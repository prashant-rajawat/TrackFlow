import mongoose from 'mongoose';
import { getActiveStorageMode } from '../config/db.js';
import type { WorkspaceRole } from '../models/WorkspaceMember.js';
import type { ProjectRole } from '../models/ProjectMember.js';

export interface IssuePermissions {
  canView: boolean;
  canCreate: boolean;
  canUpdate: boolean;
  canAssign: boolean;
  canUpdateStatus: boolean;
  canUpdatePriority: boolean;
  canDelete: boolean;
  canViewComments: boolean;
  canCreateComment: boolean;
  canModerateComments: boolean;
  canViewAttachments: boolean;
  canUploadAttachments: boolean;
  canDeleteOwnAttachment: boolean;
  canDeleteAnyAttachment: boolean;
}

export interface ProjectPermissions {
  canView: boolean;
  canUpdate: boolean;
  canArchiveRestore: boolean;
  canDelete: boolean;
  canManageMembers: boolean;
}

export const isValidEntityId = (id: string | undefined, expectedPrefix?: string): boolean => {
  if (!id || typeof id !== 'string') return false;
  const trimmed = id.trim();
  if (!trimmed) return false;

  const mode = getActiveStorageMode();
  if (mode === 'mongodb') {
    return mongoose.Types.ObjectId.isValid(trimmed);
  }

  // In memory/test mode, allow valid 24-hex ObjectIds or structured memory IDs (e.g. proj_..., iss_..., usr_..., att_...)
  if (mongoose.Types.ObjectId.isValid(trimmed)) return true;
  if (expectedPrefix && new RegExp(`^${expectedPrefix}_[a-zA-Z0-9_]+$`).test(trimmed)) return true;
  if (!expectedPrefix && /^[a-zA-Z]+_[a-zA-Z0-9_]+$/.test(trimmed)) return true;
  return false;
};

/**
 * Canonical Issue, Comment, and Attachment permission matrix.
 * Preserves Phase 4 & Phase 6 rules while adding Phase 8 attachment controls:
 * - Any workspace VIEWER or project VIEWER is strictly read-only.
 * - PROJECT_ADMIN has full issue, comment moderation, and any-attachment delete rights.
 * - DEVELOPER can create/edit/assign/transition issues, create/edit/delete own comments,
 *   upload attachments, and delete only their own attachments.
 */
export const computeIssuePermissions = (
  workspaceRole: WorkspaceRole,
  projectRole: ProjectRole
): IssuePermissions => {
  if (workspaceRole === 'VIEWER' || projectRole === 'VIEWER') {
    return {
      canView: true,
      canCreate: false,
      canUpdate: false,
      canAssign: false,
      canUpdateStatus: false,
      canUpdatePriority: false,
      canDelete: false,
      canViewComments: true,
      canCreateComment: false,
      canModerateComments: false,
      canViewAttachments: true,
      canUploadAttachments: false,
      canDeleteOwnAttachment: false,
      canDeleteAnyAttachment: false,
    };
  }

  if (projectRole === 'PROJECT_ADMIN') {
    return {
      canView: true,
      canCreate: true,
      canUpdate: true,
      canAssign: true,
      canUpdateStatus: true,
      canUpdatePriority: true,
      canDelete: true,
      canViewComments: true,
      canCreateComment: true,
      canModerateComments: true,
      canViewAttachments: true,
      canUploadAttachments: true,
      canDeleteOwnAttachment: true,
      canDeleteAnyAttachment: true,
    };
  }

  // DEVELOPER
  return {
    canView: true,
    canCreate: true,
    canUpdate: true,
    canAssign: true,
    canUpdateStatus: true,
    canUpdatePriority: true,
    canDelete: false,
    canViewComments: true,
    canCreateComment: true,
    canModerateComments: false,
    canViewAttachments: true,
    canUploadAttachments: true,
    canDeleteOwnAttachment: true,
    canDeleteAnyAttachment: false,
  };
};

/**
 * Canonical Project permission resolver reflecting ProjectRBACService rules:
 * - Workspace VIEWER is read-only.
 * - Workspace OWNER/ADMIN can update/archive/manage members; OWNER or project creator can delete.
 * - Workspace MEMBER uses their ProjectMember role (PROJECT_ADMIN full; DEVELOPER update/archive per Phase 3,
 *   unless not a member; VIEWER read-only).
 */
export const computeProjectPermissions = (params: {
  workspaceRole: WorkspaceRole;
  projectRole?: ProjectRole | null;
  isProjectCreator: boolean;
  visibility: 'PRIVATE' | 'WORKSPACE';
}): ProjectPermissions => {
  const { workspaceRole, projectRole, isProjectCreator, visibility } = params;

  if (workspaceRole === 'VIEWER') {
    const canView = visibility === 'WORKSPACE' || !!projectRole;
    return {
      canView,
      canUpdate: false,
      canArchiveRestore: false,
      canDelete: false,
      canManageMembers: false,
    };
  }

  if (workspaceRole === 'OWNER' || workspaceRole === 'ADMIN') {
    return {
      canView: true,
      canUpdate: true,
      canArchiveRestore: true,
      canDelete: workspaceRole === 'OWNER' || isProjectCreator,
      canManageMembers: true,
    };
  }

  // Workspace MEMBER
  if (!projectRole) {
    return {
      canView: visibility === 'WORKSPACE',
      canUpdate: false,
      canArchiveRestore: false,
      canDelete: false,
      canManageMembers: false,
    };
  }

  if (projectRole === 'VIEWER') {
    return {
      canView: true,
      canUpdate: false,
      canArchiveRestore: false,
      canDelete: false,
      canManageMembers: false,
    };
  }

  if (projectRole === 'PROJECT_ADMIN') {
    return {
      canView: true,
      canUpdate: true,
      canArchiveRestore: true,
      canDelete: true,
      canManageMembers: true,
    };
  }

  // Project DEVELOPER inside workspace MEMBER
  return {
    canView: true,
    canUpdate: true,
    canArchiveRestore: true,
    canDelete: isProjectCreator,
    canManageMembers: false,
  };
};
