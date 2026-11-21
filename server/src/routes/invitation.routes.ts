import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import { requireDatabase } from '../middleware/db.middleware.js';
import { invitationRateLimiter } from '../middleware/rateLimit.middleware.js';
import {
  getInvitationByToken,
  acceptInvitation,
  declineInvitation,
} from '../controllers/invitation.controller.js';

const router = Router();

router.use(requireDatabase);

// Public route to view invitation preview
router.get('/:token', getInvitationByToken as any);

// Protected routes to accept/decline
router.post('/:token/accept', requireAuth as any, invitationRateLimiter as any, acceptInvitation as any);
router.post('/:token/decline', requireAuth as any, invitationRateLimiter as any, declineInvitation as any);

export default router;
