import { Response, NextFunction } from 'express';
import { AttachmentModelAdapter, IAttachment } from '../models/Attachment.js';
import {
  IssueAction,
  IssueAuthorizedRequest,
  IssueRBACService,
  isValidEntityId,
} from './issue.rbac.service.js';
import type { IssuePermissions } from './permission.service.js';

export enum AttachmentAction {
  VIEW_ATTACHMENT = 'VIEW_ATTACHMENT',
  UPLOAD_ATTACHMENT = 'UPLOAD_ATTACHMENT',
  DELETE_ATTACHMENT = 'DELETE_ATTACHMENT',
}

export interface AttachmentAuthorizedRequest extends IssueAuthorizedRequest {
  attachment?: IAttachment;
}

export class AttachmentRBACService {
  static async authorizeAttachmentAccess(
    userId: string,
    attachmentId: string,
    action: AttachmentAction
  ): Promise<{
    authorized: boolean;
    statusCode?: number;
    message?: string;
    attachment?: IAttachment;
    issue?: any;
    project?: any;
    workspaceMember?: any;
    projectMember?: any;
    permissions?: IssuePermissions;
  }> {
    if (!isValidEntityId(attachmentId, 'att')) {
      return { authorized: false, statusCode: 400, message: 'Invalid attachment ID format.' };
    }

    const attachment = await AttachmentModelAdapter.findById(attachmentId);
    if (!attachment) {
      return { authorized: false, statusCode: 404, message: 'Attachment not found.' };
    }

    const issueAuth = await IssueRBACService.authorizeIssueAccess(
      userId,
      attachment.issueId,
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
      attachment.projectId !== issueAuth.issue.projectId ||
      attachment.workspaceId !== issueAuth.issue.workspaceId
    ) {
      return {
        authorized: false,
        statusCode: 403,
        message: 'Attachment project/workspace mismatch.',
      };
    }

    const permissions = issueAuth.permissions;

    if (action === AttachmentAction.VIEW_ATTACHMENT) {
      if (!permissions.canViewAttachments) {
        return { authorized: false, statusCode: 403, message: 'Permission denied.' };
      }
    }

    if (action === AttachmentAction.UPLOAD_ATTACHMENT) {
      if (!permissions.canUploadAttachments) {
        return {
          authorized: false,
          statusCode: 403,
          message: 'Viewers cannot upload attachments.',
        };
      }
    }

    if (action === AttachmentAction.DELETE_ATTACHMENT) {
      const isUploader = attachment.uploadedBy === userId;
      if (permissions.canDeleteAnyAttachment) {
        // PROJECT_ADMIN (and non-viewer workspace admins if project admin)
      } else if (permissions.canDeleteOwnAttachment) {
        if (!isUploader) {
          return {
            authorized: false,
            statusCode: 403,
            message: 'Developers can only delete attachments they uploaded.',
          };
        }
      } else {
        return {
          authorized: false,
          statusCode: 403,
          message: 'Viewers cannot delete attachments.',
        };
      }
    }

    return {
      authorized: true,
      attachment,
      issue: issueAuth.issue,
      project: issueAuth.project,
      workspaceMember: issueAuth.workspaceMember,
      projectMember: issueAuth.projectMember,
      permissions,
    };
  }
}

export const requireIssueAttachmentUploadAccess = () => {
  return async (req: IssueAuthorizedRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user || !req.user.id) {
        return res.status(401).json({ success: false, message: 'Authentication required.' });
      }
      if (!req.issuePermissions?.canUploadAttachments) {
        return res.status(403).json({
          success: false,
          message: 'Viewers have read-only access and cannot upload attachments.',
        });
      }
      next();
    } catch (err: any) {
      next(err);
    }
  };
};

export const requireAttachmentAccess = (action: AttachmentAction) => {
  return async (req: AttachmentAuthorizedRequest, res: Response, next: NextFunction) => {
    try {
      const attachmentId = req.params.attachmentId;
      if (!req.user || !req.user.id) {
        return res.status(401).json({ success: false, message: 'Authentication required.' });
      }

      const authResult = await AttachmentRBACService.authorizeAttachmentAccess(
        req.user.id,
        attachmentId,
        action
      );

      if (!authResult.authorized) {
        return res.status(authResult.statusCode || 403).json({
          success: false,
          message: authResult.message || 'Permission denied.',
        });
      }

      req.attachment = authResult.attachment;
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
