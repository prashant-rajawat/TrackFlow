import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import { requireDatabase } from '../middleware/db.middleware.js';
import {
  listWorkspaceIssues,
  getIssue,
  updateIssue,
  deleteIssue,
  updateIssueAssignee,
  updateIssueStatus,
  updateIssuePriority,
} from '../controllers/issue.controller.js';
import {
  requireIssueAccess,
  IssueAction,
} from '../services/issue.rbac.service.js';
import {
  listIssueComments,
  createIssueComment,
} from '../controllers/comment.controller.js';
import { requireIssueCommentCreateAccess } from '../services/comment.rbac.service.js';
import {
  listIssueAttachments,
  uploadIssueAttachments,
} from '../controllers/attachment.controller.js';
import { requireIssueAttachmentUploadAccess } from '../services/attachment.rbac.service.js';
import { parseAttachmentUpload, uploadRateLimiter } from '../middleware/upload.middleware.js';

const router = Router();

// All issue routes require active database availability and authentication
router.use(requireDatabase);
router.use(requireAuth as any);

// Workspace-scoped list across projects accessible to the authenticated user
router.get('/', listWorkspaceIssues as any);

// Single issue CRUD & quick-update endpoints
router.get('/:issueId', requireIssueAccess(IssueAction.VIEW_ISSUE) as any, getIssue as any);
router.patch('/:issueId', requireIssueAccess(IssueAction.UPDATE_ISSUE) as any, updateIssue as any);
router.delete('/:issueId', requireIssueAccess(IssueAction.DELETE_ISSUE) as any, deleteIssue as any);
router.patch('/:issueId/assignee', requireIssueAccess(IssueAction.ASSIGN_ISSUE) as any, updateIssueAssignee as any);
router.patch('/:issueId/status', requireIssueAccess(IssueAction.UPDATE_STATUS) as any, updateIssueStatus as any);
router.patch('/:issueId/priority', requireIssueAccess(IssueAction.UPDATE_PRIORITY) as any, updateIssuePriority as any);

// Issue comments & collaboration endpoints
router.get('/:issueId/comments', requireIssueAccess(IssueAction.VIEW_ISSUE) as any, listIssueComments as any);
router.post(
  '/:issueId/comments',
  requireIssueAccess(IssueAction.VIEW_ISSUE) as any,
  requireIssueCommentCreateAccess() as any,
  createIssueComment as any
);

// Issue attachments endpoints
router.get(
  '/:issueId/attachments',
  requireIssueAccess(IssueAction.VIEW_ISSUE) as any,
  listIssueAttachments as any
);
router.post(
  '/:issueId/attachments',
  requireIssueAccess(IssueAction.VIEW_ISSUE) as any,
  requireIssueAttachmentUploadAccess() as any,
  uploadRateLimiter() as any,
  parseAttachmentUpload as any,
  uploadIssueAttachments as any
);

export default router;
