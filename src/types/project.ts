import { User } from './auth';

export type ProjectStatus = 'ACTIVE' | 'ARCHIVED';
export type ProjectVisibility = 'PRIVATE' | 'WORKSPACE';
export type ProjectRole = 'PROJECT_ADMIN' | 'DEVELOPER' | 'VIEWER';

export interface ProjectPermissions {
  canView: boolean;
  canUpdate: boolean;
  canArchiveRestore: boolean;
  canDelete: boolean;
  canManageMembers: boolean;
}

export interface Project {
  id: string;
  name: string;
  key: string;
  description?: string;
  workspaceId: string;
  createdBy: string;
  leadId?: string;
  status: ProjectStatus;
  visibility: ProjectVisibility;
  startDate?: string | null;
  targetDate?: string | null;
  color: string;
  createdAt: string;
  updatedAt: string;
  lead?: {
    id: string;
    fullName: string;
    email: string;
    avatarUrl?: string;
  };
  creator?: {
    id: string;
    fullName: string;
    email: string;
  };
  memberCount?: number;
  issueCount?: number;
  isMember?: boolean;
  currentUserProjectRole?: ProjectRole | null;
  projectPermissions?: ProjectPermissions;
}

export interface ProjectMember {
  id: string;
  projectId: string;
  workspaceId: string;
  userId: string;
  role: ProjectRole;
  joinedAt: string;
  createdAt: string;
  updatedAt: string;
  user?: {
    id: string;
    fullName: string;
    email: string;
    avatarUrl?: string;
  };
}
