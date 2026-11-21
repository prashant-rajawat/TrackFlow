import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import {
  Paperclip,
  Upload,
  FileText,
  FileSpreadsheet,
  Image as ImageIcon,
  Eye,
  Download,
  Trash2,
  AlertCircle,
  RefreshCw,
  ShieldAlert,
  Info,
} from 'lucide-react';
import {
  AttachmentStorageStatus,
  IssueAttachment,
} from '../../types/attachment';
import { IssuePermissions } from '../../types/issue';
import {
  attachmentService,
  CLIENT_MAX_ATTACHMENTS_PER_ISSUE,
  createIdempotencyKey,
  formatAttachmentSize,
  isImageMimeType,
  isPreviewableMimeType,
  validateClientAttachmentFiles,
} from '../../services/attachment.service';
import { useOptionalAuth } from '../../context/AuthContext';
import { useOptionalToast } from '../../context/ToastContext';
import { Button } from '../common/Button';
import { AttachmentPreviewModal } from './AttachmentPreviewModal';
import { DeleteAttachmentDialog } from './DeleteAttachmentDialog';

interface AttachmentSectionProps {
  issueId: string;
  permissions: IssuePermissions;
  currentUserId?: string;
}

const formatAttachmentDate = (iso: string): string => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'Unknown date';
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
};

const mimeLabel = (mimeType: string, ext?: string): string => {
  switch (mimeType) {
    case 'image/png':
      return 'PNG';
    case 'image/jpeg':
      return 'JPG';
    case 'image/webp':
      return 'WEBP';
    case 'application/pdf':
      return 'PDF';
    case 'text/plain':
      return 'TXT';
    case 'text/csv':
      return 'CSV';
    case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
      return 'DOCX';
    case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
      return 'XLSX';
    default:
      return ext ? ext.toUpperCase() : 'FILE';
  }
};

const AttachmentThumbnail: React.FC<{ attachment: IssueAttachment }> = ({ attachment }) => {
  const [thumbUrl, setThumbUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  const isImage = isImageMimeType(attachment.mimeType);

  useEffect(() => {
    if (!isImage) {
      setThumbUrl(null);
      return;
    }

    let cancelled = false;
    let objectUrl: string | null = null;

    attachmentService
      .fetchAttachmentBlob(attachment.id, true)
      .then((blob) => {
        if (!cancelled) {
          objectUrl = URL.createObjectURL(blob);
          setThumbUrl(objectUrl);
        }
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [attachment.id, isImage]);

  if (isImage && thumbUrl && !failed) {
    return (
      <div className="w-10 h-10 rounded-lg border border-slate-200 bg-slate-50 overflow-hidden shrink-0 flex items-center justify-center">
        <img
          src={thumbUrl}
          alt=""
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
          className="w-full h-full object-cover"
        />
      </div>
    );
  }

  const isSpreadsheet =
    attachment.mimeType === 'text/csv' ||
    attachment.mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

  return (
    <div
      className="w-10 h-10 rounded-lg border border-slate-200 bg-slate-50 text-slate-500 shrink-0 flex items-center justify-center"
      aria-hidden="true"
    >
      {isImage ? (
        <ImageIcon className="w-4 h-4" />
      ) : isSpreadsheet ? (
        <FileSpreadsheet className="w-4 h-4" />
      ) : (
        <FileText className="w-4 h-4" />
      )}
    </div>
  );
};

export const AttachmentSection: React.FC<AttachmentSectionProps> = ({
  issueId,
  permissions,
  currentUserId: propUserId,
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
  const fileInputId = useId();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [attachments, setAttachments] = useState<IssueAttachment[]>([]);
  const [storageStatus, setStorageStatus] = useState<AttachmentStorageStatus | null>(null);
  const [serverPermissions, setServerPermissions] = useState<IssuePermissions | null>(null);
  const [maxAttachments, setMaxAttachments] = useState<number>(CLIENT_MAX_ATTACHMENTS_PER_ISSUE);

  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [pendingRetryUpload, setPendingRetryUpload] = useState<{
    files: File[];
    idempotencyKey: string;
  } | null>(null);

  const [previewTarget, setPreviewTarget] = useState<IssueAttachment | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<IssueAttachment | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const effectivePerms = serverPermissions || permissions;
  const canUploadAttachments =
    effectivePerms.canUploadAttachments ?? effectivePerms.canUpdate;
  const canDeleteAnyAttachment =
    effectivePerms.canDeleteAnyAttachment ?? effectivePerms.canDelete;
  const canDeleteOwnAttachment =
    effectivePerms.canDeleteOwnAttachment ?? effectivePerms.canUpdate;

  const canDeleteAttachmentRecord = (att: IssueAttachment): boolean => {
    if (canDeleteAnyAttachment) return true;
    if (canDeleteOwnAttachment && currentUserId && att.uploadedBy === currentUserId) {
      return true;
    }
    return false;
  };

  const fetchAttachments = useCallback(async () => {
    if (!issueId) return;
    setIsLoading(true);
    setLoadError(null);
    try {
      const res = await attachmentService.listIssueAttachments(issueId);
      setAttachments(res.attachments);
      setStorageStatus(res.storageStatus);
      if (res.limits?.maxAttachmentsPerIssue) {
        setMaxAttachments(res.limits.maxAttachmentsPerIssue);
      }
      if (res.permissions) {
        setServerPermissions(res.permissions);
      }
    } catch (err: any) {
      setLoadError(err?.message || 'Unable to load attachments.');
    } finally {
      setIsLoading(false);
    }
  }, [issueId]);

  useEffect(() => {
    setServerPermissions(null);
    setUploadError(null);
    setPendingRetryUpload(null);
    setPreviewTarget(null);
    setDeleteTarget(null);
    setDeleteError(null);
    fetchAttachments();
  }, [fetchAttachments]);

  const storageBlocked = storageStatus ? !storageStatus.configured || !storageStatus.available : false;

  const performUpload = async (files: File[], idempotencyKey: string) => {
    setIsUploading(true);
    setUploadProgress(5);
    setUploadError(null);

    try {
      const res = await attachmentService.uploadIssueAttachments(issueId, files, {
        idempotencyKey,
        onProgress: (pct) => setUploadProgress(pct),
      });

      setAttachments((prev) => {
        const existingIds = new Set(prev.map((a) => a.id));
        const newOnes = res.attachments.filter((a) => !existingIds.has(a.id));
        return [...newOnes, ...prev];
      });
      if (res.storageStatus) {
        setStorageStatus(res.storageStatus);
      }
      if (res.permissions) {
        setServerPermissions(res.permissions);
      }
      setPendingRetryUpload(null);
      setUploadProgress(0);
      addToast(
        `${res.attachments.length} attachment${res.attachments.length === 1 ? '' : 's'} uploaded`,
        'success'
      );
    } catch (err: any) {
      const msg = err?.message || 'Attachment upload failed.';
      setUploadError(msg);
      setPendingRetryUpload({ files, idempotencyKey });
      addToast(msg, 'error');
    } finally {
      setIsUploading(false);
    }
  };

  const handleFilesSelected = (fileList: FileList | File[]) => {
    const files = Array.from(fileList || []);
    if (files.length === 0) return;

    if (!canUploadAttachments) {
      setUploadError('You have read-only access and cannot upload attachments.');
      return;
    }

    if (storageBlocked) {
      setUploadError(
        storageStatus?.message || 'Attachment storage is currently unavailable.'
      );
      return;
    }

    const validationError = validateClientAttachmentFiles(files, attachments.length);
    if (validationError) {
      setUploadError(validationError);
      setPendingRetryUpload(null);
      return;
    }

    const idempotencyKey = createIdempotencyKey();
    void performUpload(files, idempotencyKey);
  };

  const handleDownload = async (att: IssueAttachment) => {
    setDownloadingId(att.id);
    try {
      await attachmentService.triggerAttachmentDownload(att.id, att.originalName);
    } catch (err: any) {
      addToast(err?.message || 'Failed to download attachment.', 'error');
    } finally {
      setDownloadingId((curr) => (curr === att.id ? null : curr));
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await attachmentService.deleteAttachment(deleteTarget.id);
      setAttachments((prev) => prev.filter((a) => a.id !== deleteTarget.id));
      if (previewTarget?.id === deleteTarget.id) {
        setPreviewTarget(null);
      }
      setDeleteTarget(null);
      addToast('Attachment deleted', 'success');
    } catch (err: any) {
      const msg = err?.message || 'Failed to delete attachment.';
      setDeleteError(msg);
      addToast(msg, 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <section
      aria-labelledby="issue-attachments-heading"
      className="bg-white rounded-xl border border-slate-200 p-6 space-y-5"
    >
      {/* Section Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap pb-4 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <Paperclip className="w-4 h-4 text-slate-500" aria-hidden="true" />
          <h2 id="issue-attachments-heading" className="text-sm font-semibold text-slate-900">
            Attachments
          </h2>
          <span
            aria-label={`${attachments.length} of ${maxAttachments} attachments`}
            className="font-mono text-xs font-medium text-slate-500 tabular-nums"
          >
            ({attachments.length}/{maxAttachments})
          </span>
        </div>

        <span className="text-[11px] text-slate-400 font-mono">
          PNG, JPG, WEBP, PDF, TXT, CSV, DOCX, XLSX · Max 10 MB
        </span>
      </div>

      {/* Honest Storage Notices */}
      {storageBlocked && storageStatus && (
        <div
          role="alert"
          className="p-3.5 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-start gap-2.5"
        >
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" aria-hidden="true" />
          <div>
            <p className="font-semibold">File storage unavailable</p>
            <p className="mt-0.5 text-amber-800">
              {storageStatus.message ||
                'Attachment storage is not configured for this environment.'}
            </p>
          </div>
        </div>
      )}

      {!storageBlocked &&
        (storageStatus?.provider === 'local-dev' || storageStatus?.provider === 'local') &&
        !storageStatus.persistent && (
        <div className="px-3.5 py-2.5 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-600 flex items-center gap-2">
          <Info className="w-3.5 h-3.5 text-slate-500 shrink-0" aria-hidden="true" />
          <span>
            Development local storage active. Configure S3 or Supabase Storage for durable cloud persistence.
          </span>
        </div>
      )}

      {/* Upload Dropzone or Viewer Notice */}
      {canUploadAttachments ? (
        <div className="space-y-3">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              if (!isUploading && !storageBlocked) setIsDraggingOver(true);
            }}
            onDragLeave={() => setIsDraggingOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDraggingOver(false);
              if (!isUploading && !storageBlocked && e.dataTransfer?.files?.length) {
                handleFilesSelected(e.dataTransfer.files);
              }
            }}
            className={`rounded-xl border-2 border-dashed p-4 sm:p-5 transition-colors flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 ${
              storageBlocked
                ? 'border-slate-200 bg-slate-50 opacity-60 cursor-not-allowed'
                : isDraggingOver
                ? 'border-blue-600 bg-blue-50/60'
                : 'border-slate-300 bg-slate-50/40 hover:border-slate-400'
            }`}
          >
            <div className="flex items-start gap-3 min-w-0">
              <div className="w-9 h-9 rounded-lg bg-white border border-slate-200 flex items-center justify-center shrink-0 text-slate-600">
                <Upload className="w-4 h-4" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold text-slate-900">
                  Drag and drop files here, or browse from your device
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Up to 5 files per upload · 10 MB per file · {Math.max(0, maxAttachments - attachments.length)} slot{maxAttachments - attachments.length === 1 ? '' : 's'} remaining
                </p>
              </div>
            </div>

            <div className="shrink-0">
              <input
                ref={fileInputRef}
                id={fileInputId}
                type="file"
                multiple
                accept=".png,.jpg,.jpeg,.webp,.pdf,.txt,.csv,.docx,.xlsx,image/png,image/jpeg,image/webp,application/pdf,text/plain,text/csv,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                disabled={isUploading || storageBlocked || attachments.length >= maxAttachments}
                onChange={(e) => {
                  if (e.target.files?.length) {
                    handleFilesSelected(e.target.files);
                  }
                  e.target.value = '';
                }}
                className="sr-only"
                aria-label="Choose attachment files"
              />
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={isUploading || storageBlocked || attachments.length >= maxAttachments}
                onClick={() => fileInputRef.current?.click()}
                className="min-h-[40px] w-full sm:w-auto"
              >
                Choose Files
              </Button>
            </div>
          </div>

          {isUploading && (
            <div className="p-3 rounded-lg border border-slate-200 bg-slate-50 space-y-2">
              <div className="flex items-center justify-between text-xs font-medium text-slate-700">
                <span>Uploading attachment(s)...</span>
                <span className="font-mono tabular-nums">{uploadProgress}%</span>
              </div>
              <div
                role="progressbar"
                aria-label="Attachment upload progress"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={uploadProgress}
                className="w-full h-2 bg-slate-200 rounded-full overflow-hidden"
              >
                <div
                  className="h-full bg-slate-900 transition-all duration-150"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}

          {uploadError && (
            <div
              role="alert"
              className="p-3.5 rounded-lg bg-rose-50 border border-rose-200 flex items-center justify-between gap-3 flex-wrap"
            >
              <div className="flex items-start gap-2 text-xs text-rose-700">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
                <span>{uploadError}</span>
              </div>
              {pendingRetryUpload && !isUploading && (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
                  onClick={() =>
                    performUpload(
                      pendingRetryUpload.files,
                      pendingRetryUpload.idempotencyKey
                    )
                  }
                >
                  Retry Upload
                </Button>
              )}
            </div>
          )}
        </div>
      ) : (
        <div className="px-3.5 py-2.5 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-600 flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-slate-500 shrink-0" aria-hidden="true" />
          <span>
            Read-only access: viewers can inspect and download attachments, while developers and project admins can upload files.
          </span>
        </div>
      )}

      {/* Attachments List States */}
      {isLoading ? (
        <div className="space-y-2.5" aria-label="Loading attachments">
          {[1, 2].map((idx) => (
            <div
              key={idx}
              className="p-3 rounded-lg border border-slate-200 flex items-center justify-between gap-3 animate-pulse"
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="w-10 h-10 rounded-lg bg-slate-200 shrink-0" />
                <div className="space-y-1.5 flex-1 min-w-0">
                  <div className="h-3.5 w-44 bg-slate-200 rounded" />
                  <div className="h-3 w-56 bg-slate-100 rounded" />
                </div>
              </div>
              <div className="h-8 w-20 bg-slate-100 rounded shrink-0" />
            </div>
          ))}
        </div>
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
            leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
            onClick={fetchAttachments}
          >
            Retry
          </Button>
        </div>
      ) : attachments.length === 0 ? (
        <div className="py-5 text-center border-t border-slate-100">
          <p className="text-sm font-medium text-slate-600">No attachments yet</p>
          <p className="text-xs text-slate-400 mt-1">
            {canUploadAttachments
              ? 'Attach screenshots, logs, or specification PDFs to provide clear context.'
              : 'No files have been attached to this issue yet.'}
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
          {attachments.map((att) => {
            const previewable = isPreviewableMimeType(att.mimeType);
            const canDeleteThis = canDeleteAttachmentRecord(att);
            const uploaderName = att.uploader?.fullName || att.uploader?.email || 'Team member';

            return (
              <li
                key={att.id}
                className="p-3.5 sm:px-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 hover:bg-slate-50/70 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <AttachmentThumbnail attachment={att} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-900 truncate">
                      {att.originalName}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5 font-mono tabular-nums truncate">
                      {mimeLabel(att.mimeType, att.fileExtension)} · {formatAttachmentSize(att.sizeBytes)} · Uploaded by{' '}
                      <span className="font-sans">{uploaderName}</span> · {formatAttachmentDate(att.createdAt)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                  {previewable && (
                    <button
                      type="button"
                      onClick={() => setPreviewTarget(att)}
                      aria-label={`Preview ${att.originalName}`}
                      className="inline-flex items-center gap-1.5 px-2.5 min-h-[40px] sm:min-h-[34px] text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors"
                    >
                      <Eye className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>Preview</span>
                    </button>
                  )}

                  <button
                    type="button"
                    disabled={downloadingId === att.id}
                    onClick={() => handleDownload(att)}
                    aria-label={`Download ${att.originalName}`}
                    className="inline-flex items-center gap-1.5 px-2.5 min-h-[40px] sm:min-h-[34px] text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors disabled:opacity-50"
                  >
                    <Download className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>{downloadingId === att.id ? 'Downloading...' : 'Download'}</span>
                  </button>

                  {canDeleteThis && (
                    <button
                      type="button"
                      onClick={() => {
                        setDeleteError(null);
                        setDeleteTarget(att);
                      }}
                      aria-label={`Delete ${att.originalName}`}
                      title={`Delete ${att.originalName}`}
                      className="inline-flex items-center justify-center min-w-[40px] min-h-[40px] sm:min-w-[34px] sm:min-h-[34px] p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" aria-hidden="true" />
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <AttachmentPreviewModal
        attachment={previewTarget}
        onClose={() => setPreviewTarget(null)}
        onDownload={handleDownload}
      />

      <DeleteAttachmentDialog
        isOpen={!!deleteTarget}
        attachment={deleteTarget}
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
