import React, { useState } from 'react';
import { CommentThread, IssueComment } from '../../types/comment';
import { CommentComposer } from './CommentComposer';
import { CommentActions } from './CommentActions';
import {
  CommentAvatar,
  CommentReply,
  formatCommentTimestamp,
} from './CommentReply';

interface CommentItemProps {
  comment: CommentThread;
  currentUserId?: string;
  canCreateComment: boolean;
  canModerateComments: boolean;
  isBusy?: boolean;
  onReply: (parentCommentId: string, content: string) => Promise<void>;
  onEdit: (commentId: string, content: string) => Promise<void>;
  onRequestDelete: (comment: IssueComment) => void;
}

export const CommentItem: React.FC<CommentItemProps> = ({
  comment,
  currentUserId,
  canCreateComment,
  canModerateComments,
  isBusy = false,
  onReply,
  onEdit,
  onRequestDelete,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [isReplying, setIsReplying] = useState(false);

  const isAuthor = !!currentUserId && comment.authorId === currentUserId;
  const canReply = !comment.isDeleted && canCreateComment;
  const canEdit = !comment.isDeleted && canCreateComment && (isAuthor || canModerateComments);
  const canDelete = !comment.isDeleted && canCreateComment && (isAuthor || canModerateComments);
  const authorName = comment.author?.fullName || comment.author?.email || 'Team member';

  const handleSaveEdit = async (content: string) => {
    await onEdit(comment.id, content);
    setIsEditing(false);
  };

  const handleSubmitReply = async (content: string) => {
    await onReply(comment.id, content);
    setIsReplying(false);
  };

  return (
    <article
      aria-label={`Comment by ${authorName}`}
      className="py-4 border-t border-slate-100 first:border-t-0 first:pt-0"
    >
      <div className="flex items-start gap-3">
        <CommentAvatar author={comment.author} size="md" />

        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex items-baseline justify-between gap-2 flex-wrap">
            <div className="flex items-baseline gap-2 flex-wrap min-w-0">
              <span className="text-sm font-semibold text-slate-900 truncate">
                {comment.isDeleted ? 'Deleted comment' : authorName}
              </span>
              <time
                dateTime={comment.createdAt}
                title={new Date(comment.createdAt).toLocaleString()}
                className="font-mono text-xs text-slate-400 tabular-nums"
              >
                {formatCommentTimestamp(comment.createdAt)}
              </time>
              {!comment.isDeleted && comment.editedAt && (
                <>
                  <span className="text-slate-300 text-xs" aria-hidden="true">·</span>
                  <span
                    title={`Edited ${new Date(comment.editedAt).toLocaleString()}`}
                    className="text-xs text-slate-400"
                  >
                    Edited
                  </span>
                </>
              )}
            </div>

            {!isEditing && (
              <CommentActions
                canReply={canReply}
                canEdit={canEdit}
                canDelete={canDelete}
                isReplying={isReplying}
                disabled={isBusy}
                onReply={() => setIsReplying((prev) => !prev)}
                onEdit={() => {
                  setIsReplying(false);
                  setIsEditing(true);
                }}
                onDelete={() => onRequestDelete(comment)}
              />
            )}
          </div>

          {comment.isDeleted ? (
            <p className="text-sm italic text-slate-400">
              This comment was deleted.
            </p>
          ) : isEditing ? (
            <CommentComposer
              initialValue={comment.content}
              ariaLabel="Edit comment"
              submitLabel="Save Changes"
              showCancel
              autoFocus
              disabled={isBusy}
              onCancel={() => setIsEditing(false)}
              onSubmit={handleSaveEdit}
            />
          ) : (
            <div className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap break-words">
              {comment.content}
            </div>
          )}

          {isReplying && !comment.isDeleted && (
            <div className="pt-2 pl-4 ml-1 border-l border-slate-200">
              <CommentComposer
                placeholder={`Reply to ${authorName}...`}
                ariaLabel={`Reply to ${authorName}`}
                submitLabel="Post Reply"
                showCancel
                autoFocus
                disabled={isBusy}
                onCancel={() => setIsReplying(false)}
                onSubmit={handleSubmitReply}
              />
            </div>
          )}

          {comment.replies && comment.replies.length > 0 && (
            <div
              className="mt-3 pl-4 sm:pl-5 ml-1 border-l border-slate-200 space-y-2.5"
              aria-label="Replies"
            >
              {comment.replies.map((reply) => (
                <CommentReply
                  key={reply.id}
                  reply={reply}
                  currentUserId={currentUserId}
                  canCreateComment={canCreateComment}
                  canModerateComments={canModerateComments}
                  isBusy={isBusy}
                  onEdit={onEdit}
                  onRequestDelete={onRequestDelete}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </article>
  );
};
