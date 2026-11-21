import mongoose, { Document, Schema, Model } from 'mongoose';
import { getActiveStorageMode } from '../config/db.js';

export interface ILoginAttempt {
  _id?: any;
  key: string;
  email: string;
  ip: string;
  failedAttempts: number;
  lockoutUntil?: Date;
  lastFailedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface ILoginAttemptDocument extends Document {
  key: string;
  email: string;
  ip: string;
  failedAttempts: number;
  lockoutUntil?: Date;
  lastFailedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const LoginAttemptSchema = new Schema<ILoginAttemptDocument>(
  {
    key: { type: String, required: true, unique: true, index: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    ip: { type: String, required: true },
    failedAttempts: { type: Number, default: 0 },
    lockoutUntil: { type: Date, index: true },
    lastFailedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// TTL index to automatically clean up old login attempt records after 24 hours
LoginAttemptSchema.index({ updatedAt: 1 }, { expireAfterSeconds: 86400 });

export const MongooseLoginAttemptModel: Model<ILoginAttemptDocument> =
  mongoose.models.LoginAttempt || mongoose.model<ILoginAttemptDocument>('LoginAttempt', LoginAttemptSchema);

const memoryLoginAttempts: Map<string, ILoginAttempt> = new Map();

export class LoginAttemptModelAdapter {
  static async getAttempt(key: string): Promise<ILoginAttempt | null> {
    const mode = getActiveStorageMode();
    if (mode === 'mongodb') {
      const doc = await MongooseLoginAttemptModel.findOne({ key });
      return doc ? (doc.toObject() as ILoginAttempt) : null;
    }
    if (mode === 'memory') {
      return memoryLoginAttempts.get(key) || null;
    }
    throw new Error('Database service unavailable. Persistent MongoDB connection is required in production.');
  }

  static async recordFailure(
    email: string,
    ip: string,
    maxAttempts: number = 5,
    lockoutMinutes: number = 5,
    windowMinutes: number = 15
  ): Promise<{ isLocked: boolean; retryAfterSeconds: number; attempts: number }> {
    const normalizedEmail = email.toLowerCase().trim();
    const key = `${normalizedEmail}:${ip}`;
    const now = new Date();
    const mode = getActiveStorageMode();
    const windowMs = windowMinutes * 60 * 1000;
    const lockoutMs = lockoutMinutes * 60 * 1000;

    if (mode === 'mongodb') {
      let record = await MongooseLoginAttemptModel.findOne({ key });

      if (!record) {
        record = new MongooseLoginAttemptModel({
          key,
          email: normalizedEmail,
          ip,
          failedAttempts: 1,
          lastFailedAt: now,
        });
      } else {
        if (record.lockoutUntil && record.lockoutUntil <= now) {
          record.failedAttempts = 1;
          record.lockoutUntil = undefined;
          record.lastFailedAt = now;
        } else if (record.lockoutUntil && record.lockoutUntil > now) {
          const retryAfterSeconds = Math.ceil((record.lockoutUntil.getTime() - now.getTime()) / 1000);
          return { isLocked: true, retryAfterSeconds, attempts: record.failedAttempts };
        } else {
          const timeSinceLastFailure = now.getTime() - new Date(record.lastFailedAt).getTime();
          if (timeSinceLastFailure > windowMs) {
            record.failedAttempts = 1;
          } else {
            record.failedAttempts += 1;
          }
          record.lastFailedAt = now;

          if (record.failedAttempts >= maxAttempts) {
            record.lockoutUntil = new Date(now.getTime() + lockoutMs);
          }
        }
      }
      await record.save();

      const isLocked = !!record.lockoutUntil && record.lockoutUntil > now;
      const retryAfterSeconds = isLocked ? Math.ceil((record.lockoutUntil!.getTime() - now.getTime()) / 1000) : 0;
      return { isLocked, retryAfterSeconds, attempts: record.failedAttempts };
    }

    if (mode === 'memory') {
      let record = memoryLoginAttempts.get(key);

      if (!record) {
        record = {
          key,
          email: normalizedEmail,
          ip,
          failedAttempts: 1,
          lastFailedAt: now,
          createdAt: now,
          updatedAt: now,
        };
      } else {
        if (record.lockoutUntil && record.lockoutUntil <= now) {
          record.failedAttempts = 1;
          record.lockoutUntil = undefined;
          record.lastFailedAt = now;
        } else if (record.lockoutUntil && record.lockoutUntil > now) {
          const retryAfterSeconds = Math.ceil((record.lockoutUntil.getTime() - now.getTime()) / 1000);
          return { isLocked: true, retryAfterSeconds, attempts: record.failedAttempts };
        } else {
          const timeSinceLastFailure = now.getTime() - new Date(record.lastFailedAt).getTime();
          if (timeSinceLastFailure > windowMs) {
            record.failedAttempts = 1;
          } else {
            record.failedAttempts += 1;
          }
          record.lastFailedAt = now;

          if (record.failedAttempts >= maxAttempts) {
            record.lockoutUntil = new Date(now.getTime() + lockoutMs);
          }
        }
      }
      memoryLoginAttempts.set(key, record);

      const isLocked = !!record.lockoutUntil && record.lockoutUntil > now;
      const retryAfterSeconds = isLocked ? Math.ceil((record.lockoutUntil!.getTime() - now.getTime()) / 1000) : 0;
      return { isLocked, retryAfterSeconds, attempts: record.failedAttempts };
    }

    throw new Error('Database service unavailable. Persistent MongoDB connection is required in production.');
  }

  static async resetAttempts(email: string, ip: string): Promise<void> {
    const normalizedEmail = email.toLowerCase().trim();
    const key = `${normalizedEmail}:${ip}`;
    const mode = getActiveStorageMode();

    if (mode === 'mongodb') {
      await MongooseLoginAttemptModel.deleteOne({ key });
      return;
    }
    if (mode === 'memory') {
      memoryLoginAttempts.delete(key);
      return;
    }
  }

  static async checkLockout(email: string, ip: string): Promise<{ isLocked: boolean; retryAfterSeconds: number }> {
    const normalizedEmail = email.toLowerCase().trim();
    const key = `${normalizedEmail}:${ip}`;
    const now = new Date();
    const record = await this.getAttempt(key);

    if (!record || !record.lockoutUntil) {
      return { isLocked: false, retryAfterSeconds: 0 };
    }

    if (record.lockoutUntil <= now) {
      await this.resetAttempts(email, ip);
      return { isLocked: false, retryAfterSeconds: 0 };
    }

    const retryAfterSeconds = Math.ceil((record.lockoutUntil.getTime() - now.getTime()) / 1000);
    return { isLocked: true, retryAfterSeconds };
  }

  static clearMemory(): void {
    memoryLoginAttempts.clear();
  }
}
