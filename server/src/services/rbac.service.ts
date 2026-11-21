import { Response, NextFunction } from 'express';
import { WorkspaceRole, WorkspaceMemberModelAdapter, IWorkspaceMember } from '../models/WorkspaceMember.js';
import { WorkspaceModelAdapter, IWorkspace } from '../models/Workspace.js';
import { AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { isValidEntityId } from './permission.service.js';

export interface WorkspaceAuthorizedRequest extends AuthenticatedRequest {
  workspace?: IWorkspace;
  workspaceMember?: IWorkspaceMember;
}

export enum WorkspaceAction {
  VIEW_WORKSPACE = 'VIEW_WORKSPACE',
  UPDATE_WORKSPACE = 'UPDATE_WORKSPACE',
  DELETE_WORKSPACE = 'DELETE_WORKSPACE',
  VIEW_MEMBERS = 'VIEW_MEMBERS',
  INVITE_MEMBER = 'INVITE_MEMBER',
  UPDATE_MEMBER_ROLE = 'UPDATE_MEMBER_ROLE',
  REMOVE_MEMBER = 'REMOVE_MEMBER',
  REVOKE_INVITATION = 'REVOKE_INVITATION',
  LEAVE_WORKSPACE = 'LEAVE_WORKSPACE',
}

// Declarative centralized permission matrix
const PERMISSION_MATRIX: Record<WorkspaceRole, Set<WorkspaceAction>> = {
  OWNER: new Set([
    WorkspaceAction.VIEW_WORKSPACE,
    WorkspaceAction.UPDATE_WORKSPACE,
    WorkspaceAction.DELETE_WORKSPACE,
    WorkspaceAction.VIEW_MEMBERS,
    WorkspaceAction.INVITE_MEMBER,
    WorkspaceAction.UPDATE_MEMBER_ROLE,
    WorkspaceAction.REMOVE_MEMBER,
    WorkspaceAction.REVOKE_INVITATION,
    WorkspaceAction.LEAVE_WORKSPACE,
  ]),
  ADMIN: new Set([
    WorkspaceAction.VIEW_WORKSPACE,
    WorkspaceAction.UPDATE_WORKSPACE,
    WorkspaceAction.VIEW_MEMBERS,
    WorkspaceAction.INVITE_MEMBER,
    WorkspaceAction.UPDATE_MEMBER_ROLE,
    WorkspaceAction.REMOVE_MEMBER,
    WorkspaceAction.REVOKE_INVITATION,
    WorkspaceAction.LEAVE_WORKSPACE,
  ]),
  MEMBER: new Set([
    WorkspaceAction.VIEW_WORKSPACE,
    WorkspaceAction.VIEW_MEMBERS,
    WorkspaceAction.LEAVE_WORKSPACE,
  ]),
  VIEWER: new Set([
    WorkspaceAction.VIEW_WORKSPACE,
    WorkspaceAction.VIEW_MEMBERS,
    WorkspaceAction.LEAVE_WORKSPACE,
  ]),
};

export class RBACService {
  static canPerformAction(role: WorkspaceRole, action: WorkspaceAction): boolean {
    const rolePermissions = PERMISSION_MATRIX[role];
    if (!rolePermissions) return false;
    return rolePermissions.has(action);
  }

  static canModifyMember(
    actorRole: WorkspaceRole,
    targetRole: WorkspaceRole,
    actorUserId: string,
    targetUserId: string,
    ownerCount: number
  ): { allowed: boolean; reason?: string } {
    // 1. An actor cannot remove/modify themselves through member admin endpoints (they must use leave)
    if (actorUserId === targetUserId) {
      return {
        allowed: false,
        reason: 'You cannot modify or remove yourself through member management. Use leave workspace instead.',
      };
    }

    // 2. ADMIN restrictions:
    if (actorRole === 'ADMIN') {
      if (targetRole === 'OWNER') {
        return {
          allowed: false,
          reason: 'Workspace administrators cannot modify or remove workspace owners.',
        };
      }
      if (targetRole === 'ADMIN') {
        return {
          allowed: false,
          reason: 'Workspace administrators cannot modify or remove fellow administrators.',
        };
      }
      return { allowed: true };
    }

    // 3. MEMBER and VIEWER cannot modify anyone
    if (actorRole !== 'OWNER') {
      return {
        allowed: false,
        reason: 'Insufficient permissions. Only workspace owners and administrators can manage members.',
      };
    }

    // 4. OWNER role hierarchy: check last owner protection
    if (targetRole === 'OWNER' && ownerCount <= 1) {
      return {
        allowed: false,
        reason: 'Cannot remove or demote the sole workspace owner. Another owner must be designated first.',
      };
    }

    return { allowed: true };
  }

  static canAssignRole(
    actorRole: WorkspaceRole,
    newRole: WorkspaceRole
  ): { allowed: boolean; reason?: string } {
    if (newRole === 'OWNER' && actorRole !== 'OWNER') {
      return {
        allowed: false,
        reason: 'Only current workspace owners can designate another owner.',
      };
    }

    if (actorRole === 'OWNER') {
      return { allowed: true };
    }

    if (actorRole === 'ADMIN') {
      if (newRole === 'OWNER') {
        return {
          allowed: false,
          reason: 'Administrators cannot grant the OWNER role.',
        };
      }
      return { allowed: true };
    }

    return {
      allowed: false,
      reason: 'Only owners and administrators can assign roles.',
    };
  }
}

// Express middleware factory for RBAC authorization
export const requireWorkspaceAccess = (action: WorkspaceAction) => {
  return async (
    req: WorkspaceAuthorizedRequest,
    res: Response,
    next: NextFunction
  ) => {
    try {
      const workspaceId =
        req.params.workspaceId || (req.headers['x-workspace-id'] as string);

      if (!workspaceId) {
        return res.status(400).json({
          success: false,
          message: 'Workspace ID is required for this operation.',
        });
      }

      if (!isValidEntityId(workspaceId, 'ws')) {
        return res.status(400).json({
          success: false,
          message: 'Invalid workspace ID format.',
        });
      }

      if (!req.user || !req.user.id) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required.',
        });
      }

      const workspace = await WorkspaceModelAdapter.findById(workspaceId);
      if (!workspace) {
        return res.status(404).json({
          success: false,
          message: 'Workspace not found.',
        });
      }

      const member = await WorkspaceMemberModelAdapter.findMember(
        workspaceId,
        req.user.id
      );

      if (!member) {
        return res.status(403).json({
          success: false,
          message: 'You are not a member of this workspace.',
        });
      }

      const isPermitted = RBACService.canPerformAction(member.role, action);
      if (!isPermitted) {
        return res.status(403).json({
          success: false,
          message: `Insufficient permissions. The '${member.role}' role cannot perform this action.`,
        });
      }

      req.workspace = workspace;
      req.workspaceMember = member;
      next();
    } catch (err: any) {
      next(err);
    }
  };
};
