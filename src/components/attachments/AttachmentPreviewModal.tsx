import React, { useEffect, useState } from 'react';
import { Download, FileText, Loader2, AlertCircle, X, Image as ImageIcon } from 'lucide-react';
import { IssueAttachment } from '../../types/attachment';
import {
  attachmentService,
  formatAttachmentSize,
  isImageMimeType,
} from '../../services/attachment.service';
import { Button } from '../common/Button';

interface AttachmentPreviewModalProps {
  attachment: IssueAttachment | null;
  onClose: () => void;
  onDownload: (attachment: IssueAttachment) => Promise<void> | void;
}

export const AttachmentPreviewModal: React.FC<AttachmentPreviewModalProps> = ({
  attachment,
  onClose,
  onDownload,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [textContent, setTextContent] = useState<string | null>(null);
  const [imageLoadFailed, setImageLoadFailed] = useState(false);

  useEffect(() => {
    if (!attachment) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [attachment, onClose]);

  useEffect(() => {
    if (!attachment) {
      setBlobUrl(null);
      setTextContent(null);
      setError(null);
      setImageLoadFailed(false);
      return;
    }

    let cancelled = false;
    let createdObjectUrl: string | null = null;

    setIsLoading(true);
    setError(null);
    setBlobUrl(null);
    setTextContent(null);
    setImageLoadFailed(false);

    const loadPreview = async () => {
      try {
        if (attachment.mimeType === 'text/plain') {
          const text = await attachmentService.fetchAttachmentText(attachment.id);
          if (!cancelled) {
            setTextContent(text);
          }
        } else {
          const blob = await attachmentService.fetchAttachmentBlob(attachment.id, true);
          if (!cancelled) {
            createdObjectUrl = URL.createObjectURL(blob);
            setBlobUrl(createdObjectUrl);
          }
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err?.message || 'Unable to load attachment preview.');
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    loadPreview();

    return () => {
      cancelled = true;
      if (createdObjectUrl) {
        URL.revokeObjectURL(createdObjectUrl);
      }
    };
  }, [attachment?.id]);

  if (!attachment) return null;

  const isImage = isImageMimeType(attachment.mimeType);
  const isPdf = attachment.mimeType === 'application/pdf';
  const isText = attachment.mimeType === 'text/plain';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="attachment-preview-title"
        className="w-full max-w-4xl max-h-[90vh] bg-white rounded-xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-3 bg-slate-50/70">
          <div className="min-w-0">
            <h2
              id="attachment-preview-title"
              className="text-sm font-semibold text-slate-900 truncate"
            >
              {attachment.originalName}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5 font-mono tabular-nums">
              {attachment.mimeType} · {formatAttachmentSize(attachment.sizeBytes)}
              {attachment.uploader?.fullName ? ` · ${attachment.uploader.fullName}` : ''}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              leftIcon={<Download className="w-3.5 h-3.5" />}
              onClick={() => onDownload(attachment)}
            >
              Download
            </Button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close attachment preview"
              className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-lg transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto p-5 bg-slate-100/70 flex items-center justify-center min-h-[280px]">
          {isLoading ? (
            <div className="flex flex-col items-center gap-2.5 text-slate-500 py-12">
              <Loader2 className="w-6 h-6 animate-spin text-slate-600" aria-hidden="true" />
              <span className="text-xs font-medium">Loading secure preview...</span>
            </div>
          ) : error ? (
            <div
              role="alert"
              className="max-w-md w-full bg-white rounded-lg border border-rose-200 p-5 text-center space-y-3"
            >
              <AlertCircle className="w-6 h-6 text-rose-600 mx-auto" aria-hidden="true" />
              <p className="text-sm font-medium text-slate-900">Preview unavailable</p>
              <p className="text-xs text-slate-600">{error}</p>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                leftIcon={<Download className="w-3.5 h-3.5" />}
                onClick={() => onDownload(attachment)}
              >
                Download File Instead
              </Button>
            </div>
          ) : isImage && blobUrl && !imageLoadFailed ? (
            <img
              src={blobUrl}
              alt={attachment.originalName}
              referrerPolicy="no-referrer"
              onError={() => setImageLoadFailed(true)}
              className="max-w-full max-h-[68vh] object-contain rounded-lg border border-slate-200 bg-white shadow-xs"
            />
          ) : isImage && imageLoadFailed ? (
            <div className="bg-white rounded-lg border border-slate-200 p-8 text-center space-y-2 max-w-sm">
              <ImageIcon className="w-8 h-8 text-slate-400 mx-auto" aria-hidden="true" />
              <p className="text-sm font-medium text-slate-800">Unable to render image</p>
              <p className="text-xs text-slate-500">Download the file to open it locally.</p>
            </div>
          ) : isPdf && blobUrl ? (
            <iframe
              title={attachment.originalName}
              src={blobUrl}
              className="w-full h-[68vh] rounded-lg border border-slate-200 bg-white"
            />
          ) : isText && textContent !== null ? (
            <pre className="w-full max-h-[68vh] overflow-auto p-4 rounded-lg border border-slate-200 bg-white text-xs font-mono text-slate-800 whitespace-pre-wrap break-words leading-relaxed">
              {textContent}
            </pre>
          ) : (
            <div className="bg-white rounded-lg border border-slate-200 p-8 text-center space-y-3 max-w-sm w-full">
              <FileText className="w-8 h-8 text-slate-400 mx-auto" aria-hidden="true" />
              <div className="space-y-1">
                <p className="text-sm font-semibold text-slate-900 truncate">
                  {attachment.originalName}
                </p>
                <p className="text-xs text-slate-500 font-mono tabular-nums">
                  {attachment.fileExtension?.toUpperCase() || attachment.mimeType} · {formatAttachmentSize(attachment.sizeBytes)}
                </p>
              </div>
              <p className="text-xs text-slate-500">
                Browser preview is not available for this file type. Download the file to open it safely on your device.
              </p>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                leftIcon={<Download className="w-3.5 h-3.5" />}
                onClick={() => onDownload(attachment)}
              >
                Download File
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
