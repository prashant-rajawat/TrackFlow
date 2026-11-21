import { IssuePermissions } from './issue';

export type CommentSortOrder = 'asc' | 'desc';

export interface CommentAuthorSummary {
  id: string;
  fullName: string;
  email: string;
  avatarUrl?: string;
}

export interface IssueComment {
  id: string;
  issueId: string;
  projectId: string;
  workspaceId: string;
  authorId: string;
  parentCommentId: string | null;
  content: string;
  isDeleted: boolean;
  editedAt: string | null;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
  author?: CommentAuthorSummary;
}

export interface CommentThread extends IssueComment {
  replies: IssueComment[];
}

export interface ListCommentsResponse {
  comments: CommentThread[];
  totalCount: number;
  activeCount: number;
  topLevelCount: number;
  hasMore: boolean;
  permissions?: IssuePermissions;
}
