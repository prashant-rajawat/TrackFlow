import { Response, NextFunction } from 'express';
import { IssueAuthorizedRequest } from '../services/issue.rbac.service.js';
import { CommentAuthorizedRequest } from '../services/comment.rbac.service.js';
import { CommentService } from '../services/comment.service.js';
import {
  createCommentSchema,
  createReplySchema,
  updateCommentSchema,
  listCommentsQuerySchema,
} from '../validators/comment.validator.js';

export const listIssueComments = async (
  req: IssueAuthorizedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const parsedQuery = listCommentsQuerySchema.safeParse(req.query);
    if (!parsedQuery.success) {
      return res.status(400).json({
        success: false,
        message: 'Invalid query parameters',
        errors: parsedQuery.error.flatten().fieldErrors,
      });
    }

    const result = await CommentService.listIssueComments({
      issueId: req.issue!.id!,
      sort: parsedQuery.data.sort,
      limit: parsedQuery.data.limit,
      offset: parsedQuery.data.offset,
    });

    return res.status(200).json({
      success: true,
      data: {
        ...result,
        permissions: req.issuePermissions,
      },
    });
  } catch (error: any) {
    next(error);
  }
};

export const createIssueComment = async (
  req: IssueAuthorizedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const parsed = createCommentSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: parsed.error.flatten().fieldErrors,
      });
    }

    const comment = await CommentService.createComment({
      issue: req.issue!,
      authorId: req.user!.id!,
      content: parsed.data.content,
    });

    return res.status(201).json({
      success: true,
      message: 'Comment added successfully',
      data: {
        comment,
        permissions: req.issuePermissions,
      },
    });
  } catch (error: any) {
    next(error);
  }
};

export const createCommentReply = async (
  req: CommentAuthorizedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const parsed = createReplySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: parsed.error.flatten().fieldErrors,
      });
    }

    const reply = await CommentService.createReply({
      parentComment: req.comment!,
      authorId: req.user!.id!,
      content: parsed.data.content,
      requestedIssueId: parsed.data.issueId,
    });

    return res.status(201).json({
      success: true,
      message: 'Reply added successfully',
      data: {
        comment: reply,
        permissions: req.issuePermissions,
      },
    });
  } catch (error: any) {
    next(error);
  }
};

export const updateComment = async (
  req: CommentAuthorizedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const parsed = updateCommentSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: parsed.error.flatten().fieldErrors,
      });
    }

    const updated = await CommentService.updateComment({
      comment: req.comment!,
      content: parsed.data.content,
    });

    return res.status(200).json({
      success: true,
      message: 'Comment updated successfully',
      data: {
        comment: updated,
        permissions: req.issuePermissions,
      },
    });
  } catch (error: any) {
    next(error);
  }
};

export const deleteComment = async (
  req: CommentAuthorizedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const deleted = await CommentService.softDeleteComment(req.comment!);

    return res.status(200).json({
      success: true,
      message: 'Comment deleted successfully',
      data: {
        comment: deleted,
        permissions: req.issuePermissions,
      },
    });
  } catch (error: any) {
    next(error);
  }
};
