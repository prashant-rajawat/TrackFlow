import { Router } from 'express';
import { requireDatabase } from '../middleware/db.middleware.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import {
  AttachmentAction,
  requireAttachmentAccess,
} from '../services/attachment.rbac.service.js';
import {
  getAttachment,
  downloadAttachment,
  deleteAttachment,
} from '../controllers/attachment.controller.js';

const router = Router();

router.use(requireDatabase);
router.use(requireAuth as any);

router.get(
  '/:attachmentId',
  requireAttachmentAccess(AttachmentAction.VIEW_ATTACHMENT) as any,
  getAttachment as any
);

router.get(
  '/:attachmentId/download',
  requireAttachmentAccess(AttachmentAction.VIEW_ATTACHMENT) as any,
  downloadAttachment as any
);

router.delete(
  '/:attachmentId',
  requireAttachmentAccess(AttachmentAction.DELETE_ATTACHMENT) as any,
  deleteAttachment as any
);

export default router;
