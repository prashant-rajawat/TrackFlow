import mongoose, { Schema, Document, Model } from 'mongoose';
import crypto from 'crypto';
import { getActiveStorageMode } from '../config/db.js';

export interface IRevokedTokenDocument extends Document {
  tokenHash: string;
  expiresAt: Date;
  revokedAt: Date;
}

const RevokedTokenSchema = new Schema<IRevokedTokenDocument>(
  {
    tokenHash: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expires: 0 }, // MongoDB TTL auto-cleanup after token expires
    },
    revokedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: false,
  }
);

export const MongooseRevokedToken: Model<IRevokedTokenDocument> =
  mongoose.models.RevokedToken ||
  mongoose.model<IRevokedTokenDocument>('RevokedToken', RevokedTokenSchema);

// In-memory set for test mode
const testRevokedTokens = new Set<string>();

const hashToken = (token: string): string => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

export const revokeToken = async (token: string, expiresAt: Date): Promise<void> => {
  const tokenHash = hashToken(token);
  const mode = getActiveStorageMode();

  if (mode === 'mongodb') {
    await MongooseRevokedToken.updateOne(
      { tokenHash },
      { $set: { tokenHash, expiresAt, revokedAt: new Date() } },
      { upsert: true }
    );
    return;
  }

  if (mode === 'memory') {
    testRevokedTokens.add(tokenHash);
    return;
  }

  throw new Error('Database service unavailable. Persistent MongoDB connection is required in production.');
};

export const isTokenRevoked = async (token: string): Promise<boolean> => {
  const tokenHash = hashToken(token);
  const mode = getActiveStorageMode();

  if (mode === 'mongodb') {
    const doc = await MongooseRevokedToken.findOne({ tokenHash });
    return !!doc;
  }

  if (mode === 'memory') {
    return testRevokedTokens.has(tokenHash);
  }

  throw new Error('Database service unavailable. Persistent MongoDB connection is required in production.');
};

export const clearRevokedTokensTest = (): void => {
  testRevokedTokens.clear();
};
