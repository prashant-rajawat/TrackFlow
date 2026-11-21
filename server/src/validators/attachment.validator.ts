import path from 'path';

export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
export const MAX_FILES_PER_REQUEST = 5;
export const MAX_ATTACHMENTS_PER_ISSUE = 20;

export const ALLOWED_ATTACHMENT_RULES: Record<
  string,
  {
    canonicalExt: string;
    canonicalMime: string;
    acceptedMimes: string[];
  }
> = {
  '.png': {
    canonicalExt: 'png',
    canonicalMime: 'image/png',
    acceptedMimes: ['image/png'],
  },
  '.jpg': {
    canonicalExt: 'jpg',
    canonicalMime: 'image/jpeg',
    acceptedMimes: ['image/jpeg', 'image/jpg'],
  },
  '.jpeg': {
    canonicalExt: 'jpg',
    canonicalMime: 'image/jpeg',
    acceptedMimes: ['image/jpeg', 'image/jpg'],
  },
  '.webp': {
    canonicalExt: 'webp',
    canonicalMime: 'image/webp',
    acceptedMimes: ['image/webp'],
  },
  '.pdf': {
    canonicalExt: 'pdf',
    canonicalMime: 'application/pdf',
    acceptedMimes: ['application/pdf'],
  },
  '.txt': {
    canonicalExt: 'txt',
    canonicalMime: 'text/plain',
    acceptedMimes: ['text/plain'],
  },
  '.csv': {
    canonicalExt: 'csv',
    canonicalMime: 'text/csv',
    acceptedMimes: ['text/csv', 'application/csv', 'application/vnd.ms-excel', 'text/plain'],
  },
  '.docx': {
    canonicalExt: 'docx',
    canonicalMime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    acceptedMimes: [
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/zip',
      'application/x-zip-compressed',
      'application/octet-stream',
    ],
  },
  '.xlsx': {
    canonicalExt: 'xlsx',
    canonicalMime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    acceptedMimes: [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'application/zip',
      'application/x-zip-compressed',
      'application/octet-stream',
    ],
  },
};

export const ATTACHMENT_LIMITS_SUMMARY = {
  maxFileSizeBytes: MAX_FILE_SIZE_BYTES,
  maxFilesPerRequest: MAX_FILES_PER_REQUEST,
  maxAttachmentsPerIssue: MAX_ATTACHMENTS_PER_ISSUE,
  allowedExtensions: ['.png', '.jpg', '.jpeg', '.webp', '.pdf', '.txt', '.csv', '.docx', '.xlsx'],
  allowedMimeTypes: [
    'image/png',
    'image/jpeg',
    'image/webp',
    'application/pdf',
    'text/plain',
    'text/csv',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ],
};

export interface ValidatedAttachmentFile {
  originalName: string;
  canonicalExt: string;
  canonicalMime: string;
  sizeBytes: number;
  buffer: Buffer;
}

export class FileValidationError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = 'FileValidationError';
    this.statusCode = statusCode;
  }
}

export const sanitizeOriginalFilename = (rawName: string): string => {
  if (!rawName || typeof rawName !== 'string') {
    throw new FileValidationError('Filename is required.');
  }

  // Reject explicit traversal sequences or null bytes before normalization
  if (rawName.includes('\0') || rawName.includes('..') || rawName.includes('/') || rawName.includes('\\')) {
    throw new FileValidationError('Filename contains invalid path characters.');
  }

  const base = path.basename(rawName).replace(/[\x00-\x1f\x7f<>:"|?*]/g, '').trim();
  if (!base || base.startsWith('.')) {
    throw new FileValidationError('Invalid filename.');
  }

  if (base.length > 200) {
    const ext = path.extname(base);
    const stem = path.basename(base, ext).slice(0, 200 - ext.length);
    return `${stem}${ext}`;
  }

  return base;
};

const isSafeUtf8TextContent = (buf: Buffer): boolean => {
  for (let i = 0; i < buf.length; i++) {
    const b = buf[i];
    if (b === 0x00) return false;
    if (b < 0x20 && b !== 0x09 && b !== 0x0a && b !== 0x0d) {
      return false;
    }
  }
  const head = buf.subarray(0, Math.min(buf.length, 512)).toString('utf8').trimStart().toLowerCase();
  if (
    head.startsWith('<!doctype html') ||
    head.startsWith('<html') ||
    head.startsWith('<svg') ||
    head.startsWith('<script') ||
    head.startsWith('<?xml') ||
    head.startsWith('#!') ||
    (buf.length >= 2 && buf[0] === 0x4d && buf[1] === 0x5a) || // MZ (PE/EXE)
    (buf.length >= 4 && buf[0] === 0x7f && buf[1] === 0x45 && buf[2] === 0x4c && buf[3] === 0x46) || // ELF
    (buf.length >= 4 && buf[0] === 0x50 && buf[1] === 0x4b && buf[2] === 0x03 && buf[3] === 0x04) // ZIP/JAR
  ) {
    return false;
  }
  return true;
};

const isZipOpenXmlContainer = (buf: Buffer, requiredDirMarker: string): boolean => {
  // Check ZIP local file header (PK\x03\x04) or empty central dir (PK\x05\x06)
  if (
    buf.length < 22 ||
    buf[0] !== 0x50 ||
    buf[1] !== 0x4b ||
    !((buf[2] === 0x03 && buf[3] === 0x04) || (buf[2] === 0x05 && buf[3] === 0x06))
  ) {
    return false;
  }

  // Verify OpenXML package markers inside the archive headers while rejecting Java JARs/executables
  const latin = buf.toString('latin1');
  if (latin.includes('META-INF/MANIFEST.MF') || latin.includes('.class')) {
    return false;
  }

  return latin.includes('[Content_Types].xml') && latin.includes(requiredDirMarker);
};

const verifyMagicBytes = (ext: string, buf: Buffer): boolean => {
  if (buf.length === 0) return false;

  switch (ext) {
    case '.png': {
      const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
      if (buf.length < sig.length) return false;
      return sig.every((byte, idx) => buf[idx] === byte);
    }
    case '.jpg':
    case '.jpeg': {
      return buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff;
    }
    case '.webp': {
      return (
        buf.length >= 12 &&
        buf.subarray(0, 4).toString('ascii') === 'RIFF' &&
        buf.subarray(8, 12).toString('ascii') === 'WEBP'
      );
    }
    case '.pdf': {
      return buf.length >= 5 && buf.subarray(0, 5).toString('ascii') === '%PDF-';
    }
    case '.txt':
    case '.csv': {
      return isSafeUtf8TextContent(buf);
    }
    case '.docx': {
      return isZipOpenXmlContainer(buf, 'word/');
    }
    case '.xlsx': {
      return isZipOpenXmlContainer(buf, 'xl/');
    }
    default:
      return false;
  }
};

export const validateUploadedFile = (file: {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}): ValidatedAttachmentFile => {
  const sanitizedName = sanitizeOriginalFilename(file.originalname);
  const ext = path.extname(sanitizedName).toLowerCase();
  const rule = ALLOWED_ATTACHMENT_RULES[ext];

  if (!rule) {
    throw new FileValidationError(
      `Unsupported file type '${ext || 'unknown'}'. Allowed types: PNG, JPG, JPEG, WEBP, PDF, TXT, CSV, DOCX, and XLSX.`
    );
  }

  const claimedMime = (file.mimetype || '').split(';')[0].trim().toLowerCase();
  if (!rule.acceptedMimes.includes(claimedMime)) {
    throw new FileValidationError(
      `Invalid content type '${claimedMime || 'unknown'}' for '${sanitizedName}'.`
    );
  }

  const sizeBytes = file.buffer ? file.buffer.length : file.size;
  if (!sizeBytes || sizeBytes <= 0) {
    throw new FileValidationError(`File '${sanitizedName}' is empty.`);
  }

  if (sizeBytes > MAX_FILE_SIZE_BYTES) {
    throw new FileValidationError(
      `File '${sanitizedName}' exceeds the maximum allowed size of 10 MB.`
    );
  }

  if (!file.buffer || !verifyMagicBytes(ext, file.buffer)) {
    throw new FileValidationError(
      `File '${sanitizedName}' content signature does not match its declared ${rule.canonicalExt.toUpperCase()} format.`
    );
  }

  return {
    originalName: sanitizedName,
    canonicalExt: rule.canonicalExt,
    canonicalMime: rule.canonicalMime,
    sizeBytes,
    buffer: file.buffer,
  };
};
