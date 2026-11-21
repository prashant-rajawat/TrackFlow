import { IProject, ProjectModelAdapter } from '../models/Project.js';
import { ProjectMemberModelAdapter } from '../models/ProjectMember.js';
import { WorkspaceModelAdapter } from '../models/Workspace.js';
import { WorkspaceMemberModelAdapter } from '../models/WorkspaceMember.js';
import { UserModelAdapter } from '../models/User.js';
import {
  IssueModelAdapter,
  IIssue,
  IIssueUserSummary,
  IssuePriority,
  IssueStatus,
} from '../models/Issue.js';
import { CommentModelAdapter } from '../models/Comment.js';
import { AttachmentService } from './attachment.service.js';
import { CreateIssueInput, UpdateIssueInput } from '../validators/issue.validator.js';
import {
  ParsedIssueQuery,
  AppliedIssueFilters,
  AppliedIssueSorting,
  IssuePaginationMeta,
  extractAppliedFilters,
  parseDateRangeStart,
  parseDateRangeEnd,
} from '../validators/issueQuery.validator.js';
import { isValidEntityId, computeIssuePermissions, IssuePermissions } from './issue.rbac.service.js';

const createServiceError = (message: string, statusCode: number) => {
  const err: any = new Error(message);
  err.statusCode = statusCode;
  return err;
};

const buildPaginationMeta = (
  page: number,
  limit: number,
  totalItems: number
): IssuePaginationMeta => {
  const totalPages = totalItems === 0 ? 0 : Math.ceil(totalItems / limit);
  return {
    currentPage: page,
    pageSize: limit,
    totalItems,
    totalPages,
    hasNextPage: totalPages > 0 && page < totalPages,
    hasPreviousPage: page > 1 && totalItems > 0,
  };
};

export class IssueService {
  static async validateAssignee(
    assigneeId: string | null | undefined,
    projectId: string,
    workspaceId: string
  ): Promise<string | null> {
    if (assigneeId === undefined || assigneeId === null || assigneeId === '') {
      return null;
    }

    if (!isValidEntityId(assigneeId, 'usr')) {
      throw createServiceError('Invalid assignee ID format.', 400);
    }

    const user = await UserModelAdapter.findById(assigneeId);
    if (!user) {
      throw createServiceError('Selected assignee does not exist.', 400);
    }

    const workspaceMember = await WorkspaceMemberModelAdapter.findMember(workspaceId, assigneeId);
    if (!workspaceMember) {
      throw createServiceError('Assignee must be a member of the workspace.', 400);
    }

    const projectMember = await ProjectMemberModelAdapter.findMember(projectId, assigneeId);
    if (!projectMember) {
      throw createServiceError('Assignee must be a member of this project.', 400);
    }

    return assigneeId;
  }

  private static parseDueDate(rawDueDate: string | null | undefined): Date | null | undefined {
    if (rawDueDate === undefined) return undefined;
    if (rawDueDate === null || rawDueDate === '') return null;
    return new Date(rawDueDate);
  }

  private static async collectMembersForProjects(projectIds: string[]): Promise<IIssueUserSummary[]> {
    const memberMap = new Map<string, IIssueUserSummary>();
    const lists = await Promise.all(
      projectIds.map((pid) => ProjectMemberModelAdapter.findByProject(pid))
    );
    for (const members of lists) {
      for (const m of members) {
        if (m.user && !memberMap.has(m.user.id)) {
          memberMap.set(m.user.id, {
            id: m.user.id,
            fullName: m.user.fullName,
            email: m.user.email,
            avatarUrl: m.user.avatarUrl || '',
          });
        }
      }
    }
    return Array.from(memberMap.values()).sort((a, b) =>
      a.fullName.localeCompare(b.fullName)
    );
  }

  static async createIssue(params: {
    project: IProject;
    reporterId: string;
    input: CreateIssueInput;
  }): Promise<IIssue> {
    const { project, reporterId, input } = params;
    const projectId = project.id!;
    const workspaceId = project.workspaceId;

    const validatedAssigneeId = await this.validateAssignee(
      input.assigneeId ?? null,
      projectId,
      workspaceId
    );

    const parsedDueDate = this.parseDueDate(input.dueDate);

    // Retry loop to guarantee atomic unique issueKey even under concurrent creation
    const maxAttempts = 3;
    let lastError: any;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const seq = await ProjectModelAdapter.incrementIssueSequence(projectId);
      if (!seq) {
        throw createServiceError('Project not found.', 404);
      }

      try {
        const created = await IssueModelAdapter.create({
          title: input.title,
          description: input.description,
          issueKey: seq.issueKey,
          projectId,
          workspaceId,
          reporterId,
          assigneeId: validatedAssigneeId,
          type: input.type,
          priority: input.priority,
          status: input.status,
          dueDate: parsedDueDate ?? null,
        });
        return created;
      } catch (err: any) {
        lastError = err;
        if (err.code === 11000 && attempt < maxAttempts - 1) {
          continue;
        }
        throw err;
      }
    }

    throw lastError || createServiceError('Failed to allocate unique issue key.', 409);
  }

  static async listProjectIssues(
    project: IProject,
    query: ParsedIssueQuery
  ): Promise<{
    issues: IIssue[];
    pagination: IssuePaginationMeta;
    appliedFilters: AppliedIssueFilters;
    appliedSorting: AppliedIssueSorting;
    members: IIssueUserSummary[];
  }> {
    const projectId = project.id!;

    const [{ issues, totalItems }, members] = await Promise.all([
      IssueModelAdapter.queryIssues({
        workspaceId: project.workspaceId,
        allowedProjectIds: [projectId],
        search: query.search,
        status: query.status,
        priority: query.priority,
        type: query.type,
        assigneeId: query.assigneeId,
        reporterId: query.reporterId,
        dueDatePreset: query.dueDatePreset,
        dueDateFrom: query.dueDateFrom ? parseDateRangeStart(query.dueDateFrom) : undefined,
        dueDateTo: query.dueDateTo ? parseDateRangeEnd(query.dueDateTo) : undefined,
        createdFrom: query.createdFrom ? parseDateRangeStart(query.createdFrom) : undefined,
        createdTo: query.createdTo ? parseDateRangeEnd(query.createdTo) : undefined,
        sortBy: query.sortBy,
        sortOrder: query.sortOrder,
        page: query.page,
        limit: query.limit,
      }),
      this.collectMembersForProjects([projectId]),
    ]);

    const appliedFilters = extractAppliedFilters(query);
    delete appliedFilters.projectId;

    return {
      issues,
      pagination: buildPaginationMeta(query.page, query.limit, totalItems),
      appliedFilters,
      appliedSorting: {
        sortBy: query.sortBy,
        sortOrder: query.sortOrder,
      },
      members,
    };
  }

  static async listWorkspaceIssues(params: {
    userId: string;
    workspaceId: string;
    query: ParsedIssueQuery;
  }): Promise<{
    issues: IIssue[];
    projects: Array<IProject & { currentUserProjectRole: string; issuePermissions: IssuePermissions }>;
    pagination: IssuePaginationMeta;
    appliedFilters: AppliedIssueFilters;
    appliedSorting: AppliedIssueSorting;
    members: IIssueUserSummary[];
  }> {
    const { userId, workspaceId, query } = params;

    if (!isValidEntityId(workspaceId, 'ws')) {
      throw createServiceError('Invalid workspace ID format.', 400);
    }

    const workspace = await WorkspaceModelAdapter.findById(workspaceId);
    if (!workspace) {
      throw createServiceError('Workspace not found.', 404);
    }

    const workspaceMember = await WorkspaceMemberModelAdapter.findMember(workspaceId, userId);
    if (!workspaceMember) {
      throw createServiceError('You are not a member of this workspace.', 403);
    }

    const workspaceProjects = await ProjectModelAdapter.findByWorkspace(workspaceId);
    const accessibleProjects: Array<
      IProject & { currentUserProjectRole: string; issuePermissions: IssuePermissions }
    > = [];

    for (const proj of workspaceProjects) {
      const pm = await ProjectMemberModelAdapter.findMember(proj.id!, userId);
      if (pm) {
        accessibleProjects.push({
          ...proj,
          currentUserProjectRole: pm.role,
          issuePermissions: computeIssuePermissions(workspaceMember.role, pm.role),
        });
      }
    }

    const accessibleSet = new Set(accessibleProjects.map((p) => p.id!));
    let scopedProjectIds: string[] = accessibleProjects.map((p) => p.id!);

    if (query.projectId && query.projectId.length > 0) {
      for (const pid of query.projectId) {
        const targetProject = await ProjectModelAdapter.findById(pid);
        if (!targetProject) {
          throw createServiceError('Project not found.', 404);
        }
        if (targetProject.workspaceId !== workspaceId) {
          throw createServiceError('Project does not belong to the requested workspace.', 403);
        }
        if (!accessibleSet.has(pid)) {
          throw createServiceError(
            'You must be an active member of this project to access its issues.',
            403
          );
        }
      }
      scopedProjectIds = query.projectId;
    }

    const appliedFilters = extractAppliedFilters(query);
    const appliedSorting: AppliedIssueSorting = {
      sortBy: query.sortBy,
      sortOrder: query.sortOrder,
    };

    if (scopedProjectIds.length === 0) {
      return {
        issues: [],
        projects: [],
        pagination: buildPaginationMeta(query.page, query.limit, 0),
        appliedFilters,
        appliedSorting,
        members: [],
      };
    }

    const [{ issues, totalItems }, members] = await Promise.all([
      IssueModelAdapter.queryIssues({
        workspaceId,
        allowedProjectIds: scopedProjectIds,
        search: query.search,
        status: query.status,
        priority: query.priority,
        type: query.type,
        assigneeId: query.assigneeId,
        reporterId: query.reporterId,
        dueDatePreset: query.dueDatePreset,
        dueDateFrom: query.dueDateFrom ? parseDateRangeStart(query.dueDateFrom) : undefined,
        dueDateTo: query.dueDateTo ? parseDateRangeEnd(query.dueDateTo) : undefined,
        createdFrom: query.createdFrom ? parseDateRangeStart(query.createdFrom) : undefined,
        createdTo: query.createdTo ? parseDateRangeEnd(query.createdTo) : undefined,
        sortBy: query.sortBy,
        sortOrder: query.sortOrder,
        page: query.page,
        limit: query.limit,
      }),
      this.collectMembersForProjects(scopedProjectIds),
    ]);

    return {
      issues,
      projects: accessibleProjects,
      pagination: buildPaginationMeta(query.page, query.limit, totalItems),
      appliedFilters,
      appliedSorting,
      members,
    };
  }

  static async updateIssue(params: {
    issue: IIssue;
    input: UpdateIssueInput;
  }): Promise<IIssue> {
    const { issue, input } = params;

    let validatedAssigneeId: string | null | undefined = undefined;
    if (input.assigneeId !== undefined) {
      validatedAssigneeId = await this.validateAssignee(
        input.assigneeId,
        issue.projectId,
        issue.workspaceId
      );
    }

    const parsedDueDate = this.parseDueDate(input.dueDate);

    const updatePayload: {
      title?: string;
      description?: string;
      type?: any;
      priority?: IssuePriority;
      status?: IssueStatus;
      assigneeId?: string | null;
      dueDate?: Date | null;
    } = {};

    if (input.title !== undefined) updatePayload.title = input.title;
    if (input.description !== undefined) updatePayload.description = input.description;
    if (input.type !== undefined) updatePayload.type = input.type;
    if (input.priority !== undefined) updatePayload.priority = input.priority;
    if (input.status !== undefined) updatePayload.status = input.status;
    if (validatedAssigneeId !== undefined) updatePayload.assigneeId = validatedAssigneeId;
    if (parsedDueDate !== undefined) updatePayload.dueDate = parsedDueDate;

    const updated = await IssueModelAdapter.update(issue.id!, updatePayload);
    if (!updated) {
      throw createServiceError('Issue not found.', 404);
    }
    return updated;
  }

  static async assignIssue(issue: IIssue, assigneeId: string | null): Promise<IIssue> {
    const validatedAssigneeId = await this.validateAssignee(
      assigneeId,
      issue.projectId,
      issue.workspaceId
    );
    const updated = await IssueModelAdapter.update(issue.id!, { assigneeId: validatedAssigneeId });
    if (!updated) {
      throw createServiceError('Issue not found.', 404);
    }
    return updated;
  }

  static async updateIssueStatus(issue: IIssue, status: IssueStatus): Promise<IIssue> {
    const updated = await IssueModelAdapter.update(issue.id!, { status });
    if (!updated) {
      throw createServiceError('Issue not found.', 404);
    }
    return updated;
  }

  static async updateIssuePriority(issue: IIssue, priority: IssuePriority): Promise<IIssue> {
    const updated = await IssueModelAdapter.update(issue.id!, { priority });
    if (!updated) {
      throw createServiceError('Issue not found.', 404);
    }
    return updated;
  }

  static async deleteIssue(issueId: string): Promise<void> {
    await AttachmentService.cascadeDeleteByIssue(issueId);
    const deleted = await IssueModelAdapter.delete(issueId);
    if (!deleted) {
      throw createServiceError('Issue not found.', 404);
    }
    await CommentModelAdapter.deleteByIssue(issueId);
  }
}
