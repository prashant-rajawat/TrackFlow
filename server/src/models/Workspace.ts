import mongoose, { Document, Schema, Model } from 'mongoose';
import { getActiveStorageMode } from '../config/db.js';

export interface IWorkspace {
  _id?: any;
  id?: string;
  name: string;
  slug: string;
  description?: string;
  ownerId: any;
  pendingOwnerId?: any;
  createdAt: Date;
  updatedAt: Date;
}

export interface IWorkspaceDocument extends Document {
  name: string;
  slug: string;
  description?: string;
  ownerId: any;
  pendingOwnerId?: any;
  createdAt: Date;
  updatedAt: Date;
}

const WorkspaceSchema = new Schema<IWorkspaceDocument>(
  {
    name: {
      type: String,
      required: [true, 'Workspace name is required'],
      trim: true,
      minlength: [2, 'Workspace name must be at least 2 characters'],
      maxlength: [60, 'Workspace name cannot exceed 60 characters'],
    },
    slug: {
      type: String,
      required: [true, 'Workspace slug is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^[a-z0-9-]+$/, 'Workspace slug may only contain lowercase letters, numbers, and hyphens'],
      minlength: [2, 'Workspace slug must be at least 2 characters'],
      maxlength: [60, 'Workspace slug cannot exceed 60 characters'],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [300, 'Description cannot exceed 300 characters'],
      default: '',
    },
    ownerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Owner ID is required'],
      index: true,
    },
    pendingOwnerId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret: any) => {
        ret.id = ret._id ? ret._id.toString() : ret.id;
        if (ret.ownerId) {
          ret.ownerId = ret.ownerId.toString();
        }
        if (ret.pendingOwnerId) {
          ret.pendingOwnerId = ret.pendingOwnerId.toString();
        } else {
          ret.pendingOwnerId = null;
        }
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

export const MongooseWorkspaceModel: Model<IWorkspaceDocument> =
  mongoose.models.Workspace || mongoose.model<IWorkspaceDocument>('Workspace', WorkspaceSchema);

// In-memory test store fallback strictly for test runs
interface MemoryWorkspaceRecord {
  id: string;
  name: string;
  slug: string;
  description: string;
  ownerId: string;
  pendingOwnerId?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const memoryWorkspaces: Map<string, MemoryWorkspaceRecord> = new Map();

export class WorkspaceModelAdapter {
  static formatWorkspace(ws: any): IWorkspace {
    const id = ws.id || (ws._id ? ws._id.toString() : '');
    const ownerId = ws.ownerId ? (ws.ownerId.toString ? ws.ownerId.toString() : String(ws.ownerId)) : '';
    const pendingOwnerId = ws.pendingOwnerId ? (ws.pendingOwnerId.toString ? ws.pendingOwnerId.toString() : String(ws.pendingOwnerId)) : null;
    return {
      id,
      name: ws.name,
      slug: ws.slug,
      description: ws.description || '',
      ownerId,
      pendingOwnerId,
      createdAt: ws.createdAt,
      updatedAt: ws.updatedAt,
    };
  }

  static async findById(id: string): Promise<IWorkspace | null> {
    const mode = getActiveStorageMode();

    if (mode === 'mongodb') {
      if (!mongoose.Types.ObjectId.isValid(id)) return null;
      const doc = await MongooseWorkspaceModel.findById(id);
      return doc ? this.formatWorkspace(doc) : null;
    }

    if (mode === 'memory') {
      const record = memoryWorkspaces.get(id);
      return record ? { ...record } : null;
    }

    throw new Error('Database service unavailable. Persistent MongoDB connection is required in production.');
  }

  static async findBySlug(slug: string): Promise<IWorkspace | null> {
    const mode = getActiveStorageMode();
    const normalizedSlug = slug.toLowerCase().trim();

    if (mode === 'mongodb') {
      const doc = await MongooseWorkspaceModel.findOne({ slug: normalizedSlug });
      return doc ? this.formatWorkspace(doc) : null;
    }

    if (mode === 'memory') {
      for (const ws of memoryWorkspaces.values()) {
        if (ws.slug === normalizedSlug) return { ...ws };
      }
      return null;
    }

    throw new Error('Database service unavailable. Persistent MongoDB connection is required in production.');
  }

  static async create(data: {
    name: string;
    slug: string;
    description?: string;
    ownerId: string;
  }): Promise<IWorkspace> {
    const mode = getActiveStorageMode();
    const normalizedSlug = data.slug.toLowerCase().trim();

    // Check slug collision
    const existing = await this.findBySlug(normalizedSlug);
    if (existing) {
      const error: any = new Error('A workspace with this URL slug already exists. Please choose another slug.');
      error.code = 11000;
      error.statusCode = 409;
      throw error;
    }

    if (mode === 'mongodb') {
      const doc = new MongooseWorkspaceModel({
        name: data.name.trim(),
        slug: normalizedSlug,
        description: data.description?.trim() || '',
        ownerId: new mongoose.Types.ObjectId(data.ownerId),
      });
      await doc.save();
      return this.formatWorkspace(doc);
    }

    if (mode === 'memory') {
      const id = `ws_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      const now = new Date();
      const record: MemoryWorkspaceRecord = {
        id,
        name: data.name.trim(),
        slug: normalizedSlug,
        description: data.description?.trim() || '',
        ownerId: data.ownerId,
        createdAt: now,
        updatedAt: now,
      };
      memoryWorkspaces.set(id, record);
      return { ...record };
    }

    throw new Error('Database service unavailable. Persistent MongoDB connection is required in production.');
  }

  static async update(
    id: string,
    updates: { name?: string; description?: string }
  ): Promise<IWorkspace | null> {
    const mode = getActiveStorageMode();

    if (mode === 'mongodb') {
      if (!mongoose.Types.ObjectId.isValid(id)) return null;
      const doc = await MongooseWorkspaceModel.findByIdAndUpdate(
        id,
        { $set: updates },
        { new: true, runValidators: true }
      );
      return doc ? this.formatWorkspace(doc) : null;
    }

    if (mode === 'memory') {
      const record = memoryWorkspaces.get(id);
      if (!record) return null;
      if (updates.name !== undefined) record.name = updates.name.trim();
      if (updates.description !== undefined) record.description = updates.description.trim();
      record.updatedAt = new Date();
      memoryWorkspaces.set(id, record);
      return { ...record };
    }

    throw new Error('Database service unavailable. Persistent MongoDB connection is required in production.');
  }

  static async delete(id: string): Promise<boolean> {
    const mode = getActiveStorageMode();

    if (mode === 'mongodb') {
      if (!mongoose.Types.ObjectId.isValid(id)) return false;
      const res = await MongooseWorkspaceModel.findByIdAndDelete(id);
      return !!res;
    }

    if (mode === 'memory') {
      return memoryWorkspaces.delete(id);
    }

    throw new Error('Database service unavailable. Persistent MongoDB connection is required in production.');
  }

  static async setPendingTransfer(workspaceId: string, recipientUserId: string | null): Promise<IWorkspace | null> {
    const mode = getActiveStorageMode();

    if (mode === 'mongodb') {
      if (!mongoose.Types.ObjectId.isValid(workspaceId)) return null;
      const update = recipientUserId ? { pendingOwnerId: new mongoose.Types.ObjectId(recipientUserId) } : { pendingOwnerId: null };
      const doc = await MongooseWorkspaceModel.findByIdAndUpdate(workspaceId, { $set: update }, { new: true });
      return doc ? this.formatWorkspace(doc) : null;
    }

    if (mode === 'memory') {
      const record = memoryWorkspaces.get(workspaceId);
      if (!record) return null;
      record.pendingOwnerId = recipientUserId;
      record.updatedAt = new Date();
      memoryWorkspaces.set(workspaceId, record);
      return { ...record };
    }

    throw new Error('Database service unavailable. Persistent MongoDB connection is required in production.');
  }

  static async transferOwnership(workspaceId: string, newOwnerId: string): Promise<IWorkspace | null> {
    const mode = getActiveStorageMode();

    if (mode === 'mongodb') {
      if (!mongoose.Types.ObjectId.isValid(workspaceId) || !mongoose.Types.ObjectId.isValid(newOwnerId)) {
        return null;
      }
      const doc = await MongooseWorkspaceModel.findByIdAndUpdate(
        workspaceId,
        { $set: { ownerId: new mongoose.Types.ObjectId(newOwnerId), pendingOwnerId: null } },
        { new: true }
      );
      return doc ? this.formatWorkspace(doc) : null;
    }

    if (mode === 'memory') {
      const record = memoryWorkspaces.get(workspaceId);
      if (!record) return null;
      record.ownerId = newOwnerId;
      record.pendingOwnerId = null;
      record.updatedAt = new Date();
      memoryWorkspaces.set(workspaceId, record);
      return { ...record };
    }

    throw new Error('Database service unavailable. Persistent MongoDB connection is required in production.');
  }

  static clearMemory(): void {
    memoryWorkspaces.clear();
  }
}
