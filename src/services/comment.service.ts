import { api } from './api';
import {
  CommentSortOrder,
  CommentThread,
  IssueComment,
  ListCommentsResponse,
} from '../types/comment';
import { IssuePermissions } from '../types/issue';

export const commentService = {
  async listIssueComments(
    issueId: string,
    options?: { sort?: CommentSortOrder; limit?: number; offset?: number }
  ): Promise<ListCommentsResponse> {
    const params = new URLSearchParams();
    if (options?.sort) params.set('sort', options.sort);
    if (typeof options?.limit === 'number') params.set('limit', String(options.limit));
    if (typeof options?.offset === 'number') params.set('offset', String(options.offset));
    const qs = params.toString();
    const url = `/api/issues/${issueId}/comments${qs ? `?${qs}` : ''}`;
    const res = await api.get<ListCommentsResponse>(url);
    return res.data!;
  },

  async createComment(
    issueId: string,
    content: string
  ): Promise<{ comment: CommentThread; permissions?: IssuePermissions }> {
    const res = await api.post<{ comment: CommentThread; permissions?: IssuePermissions }>(
      `/api/issues/${issueId}/comments`,
      { content }
    );
    return res.data!;
  },

  async createReply(
    commentId: string,
    content: string,
    issueId?: string
  ): Promise<{ comment: IssueComment; permissions?: IssuePermissions }> {
    const body: { content: string; issueId?: string } = { content };
    if (issueId) body.issueId = issueId;
    const res = await api.post<{ comment: IssueComment; permissions?: IssuePermissions }>(
      `/api/comments/${commentId}/replies`,
      body
    );
    return res.data!;
  },

  async updateComment(
    commentId: string,
    content: string
  ): Promise<{ comment: IssueComment; permissions?: IssuePermissions }> {
    const res = await api.patch<{ comment: IssueComment; permissions?: IssuePermissions }>(
      `/api/comments/${commentId}`,
      { content }
    );
    return res.data!;
  },

  async deleteComment(
    commentId: string
  ): Promise<{ comment: IssueComment; permissions?: IssuePermissions }> {
    const res = await api.delete<{ comment: IssueComment; permissions?: IssuePermissions }>(
      `/api/comments/${commentId}`
    );
    return res.data!;
  },
};
