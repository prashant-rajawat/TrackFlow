import { Project } from './project';

export type IssueType = 'BUG' | 'FEATURE' | 'TASK';
export type IssuePriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type IssueStatus = 'TODO' | 'IN_PROGRESS' | 'DONE';

export type IssueSortField =
  | 'createdAt'
  | 'updatedAt'
  | 'dueDate'
  | 'priority'
  | 'status'
  | 'issueKey'
  | 'title';

export type SortOrder = 'asc' | 'desc';

export type DueDatePreset =
  | 'overdue'
  | 'due_today'
  | 'next_7_days'
  | 'next_30_days'
  | 'no_due_date';

export type CreatedDatePreset = '' | 'today' | 'last_7_days' | 'last_30_days' | 'custom';

export interface IssueUserSummary {
  id: string;
  fullName: string;
  email: string;
  avatarUrl?: string;
}

export interface IssueProjectSummary {
  id: string;
  name: string;
  key: string;
  workspaceId: string;
}

export interface IssueWorkspaceSummary {
  id: string;
  name: string;
  slug: string;
}

export interface IssuePermissions {
  canView: boolean;
  canCreate: boolean;
  canUpdate: boolean;
  canAssign: boolean;
  canUpdateStatus: boolean;
  canUpdatePriority: boolean;
  canDelete: boolean;
  canViewComments?: boolean;
  canCreateComment?: boolean;
  canModerateComments?: boolean;
  canViewAttachments?: boolean;
  canUploadAttachments?: boolean;
  canDeleteOwnAttachment?: boolean;
  canDeleteAnyAttachment?: boolean;
}

export interface Issue {
  id: string;
  title: string;
  description: string;
  issueKey: string;
  projectId: string;
  workspaceId: string;
  reporterId: string;
  assigneeId: string | null;
  type: IssueType;
  priority: IssuePriority;
  status: IssueStatus;
  dueDate?: string | null;
  createdAt: string;
  updatedAt: string;
  reporter?: IssueUserSummary;
  assignee?: IssueUserSummary | null;
  project?: IssueProjectSummary;
  workspace?: IssueWorkspaceSummary;
}

export interface CreateIssuePayload {
  title: string;
  description: string;
  type: IssueType;
  priority: IssuePriority;
  status?: IssueStatus;
  assigneeId?: string | null;
  dueDate?: string | null;
}

export interface UpdateIssuePayload {
  title?: string;
  description?: string;
  type?: IssueType;
  priority?: IssuePriority;
  status?: IssueStatus;
  assigneeId?: string | null;
  dueDate?: string | null;
}

export interface ProjectWithIssuePermissions extends Project {
  currentUserProjectRole?: 'PROJECT_ADMIN' | 'DEVELOPER' | 'VIEWER';
  issuePermissions?: IssuePermissions;
}

export interface IssuePagination {
  currentPage: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface AppliedIssueFilters {
  search?: string;
  status?: IssueStatus[];
  priority?: IssuePriority[];
  type?: IssueType[];
  assigneeId?: string[];
  reporterId?: string[];
  projectId?: string[];
  dueDatePreset?: DueDatePreset;
  dueDateFrom?: string;
  dueDateTo?: string;
  createdFrom?: string;
  createdTo?: string;
}

export interface AppliedIssueSorting {
  sortBy: IssueSortField;
  sortOrder: SortOrder;
}

export interface IssueQueryParams {
  search?: string;
  status?: IssueStatus[];
  priority?: IssuePriority[];
  type?: IssueType[];
  assigneeId?: string[];
  reporterId?: string[];
  projectId?: string[];
  dueDatePreset?: DueDatePreset;
  dueDateFrom?: string;
  dueDateTo?: string;
  createdFrom?: string;
  createdTo?: string;
  sortBy?: IssueSortField;
  sortOrder?: SortOrder;
  page?: number;
  limit?: number;
}

export interface IssueQueryState {
  search: string;
  status: IssueStatus[];
  priority: IssuePriority[];
  type: IssueType[];
  assigneeId: string[];
  reporterId: string[];
  projectId: string[];
  dueDatePreset: DueDatePreset | '';
  dueDateFrom: string;
  dueDateTo: string;
  createdPreset: CreatedDatePreset;
  createdFrom: string;
  createdTo: string;
  sortBy: IssueSortField;
  sortOrder: SortOrder;
  page: number;
  limit: number;
}
