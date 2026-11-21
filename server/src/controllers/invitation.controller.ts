import { Request, Response, NextFunction } from 'express';
import { inviteMemberSchema } from '../validators/workspace.validator.js';
import {
  InvitationModelAdapter,
  generateSecureToken,
} from '../models/Invitation.js';
import { WorkspaceMemberModelAdapter } from '../models/WorkspaceMember.js';
import { UserModelAdapter } from '../models/User.js';
import { WorkspaceAuthorizedRequest } from '../services/rbac.service.js';
import { AuthenticatedRequest } from '../middleware/auth.middleware.js';
import { getCanonicalClientUrl } from '../utils/url.util.js';
import { EmailService } from '../services/email.service.js';

export const createInvitation = async (
  req: WorkspaceAuthorizedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const { email, role } = inviteMemberSchema.parse(req.body);
    const workspaceId = req.workspace!.id!;
    const inviterId = req.user!.id!;
    const inviterUser = req.user!;

    // Check if the user is already a member of this workspace
    const existingUser = await UserModelAdapter.findByEmail(email);
    if (existingUser) {
      const existingMember = await WorkspaceMemberModelAdapter.findMember(
        workspaceId,
        existingUser.id!
      );
      if (existingMember) {
        return res.status(409).json({
          success: false,
          message: 'This user is already a member of this workspace.',
        });
      }
    }

    // Generate cryptographically secure token
    const plainToken = generateSecureToken();

    // Create invitation (stores sha256 tokenHash)
    const invitation = await InvitationModelAdapter.create({
      workspaceId,
      invitedEmail: email,
      inviterId,
      role,
      plainToken,
      expiresInDays: 7,
    });

    const clientUrl = getCanonicalClientUrl(req);
    const inviteUrl = `${clientUrl}/invite/${plainToken}`;

    const workspaceName = req.workspace!.name || 'Workspace';
    const inviterName = inviterUser.fullName || inviterUser.email || 'Administrator';

    const emailResult = await EmailService.sendInvitationEmail(
      email,
      workspaceName,
      inviterName,
      role,
      inviteUrl
    );

    const emailSent = emailResult.success;

    return res.status(201).json({
      success: true,
      message: emailSent
        ? `Invitation email successfully sent to ${email} (via ${emailResult.provider})`
        : 'Invitation link created successfully. You can copy and share the link with the invitee.',
      data: {
        invitation,
        inviteUrl,
        emailSent,
        deliveryProvider: emailResult.provider,
      },
    });
  } catch (error: any) {
    next(error);
  }
};

export const listWorkspaceInvitations = async (
  req: WorkspaceAuthorizedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const workspaceId = req.workspace!.id!;
    const invitations = await InvitationModelAdapter.listByWorkspace(workspaceId);

    return res.status(200).json({
      success: true,
      data: {
        invitations,
      },
    });
  } catch (error: any) {
    next(error);
  }
};

export const revokeInvitation = async (
  req: WorkspaceAuthorizedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const invitationId = req.params.invitationId;
    const inv = await InvitationModelAdapter.findById(invitationId);

    if (!inv || inv.workspaceId !== req.workspace!.id!) {
      return res.status(404).json({
        success: false,
        message: 'Invitation not found in this workspace.',
      });
    }

    if (inv.status !== 'PENDING') {
      return res.status(400).json({
        success: false,
        message: `Cannot revoke an invitation that is already ${inv.status.toLowerCase()}.`,
      });
    }

    const updated = await InvitationModelAdapter.updateStatus(invitationId, 'REVOKED');

    return res.status(200).json({
      success: true,
      message: 'Invitation revoked successfully.',
      data: {
        invitation: updated,
      },
    });
  } catch (error: any) {
    next(error);
  }
};

export const getInvitationByToken = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const token = req.params.token;
    const invitation = await InvitationModelAdapter.findByToken(token);

    if (!invitation) {
      return res.status(404).json({
        success: false,
        message: 'Invalid or unknown invitation token.',
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        invitation,
      },
    });
  } catch (error: any) {
    next(error);
  }
};

export const acceptInvitation = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const token = req.params.token;
    const user = req.user!;
    const invitation = await InvitationModelAdapter.findByToken(token);

    if (!invitation) {
      return res.status(404).json({
        success: false,
        message: 'Invitation not found or invalid token.',
      });
    }

    if (invitation.status === 'EXPIRED' || new Date(invitation.expiresAt) < new Date()) {
      await InvitationModelAdapter.updateStatus(invitation.id!, 'EXPIRED');
      return res.status(400).json({
        success: false,
        message: 'This invitation has expired. Please ask an administrator to send a new invitation.',
      });
    }

    if (invitation.status === 'REVOKED') {
      return res.status(400).json({
        success: false,
        message: 'This invitation has been revoked by an administrator.',
      });
    }

    if (invitation.status === 'ACCEPTED') {
      return res.status(400).json({
        success: false,
        message: 'This invitation has already been accepted.',
      });
    }

    // Require authenticated email to match the invited email
    if (user.email.toLowerCase() !== invitation.invitedEmail.toLowerCase()) {
      return res.status(403).json({
        success: false,
        message: `This invitation was issued to ${invitation.invitedEmail}. You are currently signed in as ${user.email}. Please switch accounts to accept.`,
      });
    }

    // Add member to workspace
    const member = await WorkspaceMemberModelAdapter.createMember({
      workspaceId: invitation.workspaceId,
      userId: user.id!,
      role: invitation.role,
    });

    // Mark invitation accepted
    await InvitationModelAdapter.updateStatus(invitation.id!, 'ACCEPTED');

    return res.status(200).json({
      success: true,
      message: `You have successfully joined the workspace as ${invitation.role}!`,
      data: {
        workspaceId: invitation.workspaceId,
        member,
      },
    });
  } catch (error: any) {
    next(error);
  }
};

export const declineInvitation = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const token = req.params.token;
    const user = req.user!;
    const invitation = await InvitationModelAdapter.findByToken(token);

    if (!invitation) {
      return res.status(404).json({
        success: false,
        message: 'Invitation not found.',
      });
    }

    if (user.email.toLowerCase() !== invitation.invitedEmail.toLowerCase()) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to decline this invitation.',
      });
    }

    await InvitationModelAdapter.updateStatus(invitation.id!, 'REVOKED');

    return res.status(200).json({
      success: true,
      message: 'Invitation declined.',
    });
  } catch (error: any) {
    next(error);
  }
};
