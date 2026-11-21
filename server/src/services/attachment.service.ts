import crypto from 'crypto';
import fsPromises from 'fs/promises';
import { IIssue } from '../models/Issue.js';
import { AttachmentModelAdapter, IAttachment } from '../models/Attachment.js';
import { cleanupTempUploadedFiles } from '../middleware/upload.middleware.js';
import {
  getAttachmentStorageAdapter,
  recordFailedStorageCleanup,
  StorageServiceError,
  StorageStatusInfo,
} from './storage/attachmentStorage.js';
import {
  ATTACHMENT_LIMITS_SUMMARY,
  FileValidationError,
  MAX_ATTACHMENTS_PER_ISSUE,
  MAX_FILES_PER_REQUEST,
  ValidatedAttachmentFile,
  validateUploadedFile,
} from '../validators/attachment.validator.js';

const createServiceError = (message: string, statusCode: number, code?: string) => {
  const err: any = new Error(message);
  err.statusCode = statusCode;
  if (code) err.code = code;
  return err;
};

export class AttachmentService {
  static async listIssueAttachments(issueId: string): Promise<{
    attachments: ReturnType<typeof AttachmentModelAdapter.toPublicDTO>[];
    storageStatus: StorageStatusInfo;
    limits: typeof ATTACHMENT_LIMITS_SUMMARY;
  }> {
    const adapter = getAttachmentStorageAdapter();
    const [records, storageStatus] = await Promise.all([
      AttachmentModelAdapter.findByIssue(issueId),
      adapter.getStatus(),
    ]);

    return {
      attachments: records.map((r) => AttachmentModelAdapter.toPublicDTO(r)),
      storageStatus,
      limits: ATTACHMENT_LIMITS_SUMMARY,
    };
  }

  static async uploadIssueAttachments(params: {
    issue: IIssue;
    uploadedBy: string;
    files: Array<{
      originalname: string;
      mimetype: string;
      size: number;
      buffer?: Buffer;
      path?: string;
    }>;
    idempotencyKey?: string;
  }): Promise<{
    attachments: ReturnType<typeof AttachmentModelAdapter.toPublicDTO>[];
    storageStatus: StorageStatusInfo;
    idempotentReplay: boolean;
  }> {
    const { issue, uploadedBy, files, idempotencyKey } = params;
    const issueId = issue.id!;

    try {
      if (!files || files.length === 0) {
        throw createServiceError('Please select at least one file to upload.', 400);
      }

      if (files.length > MAX_FILES_PER_REQUEST) {
        throw createServiceError(
          `You can upload at most ${MAX_FILES_PER_REQUEST} files per request.`,
          400
        );
      }

      // Check storage adapter readiness BEFORE mutating anything
      const storage = getAttachmentStorageAdapter();
      const storageStatus = await storage.getStatus();
      if (!storageStatus.configured || !storageStatus.available) {
        throw new StorageServiceError(
          storageStatus.message || 'Attachment storage service is unavailable.',
          503,
          storageStatus.configured ? 'STORAGE_UNAVAILABLE' : 'STORAGE_NOT_CONFIGURED'
        );
      }

      // Safe idempotency replay check if Idempotency-Key header is provided
      const cleanIdempotencyKey =
        idempotencyKey && idempotencyKey.trim().length > 0
          ? idempotencyKey.trim().slice(0, 128)
          : undefined;

      if (cleanIdempotencyKey) {
        const existingForKey = await AttachmentModelAdapter.findByIdempotencyKey(
          issueId,
          cleanIdempotencyKey
        );
        if (existingForKey.length > 0) {
          return {
            attachments: existingForKey.map((r) => AttachmentModelAdapter.toPublicDTO(r)),
            storageStatus,
            idempotentReplay: true,
          };
        }
      }

      // Check existing attachment count on this issue
      const currentCount = await AttachmentModelAdapter.countByIssue(issueId);
      if (currentCount + files.length > MAX_ATTACHMENTS_PER_ISSUE) {
        const remaining = Math.max(0, MAX_ATTACHMENTS_PER_ISSUE - currentCount);
        throw createServiceError(
          `Issue attachment limit reached (${MAX_ATTACHMENTS_PER_ISSUE} max). You can upload ${remaining} more file${remaining === 1 ? '' : 's'}.`,
          400
        );
      }

      // Read temp file bytes (if using diskStorage) & strictly validate ALL files before storage/DB writes
      const validatedFiles: ValidatedAttachmentFile[] = [];
      for (const file of files) {
        try {
          const buffer =
            file.buffer && file.buffer.length > 0
              ? file.buffer
              : file.path
              ? await fsPromises.readFile(file.path)
              : Buffer.alloc(0);

          validatedFiles.push(
            validateUploadedFile({
              originalname: file.originalname,
              mimetype: file.mimetype,
              size: file.size,
              buffer,
            })
          );
        } catch (err: any) {
          if (err instanceof FileValidationError) {
            throw err;
          }
          throw createServiceError(err?.message || 'Invalid uploaded file.', 400);
        }
      }

      // Upload objects and create metadata records with full rollback on partial failure
      const createdRecords: IAttachment[] = [];
      const uploadedStorageKeys: string[] = [];

      try {
        for (const file of validatedFiles) {
          const checksum = crypto.createHash('sha256').update(file.buffer).digest('hex');
          const storedFileName = `${crypto.randomUUID()}.${file.canonicalExt}`;
          const storageKey = `attachments/${issue.workspaceId}/${issue.projectId}/${issueId}/${storedFileName}`;

          const stored = await storage.putObject({
            storageKey,
            buffer: file.buffer,
            mimeType: file.canonicalMime,
            originalName: file.originalName,
          });
          uploadedStorageKeys.push(stored.storageKey);

          const created = await AttachmentModelAdapter.create({
            originalName: file.originalName,
            storedFileName,
            fileExtension: file.canonicalExt,
            storageKey: stored.storageKey,
            storageProvider: stored.provider,
            mimeType: file.canonicalMime,
            sizeBytes: file.sizeBytes,
            checksum,
            idempotencyKey: cleanIdempotencyKey,
            issueId,
            projectId: issue.projectId,
            workspaceId: issue.workspaceId,
            uploadedBy,
          });
          createdRecords.push(created);
        }
      } catch (err: any) {
        // Roll back any storage objects and DB records written in this batch
        for (const record of createdRecords) {
          try {
            if (record.id) {
              await AttachmentModelAdapter.delete(record.id);
            }
          } catch (dbCleanupErr: any) {
            console.error('[TrackFlow Attachment Rollback] Failed to remove DB metadata:', dbCleanupErr);
          }
        }

        for (const key of uploadedStorageKeys) {
          try {
            await storage.deleteObject(key);
          } catch (storageCleanupErr: any) {
            recordFailedStorageCleanup({
              storageKey: key,
              provider: storage.provider,
              reason: storageCleanupErr?.message || 'Rollback cleanup failed',
              failedAt: new Date(),
            });
          }
        }

        throw err;
      }

      return {
        attachments: createdRecords.map((r) => AttachmentModelAdapter.toPublicDTO(r)),
        storageStatus,
        idempotentReplay: false,
      };
    } finally {
      await cleanupTempUploadedFiles(files);
    }
  }

  static async downloadAttachment(attachment: IAttachment): Promise<{
    buffer: Buffer;
    originalName: string;
    mimeType: string;
    sizeBytes: number;
  }> {
    const storage = getAttachmentStorageAdapter();
    const buffer = await storage.getObject(attachment.storageKey);
    return {
      buffer,
      originalName: attachment.originalName,
      mimeType: attachment.mimeType,
      sizeBytes: attachment.sizeBytes,
    };
  }

  static async deleteAttachment(attachment: IAttachment): Promise<{
    deletedId: string;
    storageCleanupDeferred: boolean;
  }> {
    const attachmentId = attachment.id!;
    const storage = getAttachmentStorageAdapter();

    const deleted = await AttachmentModelAdapter.delete(attachmentId);
    if (!deleted) {
      throw createServiceError('Attachment not found.', 404);
    }

    let storageCleanupDeferred = false;
    try {
      await storage.deleteObject(attachment.storageKey);
    } catch (err: any) {
      storageCleanupDeferred = true;
      recordFailedStorageCleanup({
        storageKey: attachment.storageKey,
        provider: attachment.storageProvider,
        reason: err?.message || 'Storage object delete failed after metadata removal',
        failedAt: new Date(),
      });
    }

    return { deletedId: attachmentId, storageCleanupDeferred };
  }

  static async cascadeDeleteByIssue(issueId: string): Promise<void> {
    const records = await AttachmentModelAdapter.findByIssue(issueId);
    if (records.length === 0) return;

    await AttachmentModelAdapter.deleteByIssue(issueId);
    const storage = getAttachmentStorageAdapter();
    for (const rec of records) {
      try {
        await storage.deleteObject(rec.storageKey);
      } catch (err: any) {
        recordFailedStorageCleanup({
          storageKey: rec.storageKey,
          provider: rec.storageProvider,
          reason: err?.message || 'Issue cascade cleanup failed',
          failedAt: new Date(),
        });
      }
    }
  }

  static async cascadeDeleteByProject(projectId: string): Promise<void> {
    const records = await AttachmentModelAdapter.findByProject(projectId);
    if (records.length === 0) return;

    await AttachmentModelAdapter.deleteByProject(projectId);
    const storage = getAttachmentStorageAdapter();
    for (const rec of records) {
      try {
        await storage.deleteObject(rec.storageKey);
      } catch (err: any) {
        recordFailedStorageCleanup({
          storageKey: rec.storageKey,
          provider: rec.storageProvider,
          reason: err?.message || 'Project cascade cleanup failed',
          failedAt: new Date(),
        });
      }
    }
  }
}
