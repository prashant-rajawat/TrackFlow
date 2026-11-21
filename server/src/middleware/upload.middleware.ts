import fs from 'fs';
import fsPromises from 'fs/promises';
import os from 'os';
import path from 'path';
import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import {
  MAX_FILES_PER_REQUEST,
  MAX_FILE_SIZE_BYTES,
} from '../validators/attachment.validator.js';

export const TEMP_UPLOAD_DIR = path.join(os.tmpdir(), 'trackflow-upload-tmp');

const ensureTempDirSync = () => {
  if (!fs.existsSync(TEMP_UPLOAD_DIR)) {
    fs.mkdirSync(TEMP_UPLOAD_DIR, { recursive: true });
  }
};

export const cleanupTempUploadedFiles = async (
  files: Array<{ path?: string }> | undefined
): Promise<void> => {
  if (!files || files.length === 0) return;
  await Promise.all(
    files.map(async (file) => {
      if (file?.path) {
        try {
          await fsPromises.unlink(file.path);
        } catch (err: any) {
          if (err?.code !== 'ENOENT') {
            console.warn('[TrackFlow Upload] Failed to remove temp file:', err?.message);
          }
        }
      }
    })
  );
};

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    try {
      ensureTempDirSync();
      cb(null, TEMP_UPLOAD_DIR);
    } catch (err: any) {
      cb(err, TEMP_UPLOAD_DIR);
    }
  },
  filename: (_req, _file, cb) => {
    // Always generate a random temporary filename; never trust client filename on disk
    cb(null, `upload_${crypto.randomUUID()}.tmp`);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: MAX_FILE_SIZE_BYTES,
    files: MAX_FILES_PER_REQUEST,
    fields: 10,
  },
});

export const parseAttachmentUpload = (req: Request, res: Response, next: NextFunction) => {
  const middleware = upload.any();
  middleware(req, res, async (err: any) => {
    if (!err) {
      return next();
    }

    // Clean up any partial temporary files written before Multer threw an error
    const rawFiles = Array.isArray(req.files)
      ? req.files
      : req.files
      ? Object.values(req.files).flat()
      : [];
    await cleanupTempUploadedFiles(rawFiles);

    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          success: false,
          message: 'One or more files exceed the maximum size limit of 10 MB per file.',
        });
      }
      if (err.code === 'LIMIT_FILE_COUNT' || err.code === 'LIMIT_UNEXPECTED_FILE') {
        return res.status(400).json({
          success: false,
          message: `You can upload at most ${MAX_FILES_PER_REQUEST} files per request.`,
        });
      }
      return res.status(400).json({
        success: false,
        message: err.message || 'Invalid multipart upload request.',
      });
    }

    return next(err);
  });
};

// Per-user sliding-window upload rate limiter (per Express instance)
const uploadTimestampsByUser = new Map<string, number[]>();
const DEFAULT_WINDOW_MS = 60 * 1000;
const DEFAULT_MAX_UPLOADS_PER_WINDOW = 30;
let uploadRateLimitOverrideForTest: number | null = null;

export const resetUploadRateLimitForTest = () => {
  uploadTimestampsByUser.clear();
  uploadRateLimitOverrideForTest = null;
};

export const setUploadRateLimitMaxForTest = (maxRequests: number | null) => {
  uploadRateLimitOverrideForTest = maxRequests;
};

export const uploadRateLimiter = (
  maxRequests = DEFAULT_MAX_UPLOADS_PER_WINDOW,
  windowMs = DEFAULT_WINDOW_MS
) => {
  return (req: Request & { user?: { id?: string } }, res: Response, next: NextFunction) => {
    const effectiveMax =
      uploadRateLimitOverrideForTest !== null ? uploadRateLimitOverrideForTest : maxRequests;
    const key = req.user?.id || req.ip || 'anonymous';
    const now = Date.now();
    const cutoff = now - windowMs;
    const history = (uploadTimestampsByUser.get(key) || []).filter((ts) => ts > cutoff);

    if (history.length >= effectiveMax) {
      const oldestInWindow = history[0] || now;
      const retryAfterSec = Math.max(1, Math.ceil((oldestInWindow + windowMs - now) / 1000));
      res.setHeader('Retry-After', String(retryAfterSec));
      res.setHeader('RateLimit-Limit', String(effectiveMax));
      res.setHeader('RateLimit-Remaining', '0');

      return res.status(429).json({
        success: false,
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many file upload requests. Please wait a moment and try again.',
      });
    }

    history.push(now);
    uploadTimestampsByUser.set(key, history);
    res.setHeader('RateLimit-Limit', String(effectiveMax));
    res.setHeader('RateLimit-Remaining', String(Math.max(0, effectiveMax - history.length)));
    next();
  };
};
