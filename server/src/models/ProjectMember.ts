import mongoose, { Document, Schema, Model } from 'mongoose';
import { getActiveStorageMode } from '../config/db.js';
import { UserModelAdapter } from './User.js';

export type ProjectRole = 'PROJECT_ADMIN' | 'DEVELOPER' | 'VIEWER';

export interface IProjectMember {
  _id?: any;
  id?: string;
  projectId: any;
  workspaceId: any;
  userId: any;
  role: ProjectRole;
  joinedAt: Date;
  createdAt: Date;
  updatedAt: Date;
  user?: {
    id: string;
    fullName: string;
    email: string;
    avatarUrl?: string;
  };
}

export interface IProjectMemberDocument extends Document {
  projectId: any;
  workspaceId: any;
  userId: any;
  role: ProjectRole;
  joinedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ProjectMemberSchema = new Schema<IProjectMemberDocument>(
  {
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
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
      index: true,
    },
    role: {
      type: String,
      enum: ['PROJECT_ADMIN', 'DEVELOPER', 'VIEWER'],
      default: 'DEVELOPER',
      required: true,
    },
    joinedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret: any) => {
        ret.id = ret._id ? ret._id.toString() : ret.id;
        ret.projectId = ret.projectId ? ret.projectId.toString() : '';
        ret.workspaceId = ret.workspaceId ? ret.workspaceId.toString() : '';
        ret.userId = ret.userId ? ret.userId.toString() : '';
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Compound unique index ensuring each user can belong to a project only once
ProjectMemberSchema.index({ projectId: 1, userId: 1 }, { unique: true });

export const MongooseProjectMemberModel: Model<IProjectMemberDocument> =
  mongoose.models.ProjectMember ||
  mongoose.model<IProjectMemberDocument>('ProjectMember', ProjectMemberSchema);

interface MemoryProjectMemberRecord {
  id: string;
  projectId: string;
  workspaceId: string;
  userId: string;
  role: ProjectRole;
  joinedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const memoryProjectMembers: Map<string, MemoryProjectMemberRecord> = new Map();

export class ProjectMemberModelAdapter {
  static formatMember(m: any, userDetails?: any): IProjectMember {
    const id = m.id || (m._id ? m._id.toString() : '');
    const projectId = m.projectId?.toString ? m.projectId.toString() : String(m.projectId || '');
    const workspaceId = m.workspaceId?.toString ? m.workspaceId.toString() : String(m.workspaceId || '');
    const userId = m.userId?.toString ? m.userId.toString() : String(m.userId || '');

    return {
      id,
      projectId,
      workspaceId,
      userId,
      role: m.role as ProjectRole,
      joinedAt: m.joinedAt,
      createdAt: m.createdAt,
      updatedAt: m.updatedAt,
      user: userDetails || undefined,
    };
  }

  static async findMember(projectId: string, userId: string): Promise<IProjectMember | null> {
    const mode = getActiveStorageMode();
    if (mode === 'mongodb') {
      if (!mongoose.Types.ObjectId.isValid(projectId) || !mongoose.Types.ObjectId.isValid(userId)) {
        return null;
      }
      const doc = await MongooseProjectMemberModel.findOne({
        projectId: new mongoose.Types.ObjectId(projectId),
        userId: new mongoose.Types.ObjectId(userId),
      }).populate('userId', 'fullName email avatarUrl');

      if (!doc) return null;
      const userObj = doc.userId as any;
      return this.formatMember(doc, userObj ? UserModelAdapter.formatUser(userObj) : undefined);
    }

    if (mode === 'memory') {
      for (const m of memoryProjectMembers.values()) {
        if (m.projectId === projectId && m.userId === userId) {
          const user = await UserModelAdapter.findById(userId);
          return this.formatMember(m, user ? UserModelAdapter.formatUser(user) : undefined);
        }
      }
      return null;
    }

    throw new Error('Database service unavailable. Persistent MongoDB connection is required in production.');
  }

  static async findByProject(projectId: string): Promise<IProjectMember[]> {
    const mode = getActiveStorageMode();
    if (mode === 'mongodb') {
      if (!mongoose.Types.ObjectId.isValid(projectId)) return [];
      const docs = await MongooseProjectMemberModel.find({
        projectId: new mongoose.Types.ObjectId(projectId),
      })
        .populate('userId', 'fullName email avatarUrl')
        .sort({ joinedAt: 1 });

      return docs.map((doc) => {
        const userObj = doc.userId as any;
        return this.formatMember(doc, userObj ? UserModelAdapter.formatUser(userObj) : undefined);
      });
    }

    if (mode === 'memory') {
      const results: IProjectMember[] = [];
      for (const m of memoryProjectMembers.values()) {
        if (m.projectId === projectId) {
          const user = await UserModelAdapter.findById(m.userId);
          results.push(this.formatMember(m, user ? UserModelAdapter.formatUser(user) : undefined));
        }
      }
      return results;
    }

    throw new Error('Database service unavailable. Persistent MongoDB connection is required in production.');
  }

  static async createMember(data: {
    projectId: string;
    workspaceId: string;
    userId: string;
    role: ProjectRole;
  }): Promise<IProjectMember> {
    const mode = getActiveStorageMode();
    const existing = await this.findMember(data.projectId, data.userId);
    if (existing) {
      const err: any = new Error('User is already a member of this project');
      err.statusCode = 409;
      err.code = 11000;
      throw err;
    }

    if (mode === 'mongodb') {
      const doc = new MongooseProjectMemberModel({
        projectId: new mongoose.Types.ObjectId(data.projectId),
        workspaceId: new mongoose.Types.ObjectId(data.workspaceId),
        userId: new mongoose.Types.ObjectId(data.userId),
        role: data.role,
        joinedAt: new Date(),
      });
      await doc.save();
      const user = await UserModelAdapter.findById(data.userId);
      return this.formatMember(doc, user ? UserModelAdapter.formatUser(user) : undefined);
    }

    if (mode === 'memory') {
      const id = `pm_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      const now = new Date();
      const record: MemoryProjectMemberRecord = {
        id,
        projectId: data.projectId,
        workspaceId: data.workspaceId,
        userId: data.userId,
        role: data.role,
        joinedAt: now,
        createdAt: now,
        updatedAt: now,
      };
      memoryProjectMembers.set(id, record);
      const user = await UserModelAdapter.findById(data.userId);
      return this.formatMember(record, user ? UserModelAdapter.formatUser(user) : undefined);
    }

    throw new Error('Database service unavailable. Persistent MongoDB connection is required in production.');
  }

  static async updateMemberRole(
    projectId: string,
    userId: string,
    newRole: ProjectRole
  ): Promise<IProjectMember | null> {
    const mode = getActiveStorageMode();
    if (mode === 'mongodb') {
      if (!mongoose.Types.ObjectId.isValid(projectId) || !mongoose.Types.ObjectId.isValid(userId)) {
        return null;
      }
      const doc = await MongooseProjectMemberModel.findOneAndUpdate(
        {
          projectId: new mongoose.Types.ObjectId(projectId),
          userId: new mongoose.Types.ObjectId(userId),
        },
        { $set: { role: newRole } },
        { new: true }
      ).populate('userId', 'fullName email avatarUrl');

      if (!doc) return null;
      const userObj = doc.userId as any;
      return this.formatMember(doc, userObj ? UserModelAdapter.formatUser(userObj) : undefined);
    }

    if (mode === 'memory') {
      for (const m of memoryProjectMembers.values()) {
        if (m.projectId === projectId && m.userId === userId) {
          m.role = newRole;
          m.updatedAt = new Date();
          memoryProjectMembers.set(m.id, m);
          const user = await UserModelAdapter.findById(userId);
          return this.formatMember(m, user ? UserModelAdapter.formatUser(user) : undefined);
        }
      }
      return null;
    }

    throw new Error('Database service unavailable. Persistent MongoDB connection is required in production.');
  }

  static async removeMember(projectId: string, userId: string): Promise<boolean> {
    const mode = getActiveStorageMode();
    if (mode === 'mongodb') {
      if (!mongoose.Types.ObjectId.isValid(projectId) || !mongoose.Types.ObjectId.isValid(userId)) {
        return false;
      }
      const res = await MongooseProjectMemberModel.findOneAndDelete({
        projectId: new mongoose.Types.ObjectId(projectId),
        userId: new mongoose.Types.ObjectId(userId),
      });
      return !!res;
    }

    if (mode === 'memory') {
      for (const [id, m] of memoryProjectMembers.entries()) {
        if (m.projectId === projectId && m.userId === userId) {
          memoryProjectMembers.delete(id);
          return true;
        }
      }
      return false;
    }

    throw new Error('Database service unavailable. Persistent MongoDB connection is required in production.');
  }

  static async countProjectAdmins(projectId: string): Promise<number> {
    const mode = getActiveStorageMode();
    if (mode === 'mongodb') {
      if (!mongoose.Types.ObjectId.isValid(projectId)) return 0;
      return MongooseProjectMemberModel.countDocuments({
        projectId: new mongoose.Types.ObjectId(projectId),
        role: 'PROJECT_ADMIN',
      });
    }

    if (mode === 'memory') {
      let count = 0;
      for (const m of memoryProjectMembers.values()) {
        if (m.projectId === projectId && m.role === 'PROJECT_ADMIN') count++;
      }
      return count;
    }

    throw new Error('Database service unavailable. Persistent MongoDB connection is required in production.');
  }

  static async deleteByProject(projectId: string): Promise<number> {
    const mode = getActiveStorageMode();
    if (mode === 'mongodb') {
      if (!mongoose.Types.ObjectId.isValid(projectId)) return 0;
      const res = await MongooseProjectMemberModel.deleteMany({
        projectId: new mongoose.Types.ObjectId(projectId),
      });
      return res.deletedCount || 0;
    }

    if (mode === 'memory') {
      let deleted = 0;
      for (const [id, m] of memoryProjectMembers.entries()) {
        if (m.projectId === projectId) {
          memoryProjectMembers.delete(id);
          deleted++;
        }
      }
      return deleted;
    }

    throw new Error('Database service unavailable. Persistent MongoDB connection is required in production.');
  }

  static clearMemory(): void {
    memoryProjectMembers.clear();
  }
}
