import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import { requireDatabase } from '../middleware/db.middleware.js';
import { invitationRateLimiter } from '../middleware/rateLimit.middleware.js';
import {
  createWorkspace,
  listWorkspaces,
  getWorkspace,
  updateWorkspace,
  deleteWorkspace,
} from '../controllers/workspace.controller.js';
import {
  listMembers,
  updateMemberRole,
  removeMember,
  leaveWorkspace,
  initiateOwnershipTransfer,
  acceptOwnershipTransfer,
  cancelOwnershipTransfer,
} from '../controllers/member.controller.js';
import {
  createInvitation,
  listWorkspaceInvitations,
  revokeInvitation,
} from '../controllers/invitation.controller.js';
import {
  requireWorkspaceAccess,
  WorkspaceAction,
} from '../services/rbac.service.js';

const router = Router();

// All workspace routes require database availability and authentication
router.use(requireDatabase);
router.use(requireAuth as any);

// Workspace CRUD
router.post('/', createWorkspace as any);
router.get('/', listWorkspaces as any);
router.get('/:workspaceId', requireWorkspaceAccess(WorkspaceAction.VIEW_WORKSPACE) as any, getWorkspace as any);
router.patch('/:workspaceId', requireWorkspaceAccess(WorkspaceAction.UPDATE_WORKSPACE) as any, updateWorkspace as any);
router.delete('/:workspaceId', requireWorkspaceAccess(WorkspaceAction.DELETE_WORKSPACE) as any, deleteWorkspace as any);

// Team Members & Ownership Transfer
router.get('/:workspaceId/members', requireWorkspaceAccess(WorkspaceAction.VIEW_MEMBERS) as any, listMembers as any);
router.patch('/:workspaceId/members/:userId', requireWorkspaceAccess(WorkspaceAction.UPDATE_MEMBER_ROLE) as any, updateMemberRole as any);
router.delete('/:workspaceId/members/:userId', requireWorkspaceAccess(WorkspaceAction.REMOVE_MEMBER) as any, removeMember as any);
router.post('/:workspaceId/leave', requireWorkspaceAccess(WorkspaceAction.LEAVE_WORKSPACE) as any, leaveWorkspace as any);
router.post('/:workspaceId/transfer-ownership', requireWorkspaceAccess(WorkspaceAction.VIEW_WORKSPACE) as any, initiateOwnershipTransfer as any);
router.post('/:workspaceId/transfer-ownership/accept', requireWorkspaceAccess(WorkspaceAction.VIEW_WORKSPACE) as any, acceptOwnershipTransfer as any);
router.post('/:workspaceId/transfer-ownership/cancel', requireWorkspaceAccess(WorkspaceAction.VIEW_WORKSPACE) as any, cancelOwnershipTransfer as any);

// Invitations (scoped to workspace)
router.post('/:workspaceId/invitations', invitationRateLimiter as any, requireWorkspaceAccess(WorkspaceAction.INVITE_MEMBER) as any, createInvitation as any);
router.get('/:workspaceId/invitations', requireWorkspaceAccess(WorkspaceAction.INVITE_MEMBER) as any, listWorkspaceInvitations as any);
router.delete('/:workspaceId/invitations/:invitationId', requireWorkspaceAccess(WorkspaceAction.REVOKE_INVITATION) as any, revokeInvitation as any);

export default router;
