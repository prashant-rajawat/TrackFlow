import mongoose, { Document, Schema, Model } from 'mongoose';
import { getActiveStorageMode } from '../config/db.js';
import { UserModelAdapter } from './User.js';

export interface ICommentAuthorSummary {
  id: string;
  fullName: string;
  email: string;
  avatarUrl?: string;
}

export interface IComment {
  _id?: any;
  id?: string;
  issueId: string;
  projectId: string;
  workspaceId: string;
  authorId: string;
  parentCommentId: string | null;
  content: string;
  isDeleted: boolean;
  editedAt: Date | null;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  author?: ICommentAuthorSummary;
}

export interface ICommentDocument extends Document {
  issueId: any;
  projectId: any;
  workspaceId: any;
  authorId: any;
  parentCommentId: any | null;
  content: string;
  editedAt: Date | null;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const CommentSchema = new Schema<ICommentDocument>(
  {
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
    authorId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Author ID is required'],
      index: true,
    },
    parentCommentId: {
      type: Schema.Types.ObjectId,
      ref: 'Comment',
      default: null,
      index: true,
    },
    content: {
      type: String,
      default: '',
      trim: true,
      maxlength: [2000, 'Comment cannot exceed 2000 characters'],
    },
    editedAt: {
      type: Date,
      default: null,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret: any) => {
        const isDeleted = !!ret.deletedAt;
        ret.id = ret._id ? ret._id.toString() : ret.id;
        ret.issueId = ret.issueId ? ret.issueId.toString() : '';
        ret.projectId = ret.projectId ? ret.projectId.toString() : '';
        ret.workspaceId = ret.workspaceId ? ret.workspaceId.toString() : '';
        ret.authorId = ret.authorId ? ret.authorId.toString() : '';
        ret.parentCommentId = ret.parentCommentId ? ret.parentCommentId.toString() : null;
        ret.isDeleted = isDeleted;
        if (isDeleted) {
          ret.content = '';
        }
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

CommentSchema.index({ issueId: 1, createdAt: 1 });
CommentSchema.index({ projectId: 1, createdAt: 1 });
CommentSchema.index({ workspaceId: 1, createdAt: 1 });
CommentSchema.index({ parentCommentId: 1, createdAt: 1 });

export const MongooseCommentModel: Model<ICommentDocument> =
  mongoose.models.Comment || mongoose.model<ICommentDocument>('Comment', CommentSchema);

interface MemoryCommentRecord {
  id: string;
  issueId: string;
  projectId: string;
  workspaceId: string;
  authorId: string;
  parentCommentId: string | null;
  content: string;
  editedAt: Date | null;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const memoryComments: Map<string, MemoryCommentRecord> = new Map();

export class CommentModelAdapter {
  private static extractId(val: any): string {
    if (!val) return '';
    if (typeof val === 'string') return val;
    if (val._id) return val._id.toString();
    if (val.id) return String(val.id);
    return val.toString ? val.toString() : String(val);
  }

  private static formatAuthorSummary(u: any): ICommentAuthorSummary | undefined {
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

  static formatComment(
    comment: any,
    authorOverride?: ICommentAuthorSummary
  ): IComment {
    const id = comment.id || (comment._id ? comment._id.toString() : '');
    const issueId = this.extractId(comment.issueId);
    const projectId = this.extractId(comment.projectId);
    const workspaceId = this.extractId(comment.workspaceId);
    const authorId = this.extractId(comment.authorId);
    const parentCommentId = comment.parentCommentId ? this.extractId(comment.parentCommentId) : null;
    const deletedAt = comment.deletedAt || null;
    const isDeleted = !!deletedAt;

    return {
      id,
      issueId,
      projectId,
      workspaceId,
      authorId,
      parentCommentId,
      // Never expose original text once soft-deleted
      content: isDeleted ? '' : comment.content || '',
      isDeleted,
      editedAt: comment.editedAt || null,
      deletedAt,
      createdAt: comment.createdAt,
      updatedAt: comment.updatedAt,
      author: authorOverride ?? this.formatAuthorSummary(comment.authorId),
    };
  }

  private static async hydrateMemoryComment(rec: MemoryCommentRecord): Promise<IComment> {
    const author = await UserModelAdapter.findById(rec.authorId);
    return this.formatComment(
      rec,
      author ? this.formatAuthorSummary(author) : undefined
    );
  }

  static async findById(id: string): Promise<IComment | null> {
    const mode = getActiveStorageMode();

    if (mode === 'mongodb') {
      if (!mongoose.Types.ObjectId.isValid(id)) return null;
      const doc = await MongooseCommentModel.findById(id).populate(
        'authorId',
        'fullName email avatarUrl'
      );
      return doc ? this.formatComment(doc) : null;
    }

    if (mode === 'memory') {
      const rec = memoryComments.get(id);
      return rec ? this.hydrateMemoryComment(rec) : null;
    }

    throw new Error('Database service unavailable. Persistent MongoDB connection is required in production.');
  }

  static async findByIssue(issueId: string): Promise<IComment[]> {
    const mode = getActiveStorageMode();

    if (mode === 'mongodb') {
      if (!mongoose.Types.ObjectId.isValid(issueId)) return [];
      const docs = await MongooseCommentModel.find({
        issueId: new mongoose.Types.ObjectId(issueId),
      })
        .populate('authorId', 'fullName email avatarUrl')
        .sort({ createdAt: 1, _id: 1 });
      return docs.map((doc) => this.formatComment(doc));
    }

    if (mode === 'memory') {
      const matches: MemoryCommentRecord[] = [];
      for (const rec of memoryComments.values()) {
        if (rec.issueId === issueId) {
          matches.push(rec);
        }
      }
      matches.sort((a, b) => {
        const diff = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        if (diff !== 0) return diff;
        return a.id.localeCompare(b.id);
      });
      return Promise.all(matches.map((rec) => this.hydrateMemoryComment(rec)));
    }

    throw new Error('Database service unavailable. Persistent MongoDB connection is required in production.');
  }

  static async countReplies(parentCommentId: string): Promise<number> {
    const mode = getActiveStorageMode();

    if (mode === 'mongodb') {
      if (!mongoose.Types.ObjectId.isValid(parentCommentId)) return 0;
      return MongooseCommentModel.countDocuments({
        parentCommentId: new mongoose.Types.ObjectId(parentCommentId),
      });
    }

    if (mode === 'memory') {
      let count = 0;
      for (const rec of memoryComments.values()) {
        if (rec.parentCommentId === parentCommentId) count++;
      }
      return count;
    }

    throw new Error('Database service unavailable. Persistent MongoDB connection is required in production.');
  }

  static async create(data: {
    issueId: string;
    projectId: string;
    workspaceId: string;
    authorId: string;
    parentCommentId?: string | null;
    content: string;
  }): Promise<IComment> {
    const mode = getActiveStorageMode();
    const trimmedContent = data.content.trim();

    if (mode === 'mongodb') {
      const doc = new MongooseCommentModel({
        issueId: new mongoose.Types.ObjectId(data.issueId),
        projectId: new mongoose.Types.ObjectId(data.projectId),
        workspaceId: new mongoose.Types.ObjectId(data.workspaceId),
        authorId: new mongoose.Types.ObjectId(data.authorId),
        parentCommentId: data.parentCommentId
          ? new mongoose.Types.ObjectId(data.parentCommentId)
          : null,
        content: trimmedContent,
        editedAt: null,
        deletedAt: null,
      });
      await doc.save();
      const populated = await MongooseCommentModel.findById(doc._id).populate(
        'authorId',
        'fullName email avatarUrl'
      );
      return this.formatComment(populated || doc);
    }

    if (mode === 'memory') {
      const id = `cmt_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      const now = new Date();
      const record: MemoryCommentRecord = {
        id,
        issueId: data.issueId,
        projectId: data.projectId,
        workspaceId: data.workspaceId,
        authorId: data.authorId,
        parentCommentId: data.parentCommentId || null,
        content: trimmedContent,
        editedAt: null,
        deletedAt: null,
        createdAt: now,
        updatedAt: now,
      };
      memoryComments.set(id, record);
      return this.hydrateMemoryComment(record);
    }

    throw new Error('Database service unavailable. Persistent MongoDB connection is required in production.');
  }

  static async updateContent(id: string, content: string): Promise<IComment | null> {
    const mode = getActiveStorageMode();
    const trimmedContent = content.trim();
    const now = new Date();

    if (mode === 'mongodb') {
      if (!mongoose.Types.ObjectId.isValid(id)) return null;
      const doc = await MongooseCommentModel.findByIdAndUpdate(
        id,
        { $set: { content: trimmedContent, editedAt: now } },
        { new: true, runValidators: true }
      ).populate('authorId', 'fullName email avatarUrl');
      return doc ? this.formatComment(doc) : null;
    }

    if (mode === 'memory') {
      const rec = memoryComments.get(id);
      if (!rec) return null;
      rec.content = trimmedContent;
      rec.editedAt = now;
      rec.updatedAt = now;
      memoryComments.set(id, rec);
      return this.hydrateMemoryComment(rec);
    }

    throw new Error('Database service unavailable. Persistent MongoDB connection is required in production.');
  }

  static async softDelete(id: string): Promise<IComment | null> {
    const mode = getActiveStorageMode();
    const now = new Date();

    if (mode === 'mongodb') {
      if (!mongoose.Types.ObjectId.isValid(id)) return null;
      const doc = await MongooseCommentModel.findByIdAndUpdate(
        id,
        { $set: { deletedAt: now, content: '' } },
        { new: true }
      ).populate('authorId', 'fullName email avatarUrl');
      return doc ? this.formatComment(doc) : null;
    }

    if (mode === 'memory') {
      const rec = memoryComments.get(id);
      if (!rec) return null;
      rec.deletedAt = now;
      rec.content = '';
      rec.updatedAt = now;
      memoryComments.set(id, rec);
      return this.hydrateMemoryComment(rec);
    }

    throw new Error('Database service unavailable. Persistent MongoDB connection is required in production.');
  }

  static async deleteByIssue(issueId: string): Promise<number> {
    const mode = getActiveStorageMode();

    if (mode === 'mongodb') {
      if (!mongoose.Types.ObjectId.isValid(issueId)) return 0;
      const res = await MongooseCommentModel.deleteMany({
        issueId: new mongoose.Types.ObjectId(issueId),
      });
      return res.deletedCount || 0;
    }

    if (mode === 'memory') {
      let deleted = 0;
      for (const [id, rec] of memoryComments.entries()) {
        if (rec.issueId === issueId) {
          memoryComments.delete(id);
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
      const res = await MongooseCommentModel.deleteMany({
        projectId: new mongoose.Types.ObjectId(projectId),
      });
      return res.deletedCount || 0;
    }

    if (mode === 'memory') {
      let deleted = 0;
      for (const [id, rec] of memoryComments.entries()) {
        if (rec.projectId === projectId) {
          memoryComments.delete(id);
          deleted++;
        }
      }
      return deleted;
    }

    throw new Error('Database service unavailable. Persistent MongoDB connection is required in production.');
  }

  static clearMemory(): void {
    memoryComments.clear();
  }
}
