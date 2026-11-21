import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { createApp } from '../../server/src/app';
import { connectDB, getActiveStorageMode, isMemoryModeAllowed } from '../../server/src/config/db';
import { UserModelAdapter } from '../../server/src/models/User';
import { WorkspaceModelAdapter } from '../../server/src/models/Workspace';
import { WorkspaceMemberModelAdapter } from '../../server/src/models/WorkspaceMember';
import { ProjectModelAdapter } from '../../server/src/models/Project';
import { ProjectMemberModelAdapter } from '../../server/src/models/ProjectMember';
import { IssueModelAdapter } from '../../server/src/models/Issue';
import { CommentModelAdapter } from '../../server/src/models/Comment';
import { InvitationModelAdapter } from '../../server/src/models/Invitation';
import { isTokenRevoked, clearRevokedTokensTest } from '../../server/src/models/RevokedToken';
import { seedDemoData } from '../../server/src/services/seed.service';
import {
  DEFAULT_DEV_JWT_SECRET,
  getJwtSecret,
  getCookieOptions,
} from '../../server/src/middleware/auth.middleware';

describe('TrackFlow Phase 3.1: Production Safety, Database Modes & Security Audit', () => {
  const originalEnv = { ...process.env };
  const originalReadyStateDescriptor = Object.getOwnPropertyDescriptor(mongoose.connection, 'readyState');

  const clearAllMemory = () => {
    UserModelAdapter.clearMemory();
    WorkspaceModelAdapter.clearMemory();
    WorkspaceMemberModelAdapter.clearMemory();
    ProjectModelAdapter.clearMemory();
    ProjectMemberModelAdapter.clearMemory();
    IssueModelAdapter.clearMemory();
    CommentModelAdapter.clearMemory();
    InvitationModelAdapter.clearMemory();
    clearRevokedTokensTest();
  };

  beforeEach(async () => {
    clearAllMemory();
    process.env = { ...originalEnv };
    await connectDB();
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    if (originalReadyStateDescriptor) {
      Object.defineProperty(mongoose.connection, 'readyState', originalReadyStateDescriptor);
    }
    process.env = { ...originalEnv };
    clearAllMemory();
    await connectDB();
  });

  describe('1. Development Database Modes & Explicit Memory Opt-In', () => {
    it('stays disconnected and returns 503 in development when MONGODB_URI is unset and ALLOW_MEMORY_DB is not enabled', async () => {
      delete process.env.VITEST;
      process.env.NODE_ENV = 'development';
      delete process.env.MONGODB_URI;
      delete process.env.ALLOW_MEMORY_DB;

      const status = await connectDB();
      expect(status.type).toBe('disconnected');
      expect(status.isConnected).toBe(false);
      expect(isMemoryModeAllowed()).toBe(false);
      expect(getActiveStorageMode()).toBe('none');

      const app = createApp();
      const healthRes = await request(app).get('/api/health');
      expect(healthRes.status).toBe(503);
      expect(healthRes.body.data.status).toBe('degraded');

      const regRes = await request(app).post('/api/auth/register').send({
        fullName: 'Dev Blocked',
        email: 'blocked@trackflow.dev',
        password: 'Password123!',
        confirmPassword: 'Password123!',
      });
      expect(regRes.status).toBe(503);
      expect(regRes.body.code).toBe('DATABASE_UNAVAILABLE');
    });

    it('uses explicit non-persistent memory mode in development only when ALLOW_MEMORY_DB=true and MONGODB_URI is unset', async () => {
      delete process.env.VITEST;
      process.env.NODE_ENV = 'development';
      delete process.env.MONGODB_URI;
      process.env.ALLOW_MEMORY_DB = 'true';

      const status = await connectDB();
      expect(status.type).toBe('memory');
      expect(status.isConnected).toBe(true);
      expect(status.persistent).toBe(false);
      expect(getActiveStorageMode()).toBe('memory');

      const app = createApp();
      const healthRes = await request(app).get('/api/health');
      expect(healthRes.status).toBe(200);
      expect(healthRes.body.data.database.type).toBe('memory');
      expect(healthRes.body.data.database.persistent).toBe(false);
      expect(healthRes.body.data.database.warning).toContain('ephemeral');
    });

    it('refuses silent fallback to memory when MONGODB_URI is configured in development but fails to connect', async () => {
      delete process.env.VITEST;
      process.env.NODE_ENV = 'development';
      process.env.MONGODB_URI = 'mongodb://127.0.0.1:27099/unreachable';
      process.env.ALLOW_MEMORY_DB = 'true';

      vi.spyOn(mongoose, 'connect').mockRejectedValueOnce(new Error('connect ECONNREFUSED 127.0.0.1:27099'));

      const status = await connectDB();
      expect(status.type).toBe('disconnected');
      expect(status.isConnected).toBe(false);
      expect(getActiveStorageMode()).toBe('none');
      expect(status.error).toContain('Refusing silent fallback');
    });
  });

  describe('2. Production MongoDB Enforcement & Fail-Closed Adapters', () => {
    it('throws at startup in production when MONGODB_URI is missing and blocks all 7 model adapters', async () => {
      delete process.env.VITEST;
      process.env.NODE_ENV = 'production';
      delete process.env.MONGODB_URI;
      process.env.ALLOW_MEMORY_DB = 'true'; // Even if mistakenly set, production ignores it

      await expect(connectDB()).rejects.toThrow('MONGODB_URI environment variable is required in production');
      expect(isMemoryModeAllowed()).toBe(false);
      expect(getActiveStorageMode()).toBe('none');

      const app = createApp();
      const healthRes = await request(app).get('/api/health');
      expect(healthRes.status).toBe(503);
      expect(healthRes.body.success).toBe(false);
      expect(healthRes.body.data.status).toBe('degraded');

      const regRes = await request(app).post('/api/auth/register').send({
        fullName: 'Prod User',
        email: 'prod@trackflow.dev',
        password: 'Password123!',
        confirmPassword: 'Password123!',
      });
      expect(regRes.status).toBe(503);
      expect(regRes.body.code).toBe('DATABASE_UNAVAILABLE');

      // Every model adapter must fail closed rather than silently falling back to memory
      await expect(UserModelAdapter.findByEmail('a@b.com')).rejects.toThrow('Database service unavailable');
      await expect(WorkspaceModelAdapter.findBySlug('test')).rejects.toThrow('Database service unavailable');
      await expect(WorkspaceMemberModelAdapter.findByWorkspace('ws1')).rejects.toThrow('Database service unavailable');
      await expect(ProjectModelAdapter.findByWorkspace('ws1')).rejects.toThrow('Database service unavailable');
      await expect(ProjectMemberModelAdapter.findByProject('p1')).rejects.toThrow('Database service unavailable');
      await expect(IssueModelAdapter.findByProject('p1')).rejects.toThrow('Database service unavailable');
      await expect(CommentModelAdapter.findByIssue('i1')).rejects.toThrow('Database service unavailable');
      await expect(InvitationModelAdapter.findByToken('tok')).rejects.toThrow('Database service unavailable');
      await expect(isTokenRevoked('tok')).rejects.toThrow('Database service unavailable');
    });

    it('drops to unavailable (503) and never falls back to memory if MongoDB disconnects after startup', async () => {
      delete process.env.VITEST;
      process.env.NODE_ENV = 'production';
      process.env.MONGODB_URI = 'mongodb://localhost:27017/trackflow';

      vi.spyOn(mongoose, 'connect').mockResolvedValueOnce({
        connection: { host: 'cluster0.example.mongodb.net', name: 'trackflow' },
      } as any);

      Object.defineProperty(mongoose.connection, 'readyState', {
        configurable: true,
        get: () => 1,
      });

      const connectedStatus = await connectDB();
      expect(connectedStatus.type).toBe('mongodb');
      expect(connectedStatus.isConnected).toBe(true);
      expect(getActiveStorageMode()).toBe('mongodb');

      // Simulate runtime connection drop
      Object.defineProperty(mongoose.connection, 'readyState', {
        configurable: true,
        get: () => 0,
      });

      expect(getActiveStorageMode()).toBe('none');

      const app = createApp();
      const healthRes = await request(app).get('/api/health');
      expect(healthRes.status).toBe(503);
      expect(healthRes.body.data.status).toBe('degraded');
      expect(healthRes.body.data.database.connected).toBe(false);
    });
  });

  describe('3. Demo Seeding Security & Idempotency', () => {
    it('does not seed demo data by default when ENABLE_DEMO_SEED is unset', async () => {
      delete process.env.ENABLE_DEMO_SEED;
      process.env.DEMO_USER_PASSWORD = 'DevOnlySeedPassword123!';

      const seeded = await seedDemoData();
      expect(seeded).toBe(false);
      expect(await UserModelAdapter.findByEmail('demo.lead@trackflow.dev')).toBeNull();
      expect(await WorkspaceModelAdapter.findBySlug('trackflow-core')).toBeNull();
    });

    it('strictly refuses demo seeding in production even if ENABLE_DEMO_SEED=true', async () => {
      process.env.NODE_ENV = 'production';
      process.env.ENABLE_DEMO_SEED = 'true';
      process.env.DEMO_USER_PASSWORD = 'DevOnlySeedPassword123!';

      const seeded = await seedDemoData();
      expect(seeded).toBe(false);
      expect(await UserModelAdapter.seedDemoUser()).toBeNull();
    });

    it('seeds demo user, workspace, and project idempotently when explicitly enabled in development', async () => {
      process.env.NODE_ENV = 'development';
      process.env.ENABLE_DEMO_SEED = 'true';
      process.env.DEMO_USER_EMAIL = 'reviewer@trackflow.dev';
      process.env.DEMO_USER_PASSWORD = 'DevOnlySeedPassword123!';

      const firstRun = await seedDemoData();
      expect(firstRun).toBe(true);

      const user = await UserModelAdapter.findByEmail('reviewer@trackflow.dev');
      expect(user).not.toBeNull();

      const ws = await WorkspaceModelAdapter.findBySlug('trackflow-core');
      expect(ws).not.toBeNull();

      const proj = await ProjectModelAdapter.findByKey(ws!.id!, 'WEB');
      expect(proj).not.toBeNull();

      // Re-running seedDemoData must be idempotent without duplicate members
      const secondRun = await seedDemoData();
      expect(secondRun).toBe(true);

      const wsMembers = await WorkspaceMemberModelAdapter.findByWorkspace(ws!.id!);
      const projMembers = await ProjectMemberModelAdapter.findByProject(proj!.id!);
      expect(wsMembers.length).toBe(1);
      expect(projMembers.length).toBe(1);
    });
  });

  describe('4. Cookie Flags, JWT_SECRET & CORS Security', () => {
    it('requires a non-default JWT_SECRET in production', () => {
      process.env.NODE_ENV = 'production';
      delete process.env.JWT_SECRET;
      expect(() => getJwtSecret()).toThrow('JWT_SECRET');

      process.env.JWT_SECRET = DEFAULT_DEV_JWT_SECRET;
      expect(() => getJwtSecret()).toThrow('JWT_SECRET');

      process.env.JWT_SECRET = 'a-very-strong-random-production-jwt-secret-key-2026';
      expect(getJwtSecret()).toBe('a-very-strong-random-production-jwt-secret-key-2026');
    });

    it('issues httpOnly sameSite=lax cookies by default and enforces secure in production', () => {
      process.env.NODE_ENV = 'development';
      delete process.env.COOKIE_SAMESITE;
      delete process.env.CROSS_SITE_COOKIES;
      expect(getCookieOptions()).toMatchObject({
        httpOnly: true,
        sameSite: 'lax',
        secure: false,
        path: '/',
      });

      process.env.NODE_ENV = 'production';
      expect(getCookieOptions()).toMatchObject({
        httpOnly: true,
        sameSite: 'lax',
        secure: true,
        path: '/',
      });

      process.env.CROSS_SITE_COOKIES = 'true';
      expect(getCookieOptions()).toMatchObject({
        httpOnly: true,
        sameSite: 'none',
        secure: true,
      });
    });

    it('allows only configured origins in production CORS and blocks untrusted origins', async () => {
      process.env.NODE_ENV = 'production';
      process.env.ALLOWED_ORIGINS = 'https://app.trackflow.io, https://admin.trackflow.io';
      delete process.env.CLIENT_URL;
      delete process.env.APP_URL;

      const app = createApp();

      const allowedRes = await request(app)
        .options('/api/health')
        .set('Origin', 'https://app.trackflow.io');
      expect(allowedRes.headers['access-control-allow-origin']).toBe('https://app.trackflow.io');

      const blockedRes = await request(app)
        .options('/api/health')
        .set('Origin', 'https://evil-attacker.example.com');
      expect(blockedRes.headers['access-control-allow-origin']).toBeUndefined();
    });
  });
});
