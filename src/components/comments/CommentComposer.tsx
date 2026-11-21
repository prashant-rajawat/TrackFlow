import React, { useState, useEffect, useRef } from 'react';
import { Button } from '../common/Button';

export const MAX_COMMENT_LENGTH = 2000;

interface CommentComposerProps {
  initialValue?: string;
  placeholder?: string;
  submitLabel?: string;
  cancelLabel?: string;
  showCancel?: boolean;
  autoFocus?: boolean;
  ariaLabel?: string;
  resetKey?: number;
  disabled?: boolean;
  onCancel?: () => void;
  onSubmit: (content: string) => Promise<void>;
}

export const CommentComposer: React.FC<CommentComposerProps> = ({
  initialValue = '',
  placeholder = 'Write a comment...',
  submitLabel = 'Post Comment',
  cancelLabel = 'Cancel',
  showCancel = false,
  autoFocus = false,
  ariaLabel = 'Comment content',
  resetKey = 0,
  disabled = false,
  onCancel,
  onSubmit,
}) => {
  const [content, setContent] = useState(initialValue);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submittingRef = useRef(false);

  useEffect(() => {
    setContent(initialValue);
    setValidationError(null);
    setSubmitError(null);
  }, [initialValue, resetKey]);

  const trimmed = content.trim();
  const charCount = content.length;
  const isOverLimit = charCount > MAX_COMMENT_LENGTH;
  const isBusy = isSubmitting || disabled;

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (submittingRef.current || isBusy) return;

    if (!trimmed) {
      setValidationError('Comment cannot be empty.');
      return;
    }

    if (trimmed.length > MAX_COMMENT_LENGTH) {
      setValidationError(`Comment cannot exceed ${MAX_COMMENT_LENGTH} characters.`);
      return;
    }

    setValidationError(null);
    setSubmitError(null);
    submittingRef.current = true;
    setIsSubmitting(true);

    try {
      await onSubmit(trimmed);
      if (!initialValue) {
        setContent('');
      }
    } catch (err: any) {
      // Preserve entered text on failure so the user does not lose their draft
      setSubmitError(err?.message || 'Failed to save comment. Please try again.');
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    }
  };

  const activeError = validationError || submitError;

  return (
    <form onSubmit={handleSubmit} className="space-y-2.5" noValidate>
      <div>
        <textarea
          value={content}
          onChange={(e) => {
            setContent(e.target.value);
            if (validationError) setValidationError(null);
            if (submitError) setSubmitError(null);
          }}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          aria-label={ariaLabel}
          aria-invalid={!!activeError}
          autoFocus={autoFocus}
          disabled={isBusy}
          rows={3}
          className={`w-full px-3.5 py-2.5 text-sm rounded-lg border bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 transition-colors resize-y min-h-[84px] disabled:bg-slate-50 disabled:text-slate-500 ${
            activeError
              ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-500/15'
              : 'border-slate-300 focus:border-slate-800 focus:ring-slate-900/10'
          }`}
        />
      </div>

      {activeError && (
        <div
          role="alert"
          className="text-xs font-medium text-rose-600"
        >
          {activeError}
        </div>
      )}

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <span
          className={`font-mono text-xs tabular-nums ${
            isOverLimit ? 'text-rose-600 font-semibold' : 'text-slate-400'
          }`}
        >
          {charCount} / {MAX_COMMENT_LENGTH}
        </span>

        <div className="flex items-center gap-2 ml-auto">
          {showCancel && onCancel && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={onCancel}
              disabled={isBusy}
            >
              {cancelLabel}
            </Button>
          )}
          <Button
            type="submit"
            variant="primary"
            size="sm"
            isLoading={isSubmitting}
            disabled={isBusy || isOverLimit}
          >
            {submitLabel}
          </Button>
        </div>
      </div>
    </form>
  );
};
