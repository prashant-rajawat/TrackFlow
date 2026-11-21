import mongoose, { Document, Schema, Model } from 'mongoose';
import crypto from 'crypto';
import { getActiveStorageMode } from '../config/db.js';
import { WorkspaceRole } from './WorkspaceMember.js';

export type InvitationStatus = 'PENDING' | 'ACCEPTED' | 'REVOKED' | 'EXPIRED';

export interface IInvitation {
  _id?: any;
  id?: string;
  workspaceId: any;
  invitedEmail: string;
  inviterId: any;
  role: WorkspaceRole;
  tokenHash?: string;
  status: InvitationStatus;
  expiresAt: Date;
  acceptedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  workspace?: {
    id: string;
    name: string;
    slug: string;
  };
  inviter?: {
    id: string;
    fullName: string;
    email: string;
  };
}

export interface IInvitationDocument extends Document {
  workspaceId: any;
  invitedEmail: string;
  inviterId: any;
  role: WorkspaceRole;
  tokenHash: string;
  status: InvitationStatus;
  expiresAt: Date;
  acceptedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const InvitationSchema = new Schema<IInvitationDocument>(
  {
    workspaceId: {
      type: Schema.Types.ObjectId,
      ref: 'Workspace',
      required: [true, 'Workspace ID is required'],
      index: true,
    },
    invitedEmail: {
      type: String,
      required: [true, 'Invited email is required'],
      lowercase: true,
      trim: true,
      match: [/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/, 'Please provide a valid email'],
      index: true,
    },
    inviterId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Inviter ID is required'],
      index: true,
    },
    role: {
      type: String,
      enum: ['ADMIN', 'MEMBER', 'VIEWER'],
      default: 'MEMBER',
      required: true,
    },
    tokenHash: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['PENDING', 'ACCEPTED', 'REVOKED', 'EXPIRED'],
      default: 'PENDING',
      index: true,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    acceptedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret: any) => {
        ret.id = ret._id ? ret._id.toString() : ret.id;
        ret.workspaceId = ret.workspaceId ? ret.workspaceId.toString() : '';
        ret.inviterId = ret.inviterId ? ret.inviterId.toString() : '';
        delete ret._id;
        delete ret.__v;
        delete ret.tokenHash; // Never expose token hash in API response
        return ret;
      },
    },
  }
);

// Compound index to quickly find active invitations for a workspace/email
InvitationSchema.index({ workspaceId: 1, invitedEmail: 1, status: 1 });

export const MongooseInvitationModel: Model<IInvitationDocument> =
  mongoose.models.Invitation || mongoose.model<IInvitationDocument>('Invitation', InvitationSchema);

// In-memory test store
interface MemoryInvitationRecord {
  id: string;
  workspaceId: string;
  invitedEmail: string;
  inviterId: string;
  role: WorkspaceRole;
  tokenHash: string;
  status: InvitationStatus;
  expiresAt: Date;
  acceptedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const memoryInvitations: Map<string, MemoryInvitationRecord> = new Map();

export const hashInvitationToken = (token: string): string => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

export const generateSecureToken = (): string => {
  return crypto.randomBytes(32).toString('hex');
};

export class InvitationModelAdapter {
  static formatInvitation(inv: any, workspaceDetails?: any, inviterDetails?: any): IInvitation {
    const id = inv.id || (inv._id ? inv._id.toString() : '');
    const workspaceId = inv.workspaceId
      ? inv.workspaceId.toString
        ? inv.workspaceId.toString()
        : String(inv.workspaceId)
      : '';
    const inviterId = inv.inviterId
      ? inv.inviterId.toString
        ? inv.inviterId.toString()
        : String(inv.inviterId)
      : '';

    // Check expiration dynamically
    let status = inv.status as InvitationStatus;
    if (status === 'PENDING' && new Date(inv.expiresAt) < new Date()) {
      status = 'EXPIRED';
    }

    return {
      id,
      workspaceId,
      invitedEmail: inv.invitedEmail,
      inviterId,
      role: inv.role as WorkspaceRole,
      status,
      expiresAt: inv.expiresAt,
      acceptedAt: inv.acceptedAt,
      createdAt: inv.createdAt,
      updatedAt: inv.updatedAt,
      workspace: workspaceDetails,
      inviter: inviterDetails,
    };
  }

  static async findPendingByEmail(workspaceId: string, email: string): Promise<IInvitation | null> {
    const mode = getActiveStorageMode();
    const normalizedEmail = email.toLowerCase().trim();

    if (mode === 'mongodb') {
      if (!mongoose.Types.ObjectId.isValid(workspaceId)) return null;
      const doc = await MongooseInvitationModel.findOne({
        workspaceId: new mongoose.Types.ObjectId(workspaceId),
        invitedEmail: normalizedEmail,
        status: 'PENDING',
        expiresAt: { $gt: new Date() },
      });
      return doc ? this.formatInvitation(doc) : null;
    }

    if (mode === 'memory') {
      for (const inv of memoryInvitations.values()) {
        if (
          inv.workspaceId === workspaceId &&
          inv.invitedEmail === normalizedEmail &&
          inv.status === 'PENDING' &&
          new Date(inv.expiresAt) > new Date()
        ) {
          return this.formatInvitation(inv);
        }
      }
      return null;
    }

    throw new Error('Database service unavailable. Persistent MongoDB connection is required in production.');
  }

  static async create(data: {
    workspaceId: string;
    invitedEmail: string;
    inviterId: string;
    role: WorkspaceRole;
    plainToken: string;
    expiresInDays?: number;
  }): Promise<IInvitation> {
    const mode = getActiveStorageMode();
    const normalizedEmail = data.invitedEmail.toLowerCase().trim();
    const tokenHash = hashInvitationToken(data.plainToken);
    const expiresAt = new Date(Date.now() + (data.expiresInDays || 7) * 24 * 60 * 60 * 1000);

    // Prevent duplicate active pending invitation
    const existing = await this.findPendingByEmail(data.workspaceId, normalizedEmail);
    if (existing) {
      const err: any = new Error('An active pending invitation for this email already exists in this workspace');
      err.statusCode = 409;
      err.code = 11000;
      throw err;
    }

    if (mode === 'mongodb') {
      const doc = new MongooseInvitationModel({
        workspaceId: new mongoose.Types.ObjectId(data.workspaceId),
        invitedEmail: normalizedEmail,
        inviterId: new mongoose.Types.ObjectId(data.inviterId),
        role: data.role,
        tokenHash,
        status: 'PENDING',
        expiresAt,
      });
      await doc.save();
      return this.formatInvitation(doc);
    }

    if (mode === 'memory') {
      const id = `inv_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      const now = new Date();
      const record: MemoryInvitationRecord = {
        id,
        workspaceId: data.workspaceId,
        invitedEmail: normalizedEmail,
        inviterId: data.inviterId,
        role: data.role,
        tokenHash,
        status: 'PENDING',
        expiresAt,
        createdAt: now,
        updatedAt: now,
      };
      memoryInvitations.set(id, record);
      return this.formatInvitation(record);
    }

    throw new Error('Database service unavailable. Persistent MongoDB connection is required in production.');
  }

  static async findByToken(plainToken: string): Promise<IInvitation | null> {
    const tokenHash = hashInvitationToken(plainToken);
    const mode = getActiveStorageMode();

    if (mode === 'mongodb') {
      const doc = await MongooseInvitationModel.findOne({ tokenHash })
        .populate('workspaceId', 'name slug')
        .populate('inviterId', 'fullName email');

      if (!doc) return null;

      const ws: any = doc.workspaceId;
      const inviter: any = doc.inviterId;

      const wsDetails = ws ? { id: ws._id.toString(), name: ws.name, slug: ws.slug } : undefined;
      const inviterDetails = inviter ? { id: inviter._id.toString(), fullName: inviter.fullName, email: inviter.email } : undefined;

      return this.formatInvitation(doc, wsDetails, inviterDetails);
    }

    if (mode === 'memory') {
      for (const inv of memoryInvitations.values()) {
        if (inv.tokenHash === tokenHash) {
          return this.formatInvitation(inv);
        }
      }
      return null;
    }

    throw new Error('Database service unavailable. Persistent MongoDB connection is required in production.');
  }

  static async listByWorkspace(workspaceId: string): Promise<IInvitation[]> {
    const mode = getActiveStorageMode();

    if (mode === 'mongodb') {
      if (!mongoose.Types.ObjectId.isValid(workspaceId)) return [];
      const docs = await MongooseInvitationModel.find({
        workspaceId: new mongoose.Types.ObjectId(workspaceId),
        status: 'PENDING',
      })
        .populate('inviterId', 'fullName email')
        .sort({ createdAt: -1 });

      return docs.map((doc) => {
        const inviter: any = doc.inviterId;
        const inviterDetails = inviter ? { id: inviter._id.toString(), fullName: inviter.fullName, email: inviter.email } : undefined;
        return this.formatInvitation(doc, undefined, inviterDetails);
      });
    }

    if (mode === 'memory') {
      const results: IInvitation[] = [];
      for (const inv of memoryInvitations.values()) {
        if (inv.workspaceId === workspaceId && inv.status === 'PENDING') {
          results.push(this.formatInvitation(inv));
        }
      }
      return results;
    }

    throw new Error('Database service unavailable. Persistent MongoDB connection is required in production.');
  }

  static async updateStatus(id: string, newStatus: InvitationStatus): Promise<IInvitation | null> {
    const mode = getActiveStorageMode();
    const updateFields: any = { status: newStatus };
    if (newStatus === 'ACCEPTED') {
      updateFields.acceptedAt = new Date();
    }

    if (mode === 'mongodb') {
      if (!mongoose.Types.ObjectId.isValid(id)) return null;
      const doc = await MongooseInvitationModel.findByIdAndUpdate(
        id,
        { $set: updateFields },
        { new: true }
      );
      return doc ? this.formatInvitation(doc) : null;
    }

    if (mode === 'memory') {
      const inv = memoryInvitations.get(id);
      if (!inv) return null;
      inv.status = newStatus;
      if (newStatus === 'ACCEPTED') {
        inv.acceptedAt = new Date();
      }
      inv.updatedAt = new Date();
      memoryInvitations.set(id, inv);
      return this.formatInvitation(inv);
    }

    throw new Error('Database service unavailable. Persistent MongoDB connection is required in production.');
  }

  static async findById(id: string): Promise<IInvitation | null> {
    const mode = getActiveStorageMode();

    if (mode === 'mongodb') {
      if (!mongoose.Types.ObjectId.isValid(id)) return null;
      const doc = await MongooseInvitationModel.findById(id);
      return doc ? this.formatInvitation(doc) : null;
    }

    if (mode === 'memory') {
      const inv = memoryInvitations.get(id);
      return inv ? this.formatInvitation(inv) : null;
    }

    throw new Error('Database service unavailable. Persistent MongoDB connection is required in production.');
  }

  static async deleteByWorkspace(workspaceId: string): Promise<number> {
    const mode = getActiveStorageMode();

    if (mode === 'mongodb') {
      if (!mongoose.Types.ObjectId.isValid(workspaceId)) return 0;
      const res = await MongooseInvitationModel.deleteMany({
        workspaceId: new mongoose.Types.ObjectId(workspaceId),
      });
      return res.deletedCount || 0;
    }

    if (mode === 'memory') {
      let deleted = 0;
      for (const [id, inv] of memoryInvitations.entries()) {
        if (inv.workspaceId === workspaceId) {
          memoryInvitations.delete(id);
          deleted++;
        }
      }
      return deleted;
    }

    throw new Error('Database service unavailable. Persistent MongoDB connection is required in production.');
  }

  static clearMemory(): void {
    memoryInvitations.clear();
  }
}
