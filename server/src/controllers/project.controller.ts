import { Response, NextFunction } from 'express';
import { createProjectSchema, updateProjectSchema } from '../validators/project.validator.js';
import { ProjectModelAdapter } from '../models/Project.js';
import { ProjectMemberModelAdapter } from '../models/ProjectMember.js';
import { WorkspaceModelAdapter } from '../models/Workspace.js';
import { WorkspaceMemberModelAdapter } from '../models/WorkspaceMember.js';
import { IssueModelAdapter } from '../models/Issue.js';
import { CommentModelAdapter } from '../models/Comment.js';
import { ProjectAuthorizedRequest } from '../services/project.rbac.service.js';
import { computeProjectPermissions } from '../services/permission.service.js';
import { AttachmentService } from '../services/attachment.service.js';
import { AuthenticatedRequest } from '../middleware/auth.middleware.js';

export const listProjects = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const workspaceId = (req.query.workspaceId as string) || (req.headers['x-workspace-id'] as string);
    if (!workspaceId) {
      return res.status(400).json({ success: false, message: 'Workspace ID is required to list projects.' });
    }

    const userId = req.user!.id!;
    const workspaceMember = await WorkspaceMemberModelAdapter.findMember(workspaceId, userId);
    if (!workspaceMember) {
      return res.status(403).json({ success: false, message: 'You are not a member of this workspace.' });
    }

    const projects = await ProjectModelAdapter.findByWorkspace(workspaceId);

    // Attach member counts, real issue counts, and user project membership info
    const enrichedProjects = await Promise.all(
      projects.map(async (p) => {
        const [members, issueCount] = await Promise.all([
          ProjectMemberModelAdapter.findByProject(p.id!),
          IssueModelAdapter.countByProject(p.id!),
        ]);
        const myMembership = members.find((m) => m.userId === userId);
        const projectPermissions = computeProjectPermissions({
          workspaceRole: workspaceMember.role,
          projectRole: myMembership?.role || null,
          isProjectCreator: p.createdBy.toString() === userId,
          visibility: p.visibility,
        });
        return {
          ...p,
          memberCount: members.length,
          issueCount,
          isMember: !!myMembership,
          currentUserProjectRole: myMembership?.role || null,
          projectPermissions,
        };
      })
    );

    return res.status(200).json({
      success: true,
      data: {
        projects: enrichedProjects,
      },
    });
  } catch (error: any) {
    next(error);
  }
};

export const createProject = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const validated = createProjectSchema.parse(req.body);
    const userId = req.user!.id!;

    const workspace = await WorkspaceModelAdapter.findById(validated.workspaceId);
    if (!workspace) {
      return res.status(404).json({ success: false, message: 'Workspace not found.' });
    }

    const workspaceMember = await WorkspaceMemberModelAdapter.findMember(validated.workspaceId, userId);
    if (!workspaceMember) {
      return res.status(403).json({ success: false, message: 'You must be a workspace member to create projects.' });
    }

    // Viewers cannot create projects
    if (workspaceMember.role === 'VIEWER') {
      return res.status(403).json({ success: false, message: 'Workspace viewers cannot create projects.' });
    }

    // Validate leadId if explicitly provided
    const effectiveLeadId = validated.leadId || userId;
    if (validated.leadId && validated.leadId !== userId) {
      const leadMembership = await WorkspaceMemberModelAdapter.findMember(validated.workspaceId, validated.leadId);
      if (!leadMembership) {
        return res.status(400).json({
          success: false,
          message: 'Project lead must be a member of the workspace.',
        });
      }
    }

    const startDate = validated.startDate ? new Date(validated.startDate) : undefined;
    const targetDate = validated.targetDate ? new Date(validated.targetDate) : undefined;

    const project = await ProjectModelAdapter.create({
      name: validated.name,
      key: validated.key,
      description: validated.description,
      workspaceId: validated.workspaceId,
      createdBy: userId,
      leadId: effectiveLeadId,
      visibility: validated.visibility,
      startDate,
      targetDate,
      color: validated.color,
    });

    // Always add creator as PROJECT_ADMIN so creator never loses access
    await ProjectMemberModelAdapter.createMember({
      projectId: project.id!,
      workspaceId: validated.workspaceId,
      userId,
      role: 'PROJECT_ADMIN',
    });

    // If a distinct workspace member was assigned as project lead, also add them as PROJECT_ADMIN
    if (effectiveLeadId !== userId) {
      await ProjectMemberModelAdapter.createMember({
        projectId: project.id!,
        workspaceId: validated.workspaceId,
        userId: effectiveLeadId,
        role: 'PROJECT_ADMIN',
      });
    }

    const members = await ProjectMemberModelAdapter.findByProject(project.id!);
    const projectPermissions = computeProjectPermissions({
      workspaceRole: workspaceMember.role,
      projectRole: 'PROJECT_ADMIN',
      isProjectCreator: true,
      visibility: project.visibility,
    });

    return res.status(201).json({
      success: true,
      message: 'Project created successfully',
      data: {
        project: {
          ...project,
          memberCount: members.length,
          issueCount: 0,
          isMember: true,
          currentUserProjectRole: 'PROJECT_ADMIN',
          projectPermissions,
        },
      },
    });
  } catch (error: any) {
    next(error);
  }
};

export const getProject = async (req: ProjectAuthorizedRequest, res: Response, next: NextFunction) => {
  try {
    const project = req.project!;
    const userId = req.user!.id!;
    const [members, issueCount] = await Promise.all([
      ProjectMemberModelAdapter.findByProject(project.id!),
      IssueModelAdapter.countByProject(project.id!),
    ]);
    const myMembership = members.find((m) => m.userId === userId);
    const projectPermissions =
      req.projectPermissions ||
      computeProjectPermissions({
        workspaceRole: req.workspaceMember!.role,
        projectRole: myMembership?.role || null,
        isProjectCreator: project.createdBy.toString() === userId,
        visibility: project.visibility,
      });

    return res.status(200).json({
      success: true,
      data: {
        project: {
          ...project,
          memberCount: members.length,
          issueCount,
          isMember: !!myMembership,
          currentUserProjectRole: myMembership?.role || null,
          projectPermissions,
        },
      },
    });
  } catch (error: any) {
    next(error);
  }
};

export const updateProject = async (req: ProjectAuthorizedRequest, res: Response, next: NextFunction) => {
  try {
    const validated = updateProjectSchema.parse(req.body);
    const projectId = req.project!.id!;
    const userId = req.user!.id!;

    if (validated.leadId) {
      const leadMembership = await WorkspaceMemberModelAdapter.findMember(req.project!.workspaceId, validated.leadId);
      if (!leadMembership) {
        return res.status(400).json({
          success: false,
          message: 'Project lead must be a member of the workspace.',
        });
      }
    }

    const startDate = validated.startDate !== undefined ? (validated.startDate ? new Date(validated.startDate) : null) : undefined;
    const targetDate = validated.targetDate !== undefined ? (validated.targetDate ? new Date(validated.targetDate) : null) : undefined;

    const updatePayload: any = { ...validated };
    if (startDate !== undefined) updatePayload.startDate = startDate;
    if (targetDate !== undefined) updatePayload.targetDate = targetDate;

    const updated = await ProjectModelAdapter.update(projectId, updatePayload);
    if (!updated) {
      return res.status(404).json({ success: false, message: 'Project not found.' });
    }

    const [members, issueCount] = await Promise.all([
      ProjectMemberModelAdapter.findByProject(projectId),
      IssueModelAdapter.countByProject(projectId),
    ]);
    const myMembership = members.find((m) => m.userId === userId);
    const projectPermissions =
      req.projectPermissions ||
      computeProjectPermissions({
        workspaceRole: req.workspaceMember!.role,
        projectRole: myMembership?.role || null,
        isProjectCreator: updated.createdBy.toString() === userId,
        visibility: updated.visibility,
      });

    return res.status(200).json({
      success: true,
      message: 'Project updated successfully',
      data: {
        project: {
          ...updated,
          memberCount: members.length,
          issueCount,
          isMember: !!myMembership,
          currentUserProjectRole: myMembership?.role || null,
          projectPermissions,
        },
      },
    });
  } catch (error: any) {
    next(error);
  }
};

export const archiveProject = async (req: ProjectAuthorizedRequest, res: Response, next: NextFunction) => {
  try {
    const projectId = req.project!.id!;
    const updated = await ProjectModelAdapter.update(projectId, { status: 'ARCHIVED' });

    return res.status(200).json({
      success: true,
      message: 'Project archived successfully',
      data: { project: updated },
    });
  } catch (error: any) {
    next(error);
  }
};

export const restoreProject = async (req: ProjectAuthorizedRequest, res: Response, next: NextFunction) => {
  try {
    const projectId = req.project!.id!;
    const updated = await ProjectModelAdapter.update(projectId, { status: 'ACTIVE' });

    return res.status(200).json({
      success: true,
      message: 'Project restored successfully',
      data: { project: updated },
    });
  } catch (error: any) {
    next(error);
  }
};

export const deleteProject = async (req: ProjectAuthorizedRequest, res: Response, next: NextFunction) => {
  try {
    const projectId = req.project!.id!;

    // Cascade delete project attachments, comments, issues & members
    await AttachmentService.cascadeDeleteByProject(projectId);
    await CommentModelAdapter.deleteByProject(projectId);
    await IssueModelAdapter.deleteByProject(projectId);
    await ProjectMemberModelAdapter.deleteByProject(projectId);

    // Delete project
    await ProjectModelAdapter.delete(projectId);

    return res.status(200).json({
      success: true,
      message: 'Project deleted successfully',
    });
  } catch (error: any) {
    next(error);
  }
};
