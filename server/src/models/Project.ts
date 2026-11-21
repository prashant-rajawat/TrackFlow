import mongoose, { Document, Schema, Model } from 'mongoose';
import { getActiveStorageMode } from '../config/db.js';

export type ProjectStatus = 'ACTIVE' | 'ARCHIVED';
export type ProjectVisibility = 'PRIVATE' | 'WORKSPACE';

export interface IProject {
  _id?: any;
  id?: string;
  name: string;
  key: string;
  description?: string;
  workspaceId: any;
  createdBy: any;
  leadId?: any;
  status: ProjectStatus;
  visibility: ProjectVisibility;
  startDate?: Date;
  targetDate?: Date;
  color?: string;
  issueSequence?: number;
  createdAt: Date;
  updatedAt: Date;
  lead?: {
    id: string;
    fullName: string;
    email: string;
    avatarUrl?: string;
  };
  creator?: {
    id: string;
    fullName: string;
    email: string;
  };
  memberCount?: number;
}

export interface IProjectDocument extends Document {
  name: string;
  key: string;
  description?: string;
  workspaceId: any;
  createdBy: any;
  leadId?: any;
  status: ProjectStatus;
  visibility: ProjectVisibility;
  startDate?: Date;
  targetDate?: Date;
  color?: string;
  issueSequence: number;
  createdAt: Date;
  updatedAt: Date;
}

const ProjectSchema = new Schema<IProjectDocument>(
  {
    name: {
      type: String,
      required: [true, 'Project name is required'],
      trim: true,
      minlength: [2, 'Project name must be at least 2 characters'],
      maxlength: [100, 'Project name cannot exceed 100 characters'],
    },
    key: {
      type: String,
      required: [true, 'Project key is required'],
      uppercase: true,
      trim: true,
      match: [/^[A-Z0-9-_]+$/, 'Project key can only contain uppercase letters, numbers, hyphens, and underscores'],
      minlength: [2, 'Project key must be at least 2 characters'],
      maxlength: [10, 'Project key cannot exceed 10 characters'],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [1000, 'Description cannot exceed 1000 characters'],
      default: '',
    },
    workspaceId: {
      type: Schema.Types.ObjectId,
      ref: 'Workspace',
      required: [true, 'Workspace ID is required'],
      index: true,
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Creator ID is required'],
    },
    leadId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    status: {
      type: String,
      enum: ['ACTIVE', 'ARCHIVED'],
      default: 'ACTIVE',
      index: true,
    },
    visibility: {
      type: String,
      enum: ['PRIVATE', 'WORKSPACE'],
      default: 'WORKSPACE',
    },
    startDate: {
      type: Date,
      default: null,
    },
    targetDate: {
      type: Date,
      default: null,
    },
    color: {
      type: String,
      default: 'blue',
    },
    issueSequence: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret: any) => {
        ret.id = ret._id ? ret._id.toString() : ret.id;
        ret.workspaceId = ret.workspaceId ? ret.workspaceId.toString() : '';
        ret.createdBy = ret.createdBy ? ret.createdBy.toString() : '';
        ret.leadId = ret.leadId ? ret.leadId.toString() : null;
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Compound unique index for project key within a workspace
ProjectSchema.index({ workspaceId: 1, key: 1 }, { unique: true });

export const MongooseProjectModel: Model<IProjectDocument> =
  mongoose.models.Project || mongoose.model<IProjectDocument>('Project', ProjectSchema);

// In-memory test store fallback
interface MemoryProjectRecord {
  id: string;
  name: string;
  key: string;
  description: string;
  workspaceId: string;
  createdBy: string;
  leadId?: string | null;
  status: ProjectStatus;
  visibility: ProjectVisibility;
  startDate?: Date;
  targetDate?: Date;
  color: string;
  issueSequence: number;
  createdAt: Date;
  updatedAt: Date;
}

const memoryProjects: Map<string, MemoryProjectRecord> = new Map();

export class ProjectModelAdapter {
  static formatProject(p: any, leadDetails?: any, creatorDetails?: any, memberCount = 0): IProject {
    const id = p.id || (p._id ? p._id.toString() : '');
    const workspaceId = p.workspaceId?.toString ? p.workspaceId.toString() : String(p.workspaceId || '');
    const createdBy = p.createdBy?.toString ? p.createdBy.toString() : String(p.createdBy || '');
    const leadId = p.leadId ? (p.leadId.toString ? p.leadId.toString() : String(p.leadId)) : undefined;

    return {
      id,
      name: p.name,
      key: p.key,
      description: p.description || '',
      workspaceId,
      createdBy,
      leadId,
      status: p.status as ProjectStatus,
      visibility: p.visibility as ProjectVisibility,
      startDate: p.startDate,
      targetDate: p.targetDate,
      color: p.color || 'blue',
      issueSequence: typeof p.issueSequence === 'number' ? p.issueSequence : 0,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
      lead: leadDetails || undefined,
      creator: creatorDetails || undefined,
      memberCount,
    };
  }

  static async findById(id: string): Promise<IProject | null> {
    const mode = getActiveStorageMode();
    if (mode === 'mongodb') {
      if (!mongoose.Types.ObjectId.isValid(id)) return null;
      const doc = await MongooseProjectModel.findById(id)
        .populate('leadId', 'fullName email avatarUrl')
        .populate('createdBy', 'fullName email');
      if (!doc) return null;
      return this.formatProject(doc, doc.leadId, doc.createdBy);
    }

    if (mode === 'memory') {
      const rec = memoryProjects.get(id);
      return rec ? this.formatProject(rec) : null;
    }

    throw new Error('Database service unavailable. Persistent MongoDB connection is required in production.');
  }

  static async findByWorkspace(workspaceId: string, filterStatus?: ProjectStatus): Promise<IProject[]> {
    const mode = getActiveStorageMode();
    if (mode === 'mongodb') {
      if (!mongoose.Types.ObjectId.isValid(workspaceId)) return [];
      const query: any = { workspaceId: new mongoose.Types.ObjectId(workspaceId) };
      if (filterStatus) query.status = filterStatus;
      const docs = await MongooseProjectModel.find(query)
        .populate('leadId', 'fullName email avatarUrl')
        .populate('createdBy', 'fullName email')
        .sort({ createdAt: -1 });
      return docs.map((doc) => this.formatProject(doc, doc.leadId, doc.createdBy));
    }

    if (mode === 'memory') {
      const results: IProject[] = [];
      for (const p of memoryProjects.values()) {
        if (p.workspaceId === workspaceId && (!filterStatus || p.status === filterStatus)) {
          results.push(this.formatProject(p));
        }
      }
      return results.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }

    throw new Error('Database service unavailable. Persistent MongoDB connection is required in production.');
  }

  static async findByKey(workspaceId: string, key: string): Promise<IProject | null> {
    const mode = getActiveStorageMode();
    const upperKey = key.toUpperCase().trim();
    if (mode === 'mongodb') {
      if (!mongoose.Types.ObjectId.isValid(workspaceId)) return null;
      const doc = await MongooseProjectModel.findOne({
        workspaceId: new mongoose.Types.ObjectId(workspaceId),
        key: upperKey,
      });
      return doc ? this.formatProject(doc) : null;
    }

    if (mode === 'memory') {
      for (const p of memoryProjects.values()) {
        if (p.workspaceId === workspaceId && p.key === upperKey) {
          return this.formatProject(p);
        }
      }
      return null;
    }

    throw new Error('Database service unavailable. Persistent MongoDB connection is required in production.');
  }

  static async create(data: {
    name: string;
    key: string;
    description?: string;
    workspaceId: string;
    createdBy: string;
    leadId?: string;
    visibility?: ProjectVisibility;
    startDate?: Date;
    targetDate?: Date;
    color?: string;
  }): Promise<IProject> {
    const mode = getActiveStorageMode();
    const upperKey = data.key.toUpperCase().trim();

    // Check duplicate key in workspace
    const existing = await this.findByKey(data.workspaceId, upperKey);
    if (existing) {
      const err: any = new Error(`Project key '${upperKey}' already exists in this workspace.`);
      err.statusCode = 409;
      err.code = 11000;
      throw err;
    }

    if (mode === 'mongodb') {
      const doc = new MongooseProjectModel({
        name: data.name.trim(),
        key: upperKey,
        description: data.description?.trim() || '',
        workspaceId: new mongoose.Types.ObjectId(data.workspaceId),
        createdBy: new mongoose.Types.ObjectId(data.createdBy),
        leadId: data.leadId ? new mongoose.Types.ObjectId(data.leadId) : null,
        visibility: data.visibility || 'WORKSPACE',
        startDate: data.startDate || null,
        targetDate: data.targetDate || null,
        color: data.color || 'blue',
      });
      await doc.save();
      return this.formatProject(doc);
    }

    if (mode === 'memory') {
      const id = `proj_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      const now = new Date();
      const record: MemoryProjectRecord = {
        id,
        name: data.name.trim(),
        key: upperKey,
        description: data.description?.trim() || '',
        workspaceId: data.workspaceId,
        createdBy: data.createdBy,
        leadId: data.leadId || null,
        status: 'ACTIVE',
        visibility: data.visibility || 'WORKSPACE',
        startDate: data.startDate,
        targetDate: data.targetDate,
        color: data.color || 'blue',
        issueSequence: 0,
        createdAt: now,
        updatedAt: now,
      };
      memoryProjects.set(id, record);
      return this.formatProject(record);
    }

    throw new Error('Database service unavailable. Persistent MongoDB connection is required in production.');
  }

  static async update(
    id: string,
    updates: {
      name?: string;
      description?: string;
      leadId?: string | null;
      status?: ProjectStatus;
      visibility?: ProjectVisibility;
      startDate?: Date | null;
      targetDate?: Date | null;
      color?: string;
    }
  ): Promise<IProject | null> {
    const mode = getActiveStorageMode();
    if (mode === 'mongodb') {
      if (!mongoose.Types.ObjectId.isValid(id)) return null;
      const updateData: any = { ...updates };
      if (updates.leadId !== undefined) {
        updateData.leadId = updates.leadId ? new mongoose.Types.ObjectId(updates.leadId) : null;
      }
      const doc = await MongooseProjectModel.findByIdAndUpdate(
        id,
        { $set: updateData },
        { new: true, runValidators: true }
      );
      return doc ? this.formatProject(doc) : null;
    }

    if (mode === 'memory') {
      const rec = memoryProjects.get(id);
      if (!rec) return null;
      if (updates.name !== undefined) rec.name = updates.name.trim();
      if (updates.description !== undefined) rec.description = updates.description.trim();
      if (updates.leadId !== undefined) rec.leadId = updates.leadId;
      if (updates.status !== undefined) rec.status = updates.status;
      if (updates.visibility !== undefined) rec.visibility = updates.visibility;
      if (updates.startDate !== undefined) rec.startDate = updates.startDate || undefined;
      if (updates.targetDate !== undefined) rec.targetDate = updates.targetDate || undefined;
      if (updates.color !== undefined) rec.color = updates.color;
      rec.updatedAt = new Date();
      memoryProjects.set(id, rec);
      return this.formatProject(rec);
    }

    throw new Error('Database service unavailable. Persistent MongoDB connection is required in production.');
  }

  static async delete(id: string): Promise<boolean> {
    const mode = getActiveStorageMode();
    if (mode === 'mongodb') {
      if (!mongoose.Types.ObjectId.isValid(id)) return false;
      const res = await MongooseProjectModel.findByIdAndDelete(id);
      return !!res;
    }

    if (mode === 'memory') {
      return memoryProjects.delete(id);
    }

    throw new Error('Database service unavailable. Persistent MongoDB connection is required in production.');
  }

  /**
   * Atomically increments and returns the next per-project issue sequence number
   * and formatted issue key (e.g. TRK-1, TRK-2).
   */
  static async incrementIssueSequence(projectId: string): Promise<{ sequence: number; issueKey: string } | null> {
    const mode = getActiveStorageMode();

    if (mode === 'mongodb') {
      if (!mongoose.Types.ObjectId.isValid(projectId)) return null;
      const doc = await MongooseProjectModel.findOneAndUpdate(
        { _id: new mongoose.Types.ObjectId(projectId) },
        { $inc: { issueSequence: 1 } },
        { new: true }
      );
      if (!doc) return null;
      return {
        sequence: doc.issueSequence,
        issueKey: `${doc.key}-${doc.issueSequence}`,
      };
    }

    if (mode === 'memory') {
      const rec = memoryProjects.get(projectId);
      if (!rec) return null;
      rec.issueSequence = (rec.issueSequence || 0) + 1;
      rec.updatedAt = new Date();
      memoryProjects.set(projectId, rec);
      return {
        sequence: rec.issueSequence,
        issueKey: `${rec.key}-${rec.issueSequence}`,
      };
    }

    throw new Error('Database service unavailable. Persistent MongoDB connection is required in production.');
  }

  static clearMemory(): void {
    memoryProjects.clear();
  }
}
