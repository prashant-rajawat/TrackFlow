import { Response, NextFunction } from 'express';
import { IssueAuthorizedRequest } from '../services/issue.rbac.service.js';
import { AttachmentAuthorizedRequest } from '../services/attachment.rbac.service.js';
import { AttachmentService } from '../services/attachment.service.js';
import { AttachmentModelAdapter } from '../models/Attachment.js';

const INLINE_SAFE_MIME_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/webp',
  'application/pdf',
  'text/plain',
]);

const sanitizeHeaderFilename = (rawName: string): string => {
  const cleaned = rawName
    .replace(/[\r\n"\\]/g, '_')
    .replace(/[^\x20-\x7E]/g, '_')
    .trim();
  return cleaned || 'attachment';
};

export const listIssueAttachments = async (
  req: IssueAuthorizedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const result = await AttachmentService.listIssueAttachments(req.issue!.id!);

    return res.status(200).json({
      success: true,
      data: {
        ...result,
        permissions: req.issuePermissions,
      },
    });
  } catch (error: any) {
    next(error);
  }
};

export const uploadIssueAttachments = async (
  req: IssueAuthorizedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const rawFiles = Array.isArray(req.files)
      ? req.files
      : req.files
      ? Object.values(req.files).flat()
      : [];

    const idempotencyKey = req.header('Idempotency-Key') || undefined;

    const result = await AttachmentService.uploadIssueAttachments({
      issue: req.issue!,
      uploadedBy: req.user!.id!,
      files: rawFiles.map((f) => ({
        originalname: f.originalname,
        mimetype: f.mimetype,
        size: f.size,
        buffer: f.buffer,
        path: f.path,
      })),
      idempotencyKey,
    });

    return res.status(result.idempotentReplay ? 200 : 201).json({
      success: true,
      message: result.idempotentReplay
        ? 'Attachment upload already processed'
        : `${result.attachments.length} attachment${result.attachments.length === 1 ? '' : 's'} uploaded successfully`,
      data: {
        attachments: result.attachments,
        storageStatus: result.storageStatus,
        idempotentReplay: result.idempotentReplay,
        permissions: req.issuePermissions,
      },
    });
  } catch (error: any) {
    next(error);
  }
};

export const getAttachment = async (
  req: AttachmentAuthorizedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    return res.status(200).json({
      success: true,
      data: {
        attachment: AttachmentModelAdapter.toPublicDTO(req.attachment!),
        permissions: req.issuePermissions,
      },
    });
  } catch (error: any) {
    next(error);
  }
};

export const downloadAttachment = async (
  req: AttachmentAuthorizedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const attachment = req.attachment!;
    const downloaded = await AttachmentService.downloadAttachment(attachment);

    const asciiFallback = sanitizeHeaderFilename(downloaded.originalName);
    const encodedName = encodeURIComponent(downloaded.originalName);
    const wantsInline = req.query.inline === '1' && INLINE_SAFE_MIME_TYPES.has(downloaded.mimeType);
    const disposition = wantsInline ? 'inline' : 'attachment';

    res.setHeader('Content-Type', downloaded.mimeType);
    res.setHeader('Content-Length', String(downloaded.buffer.length));
    res.setHeader(
      'Content-Disposition',
      `${disposition}; filename="${asciiFallback}"; filename*=UTF-8''${encodedName}`
    );
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');

    return res.status(200).send(downloaded.buffer);
  } catch (error: any) {
    next(error);
  }
};

export const deleteAttachment = async (
  req: AttachmentAuthorizedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const result = await AttachmentService.deleteAttachment(req.attachment!);

    return res.status(200).json({
      success: true,
      message: 'Attachment deleted successfully',
      data: {
        ...result,
        permissions: req.issuePermissions,
      },
    });
  } catch (error: any) {
    next(error);
  }
};
