import React, { useState, useEffect, useCallback } from 'react';
import { MessageSquare, AlertCircle, ArrowUpDown } from 'lucide-react';
import { commentService } from '../../services/comment.service';
import { useOptionalAuth } from '../../context/AuthContext';
import { useOptionalToast } from '../../context/ToastContext';
import { IssuePermissions } from '../../types/issue';
import {
  CommentSortOrder,
  CommentThread,
  IssueComment,
} from '../../types/comment';
import { CommentComposer } from './CommentComposer';
import { CommentItem } from './CommentItem';
import { CommentSkeleton } from './CommentSkeleton';
import { DeleteCommentDialog } from './DeleteCommentDialog';
import { Button } from '../common/Button';

interface CommentSectionProps {
  issueId: string;
  permissions: IssuePermissions;
  currentUserId?: string;
  pageSize?: number;
}

export const CommentSection: React.FC<CommentSectionProps> = ({
  issueId,
  permissions,
  currentUserId: propUserId,
  pageSize = 20,
}) => {
  const auth = useOptionalAuth();
  const toast = useOptionalToast();
  const addToast = useCallback(
    (message: string, type?: 'success' | 'error' | 'info') => {
      toast?.addToast(message, type);
    },
    [toast]
  );
  const currentUserId = propUserId ?? auth?.user?.id;

  const [threads, setThreads] = useState<CommentThread[]>([]);
  const [activeCount, setActiveCount] = useState<number>(0);
  const [hasMore, setHasMore] = useState<boolean>(false);
  const [sortOrder, setSortOrder] = useState<CommentSortOrder>('asc');
  const [serverPermissions, setServerPermissions] = useState<IssuePermissions | null>(null);

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [composerResetKey, setComposerResetKey] = useState<number>(0);

  const [deleteTarget, setDeleteTarget] = useState<IssueComment | null>(null);
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const effectivePerms = serverPermissions || permissions;
  const canCreateComment = effectivePerms.canCreateComment ?? effectivePerms.canUpdate;
  const canModerateComments = effectivePerms.canModerateComments ?? effectivePerms.canDelete;

  const fetchComments = useCallback(
    async (sort: CommentSortOrder = sortOrder) => {
      if (!issueId) return;
      setIsLoading(true);
      setLoadError(null);
      try {
        const res = await commentService.listIssueComments(issueId, {
          sort,
          limit: pageSize,
          offset: 0,
        });
        setThreads(res.comments);
        setActiveCount(res.activeCount);
        setHasMore(res.hasMore);
        if (res.permissions) {
          setServerPermissions(res.permissions);
        }
      } catch (err: any) {
        setLoadError(err?.message || 'Unable to load comments.');
      } finally {
        setIsLoading(false);
      }
    },
    [issueId, sortOrder, pageSize]
  );

  useEffect(() => {
    setServerPermissions(null);
    setDeleteTarget(null);
    setDeleteError(null);
    fetchComments(sortOrder);
  }, [issueId, sortOrder, fetchComments]);

  const handleLoadMore = async () => {
    if (isLoadingMore || !hasMore) return;
    setIsLoadingMore(true);
    try {
      const res = await commentService.listIssueComments(issueId, {
        sort: sortOrder,
        limit: pageSize,
        offset: threads.length,
      });
      setThreads((prev) => {
        const existingIds = new Set(prev.map((c) => c.id));
        const nextItems = res.comments.filter((c) => !existingIds.has(c.id));
        return [...prev, ...nextItems];
      });
      setActiveCount(res.activeCount);
      setHasMore(res.hasMore);
    } catch (err: any) {
      addToast(err?.message || 'Failed to load more comments', 'error');
    } finally {
      setIsLoadingMore(false);
    }
  };

  const handleCreateComment = async (content: string) => {
    const res = await commentService.createComment(issueId, content);
    const createdThread: CommentThread = {
      ...res.comment,
      replies: res.comment.replies || [],
    };
    setThreads((prev) =>
      sortOrder === 'desc' ? [createdThread, ...prev] : [...prev, createdThread]
    );
    setActiveCount((c) => c + 1);
    setComposerResetKey((k) => k + 1);
    if (res.permissions) {
      setServerPermissions(res.permissions);
    }
    addToast('Comment added', 'success');
  };

  const handleCreateReply = async (parentCommentId: string, content: string) => {
    const res = await commentService.createReply(parentCommentId, content, issueId);
    const createdReply = res.comment;
    setThreads((prev) =>
      prev.map((thread) =>
        thread.id === parentCommentId
          ? { ...thread, replies: [...(thread.replies || []), createdReply] }
          : thread
      )
    );
    setActiveCount((c) => c + 1);
    addToast('Reply posted', 'success');
  };

  const handleEditComment = async (commentId: string, content: string) => {
    const res = await commentService.updateComment(commentId, content);
    const updated = res.comment;
    setThreads((prev) =>
      prev.map((thread) => {
        if (thread.id === commentId) {
          return { ...thread, ...updated, replies: thread.replies };
        }
        return {
          ...thread,
          replies: (thread.replies || []).map((reply) =>
            reply.id === commentId ? { ...reply, ...updated } : reply
          ),
        };
      })
    );
    addToast('Comment updated', 'success');
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      const res = await commentService.deleteComment(deleteTarget.id);
      const deleted = res.comment;
      setThreads((prev) =>
        prev.map((thread) => {
          if (thread.id === deleted.id) {
            return { ...thread, ...deleted, replies: thread.replies };
          }
          return {
            ...thread,
            replies: (thread.replies || []).map((reply) =>
              reply.id === deleted.id ? { ...reply, ...deleted } : reply
            ),
          };
        })
      );
      setActiveCount((c) => Math.max(0, c - 1));
      setDeleteTarget(null);
      addToast('Comment deleted', 'success');
    } catch (err: any) {
      const msg = err?.message || 'Failed to delete comment';
      setDeleteError(msg);
      addToast(msg, 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <section
      aria-labelledby="issue-comments-heading"
      className="bg-white rounded-xl border border-slate-200 p-6 space-y-5"
    >
      {/* Header & Sort Control */}
      <div className="flex items-center justify-between gap-3 flex-wrap pb-4 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-slate-500" aria-hidden="true" />
          <h2
            id="issue-comments-heading"
            className="text-sm font-semibold text-slate-900"
          >
            Comments
          </h2>
          <span
            aria-label={`${activeCount} active comments`}
            className="font-mono text-xs font-medium text-slate-500 tabular-nums"
          >
            ({activeCount})
          </span>
        </div>

        <button
          type="button"
          onClick={() => setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'))}
          disabled={isLoading}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50"
        >
          <ArrowUpDown className="w-3.5 h-3.5" aria-hidden="true" />
          <span>{sortOrder === 'asc' ? 'Oldest first' : 'Newest first'}</span>
        </button>
      </div>

      {/* Top-level Composer or Read-Only Notice */}
      {canCreateComment ? (
        <CommentComposer
          resetKey={composerResetKey}
          placeholder="Add a comment to collaborate on this issue..."
          ariaLabel="Add a comment"
          submitLabel="Post Comment"
          onSubmit={handleCreateComment}
        />
      ) : (
        <p className="text-xs text-slate-500 py-2">
          Read-only access: viewers can read discussion threads but cannot post or modify comments.
        </p>
      )}

      {/* Body States */}
      {isLoading ? (
        <CommentSkeleton count={2} />
      ) : loadError ? (
        <div
          role="alert"
          className="p-4 rounded-lg bg-rose-50 border border-rose-200 flex items-center justify-between gap-3 flex-wrap"
        >
          <div className="flex items-center gap-2 text-xs text-rose-700">
            <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>{loadError}</span>
          </div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => fetchComments(sortOrder)}
          >
            Retry
          </Button>
        </div>
      ) : threads.length === 0 ? (
        <div className="py-6 text-center border-t border-slate-100">
          <p className="text-sm font-medium text-slate-600">No comments yet</p>
          <p className="text-xs text-slate-400 mt-1">
            {canCreateComment
              ? 'Start the discussion by posting the first comment above.'
              : 'There are no comments on this issue yet.'}
          </p>
        </div>
      ) : (
        <div className="divide-y divide-slate-100">
          {threads.map((thread) => (
            <CommentItem
              key={thread.id}
              comment={thread}
              currentUserId={currentUserId}
              canCreateComment={canCreateComment}
              canModerateComments={canModerateComments}
              isBusy={isDeleting}
              onReply={handleCreateReply}
              onEdit={handleEditComment}
              onRequestDelete={(target) => {
                setDeleteError(null);
                setDeleteTarget(target);
              }}
            />
          ))}
        </div>
      )}

      {hasMore && !isLoading && !loadError && (
        <div className="pt-2 flex justify-center border-t border-slate-100">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            isLoading={isLoadingMore}
            onClick={handleLoadMore}
          >
            Load more comments
          </Button>
        </div>
      )}

      <DeleteCommentDialog
        isOpen={!!deleteTarget}
        comment={deleteTarget}
        isDeleting={isDeleting}
        error={deleteError}
        onCancel={() => {
          if (!isDeleting) {
            setDeleteError(null);
            setDeleteTarget(null);
          }
        }}
        onConfirm={handleConfirmDelete}
      />
    </section>
  );
};
