import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import { requireDatabase } from '../middleware/db.middleware.js';
import {
  createCommentReply,
  updateComment,
  deleteComment,
} from '../controllers/comment.controller.js';
import {
  requireCommentAccess,
  CommentAction,
} from '../services/comment.rbac.service.js';

const router = Router();

// All comment routes require active database availability and authentication
router.use(requireDatabase);
router.use(requireAuth as any);

router.post(
  '/:commentId/replies',
  requireCommentAccess(CommentAction.REPLY_COMMENT) as any,
  createCommentReply as any
);
router.patch(
  '/:commentId',
  requireCommentAccess(CommentAction.EDIT_COMMENT) as any,
  updateComment as any
);
router.delete(
  '/:commentId',
  requireCommentAccess(CommentAction.DELETE_COMMENT) as any,
  deleteComment as any
);

export default router;
