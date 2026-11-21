import React from 'react';
import { CornerDownRight, Edit2, Trash2 } from 'lucide-react';

interface CommentActionsProps {
  canReply: boolean;
  canEdit: boolean;
  canDelete: boolean;
  isReplying?: boolean;
  disabled?: boolean;
  onReply?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}

export const CommentActions: React.FC<CommentActionsProps> = ({
  canReply,
  canEdit,
  canDelete,
  isReplying = false,
  disabled = false,
  onReply,
  onEdit,
  onDelete,
}) => {
  if (!canReply && !canEdit && !canDelete) {
    return null;
  }

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {canReply && onReply && (
        <button
          type="button"
          onClick={onReply}
          disabled={disabled}
          aria-label="Reply to comment"
          className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 min-h-[36px] sm:min-h-[30px] text-xs font-medium rounded-md transition-colors disabled:opacity-50 ${
            isReplying
              ? 'text-slate-900 bg-slate-100'
              : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <CornerDownRight className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Reply</span>
        </button>
      )}

      {canEdit && onEdit && (
        <button
          type="button"
          onClick={onEdit}
          disabled={disabled}
          aria-label="Edit comment"
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 min-h-[36px] sm:min-h-[30px] text-xs font-medium text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors disabled:opacity-50"
        >
          <Edit2 className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Edit</span>
        </button>
      )}

      {canDelete && onDelete && (
        <button
          type="button"
          onClick={onDelete}
          disabled={disabled}
          aria-label="Delete comment"
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 min-h-[36px] sm:min-h-[30px] text-xs font-medium text-slate-500 hover:text-rose-700 hover:bg-rose-50 rounded-md transition-colors disabled:opacity-50"
        >
          <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Delete</span>
        </button>
      )}
    </div>
  );
};
