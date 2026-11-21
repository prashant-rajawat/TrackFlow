import { Response, NextFunction } from 'express';
import { WorkspaceMemberModelAdapter, WorkspaceRole } from '../models/WorkspaceMember.js';
import { ProjectModelAdapter, IProject } from '../models/Project.js';
import { ProjectMemberModelAdapter, IProjectMember } from '../models/ProjectMember.js';
import { AuthenticatedRequest } from '../middleware/auth.middleware.js';
import {
  ProjectPermissions,
  computeProjectPermissions,
  isValidEntityId,
} from './permission.service.js';

export type { ProjectPermissions };

export interface ProjectAuthorizedRequest extends AuthenticatedRequest {
  workspaceMember?: {
    role: WorkspaceRole;
    workspaceId: string;
    userId: string;
  };
  project?: IProject;
  projectMember?: IProjectMember;
  projectPermissions?: ProjectPermissions;
}

export enum ProjectAction {
  VIEW_PROJECT = 'VIEW_PROJECT',
  UPDATE_PROJECT = 'UPDATE_PROJECT',
  ARCHIVE_RESTORE = 'ARCHIVE_RESTORE',
  DELETE_PROJECT = 'DELETE_PROJECT',
  MANAGE_MEMBERS = 'MANAGE_MEMBERS',
}

export class ProjectRBACService {
  static async authorizeProjectAccess(
    userId: string,
    projectId: string,
    action: ProjectAction
  ): Promise<{
    authorized: boolean;
    statusCode?: number;
    message?: string;
    project?: IProject;
    workspaceMember?: any;
    projectMember?: any;
    permissions?: ProjectPermissions;
  }> {
    if (!isValidEntityId(projectId, 'proj')) {
      return { authorized: false, statusCode: 400, message: 'Invalid project ID format.' };
    }

    const project = await ProjectModelAdapter.findById(projectId);
    if (!project) {
      return { authorized: false, statusCode: 404, message: 'Project not found.' };
    }

    const workspaceId = project.workspaceId;

    // Verify workspace membership first
    const workspaceMember = await WorkspaceMemberModelAdapter.findMember(workspaceId, userId);
    if (!workspaceMember) {
      return { authorized: false, statusCode: 403, message: 'You are not a member of the parent workspace.' };
    }

    // Find project membership if any
    const projectMember = await ProjectMemberModelAdapter.findMember(projectId, userId);
    const permissions = computeProjectPermissions({
      workspaceRole: workspaceMember.role,
      projectRole: projectMember?.role || null,
      isProjectCreator: project.createdBy.toString() === userId,
      visibility: project.visibility,
    });

    // If workspace VIEWER, read-only view access if project is workspace visible or user is project member
    if (workspaceMember.role === 'VIEWER') {
      if (action === ProjectAction.VIEW_PROJECT && permissions.canView) {
        return { authorized: true, project, workspaceMember, projectMember, permissions };
      }
      return {
        authorized: false,
        statusCode: 403,
        message: 'Workspace viewers have read-only access to permitted projects.',
      };
    }

    // If workspace OWNER or ADMIN
    if (workspaceMember.role === 'OWNER' || workspaceMember.role === 'ADMIN') {
      if (action === ProjectAction.DELETE_PROJECT && !permissions.canDelete) {
        return {
          authorized: false,
          statusCode: 403,
          message: 'Only workspace owners or project creators can delete this project.',
        };
      }
      return { authorized: true, project, workspaceMember, projectMember, permissions };
    }

    // Workspace MEMBER role
    if (workspaceMember.role === 'MEMBER') {
      if (action === ProjectAction.VIEW_PROJECT) {
        if (permissions.canView) {
          return { authorized: true, project, workspaceMember, projectMember, permissions };
        }
        return { authorized: false, statusCode: 403, message: 'Private project access restricted.' };
      }

      if (!projectMember) {
        return {
          authorized: false,
          statusCode: 403,
          message: 'You must be a project member to modify this project.',
        };
      }

      if (projectMember.role === 'VIEWER') {
        return { authorized: false, statusCode: 403, message: 'Project viewers have read-only access.' };
      }

      if (action === ProjectAction.DELETE_PROJECT && !permissions.canDelete) {
        return {
          authorized: false,
          statusCode: 403,
          message: 'Only project administrators or creators can delete this project.',
        };
      }

      if (action === ProjectAction.MANAGE_MEMBERS && !permissions.canManageMembers) {
        return {
          authorized: false,
          statusCode: 403,
          message: 'Only project administrators can manage project members.',
        };
      }

      return { authorized: true, project, workspaceMember, projectMember, permissions };
    }

    return { authorized: false, statusCode: 403, message: 'Access denied.' };
  }
}

export const requireProjectAccess = (action: ProjectAction) => {
  return async (req: ProjectAuthorizedRequest, res: Response, next: NextFunction) => {
    try {
      const projectId = req.params.projectId || req.params.id;
      if (!projectId) {
        return res.status(400).json({ success: false, message: 'Project ID is required.' });
      }

      if (!req.user || !req.user.id) {
        return res.status(401).json({ success: false, message: 'Authentication required.' });
      }

      const authResult = await ProjectRBACService.authorizeProjectAccess(req.user.id, projectId, action);
      if (!authResult.authorized) {
        return res.status(authResult.statusCode || 403).json({
          success: false,
          message: authResult.message || 'Permission denied.',
        });
      }

      req.project = authResult.project;
      req.workspaceMember = authResult.workspaceMember;
      req.projectMember = authResult.projectMember;
      req.projectPermissions = authResult.permissions;
      next();
    } catch (err: any) {
      next(err);
    }
  };
};
