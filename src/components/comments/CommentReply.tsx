import React, { useState } from 'react';
import { IssueComment, CommentAuthorSummary } from '../../types/comment';
import { CommentComposer } from './CommentComposer';
import { CommentActions } from './CommentActions';

export const getAuthorInitials = (author?: CommentAuthorSummary): string => {
  const source = author?.fullName?.trim() || author?.email?.trim() || '?';
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
};

export const formatCommentTimestamp = (iso: string): string => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'Just now';

  const nowMs = Date.now();
  const diffSec = Math.floor((nowMs - d.getTime()) / 1000);

  if (diffSec >= 0 && diffSec < 60) return 'Just now';
  if (diffSec >= 60 && diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec >= 3600 && diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;

  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

export const CommentAvatar: React.FC<{ author?: CommentAuthorSummary; size?: 'sm' | 'md' }> = ({
  author,
  size = 'md',
}) => {
  const dims = size === 'sm' ? 'w-7 h-7 text-[11px]' : 'w-8 h-8 text-xs';
  if (author?.avatarUrl) {
    return (
      <img
        src={author.avatarUrl}
        alt={author.fullName || author.email}
        className={`${dims} rounded-full object-cover border border-slate-200 shrink-0`}
      />
    );
  }
  return (
    <div
      aria-hidden="true"
      className={`${dims} rounded-full bg-slate-100 border border-slate-200 text-slate-700 font-semibold flex items-center justify-center shrink-0`}
    >
      {getAuthorInitials(author)}
    </div>
  );
};

interface CommentReplyProps {
  reply: IssueComment;
  currentUserId?: string;
  canCreateComment: boolean;
  canModerateComments: boolean;
  isBusy?: boolean;
  onEdit: (commentId: string, content: string) => Promise<void>;
  onRequestDelete: (comment: IssueComment) => void;
}

export const CommentReply: React.FC<CommentReplyProps> = ({
  reply,
  currentUserId,
  canCreateComment,
  canModerateComments,
  isBusy = false,
  onEdit,
  onRequestDelete,
}) => {
  const [isEditing, setIsEditing] = useState(false);

  const isAuthor = !!currentUserId && reply.authorId === currentUserId;
  const canEdit = !reply.isDeleted && canCreateComment && (isAuthor || canModerateComments);
  const canDelete = !reply.isDeleted && canCreateComment && (isAuthor || canModerateComments);
  const authorName = reply.author?.fullName || reply.author?.email || 'Team member';

  const handleSaveEdit = async (content: string) => {
    await onEdit(reply.id, content);
    setIsEditing(false);
  };

  return (
    <article
      aria-label={`Reply by ${authorName}`}
      className="flex items-start gap-2.5 pt-2.5"
    >
      <CommentAvatar author={reply.author} size="sm" />

      <div className="flex-1 min-w-0 space-y-1.5">
        <div className="flex items-baseline justify-between gap-2 flex-wrap">
          <div className="flex items-baseline gap-2 flex-wrap min-w-0">
            <span className="text-xs font-semibold text-slate-900 truncate">
              {reply.isDeleted ? 'Deleted comment' : authorName}
            </span>
            <time
              dateTime={reply.createdAt}
              title={new Date(reply.createdAt).toLocaleString()}
              className="font-mono text-[11px] text-slate-400 tabular-nums"
            >
              {formatCommentTimestamp(reply.createdAt)}
            </time>
            {!reply.isDeleted && reply.editedAt && (
              <>
                <span className="text-slate-300 text-xs" aria-hidden="true">·</span>
                <span
                  title={`Edited ${new Date(reply.editedAt).toLocaleString()}`}
                  className="text-[11px] text-slate-400"
                >
                  Edited
                </span>
              </>
            )}
          </div>

          {!isEditing && (
            <CommentActions
              canReply={false}
              canEdit={canEdit}
              canDelete={canDelete}
              disabled={isBusy}
              onEdit={() => setIsEditing(true)}
              onDelete={() => onRequestDelete(reply)}
            />
          )}
        </div>

        {reply.isDeleted ? (
          <p className="text-xs italic text-slate-400">
            This comment was deleted.
          </p>
        ) : isEditing ? (
          <CommentComposer
            initialValue={reply.content}
            ariaLabel="Edit reply"
            submitLabel="Save"
            showCancel
            autoFocus
            disabled={isBusy}
            onCancel={() => setIsEditing(false)}
            onSubmit={handleSaveEdit}
          />
        ) : (
          <div className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap break-words">
            {reply.content}
          </div>
        )}
      </div>
    </article>
  );
};
