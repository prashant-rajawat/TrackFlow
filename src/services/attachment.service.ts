import { api } from './api';
import {
  AttachmentListResponse,
  UploadAttachmentsResponse,
} from '../types/attachment';
import { IssuePermissions } from '../types/issue';

export const CLIENT_MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
export const CLIENT_MAX_FILES_PER_REQUEST = 5;
export const CLIENT_MAX_ATTACHMENTS_PER_ISSUE = 20;
export const CLIENT_ALLOWED_EXTENSIONS = [
  '.png',
  '.jpg',
  '.jpeg',
  '.webp',
  '.pdf',
  '.txt',
  '.csv',
  '.docx',
  '.xlsx',
];

const getBaseUrl = (): string => import.meta.env.VITE_API_BASE_URL || '';

const getAuthHeaders = (): Record<string, string> => {
  const token = api.getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export const formatAttachmentSize = (bytes: number): string => {
  if (!Number.isFinite(bytes) || bytes < 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb < 10 ? kb.toFixed(1) : Math.round(kb)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(1)} MB`;
};

export const isPreviewableMimeType = (mimeType: string): boolean => {
  return (
    mimeType === 'image/png' ||
    mimeType === 'image/jpeg' ||
    mimeType === 'image/webp' ||
    mimeType === 'application/pdf' ||
    mimeType === 'text/plain'
  );
};

export const isImageMimeType = (mimeType: string): boolean =>
  mimeType === 'image/png' || mimeType === 'image/jpeg' || mimeType === 'image/webp';

export const validateClientAttachmentFiles = (
  files: File[],
  existingCount: number
): string | null => {
  if (!files || files.length === 0) {
    return 'Please select at least one file to upload.';
  }

  if (files.length > CLIENT_MAX_FILES_PER_REQUEST) {
    return `You can upload up to ${CLIENT_MAX_FILES_PER_REQUEST} files at once.`;
  }

  if (existingCount + files.length > CLIENT_MAX_ATTACHMENTS_PER_ISSUE) {
    const remaining = Math.max(0, CLIENT_MAX_ATTACHMENTS_PER_ISSUE - existingCount);
    return `Issue attachment limit (${CLIENT_MAX_ATTACHMENTS_PER_ISSUE}) exceeded. You can add ${remaining} more file${remaining === 1 ? '' : 's'}.`;
  }

  for (const file of files) {
    const name = file.name || '';
    const dotIdx = name.lastIndexOf('.');
    const ext = dotIdx >= 0 ? name.slice(dotIdx).toLowerCase() : '';
    if (!CLIENT_ALLOWED_EXTENSIONS.includes(ext)) {
      return `"${file.name}" is not a supported file type. Allowed: PNG, JPG, WEBP, PDF, TXT, CSV, DOCX, and XLSX.`;
    }
    if (file.size <= 0) {
      return `"${file.name}" is empty and cannot be uploaded.`;
    }
    if (file.size > CLIENT_MAX_FILE_SIZE_BYTES) {
      return `"${file.name}" exceeds the 10 MB per-file limit (${formatAttachmentSize(file.size)}).`;
    }
  }

  return null;
};

export const createIdempotencyKey = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `att_idem_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
};

export const attachmentService = {
  async listIssueAttachments(issueId: string): Promise<AttachmentListResponse> {
    const res = await api.get<AttachmentListResponse>(`/api/issues/${issueId}/attachments`);
    return res.data!;
  },

  uploadIssueAttachments(
    issueId: string,
    files: File[],
    options?: {
      idempotencyKey?: string;
      onProgress?: (percent: number) => void;
    }
  ): Promise<UploadAttachmentsResponse> {
    const formData = new FormData();
    for (const file of files) {
      formData.append('files', file);
    }

    const url = `${getBaseUrl()}/api/issues/${issueId}/attachments`;
    const headers = getAuthHeaders();
    const idempotencyKey = options?.idempotencyKey || createIdempotencyKey();

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', url, true);
      xhr.withCredentials = true;
      if (headers.Authorization) {
        xhr.setRequestHeader('Authorization', headers.Authorization);
      }
      xhr.setRequestHeader('Idempotency-Key', idempotencyKey);

      if (xhr.upload && typeof options?.onProgress === 'function') {
        xhr.upload.onprogress = (event: ProgressEvent) => {
          if (event.lengthComputable && event.total > 0) {
            const pct = Math.min(100, Math.round((event.loaded / event.total) * 100));
            options.onProgress!(pct);
          }
        };
      }

      xhr.onload = () => {
        let parsed: any = null;
        try {
          parsed = xhr.responseText ? JSON.parse(xhr.responseText) : null;
        } catch {
          parsed = null;
        }

        if (xhr.status >= 200 && xhr.status < 300 && parsed?.data) {
          options?.onProgress?.(100);
          resolve(parsed.data as UploadAttachmentsResponse);
          return;
        }

        const msg =
          parsed?.message ||
          (Array.isArray(parsed?.errors) && parsed.errors[0]?.message) ||
          `Upload failed with status ${xhr.status || 500}`;
        const err: any = new Error(msg);
        err.status = xhr.status || 500;
        err.code = parsed?.code;
        reject(err);
      };

      xhr.onerror = () => {
        const err: any = new Error('Network error while uploading attachment.');
        err.status = 0;
        reject(err);
      };

      xhr.send(formData);
    });
  },

  async fetchAttachmentBlob(attachmentId: string, inline = false): Promise<Blob> {
    const suffix = inline ? '?inline=1' : '';
    const response = await fetch(`${getBaseUrl()}/api/attachments/${attachmentId}/download${suffix}`, {
      method: 'GET',
      credentials: 'include',
      headers: getAuthHeaders(),
    });

    if (!response.ok) {
      let msg = `Unable to fetch attachment (status ${response.status})`;
      try {
        const json = await response.json();
        if (json?.message) msg = json.message;
      } catch {
        // Non-JSON response
      }
      const err: any = new Error(msg);
      err.status = response.status;
      throw err;
    }

    return response.blob();
  },

  async fetchAttachmentText(attachmentId: string): Promise<string> {
    const blob = await this.fetchAttachmentBlob(attachmentId, true);
    if (typeof blob.text === 'function') {
      return blob.text();
    }
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === 'string' ? reader.result : '');
      reader.onerror = () => reject(new Error('Failed to read attachment text'));
      reader.readAsText(blob);
    });
  },

  async triggerAttachmentDownload(attachmentId: string, filename: string): Promise<void> {
    const blob = await this.fetchAttachmentBlob(attachmentId, false);
    const objectUrl = URL.createObjectURL(blob);
    try {
      const anchor = document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = filename || 'attachment';
      anchor.style.display = 'none';
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
    } finally {
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    }
  },

  async deleteAttachment(
    attachmentId: string
  ): Promise<{
    deletedId: string;
    storageCleanupDeferred: boolean;
    permissions?: IssuePermissions;
  }> {
    const res = await api.delete<{
      deletedId: string;
      storageCleanupDeferred: boolean;
      permissions?: IssuePermissions;
    }>(`/api/attachments/${attachmentId}`);
    return res.data!;
  },
};
