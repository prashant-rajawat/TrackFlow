import { Response, NextFunction } from 'express';
import { updateMemberRoleSchema } from '../validators/workspace.validator.js';
import { WorkspaceMemberModelAdapter } from '../models/WorkspaceMember.js';
import { WorkspaceModelAdapter } from '../models/Workspace.js';
import { WorkspaceAuthorizedRequest, RBACService } from '../services/rbac.service.js';

export const listMembers = async (
  req: WorkspaceAuthorizedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const workspaceId = req.workspace!.id!;
    const members = await WorkspaceMemberModelAdapter.findByWorkspace(workspaceId);

    return res.status(200).json({
      success: true,
      data: {
        members,
      },
    });
  } catch (error: any) {
    next(error);
  }
};

export const updateMemberRole = async (
  req: WorkspaceAuthorizedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { role } = updateMemberRoleSchema.parse(req.body);
    const workspaceId = req.workspace!.id!;
    const targetUserId = req.params.userId;
    const actorUserId = req.user!.id!;
    const actorRole = req.workspaceMember!.role;

    const targetMember = await WorkspaceMemberModelAdapter.findMember(workspaceId, targetUserId);
    if (!targetMember) {
      return res.status(404).json({
        success: false,
        message: 'Member not found in this workspace.',
      });
    }

    const ownerCount = await WorkspaceMemberModelAdapter.countOwners(workspaceId);

    // Check if actor has permission to modify target
    const modifyCheck = RBACService.canModifyMember(
      actorRole,
      targetMember.role,
      actorUserId,
      targetUserId,
      ownerCount
    );

    if (!modifyCheck.allowed) {
      return res.status(403).json({
        success: false,
        message: modifyCheck.reason || 'Permission denied.',
      });
    }

    // Check if actor can assign the requested role
    const assignCheck = RBACService.canAssignRole(actorRole, role);
    if (!assignCheck.allowed) {
      return res.status(403).json({
        success: false,
        message: assignCheck.reason || 'Permission denied.',
      });
    }

    const updated = await WorkspaceMemberModelAdapter.updateMemberRole(workspaceId, targetUserId, role);

    return res.status(200).json({
      success: true,
      message: `Member role updated to ${role}`,
      data: {
        member: updated,
      },
    });
  } catch (error: any) {
    next(error);
  }
};

export const removeMember = async (
  req: WorkspaceAuthorizedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const workspaceId = req.workspace!.id!;
    const targetUserId = req.params.userId;
    const actorUserId = req.user!.id!;
    const actorRole = req.workspaceMember!.role;

    const targetMember = await WorkspaceMemberModelAdapter.findMember(workspaceId, targetUserId);
    if (!targetMember) {
      return res.status(404).json({
        success: false,
        message: 'Member not found in this workspace.',
      });
    }

    const ownerCount = await WorkspaceMemberModelAdapter.countOwners(workspaceId);

    const modifyCheck = RBACService.canModifyMember(
      actorRole,
      targetMember.role,
      actorUserId,
      targetUserId,
      ownerCount
    );

    if (!modifyCheck.allowed) {
      return res.status(403).json({
        success: false,
        message: modifyCheck.reason || 'Permission denied.',
      });
    }

    await WorkspaceMemberModelAdapter.removeMember(workspaceId, targetUserId);

    return res.status(200).json({
      success: true,
      message: 'Member removed from workspace successfully.',
    });
  } catch (error: any) {
    next(error);
  }
};

export const leaveWorkspace = async (
  req: WorkspaceAuthorizedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const workspaceId = req.workspace!.id!;
    const userId = req.user!.id!;
    const currentMember = req.workspaceMember!;

    // Last owner protection
    if (currentMember.role === 'OWNER') {
      const ownerCount = await WorkspaceMemberModelAdapter.countOwners(workspaceId);
      if (ownerCount <= 1) {
        return res.status(400).json({
          success: false,
          message:
            'You are the only owner of this workspace. You must transfer ownership to another member or delete the workspace before leaving.',
        });
      }
    }

    await WorkspaceMemberModelAdapter.removeMember(workspaceId, userId);

    return res.status(200).json({
      success: true,
      message: 'You have left the workspace.',
    });
  } catch (error: any) {
    next(error);
  }
};

export const initiateOwnershipTransfer = async (
  req: WorkspaceAuthorizedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const workspace = req.workspace!;
    const actorRole = req.workspaceMember!.role;
    if (actorRole !== 'OWNER') {
      return res.status(403).json({
        success: false,
        message: 'Only the current workspace owner can initiate ownership transfer.',
      });
    }

    const { recipientUserId } = req.body;
    if (!recipientUserId) {
      return res.status(400).json({
        success: false,
        message: 'Recipient user ID is required.',
      });
    }

    if (recipientUserId === workspace.ownerId.toString()) {
      return res.status(400).json({
        success: false,
        message: 'You are already the owner of this workspace.',
      });
    }

    const recipientMember = await WorkspaceMemberModelAdapter.findMember(workspace.id!, recipientUserId);
    if (!recipientMember) {
      return res.status(404).json({
        success: false,
        message: 'Recipient must be an existing member of this workspace.',
      });
    }

    await WorkspaceModelAdapter.setPendingTransfer(workspace.id!, recipientUserId);

    return res.status(200).json({
      success: true,
      message: 'Ownership transfer initiated. Waiting for recipient acceptance.',
      data: {
        pendingOwnerId: recipientUserId,
      },
    });
  } catch (error: any) {
    next(error);
  }
};

export const acceptOwnershipTransfer = async (
  req: WorkspaceAuthorizedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const workspace = req.workspace!;
    const userId = req.user!.id!;

    if (!workspace.pendingOwnerId || workspace.pendingOwnerId.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: 'No pending ownership transfer found for your account.',
      });
    }

    const previousOwnerId = workspace.ownerId.toString();

    // Atomically transfer ownership across membership and workspace records
    await WorkspaceMemberModelAdapter.updateMemberRole(workspace.id!, previousOwnerId, 'ADMIN');
    await WorkspaceMemberModelAdapter.updateMemberRole(workspace.id!, userId, 'OWNER');
    await WorkspaceModelAdapter.transferOwnership(workspace.id!, userId);

    return res.status(200).json({
      success: true,
      message: 'Ownership transfer accepted successfully. You are now the workspace owner.',
    });
  } catch (error: any) {
    next(error);
  }
};

export const cancelOwnershipTransfer = async (
  req: WorkspaceAuthorizedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const workspace = req.workspace!;
    const actorRole = req.workspaceMember!.role;
    const userId = req.user!.id!;

    if (actorRole !== 'OWNER' && workspace.pendingOwnerId?.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized to cancel this transfer.',
      });
    }

    await WorkspaceModelAdapter.setPendingTransfer(workspace.id!, null);

    return res.status(200).json({
      success: true,
      message: 'Ownership transfer canceled.',
    });
  } catch (error: any) {
    next(error);
  }
};
