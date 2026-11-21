import { Response, NextFunction } from 'express';
import {
  createIssueSchema,
  updateIssueSchema,
  updateIssueAssigneeSchema,
  updateIssueStatusSchema,
  updateIssuePrioritySchema,
} from '../validators/issue.validator.js';
import { issueQuerySchema } from '../validators/issueQuery.validator.js';
import { IssueService } from '../services/issue.service.js';
import { IssueAuthorizedRequest } from '../services/issue.rbac.service.js';
import { AuthenticatedRequest } from '../middleware/auth.middleware.js';

export const listProjectIssues = async (
  req: IssueAuthorizedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const project = req.project!;
    const validatedQuery = issueQuerySchema.parse(req.query);
    const result = await IssueService.listProjectIssues(project, validatedQuery);

    return res.status(200).json({
      success: true,
      data: {
        issues: result.issues,
        pagination: result.pagination,
        appliedFilters: result.appliedFilters,
        appliedSorting: result.appliedSorting,
        members: result.members,
        project,
        permissions: req.issuePermissions,
      },
    });
  } catch (error: any) {
    next(error);
  }
};

export const createIssue = async (
  req: IssueAuthorizedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const validated = createIssueSchema.parse(req.body);
    const project = req.project!;
    const reporterId = req.user!.id!;

    const issue = await IssueService.createIssue({
      project,
      reporterId,
      input: validated,
    });

    return res.status(201).json({
      success: true,
      message: 'Issue created successfully',
      data: {
        issue,
        permissions: req.issuePermissions,
      },
    });
  } catch (error: any) {
    next(error);
  }
};

export const listWorkspaceIssues = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const workspaceId =
      (req.query.workspaceId as string) || (req.headers['x-workspace-id'] as string);

    if (!workspaceId) {
      return res.status(400).json({
        success: false,
        message: 'Workspace ID is required to list issues.',
      });
    }

    const validatedQuery = issueQuerySchema.parse(req.query);

    const result = await IssueService.listWorkspaceIssues({
      userId: req.user!.id!,
      workspaceId,
      query: validatedQuery,
    });

    return res.status(200).json({
      success: true,
      data: {
        issues: result.issues,
        pagination: result.pagination,
        appliedFilters: result.appliedFilters,
        appliedSorting: result.appliedSorting,
        projects: result.projects,
        members: result.members,
      },
    });
  } catch (error: any) {
    next(error);
  }
};

export const getIssue = async (
  req: IssueAuthorizedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    return res.status(200).json({
      success: true,
      data: {
        issue: req.issue!,
        project: req.project!,
        permissions: req.issuePermissions,
      },
    });
  } catch (error: any) {
    next(error);
  }
};

export const updateIssue = async (
  req: IssueAuthorizedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const validated = updateIssueSchema.parse(req.body);
    const updated = await IssueService.updateIssue({
      issue: req.issue!,
      input: validated,
    });

    return res.status(200).json({
      success: true,
      message: 'Issue updated successfully',
      data: {
        issue: updated,
        permissions: req.issuePermissions,
      },
    });
  } catch (error: any) {
    next(error);
  }
};

export const updateIssueAssignee = async (
  req: IssueAuthorizedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const validated = updateIssueAssigneeSchema.parse(req.body);
    const updated = await IssueService.assignIssue(req.issue!, validated.assigneeId);

    return res.status(200).json({
      success: true,
      message: updated.assigneeId ? 'Issue assigned successfully' : 'Issue unassigned successfully',
      data: {
        issue: updated,
        permissions: req.issuePermissions,
      },
    });
  } catch (error: any) {
    next(error);
  }
};

export const updateIssueStatus = async (
  req: IssueAuthorizedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const validated = updateIssueStatusSchema.parse(req.body);
    const updated = await IssueService.updateIssueStatus(req.issue!, validated.status);

    return res.status(200).json({
      success: true,
      message: 'Issue status updated successfully',
      data: {
        issue: updated,
        permissions: req.issuePermissions,
      },
    });
  } catch (error: any) {
    next(error);
  }
};

export const updateIssuePriority = async (
  req: IssueAuthorizedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const validated = updateIssuePrioritySchema.parse(req.body);
    const updated = await IssueService.updateIssuePriority(req.issue!, validated.priority);

    return res.status(200).json({
      success: true,
      message: 'Issue priority updated successfully',
      data: {
        issue: updated,
        permissions: req.issuePermissions,
      },
    });
  } catch (error: any) {
    next(error);
  }
};

export const deleteIssue = async (
  req: IssueAuthorizedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    await IssueService.deleteIssue(req.issue!.id!);

    return res.status(200).json({
      success: true,
      message: 'Issue deleted successfully',
    });
  } catch (error: any) {
    next(error);
  }
};
