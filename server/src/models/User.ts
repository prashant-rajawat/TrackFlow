import mongoose, { Document, Schema, Model } from 'mongoose';
import bcrypt from 'bcryptjs';
import { getActiveStorageMode, isProductionEnvironment } from '../config/db.js';

export interface IUser {
  _id?: any;
  id?: string;
  fullName: string;
  email: string;
  passwordHash: string;
  avatarUrl?: string;
  role?: string;
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
}

export interface IUserDocument extends Document {
  fullName: string;
  email: string;
  passwordHash: string;
  avatarUrl?: string;
  role?: string;
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
}

const UserSchema = new Schema<IUserDocument>(
  {
    fullName: {
      type: String,
      required: [true, 'Full name is required'],
      trim: true,
      minlength: [2, 'Full name must be at least 2 characters long'],
      maxlength: [100, 'Full name cannot exceed 100 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [
        /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
        'Please provide a valid email address',
      ],
    },
    passwordHash: {
      type: String,
      required: [true, 'Password is required'],
    },
    avatarUrl: {
      type: String,
      default: '',
    },
    role: {
      type: String,
      enum: ['user', 'admin'],
      default: 'user',
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret: any) => {
        ret.id = ret._id ? ret._id.toString() : ret.id;
        delete ret._id;
        delete ret.__v;
        delete ret.passwordHash;
        return ret;
      },
    },
  }
);

// Mongoose Pre-save hook for password hashing
UserSchema.pre('save', async function () {
  if (!this.isModified('passwordHash')) {
    return;
  }
  const salt = await bcrypt.genSalt(10);
  this.passwordHash = await bcrypt.hash(this.passwordHash, salt);
});

// Compare password method
UserSchema.methods.comparePassword = async function (candidatePassword: string): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.passwordHash);
};

export const MongooseUserModel: Model<IUserDocument> =
  mongoose.models.User || mongoose.model<IUserDocument>('User', UserSchema);

// In-Memory store fallback for environments without an active MongoDB connection
interface MemoryUserRecord {
  id: string;
  fullName: string;
  email: string;
  passwordHash: string;
  avatarUrl?: string;
  role?: string;
  createdAt: Date;
  updatedAt: Date;
}

const memoryUsers: Map<string, MemoryUserRecord> = new Map();

export class UserModelAdapter {
  static async findByEmail(email: string): Promise<IUser | null> {
    const mode = getActiveStorageMode();
    const normalizedEmail = email.toLowerCase().trim();

    if (mode === 'mongodb') {
      const doc = await MongooseUserModel.findOne({ email: normalizedEmail });
      return doc ? (doc as unknown as IUser) : null;
    }

    if (mode === 'memory') {
      for (const user of memoryUsers.values()) {
        if (user.email === normalizedEmail) {
          return {
            ...user,
            comparePassword: async (candidatePassword: string) => {
              return bcrypt.compare(candidatePassword, user.passwordHash);
            },
          };
        }
      }
      return null;
    }

    throw new Error('Database service unavailable. Persistent MongoDB connection is required in production.');
  }

  static async findById(id: string): Promise<IUser | null> {
    const mode = getActiveStorageMode();

    if (mode === 'mongodb') {
      const doc = await MongooseUserModel.findById(id);
      return doc ? (doc as unknown as IUser) : null;
    }

    if (mode === 'memory') {
      const user = memoryUsers.get(id);
      if (!user) return null;

      return {
        ...user,
        comparePassword: async (candidatePassword: string) => {
          return bcrypt.compare(candidatePassword, user.passwordHash);
        },
      };
    }

    throw new Error('Database service unavailable. Persistent MongoDB connection is required in production.');
  }

  static async create(data: { fullName: string; email: string; password: string }): Promise<IUser> {
    const mode = getActiveStorageMode();
    const normalizedEmail = data.email.toLowerCase().trim();

    // Check duplicate email
    const existing = await this.findByEmail(normalizedEmail);
    if (existing) {
      const error: any = new Error('An account with this email address already exists');
      error.code = 11000;
      error.statusCode = 409;
      throw error;
    }

    if (mode === 'mongodb') {
      const doc = new MongooseUserModel({
        fullName: data.fullName.trim(),
        email: normalizedEmail,
        passwordHash: data.password, // Mongoose pre-save hook will hash this
      });
      await doc.save();
      return doc as unknown as IUser;
    }

    if (mode === 'memory') {
      // Memory adapter: hash password using bcrypt
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(data.password, salt);
      const id = `usr_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      const now = new Date();

      const record: MemoryUserRecord = {
        id,
        fullName: data.fullName.trim(),
        email: normalizedEmail,
        passwordHash,
        avatarUrl: '',
        role: 'user',
        createdAt: now,
        updatedAt: now,
      };

      memoryUsers.set(id, record);

      return {
        ...record,
        comparePassword: async (candidatePassword: string) => {
          return bcrypt.compare(candidatePassword, record.passwordHash);
        },
      };
    }

    throw new Error('Database service unavailable. Persistent MongoDB connection is required in production.');
  }

  static formatUser(user: IUser) {
    const id = user.id || (user as any)._id?.toString() || '';
    return {
      id,
      fullName: user.fullName,
      email: user.email,
      avatarUrl: user.avatarUrl || '',
      role: user.role || 'user',
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }

  static async seedDemoUser(options?: { email?: string; password?: string; fullName?: string }): Promise<IUser | null> {
    if (isProductionEnvironment()) {
      console.warn('[TrackFlow Security] seedDemoUser is strictly disabled in production mode.');
      return null;
    }

    const email = (options?.email || process.env.DEMO_USER_EMAIL || 'demo.lead@trackflow.dev').toLowerCase().trim();
    const password = options?.password || process.env.DEMO_USER_PASSWORD;

    if (!password) {
      console.warn('[TrackFlow Security] DEMO_USER_PASSWORD environment variable is required to seed demo user.');
      return null;
    }

    const existing = await this.findByEmail(email);
    if (!existing) {
      const user = await this.create({
        fullName: options?.fullName || 'Sarah Connor (Tech Lead)',
        email,
        password,
      });
      console.log(`[TrackFlow] Seeded development reviewer account: ${email}`);
      return user;
    }
    return existing;
  }

  // Helper for automated testing resets
  static clearMemory(): void {
    memoryUsers.clear();
  }
}
