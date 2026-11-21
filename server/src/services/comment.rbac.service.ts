import { Response, NextFunction } from 'express';
import { CommentModelAdapter, IComment } from '../models/Comment.js';
import {
  IssueAction,
  IssueAuthorizedRequest,
  IssueRBACService,
  isValidEntityId,
} from './issue.rbac.service.js';

export enum CommentAction {
  CREATE_COMMENT = 'CREATE_COMMENT',
  REPLY_COMMENT = 'REPLY_COMMENT',
  EDIT_COMMENT = 'EDIT_COMMENT',
  DELETE_COMMENT = 'DELETE_COMMENT',
}

export interface CommentAuthorizedRequest extends IssueAuthorizedRequest {
  comment?: IComment;
}

export class CommentRBACService {
  static async authorizeCommentAccess(
    userId: string,
    commentId: string,
    action: CommentAction
  ): Promise<{
    authorized: boolean;
    statusCode?: number;
    message?: string;
    comment?: IComment;
    issue?: any;
    project?: any;
    workspaceMember?: any;
    projectMember?: any;
    permissions?: any;
  }> {
    if (!isValidEntityId(commentId, 'cmt')) {
      return { authorized: false, statusCode: 400, message: 'Invalid comment ID format.' };
    }

    const comment = await CommentModelAdapter.findById(commentId);
    if (!comment) {
      return { authorized: false, statusCode: 404, message: 'Comment not found.' };
    }

    const issueAuth = await IssueRBACService.authorizeIssueAccess(
      userId,
      comment.issueId,
      IssueAction.VIEW_ISSUE
    );

    if (!issueAuth.authorized || !issueAuth.issue || !issueAuth.permissions) {
      return {
        authorized: false,
        statusCode: issueAuth.statusCode || 403,
        message: issueAuth.message || 'Permission denied.',
      };
    }

    if (
      comment.projectId !== issueAuth.issue.projectId ||
      comment.workspaceId !== issueAuth.issue.workspaceId
    ) {
      return {
        authorized: false,
        statusCode: 403,
        message: 'Comment project/workspace mismatch.',
      };
    }

    const permissions = issueAuth.permissions;

    if (!permissions.canCreateComment) {
      return {
        authorized: false,
        statusCode: 403,
        message: 'Viewers have read-only access and cannot modify comments.',
      };
    }

    const isAuthor = comment.authorId === userId;

    if (action === CommentAction.EDIT_COMMENT) {
      if (!isAuthor && !permissions.canModerateComments) {
        return {
          authorized: false,
          statusCode: 403,
          message: 'You can only edit your own comments.',
        };
      }
    }

    if (action === CommentAction.DELETE_COMMENT) {
      if (!isAuthor && !permissions.canModerateComments) {
        return {
          authorized: false,
          statusCode: 403,
          message: 'You can only delete your own comments.',
        };
      }
    }

    return {
      authorized: true,
      comment,
      issue: issueAuth.issue,
      project: issueAuth.project,
      workspaceMember: issueAuth.workspaceMember,
      projectMember: issueAuth.projectMember,
      permissions,
    };
  }
}

export const requireIssueCommentCreateAccess = () => {
  return async (req: IssueAuthorizedRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user || !req.user.id) {
        return res.status(401).json({ success: false, message: 'Authentication required.' });
      }
      if (!req.issuePermissions?.canCreateComment) {
        return res.status(403).json({
          success: false,
          message: 'Viewers cannot add comments.',
        });
      }
      next();
    } catch (err: any) {
      next(err);
    }
  };
};

export const requireCommentAccess = (action: CommentAction) => {
  return async (req: CommentAuthorizedRequest, res: Response, next: NextFunction) => {
    try {
      const commentId = req.params.commentId;
      if (!req.user || !req.user.id) {
        return res.status(401).json({ success: false, message: 'Authentication required.' });
      }

      const authResult = await CommentRBACService.authorizeCommentAccess(
        req.user.id,
        commentId,
        action
      );

      if (!authResult.authorized) {
        return res.status(authResult.statusCode || 403).json({
          success: false,
          message: authResult.message || 'Permission denied.',
        });
      }

      req.comment = authResult.comment;
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
