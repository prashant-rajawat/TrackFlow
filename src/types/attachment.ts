import { IssuePermissions, IssueUserSummary } from './issue';

export type AttachmentStorageProvider =
  | 'local'
  | 'local-dev'
  | 's3'
  | 'cloudinary'
  | 'supabase'
  | 'memory'
  | 'memory-test'
  | 'unconfigured';

export interface IssueAttachment {
  id: string;
  originalName: string;
  fileExtension?: string;
  storageProvider?: AttachmentStorageProvider;
  mimeType: string;
  sizeBytes: number;
  checksum?: string;
  issueId: string;
  projectId: string;
  workspaceId: string;
  uploadedBy: string;
  uploader?: IssueUserSummary | null;
  createdAt: string;
  updatedAt: string;
}

export interface AttachmentStorageStatus {
  provider: AttachmentStorageProvider;
  configured: boolean;
  available: boolean;
  persistent: boolean;
  message?: string;
}

export interface AttachmentLimits {
  maxFileSizeBytes: number;
  maxFilesPerRequest: number;
  maxAttachmentsPerIssue: number;
  allowedExtensions: string[];
  allowedMimeTypes: string[];
}

export interface AttachmentListResponse {
  attachments: IssueAttachment[];
  storageStatus: AttachmentStorageStatus;
  limits: AttachmentLimits;
  permissions?: IssuePermissions;
}

export interface UploadAttachmentsResponse {
  attachments: IssueAttachment[];
  storageStatus: AttachmentStorageStatus;
  idempotentReplay: boolean;
  permissions?: IssuePermissions;
}
