import mongoose, { Document, Schema, Model } from 'mongoose';
import { getActiveStorageMode } from '../config/db.js';
import { UserModelAdapter, MongooseUserModel } from './User.js';
import { ProjectModelAdapter } from './Project.js';
import { WorkspaceModelAdapter } from './Workspace.js';
import type {
  DueDatePreset,
  IssueSortField,
  SortOrder,
} from '../validators/issueQuery.validator.js';

export type IssueType = 'BUG' | 'FEATURE' | 'TASK';
export type IssuePriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type IssueStatus = 'TODO' | 'IN_PROGRESS' | 'DONE';

export interface IIssueUserSummary {
  id: string;
  fullName: string;
  email: string;
  avatarUrl?: string;
}

export interface IIssueProjectSummary {
  id: string;
  name: string;
  key: string;
  workspaceId: string;
}

export interface IIssueWorkspaceSummary {
  id: string;
  name: string;
  slug: string;
}

export interface IIssue {
  _id?: any;
  id?: string;
  title: string;
  description: string;
  issueKey: string;
  projectId: string;
  workspaceId: string;
  reporterId: string;
  assigneeId: string | null;
  type: IssueType;
  priority: IssuePriority;
  status: IssueStatus;
  dueDate?: Date | null;
  createdAt: Date;
  updatedAt: Date;
  reporter?: IIssueUserSummary;
  assignee?: IIssueUserSummary | null;
  project?: IIssueProjectSummary;
  workspace?: IIssueWorkspaceSummary;
}

export interface IIssueDocument extends Document {
  title: string;
  description: string;
  issueKey: string;
  projectId: any;
  workspaceId: any;
  reporterId: any;
  assigneeId: any | null;
  type: IssueType;
  priority: IssuePriority;
  status: IssueStatus;
  dueDate?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const IssueSchema = new Schema<IIssueDocument>(
  {
    title: {
      type: String,
      required: [true, 'Issue title is required'],
      trim: true,
      minlength: [3, 'Issue title must be at least 3 characters'],
      maxlength: [120, 'Issue title cannot exceed 120 characters'],
    },
    description: {
      type: String,
      required: [true, 'Issue description is required'],
      trim: true,
      minlength: [1, 'Issue description is required'],
      maxlength: [10000, 'Issue description cannot exceed 10000 characters'],
    },
    issueKey: {
      type: String,
      required: [true, 'Issue key is required'],
      unique: true,
      uppercase: true,
      trim: true,
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
    reporterId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Reporter ID is required'],
      index: true,
    },
    assigneeId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },
    type: {
      type: String,
      enum: ['BUG', 'FEATURE', 'TASK'],
      default: 'BUG',
      required: true,
    },
    priority: {
      type: String,
      enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
      default: 'MEDIUM',
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['TODO', 'IN_PROGRESS', 'DONE'],
      default: 'TODO',
      required: true,
      index: true,
    },
    dueDate: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret: any) => {
        ret.id = ret._id ? ret._id.toString() : ret.id;
        ret.projectId = ret.projectId ? ret.projectId.toString() : '';
        ret.workspaceId = ret.workspaceId ? ret.workspaceId.toString() : '';
        ret.reporterId = ret.reporterId ? ret.reporterId.toString() : '';
        ret.assigneeId = ret.assigneeId ? ret.assigneeId.toString() : null;
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

IssueSchema.index({ projectId: 1, createdAt: -1 });
IssueSchema.index({ workspaceId: 1, createdAt: -1 });
IssueSchema.index({ workspaceId: 1, updatedAt: -1 });
IssueSchema.index({ projectId: 1, status: 1, updatedAt: -1 });
IssueSchema.index({ projectId: 1, priority: 1, updatedAt: -1 });
IssueSchema.index({ workspaceId: 1, status: 1, updatedAt: -1 });
IssueSchema.index({ projectId: 1, assigneeId: 1, updatedAt: -1 });
IssueSchema.index({ projectId: 1, dueDate: 1 });

export const MongooseIssueModel: Model<IIssueDocument> =
  mongoose.models.Issue || mongoose.model<IIssueDocument>('Issue', IssueSchema);

interface MemoryIssueRecord {
  id: string;
  title: string;
  description: string;
  issueKey: string;
  projectId: string;
  workspaceId: string;
  reporterId: string;
  assigneeId: string | null;
  type: IssueType;
  priority: IssuePriority;
  status: IssueStatus;
  dueDate?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const memoryIssues: Map<string, MemoryIssueRecord> = new Map();

export class IssueModelAdapter {
  private static extractId(val: any): string {
    if (!val) return '';
    if (typeof val === 'string') return val;
    if (val._id) return val._id.toString();
    if (val.id) return String(val.id);
    return val.toString ? val.toString() : String(val);
  }

  private static formatUserSummary(u: any): IIssueUserSummary | undefined {
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

  private static formatProjectSummary(p: any): IIssueProjectSummary | undefined {
    if (!p || typeof p !== 'object') return undefined;
    if (!p.name && !p.key) return undefined;
    return {
      id: this.extractId(p),
      name: p.name,
      key: p.key,
      workspaceId: this.extractId(p.workspaceId),
    };
  }

  private static formatWorkspaceSummary(w: any): IIssueWorkspaceSummary | undefined {
    if (!w || typeof w !== 'object') return undefined;
    if (!w.name && !w.slug) return undefined;
    return {
      id: this.extractId(w),
      name: w.name,
      slug: w.slug,
    };
  }

  static formatIssue(
    issue: any,
    extras?: {
      reporter?: IIssueUserSummary;
      assignee?: IIssueUserSummary | null;
      project?: IIssueProjectSummary;
      workspace?: IIssueWorkspaceSummary;
    }
  ): IIssue {
    const id = issue.id || (issue._id ? issue._id.toString() : '');
    const projectId = this.extractId(issue.projectId);
    const workspaceId = this.extractId(issue.workspaceId);
    const reporterId = this.extractId(issue.reporterId);
    const assigneeId = issue.assigneeId ? this.extractId(issue.assigneeId) : null;

    return {
      id,
      title: issue.title,
      description: issue.description,
      issueKey: issue.issueKey,
      projectId,
      workspaceId,
      reporterId,
      assigneeId,
      type: issue.type as IssueType,
      priority: issue.priority as IssuePriority,
      status: issue.status as IssueStatus,
      dueDate: issue.dueDate || null,
      createdAt: issue.createdAt,
      updatedAt: issue.updatedAt,
      reporter: extras?.reporter ?? this.formatUserSummary(issue.reporterId),
      assignee: extras?.assignee !== undefined ? extras.assignee : (this.formatUserSummary(issue.assigneeId) || null),
      project: extras?.project ?? this.formatProjectSummary(issue.projectId),
      workspace: extras?.workspace ?? this.formatWorkspaceSummary(issue.workspaceId),
    };
  }

  private static async hydrateMemoryIssue(rec: MemoryIssueRecord): Promise<IIssue> {
    const [reporter, assignee, project, workspace] = await Promise.all([
      UserModelAdapter.findById(rec.reporterId),
      rec.assigneeId ? UserModelAdapter.findById(rec.assigneeId) : Promise.resolve(null),
      ProjectModelAdapter.findById(rec.projectId),
      WorkspaceModelAdapter.findById(rec.workspaceId),
    ]);

    return this.formatIssue(rec, {
      reporter: reporter ? this.formatUserSummary(reporter) : undefined,
      assignee: assignee ? this.formatUserSummary(assignee) || null : null,
      project: project
        ? {
            id: project.id!,
            name: project.name,
            key: project.key,
            workspaceId: project.workspaceId,
          }
        : undefined,
      workspace: workspace
        ? {
            id: workspace.id!,
            name: workspace.name,
            slug: workspace.slug,
          }
        : undefined,
    });
  }

  static async findById(id: string): Promise<IIssue | null> {
    const mode = getActiveStorageMode();

    if (mode === 'mongodb') {
      if (!mongoose.Types.ObjectId.isValid(id)) return null;
      const doc = await MongooseIssueModel.findById(id)
        .populate('reporterId', 'fullName email avatarUrl')
        .populate('assigneeId', 'fullName email avatarUrl')
        .populate('projectId', 'name key workspaceId')
        .populate('workspaceId', 'name slug');
      return doc ? this.formatIssue(doc) : null;
    }

    if (mode === 'memory') {
      const rec = memoryIssues.get(id);
      return rec ? this.hydrateMemoryIssue(rec) : null;
    }

    throw new Error('Database service unavailable. Persistent MongoDB connection is required in production.');
  }

  static async findByIssueKey(issueKey: string): Promise<IIssue | null> {
    const mode = getActiveStorageMode();
    const normalizedKey = issueKey.toUpperCase().trim();

    if (mode === 'mongodb') {
      const doc = await MongooseIssueModel.findOne({ issueKey: normalizedKey })
        .populate('reporterId', 'fullName email avatarUrl')
        .populate('assigneeId', 'fullName email avatarUrl')
        .populate('projectId', 'name key workspaceId')
        .populate('workspaceId', 'name slug');
      return doc ? this.formatIssue(doc) : null;
    }

    if (mode === 'memory') {
      for (const rec of memoryIssues.values()) {
        if (rec.issueKey === normalizedKey) {
          return this.hydrateMemoryIssue(rec);
        }
      }
      return null;
    }

    throw new Error('Database service unavailable. Persistent MongoDB connection is required in production.');
  }

  static async findByProject(projectId: string): Promise<IIssue[]> {
    const mode = getActiveStorageMode();

    if (mode === 'mongodb') {
      if (!mongoose.Types.ObjectId.isValid(projectId)) return [];
      const docs = await MongooseIssueModel.find({
        projectId: new mongoose.Types.ObjectId(projectId),
      })
        .populate('reporterId', 'fullName email avatarUrl')
        .populate('assigneeId', 'fullName email avatarUrl')
        .populate('projectId', 'name key workspaceId')
        .populate('workspaceId', 'name slug')
        .sort({ createdAt: -1 });
      return docs.map((doc) => this.formatIssue(doc));
    }

    if (mode === 'memory') {
      const matches: MemoryIssueRecord[] = [];
      for (const rec of memoryIssues.values()) {
        if (rec.projectId === projectId) {
          matches.push(rec);
        }
      }
      matches.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      return Promise.all(matches.map((rec) => this.hydrateMemoryIssue(rec)));
    }

    throw new Error('Database service unavailable. Persistent MongoDB connection is required in production.');
  }

  static async findByWorkspace(workspaceId: string, projectIds?: string[]): Promise<IIssue[]> {
    const mode = getActiveStorageMode();

    if (mode === 'mongodb') {
      if (!mongoose.Types.ObjectId.isValid(workspaceId)) return [];
      const query: any = { workspaceId: new mongoose.Types.ObjectId(workspaceId) };
      if (projectIds) {
        const validProjectIds = projectIds
          .filter((pid) => mongoose.Types.ObjectId.isValid(pid))
          .map((pid) => new mongoose.Types.ObjectId(pid));
        query.projectId = { $in: validProjectIds };
      }
      const docs = await MongooseIssueModel.find(query)
        .populate('reporterId', 'fullName email avatarUrl')
        .populate('assigneeId', 'fullName email avatarUrl')
        .populate('projectId', 'name key workspaceId')
        .populate('workspaceId', 'name slug')
        .sort({ createdAt: -1 });
      return docs.map((doc) => this.formatIssue(doc));
    }

    if (mode === 'memory') {
      const allowedSet = projectIds ? new Set(projectIds) : null;
      const matches: MemoryIssueRecord[] = [];
      for (const rec of memoryIssues.values()) {
        if (rec.workspaceId === workspaceId && (!allowedSet || allowedSet.has(rec.projectId))) {
          matches.push(rec);
        }
      }
      matches.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      return Promise.all(matches.map((rec) => this.hydrateMemoryIssue(rec)));
    }

    throw new Error('Database service unavailable. Persistent MongoDB connection is required in production.');
  }

  static async countByProject(projectId: string): Promise<number> {
    const mode = getActiveStorageMode();

    if (mode === 'mongodb') {
      if (!mongoose.Types.ObjectId.isValid(projectId)) return 0;
      return MongooseIssueModel.countDocuments({
        projectId: new mongoose.Types.ObjectId(projectId),
      });
    }

    if (mode === 'memory') {
      let count = 0;
      for (const rec of memoryIssues.values()) {
        if (rec.projectId === projectId) count++;
      }
      return count;
    }

    throw new Error('Database service unavailable. Persistent MongoDB connection is required in production.');
  }

  static async create(data: {
    title: string;
    description: string;
    issueKey: string;
    projectId: string;
    workspaceId: string;
    reporterId: string;
    assigneeId?: string | null;
    type?: IssueType;
    priority?: IssuePriority;
    status?: IssueStatus;
    dueDate?: Date | null;
    createdAt?: Date;
    updatedAt?: Date;
  }): Promise<IIssue> {
    const mode = getActiveStorageMode();
    const normalizedKey = data.issueKey.toUpperCase().trim();

    if (mode === 'mongodb') {
      const doc = new MongooseIssueModel({
        title: data.title.trim(),
        description: data.description.trim(),
        issueKey: normalizedKey,
        projectId: new mongoose.Types.ObjectId(data.projectId),
        workspaceId: new mongoose.Types.ObjectId(data.workspaceId),
        reporterId: new mongoose.Types.ObjectId(data.reporterId),
        assigneeId: data.assigneeId ? new mongoose.Types.ObjectId(data.assigneeId) : null,
        type: data.type || 'BUG',
        priority: data.priority || 'MEDIUM',
        status: data.status || 'TODO',
        dueDate: data.dueDate || null,
        ...(data.createdAt ? { createdAt: data.createdAt } : {}),
        ...(data.updatedAt ? { updatedAt: data.updatedAt } : {}),
      });
      await doc.save();
      const populated = await MongooseIssueModel.findById(doc._id)
        .populate('reporterId', 'fullName email avatarUrl')
        .populate('assigneeId', 'fullName email avatarUrl')
        .populate('projectId', 'name key workspaceId')
        .populate('workspaceId', 'name slug');
      return this.formatIssue(populated || doc);
    }

    if (mode === 'memory') {
      // Enforce unique issueKey in memory mode
      for (const existing of memoryIssues.values()) {
        if (existing.issueKey === normalizedKey) {
          const err: any = new Error(`Issue key '${normalizedKey}' already exists.`);
          err.statusCode = 409;
          err.code = 11000;
          throw err;
        }
      }

      const id = `iss_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      const now = new Date();
      const record: MemoryIssueRecord = {
        id,
        title: data.title.trim(),
        description: data.description.trim(),
        issueKey: normalizedKey,
        projectId: data.projectId,
        workspaceId: data.workspaceId,
        reporterId: data.reporterId,
        assigneeId: data.assigneeId || null,
        type: data.type || 'BUG',
        priority: data.priority || 'MEDIUM',
        status: data.status || 'TODO',
        dueDate: data.dueDate || null,
        createdAt: data.createdAt || now,
        updatedAt: data.updatedAt || data.createdAt || now,
      };
      memoryIssues.set(id, record);
      return this.hydrateMemoryIssue(record);
    }

    throw new Error('Database service unavailable. Persistent MongoDB connection is required in production.');
  }

  static async update(
    id: string,
    updates: {
      title?: string;
      description?: string;
      type?: IssueType;
      priority?: IssuePriority;
      status?: IssueStatus;
      assigneeId?: string | null;
      dueDate?: Date | null;
    }
  ): Promise<IIssue | null> {
    const mode = getActiveStorageMode();

    if (mode === 'mongodb') {
      if (!mongoose.Types.ObjectId.isValid(id)) return null;
      const updateData: any = {};
      if (updates.title !== undefined) updateData.title = updates.title.trim();
      if (updates.description !== undefined) updateData.description = updates.description.trim();
      if (updates.type !== undefined) updateData.type = updates.type;
      if (updates.priority !== undefined) updateData.priority = updates.priority;
      if (updates.status !== undefined) updateData.status = updates.status;
      if (updates.dueDate !== undefined) updateData.dueDate = updates.dueDate;
      if (updates.assigneeId !== undefined) {
        updateData.assigneeId = updates.assigneeId ? new mongoose.Types.ObjectId(updates.assigneeId) : null;
      }

      const doc = await MongooseIssueModel.findByIdAndUpdate(
        id,
        { $set: updateData },
        { new: true, runValidators: true }
      )
        .populate('reporterId', 'fullName email avatarUrl')
        .populate('assigneeId', 'fullName email avatarUrl')
        .populate('projectId', 'name key workspaceId')
        .populate('workspaceId', 'name slug');
      return doc ? this.formatIssue(doc) : null;
    }

    if (mode === 'memory') {
      const rec = memoryIssues.get(id);
      if (!rec) return null;
      if (updates.title !== undefined) rec.title = updates.title.trim();
      if (updates.description !== undefined) rec.description = updates.description.trim();
      if (updates.type !== undefined) rec.type = updates.type;
      if (updates.priority !== undefined) rec.priority = updates.priority;
      if (updates.status !== undefined) rec.status = updates.status;
      if (updates.assigneeId !== undefined) rec.assigneeId = updates.assigneeId || null;
      if (updates.dueDate !== undefined) rec.dueDate = updates.dueDate;
      rec.updatedAt = new Date();
      memoryIssues.set(id, rec);
      return this.hydrateMemoryIssue(rec);
    }

    throw new Error('Database service unavailable. Persistent MongoDB connection is required in production.');
  }

  static async delete(id: string): Promise<boolean> {
    const mode = getActiveStorageMode();

    if (mode === 'mongodb') {
      if (!mongoose.Types.ObjectId.isValid(id)) return false;
      const res = await MongooseIssueModel.findByIdAndDelete(id);
      return !!res;
    }

    if (mode === 'memory') {
      return memoryIssues.delete(id);
    }

    throw new Error('Database service unavailable. Persistent MongoDB connection is required in production.');
  }

  static async deleteByProject(projectId: string): Promise<number> {
    const mode = getActiveStorageMode();

    if (mode === 'mongodb') {
      if (!mongoose.Types.ObjectId.isValid(projectId)) return 0;
      const res = await MongooseIssueModel.deleteMany({
        projectId: new mongoose.Types.ObjectId(projectId),
      });
      return res.deletedCount || 0;
    }

    if (mode === 'memory') {
      let deleted = 0;
      for (const [id, rec] of memoryIssues.entries()) {
        if (rec.projectId === projectId) {
          memoryIssues.delete(id);
          deleted++;
        }
      }
      return deleted;
    }

    throw new Error('Database service unavailable. Persistent MongoDB connection is required in production.');
  }

  static async queryIssues(options: {
    workspaceId: string;
    allowedProjectIds: string[];
    search?: string;
    status?: IssueStatus[];
    priority?: IssuePriority[];
    type?: IssueType[];
    assigneeId?: string[];
    reporterId?: string[];
    dueDatePreset?: DueDatePreset;
    dueDateFrom?: Date;
    dueDateTo?: Date;
    createdFrom?: Date;
    createdTo?: Date;
    sortBy: IssueSortField;
    sortOrder: SortOrder;
    page: number;
    limit: number;
    now?: Date;
  }): Promise<{ issues: IIssue[]; totalItems: number }> {
    const mode = getActiveStorageMode();
    if (mode !== 'mongodb' && mode !== 'memory') {
      throw new Error('Database service unavailable. Persistent MongoDB connection is required in production.');
    }

    if (options.allowedProjectIds.length === 0) {
      return { issues: [], totalItems: 0 };
    }

    const now = options.now ?? new Date();
    const startOfToday = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0)
    );
    const endOfToday = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999)
    );
    const endOf7Days = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 7, 23, 59, 59, 999)
    );
    const endOf30Days = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 30, 23, 59, 59, 999)
    );

    const priorityRank: Record<IssuePriority, number> = {
      CRITICAL: 4,
      HIGH: 3,
      MEDIUM: 2,
      LOW: 1,
    };

    const statusRank: Record<IssueStatus, number> = {
      TODO: 1,
      IN_PROGRESS: 2,
      DONE: 3,
    };

    const escapeRegex = (val: string): string =>
      val.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    const skip = (options.page - 1) * options.limit;
    const sortDir = options.sortOrder === 'asc' ? 1 : -1;

    if (mode === 'mongodb') {
      if (!mongoose.Types.ObjectId.isValid(options.workspaceId)) {
        return { issues: [], totalItems: 0 };
      }

      const validProjectIds = options.allowedProjectIds
        .filter((pid) => mongoose.Types.ObjectId.isValid(pid))
        .map((pid) => new mongoose.Types.ObjectId(pid));

      if (validProjectIds.length === 0) {
        return { issues: [], totalItems: 0 };
      }

      const andConditions: Record<string, any>[] = [
        {
          workspaceId: new mongoose.Types.ObjectId(options.workspaceId),
          projectId: { $in: validProjectIds },
        },
      ];

      if (options.status && options.status.length > 0) {
        andConditions.push({ status: { $in: options.status } });
      }
      if (options.priority && options.priority.length > 0) {
        andConditions.push({ priority: { $in: options.priority } });
      }
      if (options.type && options.type.length > 0) {
        andConditions.push({ type: { $in: options.type } });
      }

      if (options.assigneeId && options.assigneeId.length > 0) {
        const includeUnassigned = options.assigneeId.includes('UNASSIGNED');
        const userObjectIds = options.assigneeId
          .filter((id) => id !== 'UNASSIGNED' && mongoose.Types.ObjectId.isValid(id))
          .map((id) => new mongoose.Types.ObjectId(id));

        const assigneeOr: Record<string, any>[] = [];
        if (includeUnassigned) {
          assigneeOr.push({ assigneeId: null });
        }
        if (userObjectIds.length > 0) {
          assigneeOr.push({ assigneeId: { $in: userObjectIds } });
        }
        if (assigneeOr.length === 0) {
          return { issues: [], totalItems: 0 };
        }
        andConditions.push(assigneeOr.length === 1 ? assigneeOr[0] : { $or: assigneeOr });
      }

      if (options.reporterId && options.reporterId.length > 0) {
        const reporterObjectIds = options.reporterId
          .filter((id) => mongoose.Types.ObjectId.isValid(id))
          .map((id) => new mongoose.Types.ObjectId(id));
        if (reporterObjectIds.length === 0) {
          return { issues: [], totalItems: 0 };
        }
        andConditions.push({ reporterId: { $in: reporterObjectIds } });
      }

      if (options.dueDatePreset) {
        switch (options.dueDatePreset) {
          case 'overdue':
            andConditions.push({ dueDate: { $ne: null, $lt: startOfToday } });
            break;
          case 'due_today':
            andConditions.push({ dueDate: { $gte: startOfToday, $lte: endOfToday } });
            break;
          case 'next_7_days':
            andConditions.push({ dueDate: { $gte: startOfToday, $lte: endOf7Days } });
            break;
          case 'next_30_days':
            andConditions.push({ dueDate: { $gte: startOfToday, $lte: endOf30Days } });
            break;
          case 'no_due_date':
            andConditions.push({ dueDate: null });
            break;
        }
      }

      if (options.dueDateFrom || options.dueDateTo) {
        const range: Record<string, any> = { $ne: null };
        if (options.dueDateFrom) range.$gte = options.dueDateFrom;
        if (options.dueDateTo) range.$lte = options.dueDateTo;
        andConditions.push({ dueDate: range });
      }

      if (options.createdFrom || options.createdTo) {
        const range: Record<string, any> = {};
        if (options.createdFrom) range.$gte = options.createdFrom;
        if (options.createdTo) range.$lte = options.createdTo;
        andConditions.push({ createdAt: range });
      }

      if (options.search && options.search.trim().length > 0) {
        const escaped = escapeRegex(options.search.trim());
        const regex = new RegExp(escaped, 'i');
        const matchedUsers = await MongooseUserModel.find(
          { $or: [{ fullName: regex }, { email: regex }] },
          { _id: 1 }
        ).lean();
        const matchedUserIds = matchedUsers.map((u: any) => u._id);

        const searchOr: Record<string, any>[] = [
          { title: regex },
          { description: regex },
          { issueKey: regex },
        ];
        if (matchedUserIds.length > 0) {
          searchOr.push({ assigneeId: { $in: matchedUserIds } });
          searchOr.push({ reporterId: { $in: matchedUserIds } });
        }
        andConditions.push({ $or: searchOr });
      }

      const matchStage =
        andConditions.length === 1 ? andConditions[0] : { $and: andConditions };

      const pipeline: any[] = [{ $match: matchStage }];

      const addFields: Record<string, any> = {};
      let sortStage: Record<string, 1 | -1>;

      switch (options.sortBy) {
        case 'priority':
          addFields._priorityRank = {
            $switch: {
              branches: [
                { case: { $eq: ['$priority', 'CRITICAL'] }, then: 4 },
                { case: { $eq: ['$priority', 'HIGH'] }, then: 3 },
                { case: { $eq: ['$priority', 'MEDIUM'] }, then: 2 },
                { case: { $eq: ['$priority', 'LOW'] }, then: 1 },
              ],
              default: 0,
            },
          };
          sortStage = { _priorityRank: sortDir, updatedAt: -1, _id: 1 };
          break;
        case 'status':
          addFields._statusRank = {
            $switch: {
              branches: [
                { case: { $eq: ['$status', 'TODO'] }, then: 1 },
                { case: { $eq: ['$status', 'IN_PROGRESS'] }, then: 2 },
                { case: { $eq: ['$status', 'DONE'] }, then: 3 },
              ],
              default: 0,
            },
          };
          sortStage = { _statusRank: sortDir, updatedAt: -1, _id: 1 };
          break;
        case 'dueDate':
          addFields._missingDueDate = {
            $cond: [{ $eq: [{ $ifNull: ['$dueDate', null] }, null] }, 1, 0],
          };
          sortStage = { _missingDueDate: 1, dueDate: sortDir, updatedAt: -1, _id: 1 };
          break;
        case 'title':
          addFields._titleLower = { $toLower: '$title' };
          sortStage = { _titleLower: sortDir, _id: 1 };
          break;
        case 'issueKey':
          sortStage = { issueKey: sortDir, _id: 1 };
          break;
        case 'createdAt':
          sortStage = { createdAt: sortDir, _id: 1 };
          break;
        case 'updatedAt':
        default:
          sortStage = { updatedAt: sortDir, _id: 1 };
          break;
      }

      if (Object.keys(addFields).length > 0) {
        pipeline.push({ $addFields: addFields });
      }
      pipeline.push({ $sort: sortStage });
      pipeline.push({
        $facet: {
          metadata: [{ $count: 'totalItems' }],
          items: [{ $skip: skip }, { $limit: options.limit }],
        },
      });

      const [aggResult] = await MongooseIssueModel.aggregate(pipeline);
      const totalItems: number = aggResult?.metadata?.[0]?.totalItems ?? 0;
      const rawItems: any[] = aggResult?.items ?? [];

      if (rawItems.length === 0) {
        return { issues: [], totalItems };
      }

      const populated = await MongooseIssueModel.populate(rawItems, [
        { path: 'reporterId', select: 'fullName email avatarUrl' },
        { path: 'assigneeId', select: 'fullName email avatarUrl' },
        { path: 'projectId', select: 'name key workspaceId' },
        { path: 'workspaceId', select: 'name slug' },
      ]);

      return {
        issues: (populated as any[]).map((doc) => this.formatIssue(doc)),
        totalItems,
      };
    }

    // Memory mode with identical semantics and strict tenant/project scoping
    const allowedSet = new Set(options.allowedProjectIds);
    const statusSet = options.status?.length ? new Set(options.status) : null;
    const prioritySet = options.priority?.length ? new Set(options.priority) : null;
    const typeSet = options.type?.length ? new Set(options.type) : null;
    const assigneeSet = options.assigneeId?.length ? new Set(options.assigneeId) : null;
    const reporterSet = options.reporterId?.length ? new Set(options.reporterId) : null;

    const searchRegex =
      options.search && options.search.trim().length > 0
        ? new RegExp(escapeRegex(options.search.trim()), 'i')
        : null;

    const candidates: MemoryIssueRecord[] = [];
    for (const rec of memoryIssues.values()) {
      if (rec.workspaceId !== options.workspaceId || !allowedSet.has(rec.projectId)) {
        continue;
      }
      if (statusSet && !statusSet.has(rec.status)) continue;
      if (prioritySet && !prioritySet.has(rec.priority)) continue;
      if (typeSet && !typeSet.has(rec.type)) continue;

      if (assigneeSet) {
        if (rec.assigneeId === null) {
          if (!assigneeSet.has('UNASSIGNED')) continue;
        } else if (!assigneeSet.has(rec.assigneeId)) {
          continue;
        }
      }

      if (reporterSet && !reporterSet.has(rec.reporterId)) continue;

      const dueTime = rec.dueDate ? new Date(rec.dueDate).getTime() : null;

      if (options.dueDatePreset) {
        if (options.dueDatePreset === 'no_due_date') {
          if (dueTime !== null) continue;
        } else if (dueTime === null) {
          continue;
        } else if (options.dueDatePreset === 'overdue') {
          if (dueTime >= startOfToday.getTime()) continue;
        } else if (options.dueDatePreset === 'due_today') {
          if (dueTime < startOfToday.getTime() || dueTime > endOfToday.getTime()) continue;
        } else if (options.dueDatePreset === 'next_7_days') {
          if (dueTime < startOfToday.getTime() || dueTime > endOf7Days.getTime()) continue;
        } else if (options.dueDatePreset === 'next_30_days') {
          if (dueTime < startOfToday.getTime() || dueTime > endOf30Days.getTime()) continue;
        }
      }

      if (options.dueDateFrom || options.dueDateTo) {
        if (dueTime === null) continue;
        if (options.dueDateFrom && dueTime < options.dueDateFrom.getTime()) continue;
        if (options.dueDateTo && dueTime > options.dueDateTo.getTime()) continue;
      }

      const createdTime = new Date(rec.createdAt).getTime();
      if (options.createdFrom && createdTime < options.createdFrom.getTime()) continue;
      if (options.createdTo && createdTime > options.createdTo.getTime()) continue;

      candidates.push(rec);
    }

    let hydrated = await Promise.all(candidates.map((rec) => this.hydrateMemoryIssue(rec)));

    if (searchRegex) {
      hydrated = hydrated.filter((iss) => {
        return (
          searchRegex.test(iss.title) ||
          searchRegex.test(iss.description) ||
          searchRegex.test(iss.issueKey) ||
          (iss.assignee ? searchRegex.test(iss.assignee.fullName) || searchRegex.test(iss.assignee.email) : false) ||
          (iss.reporter ? searchRegex.test(iss.reporter.fullName) || searchRegex.test(iss.reporter.email) : false)
        );
      });
    }

    hydrated.sort((a, b) => {
      let cmp = 0;
      switch (options.sortBy) {
        case 'priority': {
          cmp = (priorityRank[a.priority] - priorityRank[b.priority]) * sortDir;
          break;
        }
        case 'status': {
          cmp = (statusRank[a.status] - statusRank[b.status]) * sortDir;
          break;
        }
        case 'dueDate': {
          const aHas = a.dueDate ? 0 : 1;
          const bHas = b.dueDate ? 0 : 1;
          if (aHas !== bHas) {
            return aHas - bHas; // nulls always last regardless of asc/desc
          }
          if (a.dueDate && b.dueDate) {
            cmp = (new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()) * sortDir;
          }
          break;
        }
        case 'title': {
          cmp = a.title.toLowerCase().localeCompare(b.title.toLowerCase()) * sortDir;
          break;
        }
        case 'issueKey': {
          cmp = a.issueKey.localeCompare(b.issueKey) * sortDir;
          break;
        }
        case 'createdAt': {
          cmp = (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) * sortDir;
          break;
        }
        case 'updatedAt':
        default: {
          cmp = (new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime()) * sortDir;
          break;
        }
      }

      if (cmp !== 0) return cmp;
      if (options.sortBy !== 'updatedAt') {
        const updDiff = new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
        if (updDiff !== 0) return updDiff;
      }
      return (a.id || '').localeCompare(b.id || '');
    });

    const totalItems = hydrated.length;
    const paged = hydrated.slice(skip, skip + options.limit);
    return { issues: paged, totalItems };
  }

  static clearMemory(): void {
    memoryIssues.clear();
  }
}
