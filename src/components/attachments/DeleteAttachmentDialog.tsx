import React from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { IssueAttachment } from '../../types/attachment';
import { formatAttachmentSize } from '../../services/attachment.service';
import { Button } from '../common/Button';

interface DeleteAttachmentDialogProps {
  isOpen: boolean;
  attachment: IssueAttachment | null;
  isDeleting: boolean;
  error?: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}

export const DeleteAttachmentDialog: React.FC<DeleteAttachmentDialogProps> = ({
  isOpen,
  attachment,
  isDeleting,
  error = null,
  onCancel,
  onConfirm,
}) => {
  if (!isOpen || !attachment) return null;

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
        aria-labelledby="delete-attachment-title"
        className="w-full max-w-md bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5 text-rose-700">
            <AlertTriangle className="w-5 h-5 shrink-0" aria-hidden="true" />
            <h2 id="delete-attachment-title" className="text-base font-semibold text-slate-900">
              Delete attachment
            </h2>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={isDeleting}
            aria-label="Close delete attachment dialog"
            className="p-2 text-slate-400 hover:text-slate-600 rounded-lg disabled:opacity-50"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <p className="text-sm text-slate-600">
            Are you sure you want to permanently remove{' '}
            <strong className="font-semibold text-slate-900 break-all">
              {attachment.originalName}
            </strong>{' '}
            (<span className="font-mono tabular-nums">{formatAttachmentSize(attachment.sizeBytes)}</span>)?
            This action cannot be undone.
          </p>

          {error && (
            <div
              role="alert"
              className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700"
            >
              {error}
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={onCancel}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="danger"
              isLoading={isDeleting}
              onClick={onConfirm}
            >
              Delete Attachment
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
