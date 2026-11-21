import { Response, NextFunction } from 'express';
import { WorkspaceModelAdapter } from '../models/Workspace.js';
import { WorkspaceMemberModelAdapter, WorkspaceRole } from '../models/WorkspaceMember.js';
import { ProjectModelAdapter, IProject } from '../models/Project.js';
import { ProjectMemberModelAdapter, IProjectMember } from '../models/ProjectMember.js';
import { IssueModelAdapter, IIssue } from '../models/Issue.js';
import { AuthenticatedRequest } from '../middleware/auth.middleware.js';
import {
  IssuePermissions,
  computeIssuePermissions,
  isValidEntityId,
} from './permission.service.js';

export type { IssuePermissions };
export { computeIssuePermissions, isValidEntityId };

export enum IssueAction {
  VIEW_ISSUE = 'VIEW_ISSUE',
  CREATE_ISSUE = 'CREATE_ISSUE',
  UPDATE_ISSUE = 'UPDATE_ISSUE',
  ASSIGN_ISSUE = 'ASSIGN_ISSUE',
  UPDATE_STATUS = 'UPDATE_STATUS',
  UPDATE_PRIORITY = 'UPDATE_PRIORITY',
  DELETE_ISSUE = 'DELETE_ISSUE',
}

export interface IssueAuthorizedRequest extends AuthenticatedRequest {
  workspaceMember?: {
    role: WorkspaceRole;
    workspaceId: string;
    userId: string;
  };
  project?: IProject;
  projectMember?: IProjectMember;
  issue?: IIssue;
  issuePermissions?: IssuePermissions;
}

const isActionPermitted = (
  permissions: IssuePermissions,
  action: IssueAction
): { allowed: boolean; message?: string } => {
  switch (action) {
    case IssueAction.VIEW_ISSUE:
      return { allowed: permissions.canView };
    case IssueAction.CREATE_ISSUE:
      return permissions.canCreate
        ? { allowed: true }
        : { allowed: false, message: 'Viewers cannot create issues.' };
    case IssueAction.UPDATE_ISSUE:
      return permissions.canUpdate
        ? { allowed: true }
        : { allowed: false, message: 'Viewers cannot update issues.' };
    case IssueAction.ASSIGN_ISSUE:
      return permissions.canAssign
        ? { allowed: true }
        : { allowed: false, message: 'Viewers cannot assign issues.' };
    case IssueAction.UPDATE_STATUS:
      return permissions.canUpdateStatus
        ? { allowed: true }
        : { allowed: false, message: 'Viewers cannot change issue status.' };
    case IssueAction.UPDATE_PRIORITY:
      return permissions.canUpdatePriority
        ? { allowed: true }
        : { allowed: false, message: 'Viewers cannot change issue priority.' };
    case IssueAction.DELETE_ISSUE:
      return permissions.canDelete
        ? { allowed: true }
        : { allowed: false, message: 'Only project administrators can delete issues.' };
    default:
      return { allowed: false, message: 'Access denied.' };
  }
};

export class IssueRBACService {
  static async authorizeProjectIssueAccess(
    userId: string,
    projectId: string,
    action: IssueAction
  ): Promise<{
    authorized: boolean;
    statusCode?: number;
    message?: string;
    project?: IProject;
    workspaceMember?: any;
    projectMember?: IProjectMember;
    permissions?: IssuePermissions;
  }> {
    if (!isValidEntityId(projectId, 'proj')) {
      return { authorized: false, statusCode: 400, message: 'Invalid project ID format.' };
    }

    const project = await ProjectModelAdapter.findById(projectId);
    if (!project) {
      return { authorized: false, statusCode: 404, message: 'Project not found.' };
    }

    const workspace = await WorkspaceModelAdapter.findById(project.workspaceId);
    if (!workspace) {
      return { authorized: false, statusCode: 404, message: 'Parent workspace not found.' };
    }

    const workspaceMember = await WorkspaceMemberModelAdapter.findMember(project.workspaceId, userId);
    if (!workspaceMember) {
      return {
        authorized: false,
        statusCode: 403,
        message: 'You are not a member of the parent workspace.',
      };
    }

    const projectMember = await ProjectMemberModelAdapter.findMember(projectId, userId);
    if (!projectMember) {
      return {
        authorized: false,
        statusCode: 403,
        message: 'You must be an active member of this project to access its issues.',
      };
    }

    const permissions = computeIssuePermissions(workspaceMember.role, projectMember.role);
    const check = isActionPermitted(permissions, action);
    if (!check.allowed) {
      return {
        authorized: false,
        statusCode: 403,
        message: check.message || 'Permission denied.',
      };
    }

    return {
      authorized: true,
      project,
      workspaceMember,
      projectMember,
      permissions,
    };
  }

  static async authorizeIssueAccess(
    userId: string,
    issueId: string,
    action: IssueAction
  ): Promise<{
    authorized: boolean;
    statusCode?: number;
    message?: string;
    issue?: IIssue;
    project?: IProject;
    workspaceMember?: any;
    projectMember?: IProjectMember;
    permissions?: IssuePermissions;
  }> {
    if (!isValidEntityId(issueId, 'iss')) {
      return { authorized: false, statusCode: 400, message: 'Invalid issue ID format.' };
    }

    const issue = await IssueModelAdapter.findById(issueId);
    if (!issue) {
      return { authorized: false, statusCode: 404, message: 'Issue not found.' };
    }

    const project = await ProjectModelAdapter.findById(issue.projectId);
    if (!project) {
      return { authorized: false, statusCode: 404, message: 'Parent project not found.' };
    }

    if (project.workspaceId !== issue.workspaceId) {
      return {
        authorized: false,
        statusCode: 403,
        message: 'Issue workspace mismatch.',
      };
    }

    const workspace = await WorkspaceModelAdapter.findById(issue.workspaceId);
    if (!workspace) {
      return { authorized: false, statusCode: 404, message: 'Parent workspace not found.' };
    }

    const workspaceMember = await WorkspaceMemberModelAdapter.findMember(issue.workspaceId, userId);
    if (!workspaceMember) {
      return {
        authorized: false,
        statusCode: 403,
        message: 'You are not a member of this workspace.',
      };
    }

    const projectMember = await ProjectMemberModelAdapter.findMember(issue.projectId, userId);
    if (!projectMember) {
      return {
        authorized: false,
        statusCode: 403,
        message: 'You must be an active member of this project to access its issues.',
      };
    }

    const permissions = computeIssuePermissions(workspaceMember.role, projectMember.role);
    const check = isActionPermitted(permissions, action);
    if (!check.allowed) {
      return {
        authorized: false,
        statusCode: 403,
        message: check.message || 'Permission denied.',
      };
    }

    return {
      authorized: true,
      issue,
      project,
      workspaceMember,
      projectMember,
      permissions,
    };
  }
}

export const requireProjectIssueAccess = (action: IssueAction) => {
  return async (req: IssueAuthorizedRequest, res: Response, next: NextFunction) => {
    try {
      const projectId = req.params.projectId;
      if (!req.user || !req.user.id) {
        return res.status(401).json({ success: false, message: 'Authentication required.' });
      }

      const authResult = await IssueRBACService.authorizeProjectIssueAccess(
        req.user.id,
        projectId,
        action
      );

      if (!authResult.authorized) {
        return res.status(authResult.statusCode || 403).json({
          success: false,
          message: authResult.message || 'Permission denied.',
        });
      }

      req.project = authResult.project;
      req.workspaceMember = authResult.workspaceMember;
      req.projectMember = authResult.projectMember;
      req.issuePermissions = authResult.permissions;
      next();
    } catch (err: any) {
      next(err);
    }
  };
};

export const requireIssueAccess = (action: IssueAction) => {
  return async (req: IssueAuthorizedRequest, res: Response, next: NextFunction) => {
    try {
      const issueId = req.params.issueId;
      if (!req.user || !req.user.id) {
        return res.status(401).json({ success: false, message: 'Authentication required.' });
      }

      const authResult = await IssueRBACService.authorizeIssueAccess(
        req.user.id,
        issueId,
        action
      );

      if (!authResult.authorized) {
        return res.status(authResult.statusCode || 403).json({
          success: false,
          message: authResult.message || 'Permission denied.',
        });
      }

      req.issue = authResult.issue;
      req.project = authResult.project;
      req.workspaceMember = authResult.workspaceMember;
      req.projectMember = authResult.projectMember;
      req.issuePermissions = authResult.permissions;
      next();
    } catch (err: any) {
      next(err);
    }
  };
};
