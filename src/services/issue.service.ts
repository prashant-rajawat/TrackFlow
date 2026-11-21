import { api } from './api';
import {
  Issue,
  IssuePermissions,
  IssuePriority,
  IssueStatus,
  IssuePagination,
  AppliedIssueFilters,
  AppliedIssueSorting,
  IssueQueryParams,
  IssueUserSummary,
  CreateIssuePayload,
  UpdateIssuePayload,
  ProjectWithIssuePermissions,
} from '../types/issue';
import { Project } from '../types/project';

const appendIssueQueryParams = (params: URLSearchParams, query?: IssueQueryParams) => {
  if (!query) return;

  if (query.search && query.search.trim()) {
    params.set('search', query.search.trim());
  }
  if (query.status && query.status.length > 0) {
    params.set('status', query.status.join(','));
  }
  if (query.priority && query.priority.length > 0) {
    params.set('priority', query.priority.join(','));
  }
  if (query.type && query.type.length > 0) {
    params.set('type', query.type.join(','));
  }
  if (query.assigneeId && query.assigneeId.length > 0) {
    params.set('assigneeId', query.assigneeId.join(','));
  }
  if (query.reporterId && query.reporterId.length > 0) {
    params.set('reporterId', query.reporterId.join(','));
  }
  if (query.projectId && query.projectId.length > 0) {
    params.set('projectId', query.projectId.join(','));
  }
  if (query.dueDatePreset) {
    params.set('dueDatePreset', query.dueDatePreset);
  }
  if (query.dueDateFrom) {
    params.set('dueDateFrom', query.dueDateFrom);
  }
  if (query.dueDateTo) {
    params.set('dueDateTo', query.dueDateTo);
  }
  if (query.createdFrom) {
    params.set('createdFrom', query.createdFrom);
  }
  if (query.createdTo) {
    params.set('createdTo', query.createdTo);
  }
  if (query.sortBy) {
    params.set('sortBy', query.sortBy);
  }
  if (query.sortOrder) {
    params.set('sortOrder', query.sortOrder);
  }
  if (query.page !== undefined) {
    params.set('page', String(query.page));
  }
  if (query.limit !== undefined) {
    params.set('limit', String(query.limit));
  }
};

export interface ListProjectIssuesResponse {
  issues: Issue[];
  project: Project;
  permissions?: IssuePermissions;
  pagination?: IssuePagination;
  appliedFilters?: AppliedIssueFilters;
  appliedSorting?: AppliedIssueSorting;
  members?: IssueUserSummary[];
}

export interface ListWorkspaceIssuesResponse {
  issues: Issue[];
  projects: ProjectWithIssuePermissions[];
  pagination?: IssuePagination;
  appliedFilters?: AppliedIssueFilters;
  appliedSorting?: AppliedIssueSorting;
  members?: IssueUserSummary[];
}

export const issueService = {
  async listProjectIssues(
    projectId: string,
    query?: IssueQueryParams,
    options?: { signal?: AbortSignal }
  ): Promise<ListProjectIssuesResponse> {
    const params = new URLSearchParams();
    appendIssueQueryParams(params, query);
    const qs = params.toString();
    const endpoint = qs
      ? `/api/projects/${projectId}/issues?${qs}`
      : `/api/projects/${projectId}/issues`;

    const res = await api.get<ListProjectIssuesResponse>(endpoint, {
      signal: options?.signal,
    });
    return res.data!;
  },

  async createIssue(
    projectId: string,
    data: CreateIssuePayload
  ): Promise<{ issue: Issue; permissions?: IssuePermissions }> {
    const res = await api.post<{ issue: Issue; permissions?: IssuePermissions }>(
      `/api/projects/${projectId}/issues`,
      data
    );
    return res.data!;
  },

  async listWorkspaceIssues(
    workspaceId: string,
    projectIdOrQuery?: string | IssueQueryParams,
    options?: { signal?: AbortSignal }
  ): Promise<ListWorkspaceIssuesResponse> {
    const params = new URLSearchParams({ workspaceId });

    if (typeof projectIdOrQuery === 'string') {
      if (projectIdOrQuery) {
        params.set('projectId', projectIdOrQuery);
      }
    } else if (projectIdOrQuery) {
      appendIssueQueryParams(params, projectIdOrQuery);
    }

    const res = await api.get<ListWorkspaceIssuesResponse>(
      `/api/issues?${params.toString()}`,
      { signal: options?.signal }
    );
    return res.data!;
  },

  async getIssue(issueId: string): Promise<{
    issue: Issue;
    project: Project;
    permissions?: IssuePermissions;
  }> {
    const res = await api.get<{
      issue: Issue;
      project: Project;
      permissions?: IssuePermissions;
    }>(`/api/issues/${issueId}`);
    return res.data!;
  },

  async updateIssue(
    issueId: string,
    data: UpdateIssuePayload
  ): Promise<{ issue: Issue; permissions?: IssuePermissions }> {
    const res = await api.patch<{ issue: Issue; permissions?: IssuePermissions }>(
      `/api/issues/${issueId}`,
      data
    );
    return res.data!;
  },

  async updateAssignee(
    issueId: string,
    assigneeId: string | null
  ): Promise<{ issue: Issue; permissions?: IssuePermissions }> {
    const res = await api.patch<{ issue: Issue; permissions?: IssuePermissions }>(
      `/api/issues/${issueId}/assignee`,
      { assigneeId }
    );
    return res.data!;
  },

  async updateStatus(
    issueId: string,
    status: IssueStatus
  ): Promise<{ issue: Issue; permissions?: IssuePermissions }> {
    const res = await api.patch<{ issue: Issue; permissions?: IssuePermissions }>(
      `/api/issues/${issueId}/status`,
      { status }
    );
    return res.data!;
  },

  async updatePriority(
    issueId: string,
    priority: IssuePriority
  ): Promise<{ issue: Issue; permissions?: IssuePermissions }> {
    const res = await api.patch<{ issue: Issue; permissions?: IssuePermissions }>(
      `/api/issues/${issueId}/priority`,
      { priority }
    );
    return res.data!;
  },

  async deleteIssue(issueId: string): Promise<void> {
    await api.delete(`/api/issues/${issueId}`);
  },
};
