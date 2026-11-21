import { CommentModelAdapter, IComment } from '../models/Comment.js';
import { IIssue } from '../models/Issue.js';
import { isValidEntityId } from './issue.rbac.service.js';

export interface CommentThreadItem extends IComment {
  replies: IComment[];
}

const createServiceError = (message: string, statusCode: number) => {
  const err: any = new Error(message);
  err.statusCode = statusCode;
  return err;
};

export class CommentService {
  static async listIssueComments(params: {
    issueId: string;
    sort?: 'asc' | 'desc';
    limit?: number;
    offset?: number;
  }): Promise<{
    comments: CommentThreadItem[];
    totalCount: number;
    activeCount: number;
    topLevelCount: number;
    hasMore: boolean;
  }> {
    const { issueId, sort = 'asc', limit, offset = 0 } = params;
    const allComments = await CommentModelAdapter.findByIssue(issueId);

    const repliesByParent = new Map<string, IComment[]>();
    const topLevel: IComment[] = [];

    for (const c of allComments) {
      if (c.parentCommentId) {
        const list = repliesByParent.get(c.parentCommentId) || [];
        list.push(c);
        repliesByParent.set(c.parentCommentId, list);
      } else {
        topLevel.push(c);
      }
    }

    if (sort === 'desc') {
      topLevel.reverse();
    }

    const topLevelCount = topLevel.length;
    const slicedTopLevel =
      typeof limit === 'number' ? topLevel.slice(offset, offset + limit) : topLevel.slice(offset);

    const threads: CommentThreadItem[] = slicedTopLevel.map((parent) => ({
      ...parent,
      replies: repliesByParent.get(parent.id!) || [],
    }));

    const activeCount = allComments.filter((c) => !c.isDeleted).length;
    const hasMore =
      typeof limit === 'number' ? offset + slicedTopLevel.length < topLevelCount : false;

    return {
      comments: threads,
      totalCount: allComments.length,
      activeCount,
      topLevelCount,
      hasMore,
    };
  }

  static async createComment(params: {
    issue: IIssue;
    authorId: string;
    content: string;
  }): Promise<CommentThreadItem> {
    const { issue, authorId, content } = params;

    const created = await CommentModelAdapter.create({
      issueId: issue.id!,
      projectId: issue.projectId,
      workspaceId: issue.workspaceId,
      authorId,
      parentCommentId: null,
      content,
    });

    return {
      ...created,
      replies: [],
    };
  }

  static async createReply(params: {
    parentComment: IComment;
    authorId: string;
    content: string;
    requestedIssueId?: string;
  }): Promise<IComment> {
    const { parentComment, authorId, content, requestedIssueId } = params;

    if (requestedIssueId) {
      if (!isValidEntityId(requestedIssueId, 'iss')) {
        throw createServiceError('Invalid issue ID format.', 400);
      }
      if (requestedIssueId !== parentComment.issueId) {
        throw createServiceError('Cannot reply to a comment belonging to a different issue.', 400);
      }
    }

    if (parentComment.parentCommentId !== null) {
      throw createServiceError('Nested replies beyond one level are not allowed.', 400);
    }

    if (parentComment.isDeleted || parentComment.deletedAt) {
      throw createServiceError('Cannot reply to a deleted comment.', 400);
    }

    return CommentModelAdapter.create({
      issueId: parentComment.issueId,
      projectId: parentComment.projectId,
      workspaceId: parentComment.workspaceId,
      authorId,
      parentCommentId: parentComment.id!,
      content,
    });
  }

  static async updateComment(params: {
    comment: IComment;
    content: string;
  }): Promise<IComment> {
    const { comment, content } = params;

    if (comment.isDeleted || comment.deletedAt) {
      throw createServiceError('Deleted comments cannot be edited.', 400);
    }

    const updated = await CommentModelAdapter.updateContent(comment.id!, content);
    if (!updated) {
      throw createServiceError('Comment not found.', 404);
    }

    return updated;
  }

  static async softDeleteComment(comment: IComment): Promise<IComment> {
    if (comment.isDeleted || comment.deletedAt) {
      throw createServiceError('Comment has already been deleted.', 400);
    }

    const deleted = await CommentModelAdapter.softDelete(comment.id!);
    if (!deleted) {
      throw createServiceError('Comment not found.', 404);
    }

    return deleted;
  }
}
