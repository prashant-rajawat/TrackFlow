import mongoose, { Document, Schema, Model } from 'mongoose';
import { getActiveStorageMode } from '../config/db.js';
import { UserModelAdapter } from './User.js';
import type { StorageProviderType } from '../services/storage/attachmentStorage.js';

export interface IAttachmentUploaderSummary {
  id: string;
  fullName: string;
  email: string;
  avatarUrl?: string;
}

export interface IAttachment {
  _id?: any;
  id?: string;
  originalName: string;
  storedFileName?: string;
  fileExtension?: string;
  storageKey: string;
  storageProvider: StorageProviderType;
  mimeType: string;
  sizeBytes: number;
  checksum: string;
  idempotencyKey?: string;
  issueId: string;
  projectId: string;
  workspaceId: string;
  uploadedBy: string;
  createdAt: Date;
  updatedAt: Date;
  uploader?: IAttachmentUploaderSummary;
}

export interface IAttachmentDocument extends Document {
  originalName: string;
  storedFileName: string;
  fileExtension: string;
  storageKey: string;
  storageProvider: StorageProviderType;
  mimeType: string;
  sizeBytes: number;
  checksum: string;
  idempotencyKey?: string;
  issueId: any;
  projectId: any;
  workspaceId: any;
  uploadedBy: any;
  createdAt: Date;
  updatedAt: Date;
}

const AttachmentSchema = new Schema<IAttachmentDocument>(
  {
    originalName: {
      type: String,
      required: [true, 'Original filename is required'],
      trim: true,
      maxlength: [255, 'Filename cannot exceed 255 characters'],
    },
    storedFileName: {
      type: String,
      required: [true, 'Stored filename is required'],
      trim: true,
    },
    fileExtension: {
      type: String,
      required: [true, 'File extension is required'],
      trim: true,
      lowercase: true,
    },
    storageKey: {
      type: String,
      required: [true, 'Storage key is required'],
      unique: true,
      trim: true,
    },
    storageProvider: {
      type: String,
      enum: ['s3', 'cloudinary', 'supabase', 'local-dev', 'memory-test', 'unconfigured'],
      required: [true, 'Storage provider is required'],
    },
    mimeType: {
      type: String,
      required: [true, 'MIME type is required'],
      trim: true,
    },
    sizeBytes: {
      type: Number,
      required: [true, 'File size is required'],
      min: [1, 'File cannot be empty'],
      max: [10 * 1024 * 1024, 'File size exceeds 10 MB maximum'],
    },
    checksum: {
      type: String,
      required: [true, 'SHA-256 checksum is required'],
      trim: true,
      index: true,
    },
    idempotencyKey: {
      type: String,
      trim: true,
      default: undefined,
    },
    issueId: {
      type: Schema.Types.ObjectId,
      ref: 'Issue',
      required: [true, 'Issue ID is required'],
      index: true,
    },
    projectId: {
      type: Schema.Types.ObjectId,
      ref: 'Project',
      required: [true, 'Project ID is required'],
      index: true,
    },
    workspaceId: {
      type: Schema.Types.ObjectId,
      ref: 'Workspace',
      required: [true, 'Workspace ID is required'],
      index: true,
    },
    uploadedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Uploader ID is required'],
      index: true,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret: any) => {
        ret.id = ret._id ? ret._id.toString() : ret.id;
        ret.issueId = ret.issueId ? ret.issueId.toString() : '';
        ret.projectId = ret.projectId ? ret.projectId.toString() : '';
        ret.workspaceId = ret.workspaceId ? ret.workspaceId.toString() : '';
        ret.uploadedBy = ret.uploadedBy ? ret.uploadedBy.toString() : '';
        delete ret._id;
        delete ret.__v;
        delete ret.storageKey;
        delete ret.storedFileName;
        return ret;
      },
    },
  }
);

AttachmentSchema.index({ issueId: 1, createdAt: -1 });
AttachmentSchema.index({ projectId: 1, createdAt: -1 });
AttachmentSchema.index({ workspaceId: 1, createdAt: -1 });
AttachmentSchema.index({ issueId: 1, idempotencyKey: 1 }, { sparse: true });

export const MongooseAttachmentModel: Model<IAttachmentDocument> =
  mongoose.models.Attachment ||
  mongoose.model<IAttachmentDocument>('Attachment', AttachmentSchema);

interface MemoryAttachmentRecord {
  id: string;
  originalName: string;
  storedFileName: string;
  fileExtension: string;
  storageKey: string;
  storageProvider: StorageProviderType;
  mimeType: string;
  sizeBytes: number;
  checksum: string;
  idempotencyKey?: string;
  issueId: string;
  projectId: string;
  workspaceId: string;
  uploadedBy: string;
  createdAt: Date;
  updatedAt: Date;
}

const memoryAttachments: Map<string, MemoryAttachmentRecord> = new Map();
let simulateNextCreateFailure = false;

export const setSimulateAttachmentDbCreateFailure = (fail: boolean): void => {
  simulateNextCreateFailure = fail;
};

export class AttachmentModelAdapter {
  private static extractId(val: any): string {
    if (!val) return '';
    if (typeof val === 'string') return val;
    if (val._id) return val._id.toString();
    if (val.id) return String(val.id);
    return val.toString ? val.toString() : String(val);
  }

  private static formatUploaderSummary(u: any): IAttachmentUploaderSummary | undefined {
    if (!u || typeof u !== 'object') return undefined;
    if (!u.email && !u.fullName) return undefined;
    const formatted = UserModelAdapter.formatUser(u);
    return {
      id: formatted.id,
      fullName: formatted.fullName,
      email: formatted.email,
      avatarUrl: formatted.avatarUrl || '',
    };
  }

  static formatAttachment(
    att: any,
    uploaderOverride?: IAttachmentUploaderSummary
  ): IAttachment {
    const id = att.id || (att._id ? att._id.toString() : '');
    const ext =
      att.fileExtension ||
      (typeof att.originalName === 'string' && att.originalName.includes('.')
        ? att.originalName.split('.').pop()?.toLowerCase()
        : '');
    return {
      id,
      originalName: att.originalName,
      storedFileName: att.storedFileName,
      fileExtension: ext,
      storageKey: att.storageKey,
      storageProvider: att.storageProvider,
      mimeType: att.mimeType,
      sizeBytes: att.sizeBytes,
      checksum: att.checksum,
      idempotencyKey: att.idempotencyKey,
      issueId: this.extractId(att.issueId),
      projectId: this.extractId(att.projectId),
      workspaceId: this.extractId(att.workspaceId),
      uploadedBy: this.extractId(att.uploadedBy),
      createdAt: att.createdAt,
      updatedAt: att.updatedAt,
      uploader: uploaderOverride ?? this.formatUploaderSummary(att.uploadedBy),
    };
  }

  /**
   * Sanitizes attachment payload for API JSON responses so internal storageKeys
   * or storage provider paths are never exposed to browser clients.
   */
  static toPublicDTO(att: IAttachment) {
    return {
      id: att.id!,
      originalName: att.originalName,
      fileExtension: att.fileExtension,
      mimeType: att.mimeType,
      sizeBytes: att.sizeBytes,
      checksum: att.checksum,
      issueId: att.issueId,
      projectId: att.projectId,
      workspaceId: att.workspaceId,
      uploadedBy: att.uploadedBy,
      createdAt: att.createdAt,
      updatedAt: att.updatedAt,
      uploader: att.uploader,
    };
  }

  private static async hydrateMemoryAttachment(rec: MemoryAttachmentRecord): Promise<IAttachment> {
    const uploader = await UserModelAdapter.findById(rec.uploadedBy);
    return this.formatAttachment(
      rec,
      uploader ? this.formatUploaderSummary(uploader) : undefined
    );
  }

  static async findById(id: string): Promise<IAttachment | null> {
    const mode = getActiveStorageMode();
    if (mode === 'mongodb') {
      if (!mongoose.Types.ObjectId.isValid(id)) return null;
      const doc = await MongooseAttachmentModel.findById(id).populate(
        'uploadedBy',
        'fullName email avatarUrl'
      );
      return doc ? this.formatAttachment(doc) : null;
    }

    if (mode === 'memory') {
      const rec = memoryAttachments.get(id);
      return rec ? this.hydrateMemoryAttachment(rec) : null;
    }

    throw new Error('Database service unavailable. Persistent MongoDB connection is required in production.');
  }

  static async findByIssue(issueId: string): Promise<IAttachment[]> {
    const mode = getActiveStorageMode();
    if (mode === 'mongodb') {
      if (!mongoose.Types.ObjectId.isValid(issueId)) return [];
      const docs = await MongooseAttachmentModel.find({
        issueId: new mongoose.Types.ObjectId(issueId),
      })
        .populate('uploadedBy', 'fullName email avatarUrl')
        .sort({ createdAt: -1, _id: 1 });
      return docs.map((doc) => this.formatAttachment(doc));
    }

    if (mode === 'memory') {
      const matches: MemoryAttachmentRecord[] = [];
      for (const rec of memoryAttachments.values()) {
        if (rec.issueId === issueId) {
          matches.push(rec);
        }
      }
      matches.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      return Promise.all(matches.map((rec) => this.hydrateMemoryAttachment(rec)));
    }

    throw new Error('Database service unavailable. Persistent MongoDB connection is required in production.');
  }

  static async findByProject(projectId: string): Promise<IAttachment[]> {
    const mode = getActiveStorageMode();
    if (mode === 'mongodb') {
      if (!mongoose.Types.ObjectId.isValid(projectId)) return [];
      const docs = await MongooseAttachmentModel.find({
        projectId: new mongoose.Types.ObjectId(projectId),
      });
      return docs.map((doc) => this.formatAttachment(doc));
    }

    if (mode === 'memory') {
      const matches: MemoryAttachmentRecord[] = [];
      for (const rec of memoryAttachments.values()) {
        if (rec.projectId === projectId) {
          matches.push(rec);
        }
      }
      return Promise.all(matches.map((rec) => this.hydrateMemoryAttachment(rec)));
    }

    throw new Error('Database service unavailable. Persistent MongoDB connection is required in production.');
  }

  static async findByIdempotencyKey(
    issueId: string,
    idempotencyKey: string
  ): Promise<IAttachment[]> {
    const mode = getActiveStorageMode();
    if (!idempotencyKey) return [];

    if (mode === 'mongodb') {
      if (!mongoose.Types.ObjectId.isValid(issueId)) return [];
      const docs = await MongooseAttachmentModel.find({
        issueId: new mongoose.Types.ObjectId(issueId),
        idempotencyKey,
      })
        .populate('uploadedBy', 'fullName email avatarUrl')
        .sort({ createdAt: 1 });
      return docs.map((doc) => this.formatAttachment(doc));
    }

    if (mode === 'memory') {
      const matches: MemoryAttachmentRecord[] = [];
      for (const rec of memoryAttachments.values()) {
        if (rec.issueId === issueId && rec.idempotencyKey === idempotencyKey) {
          matches.push(rec);
        }
      }
      return Promise.all(matches.map((rec) => this.hydrateMemoryAttachment(rec)));
    }

    throw new Error('Database service unavailable. Persistent MongoDB connection is required in production.');
  }

  static async countByIssue(issueId: string): Promise<number> {
    const mode = getActiveStorageMode();
    if (mode === 'mongodb') {
      if (!mongoose.Types.ObjectId.isValid(issueId)) return 0;
      return MongooseAttachmentModel.countDocuments({
        issueId: new mongoose.Types.ObjectId(issueId),
      });
    }

    if (mode === 'memory') {
      let count = 0;
      for (const rec of memoryAttachments.values()) {
        if (rec.issueId === issueId) count++;
      }
      return count;
    }

    throw new Error('Database service unavailable. Persistent MongoDB connection is required in production.');
  }

  static async create(data: {
    originalName: string;
    storedFileName: string;
    fileExtension: string;
    storageKey: string;
    storageProvider: StorageProviderType;
    mimeType: string;
    sizeBytes: number;
    checksum: string;
    idempotencyKey?: string;
    issueId: string;
    projectId: string;
    workspaceId: string;
    uploadedBy: string;
  }): Promise<IAttachment> {
    if (simulateNextCreateFailure) {
      simulateNextCreateFailure = false;
      throw new Error('Simulated metadata persistence failure.');
    }

    const mode = getActiveStorageMode();

    if (mode === 'mongodb') {
      const doc = new MongooseAttachmentModel({
        originalName: data.originalName,
        storedFileName: data.storedFileName,
        fileExtension: data.fileExtension,
        storageKey: data.storageKey,
        storageProvider: data.storageProvider,
        mimeType: data.mimeType,
        sizeBytes: data.sizeBytes,
        checksum: data.checksum,
        idempotencyKey: data.idempotencyKey || undefined,
        issueId: new mongoose.Types.ObjectId(data.issueId),
        projectId: new mongoose.Types.ObjectId(data.projectId),
        workspaceId: new mongoose.Types.ObjectId(data.workspaceId),
        uploadedBy: new mongoose.Types.ObjectId(data.uploadedBy),
      });
      await doc.save();
      const populated = await MongooseAttachmentModel.findById(doc._id).populate(
        'uploadedBy',
        'fullName email avatarUrl'
      );
      return this.formatAttachment(populated || doc);
    }

    if (mode === 'memory') {
      const id = `att_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      const now = new Date();
      const record: MemoryAttachmentRecord = {
        id,
        originalName: data.originalName,
        storedFileName: data.storedFileName,
        fileExtension: data.fileExtension,
        storageKey: data.storageKey,
        storageProvider: data.storageProvider,
        mimeType: data.mimeType,
        sizeBytes: data.sizeBytes,
        checksum: data.checksum,
        idempotencyKey: data.idempotencyKey,
        issueId: data.issueId,
        projectId: data.projectId,
        workspaceId: data.workspaceId,
        uploadedBy: data.uploadedBy,
        createdAt: now,
        updatedAt: now,
      };
      memoryAttachments.set(id, record);
      return this.hydrateMemoryAttachment(record);
    }

    throw new Error('Database service unavailable. Persistent MongoDB connection is required in production.');
  }

  static async delete(id: string): Promise<boolean> {
    const mode = getActiveStorageMode();
    if (mode === 'mongodb') {
      if (!mongoose.Types.ObjectId.isValid(id)) return false;
      const res = await MongooseAttachmentModel.findByIdAndDelete(id);
      return !!res;
    }

    if (mode === 'memory') {
      return memoryAttachments.delete(id);
    }

    throw new Error('Database service unavailable. Persistent MongoDB connection is required in production.');
  }

  static async deleteByIssue(issueId: string): Promise<number> {
    const mode = getActiveStorageMode();
    if (mode === 'mongodb') {
      if (!mongoose.Types.ObjectId.isValid(issueId)) return 0;
      const res = await MongooseAttachmentModel.deleteMany({
        issueId: new mongoose.Types.ObjectId(issueId),
      });
      return res.deletedCount || 0;
    }

    if (mode === 'memory') {
      let deleted = 0;
      for (const [id, rec] of memoryAttachments.entries()) {
        if (rec.issueId === issueId) {
          memoryAttachments.delete(id);
          deleted++;
        }
      }
      return deleted;
    }

    throw new Error('Database service unavailable. Persistent MongoDB connection is required in production.');
  }

  static async deleteByProject(projectId: string): Promise<number> {
    const mode = getActiveStorageMode();
    if (mode === 'mongodb') {
      if (!mongoose.Types.ObjectId.isValid(projectId)) return 0;
      const res = await MongooseAttachmentModel.deleteMany({
        projectId: new mongoose.Types.ObjectId(projectId),
      });
      return res.deletedCount || 0;
    }

    if (mode === 'memory') {
      let deleted = 0;
      for (const [id, rec] of memoryAttachments.entries()) {
        if (rec.projectId === projectId) {
          memoryAttachments.delete(id);
          deleted++;
        }
      }
      return deleted;
    }

    throw new Error('Database service unavailable. Persistent MongoDB connection is required in production.');
  }

  static clearMemory(): void {
    memoryAttachments.clear();
    simulateNextCreateFailure = false;
  }
}
