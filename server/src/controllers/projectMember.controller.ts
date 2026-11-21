import { Response, NextFunction } from 'express';
import { addProjectMemberSchema, updateProjectMemberRoleSchema } from '../validators/project.validator.js';
import { ProjectMemberModelAdapter } from '../models/ProjectMember.js';
import { WorkspaceMemberModelAdapter } from '../models/WorkspaceMember.js';
import { ProjectAuthorizedRequest } from '../services/project.rbac.service.js';

export const listProjectMembers = async (req: ProjectAuthorizedRequest, res: Response, next: NextFunction) => {
  try {
    const projectId = req.project!.id!;
    const members = await ProjectMemberModelAdapter.findByProject(projectId);

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

export const addProjectMember = async (req: ProjectAuthorizedRequest, res: Response, next: NextFunction) => {
  try {
    const validated = addProjectMemberSchema.parse(req.body);
    const projectId = req.project!.id!;
    const workspaceId = req.project!.workspaceId;

    // Verify user is an active member of the parent workspace
    const workspaceMember = await WorkspaceMemberModelAdapter.findMember(workspaceId, validated.userId);
    if (!workspaceMember) {
      return res.status(400).json({
        success: false,
        message: 'User must be a member of the parent workspace before being added to a project.',
      });
    }

    const member = await ProjectMemberModelAdapter.createMember({
      projectId,
      workspaceId,
      userId: validated.userId,
      role: validated.role,
    });

    return res.status(201).json({
      success: true,
      message: 'Member added to project successfully',
      data: {
        member,
      },
    });
  } catch (error: any) {
    next(error);
  }
};

export const updateProjectMemberRole = async (req: ProjectAuthorizedRequest, res: Response, next: NextFunction) => {
  try {
    const validated = updateProjectMemberRoleSchema.parse(req.body);
    const projectId = req.project!.id!;
    const targetUserId = req.params.userId || req.params.memberId;

    const targetMember = await ProjectMemberModelAdapter.findMember(projectId, targetUserId);
    if (!targetMember) {
      return res.status(404).json({ success: false, message: 'Project member not found.' });
    }

    // Prevent demoting the last PROJECT_ADMIN
    if (targetMember.role === 'PROJECT_ADMIN' && validated.role !== 'PROJECT_ADMIN') {
      const adminCount = await ProjectMemberModelAdapter.countProjectAdmins(projectId);
      if (adminCount <= 1) {
        return res.status(400).json({
          success: false,
          message: 'Cannot demote the final project administrator. Another administrator must be designated first.',
        });
      }
    }

    const updated = await ProjectMemberModelAdapter.updateMemberRole(projectId, targetUserId, validated.role);

    return res.status(200).json({
      success: true,
      message: `Project member role updated to ${validated.role}`,
      data: {
        member: updated,
      },
    });
  } catch (error: any) {
    next(error);
  }
};

export const removeProjectMember = async (req: ProjectAuthorizedRequest, res: Response, next: NextFunction) => {
  try {
    const projectId = req.project!.id!;
    const targetUserId = req.params.userId || req.params.memberId;

    const targetMember = await ProjectMemberModelAdapter.findMember(projectId, targetUserId);
    if (!targetMember) {
      return res.status(404).json({ success: false, message: 'Project member not found.' });
    }

    // Prevent removing the last PROJECT_ADMIN
    if (targetMember.role === 'PROJECT_ADMIN') {
      const adminCount = await ProjectMemberModelAdapter.countProjectAdmins(projectId);
      if (adminCount <= 1) {
        return res.status(400).json({
          success: false,
          message: 'Cannot remove the final project administrator. Another administrator must be designated first.',
        });
      }
    }

    await ProjectMemberModelAdapter.removeMember(projectId, targetUserId);

    return res.status(200).json({
      success: true,
      message: 'Project member removed successfully.',
    });
  } catch (error: any) {
    next(error);
  }
};
