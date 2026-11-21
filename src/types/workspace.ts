export type WorkspaceRole = 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER';

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  description?: string;
  ownerId: string;
  role: WorkspaceRole;
  memberCount: number;
  createdAt: string | Date;
  updatedAt: string | Date;
}

export interface WorkspaceMember {
  id: string;
  workspaceId: string;
  userId: string;
  role: WorkspaceRole;
  joinedAt: string | Date;
  createdAt: string | Date;
  updatedAt: string | Date;
  user?: {
    id: string;
    fullName: string;
    email: string;
    avatarUrl?: string;
  };
}

export type InvitationStatus = 'PENDING' | 'ACCEPTED' | 'REVOKED' | 'EXPIRED';

export interface Invitation {
  id: string;
  workspaceId: string;
  invitedEmail: string;
  inviterId: string;
  role: WorkspaceRole;
  status: InvitationStatus;
  expiresAt: string | Date;
  acceptedAt?: string | Date;
  createdAt: string | Date;
  updatedAt: string | Date;
  workspace?: {
    id: string;
    name: string;
    slug: string;
  };
  inviter?: {
    id: string;
    fullName: string;
    email: string;
  };
}
