import React, { useEffect } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { IssueComment } from '../../types/comment';
import { Button } from '../common/Button';

interface DeleteCommentDialogProps {
  isOpen: boolean;
  comment: IssueComment | null;
  isDeleting?: boolean;
  error?: string | null;
  onCancel: () => void;
  onConfirm: () => Promise<void> | void;
}

export const DeleteCommentDialog: React.FC<DeleteCommentDialogProps> = ({
  isOpen,
  comment,
  isDeleting = false,
  error = null,
  onCancel,
  onConfirm,
}) => {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isDeleting) {
        onCancel();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isDeleting, onCancel]);

  if (!isOpen || !comment) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs"
      onClick={() => {
        if (!isDeleting) onCancel();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-comment-dialog-title"
        className="w-full max-w-md bg-white rounded-xl border border-slate-200 shadow-lg overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5 text-rose-700">
            <AlertTriangle className="w-5 h-5 shrink-0" aria-hidden="true" />
            <h2 id="delete-comment-dialog-title" className="text-base font-semibold text-slate-900">
              Delete Comment
            </h2>
          </div>
          <button
            type="button"
            onClick={() => {
              if (!isDeleting) onCancel();
            }}
            aria-label="Close delete comment dialog"
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <p className="text-sm text-slate-600 leading-relaxed">
            Are you sure you want to delete this comment? Its content will be replaced with a{' '}
            <span className="font-medium text-slate-900">deleted comment indicator</span>, while any existing replies remain intact.
          </p>

          {error && (
            <div role="alert" className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700">
              {error}
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={onCancel} disabled={isDeleting}>
              Cancel
            </Button>
            <Button type="button" variant="danger" isLoading={isDeleting} onClick={onConfirm}>
              Delete Comment
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
