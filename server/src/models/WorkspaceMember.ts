import mongoose, { Document, Schema, Model } from 'mongoose';
import { getActiveStorageMode } from '../config/db.js';
import { UserModelAdapter } from './User.js';

export type WorkspaceRole = 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER';

export interface IWorkspaceMember {
  _id?: any;
  id?: string;
  workspaceId: any;
  userId: any;
  role: WorkspaceRole;
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

export interface IWorkspaceMemberDocument extends Document {
  workspaceId: any;
  userId: any;
  role: WorkspaceRole;
  joinedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const WorkspaceMemberSchema = new Schema<IWorkspaceMemberDocument>(
  {
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
      enum: ['OWNER', 'ADMIN', 'MEMBER', 'VIEWER'],
      default: 'MEMBER',
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
        ret.workspaceId = ret.workspaceId ? ret.workspaceId.toString() : '';
        ret.userId = ret.userId ? ret.userId.toString() : '';
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Compound unique index ensuring each user can belong to a workspace only once
WorkspaceMemberSchema.index({ workspaceId: 1, userId: 1 }, { unique: true });

export const MongooseWorkspaceMemberModel: Model<IWorkspaceMemberDocument> =
  mongoose.models.WorkspaceMember ||
  mongoose.model<IWorkspaceMemberDocument>('WorkspaceMember', WorkspaceMemberSchema);

// Memory store for test runs
interface MemoryMemberRecord {
  id: string;
  workspaceId: string;
  userId: string;
  role: WorkspaceRole;
  joinedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const memoryMembers: Map<string, MemoryMemberRecord> = new Map();

export class WorkspaceMemberModelAdapter {
  static formatMember(m: any, userDetails?: any): IWorkspaceMember {
    const id = m.id || (m._id ? m._id.toString() : '');
    const workspaceId = m.workspaceId
      ? m.workspaceId.toString
        ? m.workspaceId.toString()
        : String(m.workspaceId)
      : '';
    const userId = m.userId
      ? m.userId.toString
        ? m.userId.toString()
        : String(m.userId)
      : '';

    return {
      id,
      workspaceId,
      userId,
      role: m.role as WorkspaceRole,
      joinedAt: m.joinedAt,
      createdAt: m.createdAt,
      updatedAt: m.updatedAt,
      user: userDetails || undefined,
    };
  }

  static async findMember(workspaceId: string, userId: string): Promise<IWorkspaceMember | null> {
    const mode = getActiveStorageMode();

    if (mode === 'mongodb') {
      if (!mongoose.Types.ObjectId.isValid(workspaceId) || !mongoose.Types.ObjectId.isValid(userId)) {
        return null;
      }
      const doc = await MongooseWorkspaceMemberModel.findOne({
        workspaceId: new mongoose.Types.ObjectId(workspaceId),
        userId: new mongoose.Types.ObjectId(userId),
      }).populate('userId', 'fullName email avatarUrl');

      if (!doc) return null;
      const userObj = doc.userId as any;
      return this.formatMember(doc, userObj ? UserModelAdapter.formatUser(userObj) : undefined);
    }

    if (mode === 'memory') {
      for (const m of memoryMembers.values()) {
        if (m.workspaceId === workspaceId && m.userId === userId) {
          const user = await UserModelAdapter.findById(userId);
          return this.formatMember(m, user ? UserModelAdapter.formatUser(user) : undefined);
        }
      }
      return null;
    }

    throw new Error('Database service unavailable. Persistent MongoDB connection is required in production.');
  }

  static async findByWorkspace(workspaceId: string): Promise<IWorkspaceMember[]> {
    const mode = getActiveStorageMode();

    if (mode === 'mongodb') {
      if (!mongoose.Types.ObjectId.isValid(workspaceId)) return [];
      const docs = await MongooseWorkspaceMemberModel.find({
        workspaceId: new mongoose.Types.ObjectId(workspaceId),
      })
        .populate('userId', 'fullName email avatarUrl')
        .sort({ joinedAt: 1 });

      return docs.map((doc) => {
        const userObj = doc.userId as any;
        return this.formatMember(doc, userObj ? UserModelAdapter.formatUser(userObj) : undefined);
      });
    }

    if (mode === 'memory') {
      const results: IWorkspaceMember[] = [];
      for (const m of memoryMembers.values()) {
        if (m.workspaceId === workspaceId) {
          const user = await UserModelAdapter.findById(m.userId);
          results.push(this.formatMember(m, user ? UserModelAdapter.formatUser(user) : undefined));
        }
      }
      return results;
    }

    throw new Error('Database service unavailable. Persistent MongoDB connection is required in production.');
  }

  static async findUserWorkspaces(userId: string): Promise<Array<{ workspaceId: string; role: WorkspaceRole }>> {
    const mode = getActiveStorageMode();

    if (mode === 'mongodb') {
      if (!mongoose.Types.ObjectId.isValid(userId)) return [];
      const docs = await MongooseWorkspaceMemberModel.find({
        userId: new mongoose.Types.ObjectId(userId),
      });
      return docs.map((doc) => ({
        workspaceId: doc.workspaceId.toString(),
        role: doc.role as WorkspaceRole,
      }));
    }

    if (mode === 'memory') {
      const results: Array<{ workspaceId: string; role: WorkspaceRole }> = [];
      for (const m of memoryMembers.values()) {
        if (m.userId === userId) {
          results.push({ workspaceId: m.workspaceId, role: m.role });
        }
      }
      return results;
    }

    throw new Error('Database service unavailable. Persistent MongoDB connection is required in production.');
  }

  static async createMember(data: {
    workspaceId: string;
    userId: string;
    role: WorkspaceRole;
  }): Promise<IWorkspaceMember> {
    const mode = getActiveStorageMode();

    // Prevent duplicate membership
    const existing = await this.findMember(data.workspaceId, data.userId);
    if (existing) {
      const err: any = new Error('User is already a member of this workspace');
      err.statusCode = 409;
      err.code = 11000;
      throw err;
    }

    if (mode === 'mongodb') {
      const doc = new MongooseWorkspaceMemberModel({
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
      const id = `wm_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      const now = new Date();
      const record: MemoryMemberRecord = {
        id,
        workspaceId: data.workspaceId,
        userId: data.userId,
        role: data.role,
        joinedAt: now,
        createdAt: now,
        updatedAt: now,
      };
      memoryMembers.set(id, record);
      const user = await UserModelAdapter.findById(data.userId);
      return this.formatMember(record, user ? UserModelAdapter.formatUser(user) : undefined);
    }

    throw new Error('Database service unavailable. Persistent MongoDB connection is required in production.');
  }

  static async updateMemberRole(
    workspaceId: string,
    userId: string,
    newRole: WorkspaceRole
  ): Promise<IWorkspaceMember | null> {
    const mode = getActiveStorageMode();

    if (mode === 'mongodb') {
      if (!mongoose.Types.ObjectId.isValid(workspaceId) || !mongoose.Types.ObjectId.isValid(userId)) {
        return null;
      }
      const doc = await MongooseWorkspaceMemberModel.findOneAndUpdate(
        {
          workspaceId: new mongoose.Types.ObjectId(workspaceId),
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
      for (const m of memoryMembers.values()) {
        if (m.workspaceId === workspaceId && m.userId === userId) {
          m.role = newRole;
          m.updatedAt = new Date();
          memoryMembers.set(m.id, m);
          const user = await UserModelAdapter.findById(userId);
          return this.formatMember(m, user ? UserModelAdapter.formatUser(user) : undefined);
        }
      }
      return null;
    }

    throw new Error('Database service unavailable. Persistent MongoDB connection is required in production.');
  }

  static async removeMember(workspaceId: string, userId: string): Promise<boolean> {
    const mode = getActiveStorageMode();

    if (mode === 'mongodb') {
      if (!mongoose.Types.ObjectId.isValid(workspaceId) || !mongoose.Types.ObjectId.isValid(userId)) {
        return false;
      }
      const res = await MongooseWorkspaceMemberModel.findOneAndDelete({
        workspaceId: new mongoose.Types.ObjectId(workspaceId),
        userId: new mongoose.Types.ObjectId(userId),
      });
      return !!res;
    }

    if (mode === 'memory') {
      for (const [id, m] of memoryMembers.entries()) {
        if (m.workspaceId === workspaceId && m.userId === userId) {
          memoryMembers.delete(id);
          return true;
        }
      }
      return false;
    }

    throw new Error('Database service unavailable. Persistent MongoDB connection is required in production.');
  }

  static async countOwners(workspaceId: string): Promise<number> {
    const mode = getActiveStorageMode();

    if (mode === 'mongodb') {
      if (!mongoose.Types.ObjectId.isValid(workspaceId)) return 0;
      return MongooseWorkspaceMemberModel.countDocuments({
        workspaceId: new mongoose.Types.ObjectId(workspaceId),
        role: 'OWNER',
      });
    }

    if (mode === 'memory') {
      let count = 0;
      for (const m of memoryMembers.values()) {
        if (m.workspaceId === workspaceId && m.role === 'OWNER') count++;
      }
      return count;
    }

    throw new Error('Database service unavailable. Persistent MongoDB connection is required in production.');
  }

  static clearMemory(): void {
    memoryMembers.clear();
  }
}
