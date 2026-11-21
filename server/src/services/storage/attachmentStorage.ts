import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { isProductionEnvironment, isTestEnvironment } from '../../config/db.js';

export type StorageProviderType =
  | 's3'
  | 'cloudinary'
  | 'supabase'
  | 'local-dev'
  | 'memory-test'
  | 'unconfigured';

export interface StorageStatusInfo {
  configured: boolean;
  available: boolean;
  persistent: boolean;
  provider: StorageProviderType;
  message?: string;
}

export interface PutObjectInput {
  storageKey: string;
  buffer: Buffer;
  mimeType: string;
  originalName: string;
}

export interface AttachmentStorageAdapter {
  readonly provider: StorageProviderType;
  isConfigured(): boolean;
  isPersistentProductionSafe(): boolean;
  getStatus(): Promise<StorageStatusInfo>;
  putObject(input: PutObjectInput): Promise<{ provider: StorageProviderType; storageKey: string }>;
  getObject(storageKey: string): Promise<Buffer>;
  deleteObject(storageKey: string): Promise<void>;
  objectExists(storageKey: string): Promise<boolean>;
}

export class StorageServiceError extends Error {
  statusCode: number;
  code: string;

  constructor(message: string, statusCode = 503, code = 'STORAGE_UNAVAILABLE') {
    super(message);
    this.name = 'StorageServiceError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

export interface PendingStorageCleanup {
  storageKey: string;
  provider: StorageProviderType;
  reason: string;
  failedAt: Date;
}

const pendingCleanupQueue: PendingStorageCleanup[] = [];

export const recordFailedStorageCleanup = (entry: PendingStorageCleanup): void => {
  pendingCleanupQueue.push(entry);
  console.warn(
    `[TrackFlow Storage Cleanup] Deferred cleanup queued for key="${entry.storageKey}" provider="${entry.provider}": ${entry.reason}`
  );
};

export const getPendingStorageCleanups = (): PendingStorageCleanup[] => [...pendingCleanupQueue];
export const clearPendingStorageCleanups = (): void => {
  pendingCleanupQueue.length = 0;
};

const assertSafeStorageKey = (storageKey: string): string => {
  const normalized = storageKey.replace(/\\/g, '/').replace(/^\/+/, '');
  if (
    !normalized ||
    normalized.includes('..') ||
    normalized.includes('\0') ||
    !/^[a-zA-Z0-9/_.-]+$/.test(normalized)
  ) {
    throw new StorageServiceError('Invalid storage key.', 400, 'INVALID_STORAGE_KEY');
  }
  return normalized;
};

/**
 * Unconfigured fail-closed adapter used in production when no external persistent
 * object storage provider (S3, Cloudinary, or Supabase) is configured, or in dev when disabled.
 */
class UnconfiguredStorageAdapter implements AttachmentStorageAdapter {
  readonly provider: StorageProviderType = 'unconfigured';
  private readonly reason: string;

  constructor(reason?: string) {
    this.reason =
      reason ||
      'Persistent object storage is not configured. Configure S3, Cloudinary, or Supabase Storage credentials on the server.';
  }

  isConfigured(): boolean {
    return false;
  }

  isPersistentProductionSafe(): boolean {
    return false;
  }

  async getStatus(): Promise<StorageStatusInfo> {
    return {
      configured: false,
      available: false,
      persistent: false,
      provider: 'unconfigured',
      message: this.reason,
    };
  }

  async putObject(): Promise<never> {
    throw new StorageServiceError(this.reason, 503, 'STORAGE_NOT_CONFIGURED');
  }

  async getObject(): Promise<never> {
    throw new StorageServiceError(this.reason, 503, 'STORAGE_NOT_CONFIGURED');
  }

  async deleteObject(): Promise<never> {
    throw new StorageServiceError(this.reason, 503, 'STORAGE_NOT_CONFIGURED');
  }

  async objectExists(): Promise<boolean> {
    return false;
  }
}

/**
 * Local disk storage adapter strictly restricted to non-production development.
 * Never exposed in production or via static public directories.
 */
class LocalDevStorageAdapter implements AttachmentStorageAdapter {
  readonly provider: StorageProviderType = 'local-dev';
  private readonly baseDir: string;

  constructor(baseDir?: string) {
    this.baseDir = path.resolve(baseDir || process.env.LOCAL_UPLOAD_DIR || '.trackflow-uploads');
  }

  isConfigured(): boolean {
    return true;
  }

  isPersistentProductionSafe(): boolean {
    return false;
  }

  private resolveSafePath(storageKey: string): string {
    const safeKey = assertSafeStorageKey(storageKey);
    const resolved = path.resolve(this.baseDir, safeKey);
    if (!resolved.startsWith(this.baseDir + path.sep)) {
      throw new StorageServiceError('Path traversal detected in storage key.', 400, 'INVALID_STORAGE_KEY');
    }
    return resolved;
  }

  async getStatus(): Promise<StorageStatusInfo> {
    return {
      configured: true,
      available: true,
      persistent: false,
      provider: 'local-dev',
      message:
        'Using local development disk storage (.trackflow-uploads). Configure S3, Cloudinary, or Supabase Storage for persistent cloud production storage.',
    };
  }

  async putObject(input: PutObjectInput): Promise<{ provider: StorageProviderType; storageKey: string }> {
    const targetPath = this.resolveSafePath(input.storageKey);
    await fs.mkdir(path.dirname(targetPath), { recursive: true });
    await fs.writeFile(targetPath, input.buffer, { flag: 'wx' });
    return { provider: this.provider, storageKey: input.storageKey };
  }

  async getObject(storageKey: string): Promise<Buffer> {
    const targetPath = this.resolveSafePath(storageKey);
    try {
      return await fs.readFile(targetPath);
    } catch (err: any) {
      if (err?.code === 'ENOENT') {
        throw new StorageServiceError('Attachment binary was not found in storage.', 404, 'OBJECT_NOT_FOUND');
      }
      throw new StorageServiceError('Unable to read attachment from storage.', 503, 'STORAGE_READ_FAILED');
    }
  }

  async deleteObject(storageKey: string): Promise<void> {
    const targetPath = this.resolveSafePath(storageKey);
    try {
      await fs.unlink(targetPath);
    } catch (err: any) {
      if (err?.code === 'ENOENT') return;
      throw new StorageServiceError('Failed to delete attachment object from storage.', 503, 'STORAGE_DELETE_FAILED');
    }
  }

  async objectExists(storageKey: string): Promise<boolean> {
    const targetPath = this.resolveSafePath(storageKey);
    try {
      await fs.stat(targetPath);
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * AWS S3 / S3-compatible REST adapter signed with AWS Signature Version 4 using Node crypto + fetch.
 * Activated ONLY when real S3 credentials are configured in environment variables.
 */
class S3StorageAdapter implements AttachmentStorageAdapter {
  readonly provider: StorageProviderType = 's3';
  private readonly bucket: string;
  private readonly region: string;
  private readonly accessKeyId: string;
  private readonly secretAccessKey: string;
  private readonly endpoint: string;

  constructor(cfg: {
    bucket: string;
    region: string;
    accessKeyId: string;
    secretAccessKey: string;
    endpoint?: string;
  }) {
    this.bucket = cfg.bucket;
    this.region = cfg.region;
    this.accessKeyId = cfg.accessKeyId;
    this.secretAccessKey = cfg.secretAccessKey;
    this.endpoint = (cfg.endpoint || `https://${cfg.bucket}.s3.${cfg.region}.amazonaws.com`).replace(/\/+$/, '');
  }

  isConfigured(): boolean {
    return true;
  }

  isPersistentProductionSafe(): boolean {
    return true;
  }

  async getStatus(): Promise<StorageStatusInfo> {
    return {
      configured: true,
      available: true,
      persistent: true,
      provider: 's3',
    };
  }

  private signRequest(method: string, storageKey: string, payloadHash: string, extraHeaders: Record<string, string> = {}) {
    const safeKey = assertSafeStorageKey(storageKey);
    const url = new URL(`${this.endpoint}/${safeKey}`);
    const now = new Date();
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
    const dateStamp = amzDate.slice(0, 8);
    const credentialScope = `${dateStamp}/${this.region}/s3/aws4_request`;

    const headers: Record<string, string> = {
      host: url.host,
      'x-amz-content-sha256': payloadHash,
      'x-amz-date': amzDate,
      ...extraHeaders,
    };

    const sortedKeys = Object.keys(headers).sort();
    const canonicalHeaders = sortedKeys.map((k) => `${k.toLowerCase()}:${headers[k].trim()}\n`).join('');
    const signedHeaders = sortedKeys.map((k) => k.toLowerCase()).join(';');
    const canonicalRequest = [
      method,
      url.pathname,
      '',
      canonicalHeaders,
      signedHeaders,
      payloadHash,
    ].join('\n');

    const stringToSign = [
      'AWS4-HMAC-SHA256',
      amzDate,
      credentialScope,
      crypto.createHash('sha256').update(canonicalRequest).digest('hex'),
    ].join('\n');

    const hmac = (key: Buffer | string, data: string) =>
      crypto.createHmac('sha256', key).update(data).digest();
    const kDate = hmac(`AWS4${this.secretAccessKey}`, dateStamp);
    const kRegion = hmac(kDate, this.region);
    const kService = hmac(kRegion, 's3');
    const kSigning = hmac(kService, 'aws4_request');
    const signature = crypto.createHmac('sha256', kSigning).update(stringToSign).digest('hex');

    headers.Authorization = `AWS4-HMAC-SHA256 Credential=${this.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
    return { url: url.toString(), headers };
  }

  async putObject(input: PutObjectInput): Promise<{ provider: StorageProviderType; storageKey: string }> {
    const payloadHash = crypto.createHash('sha256').update(input.buffer).digest('hex');
    const { url, headers } = this.signRequest('PUT', input.storageKey, payloadHash, {
      'content-type': input.mimeType,
    });
    const res = await fetch(url, { method: 'PUT', headers, body: new Uint8Array(input.buffer) });
    if (!res.ok) {
      throw new StorageServiceError(`Object storage upload failed (${res.status}).`, 503, 'STORAGE_UPLOAD_FAILED');
    }
    return { provider: 's3', storageKey: input.storageKey };
  }

  async getObject(storageKey: string): Promise<Buffer> {
    const emptyHash = crypto.createHash('sha256').update('').digest('hex');
    const { url, headers } = this.signRequest('GET', storageKey, emptyHash);
    const res = await fetch(url, { method: 'GET', headers });
    if (res.status === 404) {
      throw new StorageServiceError('Attachment binary was not found in storage.', 404, 'OBJECT_NOT_FOUND');
    }
    if (!res.ok) {
      throw new StorageServiceError(`Object storage download failed (${res.status}).`, 503, 'STORAGE_READ_FAILED');
    }
    const arr = await res.arrayBuffer();
    return Buffer.from(arr);
  }

  async deleteObject(storageKey: string): Promise<void> {
    const emptyHash = crypto.createHash('sha256').update('').digest('hex');
    const { url, headers } = this.signRequest('DELETE', storageKey, emptyHash);
    const res = await fetch(url, { method: 'DELETE', headers });
    if (res.status === 404) return;
    if (!res.ok) {
      throw new StorageServiceError(`Object storage delete failed (${res.status}).`, 503, 'STORAGE_DELETE_FAILED');
    }
  }

  async objectExists(storageKey: string): Promise<boolean> {
    const emptyHash = crypto.createHash('sha256').update('').digest('hex');
    const { url, headers } = this.signRequest('HEAD', storageKey, emptyHash);
    const res = await fetch(url, { method: 'HEAD', headers });
    return res.ok;
  }
}

/**
 * Supabase Storage REST adapter using service role bearer token strictly on the server.
 */
class SupabaseStorageAdapter implements AttachmentStorageAdapter {
  readonly provider: StorageProviderType = 'supabase';
  private readonly url: string;
  private readonly serviceRoleKey: string;
  private readonly bucket: string;

  constructor(cfg: { url: string; serviceRoleKey: string; bucket: string }) {
    this.url = cfg.url.replace(/\/+$/, '');
    this.serviceRoleKey = cfg.serviceRoleKey;
    this.bucket = cfg.bucket;
  }

  isConfigured(): boolean {
    return true;
  }

  isPersistentProductionSafe(): boolean {
    return true;
  }

  async getStatus(): Promise<StorageStatusInfo> {
    return {
      configured: true,
      available: true,
      persistent: true,
      provider: 'supabase',
    };
  }

  async putObject(input: PutObjectInput): Promise<{ provider: StorageProviderType; storageKey: string }> {
    const safeKey = assertSafeStorageKey(input.storageKey);
    const res = await fetch(`${this.url}/storage/v1/object/${this.bucket}/${safeKey}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.serviceRoleKey}`,
        apikey: this.serviceRoleKey,
        'Content-Type': input.mimeType,
        'x-upsert': 'false',
      },
      body: new Uint8Array(input.buffer),
    });
    if (!res.ok) {
      throw new StorageServiceError(`Supabase storage upload failed (${res.status}).`, 503, 'STORAGE_UPLOAD_FAILED');
    }
    return { provider: 'supabase', storageKey: safeKey };
  }

  async getObject(storageKey: string): Promise<Buffer> {
    const safeKey = assertSafeStorageKey(storageKey);
    const res = await fetch(`${this.url}/storage/v1/object/authenticated/${this.bucket}/${safeKey}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${this.serviceRoleKey}`,
        apikey: this.serviceRoleKey,
      },
    });
    if (res.status === 404) {
      throw new StorageServiceError('Attachment binary was not found in storage.', 404, 'OBJECT_NOT_FOUND');
    }
    if (!res.ok) {
      throw new StorageServiceError(`Supabase storage download failed (${res.status}).`, 503, 'STORAGE_READ_FAILED');
    }
    return Buffer.from(await res.arrayBuffer());
  }

  async deleteObject(storageKey: string): Promise<void> {
    const safeKey = assertSafeStorageKey(storageKey);
    const res = await fetch(`${this.url}/storage/v1/object/${this.bucket}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${this.serviceRoleKey}`,
        apikey: this.serviceRoleKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ prefixes: [safeKey] }),
    });
    if (!res.ok && res.status !== 404) {
      throw new StorageServiceError(`Supabase storage delete failed (${res.status}).`, 503, 'STORAGE_DELETE_FAILED');
    }
  }

  async objectExists(storageKey: string): Promise<boolean> {
    const safeKey = assertSafeStorageKey(storageKey);
    const res = await fetch(`${this.url}/storage/v1/object/info/authenticated/${this.bucket}/${safeKey}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${this.serviceRoleKey}`,
        apikey: this.serviceRoleKey,
      },
    });
    return res.ok;
  }
}

/**
 * Isolated in-memory storage adapter exclusively for automated Vitest runs,
 * with explicit outage & partial failure simulation hooks.
 */
class TestMemoryStorageAdapter implements AttachmentStorageAdapter {
  readonly provider: StorageProviderType = 'memory-test';
  private readonly objects = new Map<string, { buffer: Buffer; mimeType: string }>();
  private outageMode = false;

  setOutage(enabled: boolean): void {
    this.outageMode = enabled;
  }

  clear(): void {
    this.objects.clear();
    this.outageMode = false;
  }

  hasObject(storageKey: string): boolean {
    return this.objects.has(storageKey);
  }

  countObjects(): number {
    return this.objects.size;
  }

  isConfigured(): boolean {
    return !this.outageMode;
  }

  isPersistentProductionSafe(): boolean {
    return false;
  }

  async getStatus(): Promise<StorageStatusInfo> {
    if (this.outageMode) {
      return {
        configured: true,
        available: false,
        persistent: false,
        provider: 'memory-test',
        message: 'Test storage outage simulated.',
      };
    }
    return {
      configured: true,
      available: true,
      persistent: false,
      provider: 'memory-test',
      message: 'In-memory test storage adapter active.',
    };
  }

  async putObject(input: PutObjectInput): Promise<{ provider: StorageProviderType; storageKey: string }> {
    if (this.outageMode) {
      throw new StorageServiceError('Attachment storage service unavailable.', 503, 'STORAGE_UNAVAILABLE');
    }
    const safeKey = assertSafeStorageKey(input.storageKey);
    this.objects.set(safeKey, {
      buffer: Buffer.from(input.buffer),
      mimeType: input.mimeType,
    });
    return { provider: this.provider, storageKey: safeKey };
  }

  async getObject(storageKey: string): Promise<Buffer> {
    if (this.outageMode) {
      throw new StorageServiceError('Attachment storage service unavailable.', 503, 'STORAGE_UNAVAILABLE');
    }
    const safeKey = assertSafeStorageKey(storageKey);
    const entry = this.objects.get(safeKey);
    if (!entry) {
      throw new StorageServiceError('Attachment binary was not found in storage.', 404, 'OBJECT_NOT_FOUND');
    }
    return Buffer.from(entry.buffer);
  }

  async deleteObject(storageKey: string): Promise<void> {
    if (this.outageMode) {
      throw new StorageServiceError('Attachment storage service unavailable.', 503, 'STORAGE_UNAVAILABLE');
    }
    const safeKey = assertSafeStorageKey(storageKey);
    this.objects.delete(safeKey);
  }

  async objectExists(storageKey: string): Promise<boolean> {
    if (this.outageMode) return false;
    const safeKey = assertSafeStorageKey(storageKey);
    return this.objects.has(safeKey);
  }
}

export const testMemoryStorage = new TestMemoryStorageAdapter();
let customStorageOverride: AttachmentStorageAdapter | null = null;

export const setCustomStorageAdapterForTest = (adapter: AttachmentStorageAdapter | null): void => {
  customStorageOverride = adapter;
};

export const getAttachmentStorageAdapter = (): AttachmentStorageAdapter => {
  if (customStorageOverride) {
    return customStorageOverride;
  }

  const requested = (process.env.STORAGE_PROVIDER || 'auto').toLowerCase().trim();
  const isProd = isProductionEnvironment();
  const isTest = isTestEnvironment();

  // Test environment uses explicit TestMemoryStorageAdapter unless production or external explicitly requested
  if (!isProd && isTest && requested === 'auto') {
    return testMemoryStorage;
  }

  // 1. Check real S3 configuration
  if (
    (requested === 'auto' || requested === 's3') &&
    process.env.S3_BUCKET &&
    process.env.S3_REGION &&
    process.env.S3_ACCESS_KEY_ID &&
    process.env.S3_SECRET_ACCESS_KEY
  ) {
    return new S3StorageAdapter({
      bucket: process.env.S3_BUCKET,
      region: process.env.S3_REGION,
      accessKeyId: process.env.S3_ACCESS_KEY_ID,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
      endpoint: process.env.S3_ENDPOINT,
    });
  }

  // 2. Check real Supabase Storage configuration
  if (
    (requested === 'auto' || requested === 'supabase') &&
    process.env.SUPABASE_URL &&
    process.env.SUPABASE_SERVICE_ROLE_KEY &&
    process.env.SUPABASE_STORAGE_BUCKET
  ) {
    return new SupabaseStorageAdapter({
      url: process.env.SUPABASE_URL,
      serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
      bucket: process.env.SUPABASE_STORAGE_BUCKET,
    });
  }

  // 3. Production strictly forbids local filesystem fallback
  if (isProd) {
    return new UnconfiguredStorageAdapter(
      'File attachments require a configured persistent object storage provider (S3 or Supabase Storage) in production.'
    );
  }

  // 4. Development local disk fallback (opt-out via ALLOW_LOCAL_ATTACHMENT_STORAGE=false)
  if (
    (requested === 'auto' || requested === 'local' || requested === 'local-dev') &&
    process.env.ALLOW_LOCAL_ATTACHMENT_STORAGE !== 'false'
  ) {
    return new LocalDevStorageAdapter();
  }

  return new UnconfiguredStorageAdapter(
    'Attachment storage is disabled or unconfigured. Enable local dev storage or configure S3/Supabase credentials.'
  );
};
