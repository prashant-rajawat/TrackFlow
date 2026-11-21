import { Response, NextFunction } from 'express';
import { createWorkspaceSchema, updateWorkspaceSchema } from '../validators/workspace.validator.js';
import { WorkspaceModelAdapter } from '../models/Workspace.js';
import { WorkspaceMemberModelAdapter } from '../models/WorkspaceMember.js';
import { ProjectModelAdapter } from '../models/Project.js';
import { ProjectMemberModelAdapter } from '../models/ProjectMember.js';
import { IssueModelAdapter } from '../models/Issue.js';
import { CommentModelAdapter } from '../models/Comment.js';
import { InvitationModelAdapter } from '../models/Invitation.js';
import { WorkspaceAuthorizedRequest } from '../services/rbac.service.js';
import { AttachmentService } from '../services/attachment.service.js';
import { AuthenticatedRequest } from '../middleware/auth.middleware.js';

const slugify = (text: string): string => {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
};

export const createWorkspace = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const validatedData = createWorkspaceSchema.parse(req.body);
    const userId = req.user!.id!;

    // Generate slug if not provided
    let slug = validatedData.slug;
    if (!slug) {
      const baseSlug = slugify(validatedData.name) || 'workspace';
      slug = baseSlug;

      // Check collision and append random suffix if needed
      const existing = await WorkspaceModelAdapter.findBySlug(slug);
      if (existing) {
        slug = `${baseSlug}-${Math.random().toString(36).substring(2, 6)}`;
      }
    }

    // Create workspace
    const workspace = await WorkspaceModelAdapter.create({
      name: validatedData.name,
      slug,
      description: validatedData.description,
      ownerId: userId,
    });

    // Atomically create OWNER membership
    const member = await WorkspaceMemberModelAdapter.createMember({
      workspaceId: workspace.id!,
      userId,
      role: 'OWNER',
    });

    return res.status(201).json({
      success: true,
      message: 'Workspace created successfully',
      data: {
        workspace: {
          ...workspace,
          role: member.role,
          memberCount: 1,
        },
      },
    });
  } catch (error: any) {
    next(error);
  }
};

export const listWorkspaces = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user!.id!;
    const userMemberships = await WorkspaceMemberModelAdapter.findUserWorkspaces(userId);

    const workspacesWithRole = await Promise.all(
      userMemberships.map(async (m) => {
        const ws = await WorkspaceModelAdapter.findById(m.workspaceId);
        if (!ws) return null;
        const allMembers = await WorkspaceMemberModelAdapter.findByWorkspace(m.workspaceId);

        return {
          ...ws,
          role: m.role,
          memberCount: allMembers.length,
        };
      })
    );

    const activeWorkspaces = workspacesWithRole.filter(Boolean);

    return res.status(200).json({
      success: true,
      data: {
        workspaces: activeWorkspaces,
      },
    });
  } catch (error: any) {
    next(error);
  }
};

export const getWorkspace = async (
  req: WorkspaceAuthorizedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const workspace = req.workspace!;
    const member = req.workspaceMember!;
    const allMembers = await WorkspaceMemberModelAdapter.findByWorkspace(workspace.id!);

    return res.status(200).json({
      success: true,
      data: {
        workspace: {
          ...workspace,
          role: member.role,
          memberCount: allMembers.length,
        },
      },
    });
  } catch (error: any) {
    next(error);
  }
};

export const updateWorkspace = async (
  req: WorkspaceAuthorizedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const validatedData = updateWorkspaceSchema.parse(req.body);
    const workspaceId = req.workspace!.id!;

    const updated = await WorkspaceModelAdapter.update(workspaceId, validatedData);
    if (!updated) {
      return res.status(404).json({
        success: false,
        message: 'Workspace not found',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Workspace updated successfully',
      data: {
        workspace: {
          ...updated,
          role: req.workspaceMember!.role,
        },
      },
    });
  } catch (error: any) {
    next(error);
  }
};

export const deleteWorkspace = async (
  req: WorkspaceAuthorizedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const workspaceId = req.workspace!.id!;

    // Cascade delete projects, project members, attachments, comments, and project issues
    const projects = await ProjectModelAdapter.findByWorkspace(workspaceId);
    for (const proj of projects) {
      await AttachmentService.cascadeDeleteByProject(proj.id!);
      await CommentModelAdapter.deleteByProject(proj.id!);
      await IssueModelAdapter.deleteByProject(proj.id!);
      await ProjectMemberModelAdapter.deleteByProject(proj.id!);
      await ProjectModelAdapter.delete(proj.id!);
    }

    // Delete invitations
    await InvitationModelAdapter.deleteByWorkspace(workspaceId);

    // Delete workspace members
    const members = await WorkspaceMemberModelAdapter.findByWorkspace(workspaceId);
    for (const m of members) {
      await WorkspaceMemberModelAdapter.removeMember(workspaceId, m.userId);
    }

    // Delete workspace
    await WorkspaceModelAdapter.delete(workspaceId);

    return res.status(200).json({
      success: true,
      message: 'Workspace deleted successfully',
    });
  } catch (error: any) {
    next(error);
  }
};
