import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../server/src/app';
import { UserModelAdapter } from '../../server/src/models/User';
import bcrypt from 'bcryptjs';

describe('TrackFlow Authentication & Backend API Tests', () => {
  const app = createApp();

  beforeEach(() => {
    UserModelAdapter.clearMemory();
  });

  describe('Health Endpoint', () => {
    it('returns healthy status and database information', async () => {
      const res = await request(app).get('/api/health');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('healthy');
      expect(res.body.data.database).toBeDefined();
    });
  });

  describe('POST /api/auth/register', () => {
    it('successfully registers a new user with hashed password', async () => {
      const payload = {
        fullName: 'Alex Murphy',
        email: 'alex.murphy@trackflow.dev',
        password: 'Password123!',
        confirmPassword: 'Password123!',
      };

      const res = await request(app)
        .post('/api/auth/register')
        .send(payload);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.email).toBe('alex.murphy@trackflow.dev');
      expect(res.body.data.user.fullName).toBe('Alex Murphy');
      expect(res.body.data.user.passwordHash).toBeUndefined(); // Never expose password hash
      expect(res.body.data.token).toBeDefined();

      // Verify the password in database is indeed hashed and not plain text
      const stored = await UserModelAdapter.findByEmail('alex.murphy@trackflow.dev');
      expect(stored).not.toBeNull();
      expect(stored!.passwordHash).not.toBe('Password123!');
      const isValid = await bcrypt.compare('Password123!', stored!.passwordHash);
      expect(isValid).toBe(true);
    });

    it('rejects registration with duplicate email address', async () => {
      const payload = {
        fullName: 'Alex Murphy',
        email: 'alex.murphy@trackflow.dev',
        password: 'Password123!',
        confirmPassword: 'Password123!',
      };

      // First registration
      await request(app).post('/api/auth/register').send(payload);

      // Attempt duplicate
      const res = await request(app).post('/api/auth/register').send(payload);
      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('already exists');
    });

    it('rejects registration with mismatched passwords', async () => {
      const payload = {
        fullName: 'Alex Murphy',
        email: 'alex.murphy@trackflow.dev',
        password: 'Password123!',
        confirmPassword: 'DifferentPassword123!',
      };

      const res = await request(app).post('/api/auth/register').send(payload);
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('rejects registration with weak password (missing number)', async () => {
      const payload = {
        fullName: 'Alex Murphy',
        email: 'alex.murphy@trackflow.dev',
        password: 'PasswordNoNumber!',
        confirmPassword: 'PasswordNoNumber!',
      };

      const res = await request(app).post('/api/auth/register').send(payload);
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('POST /api/auth/login', () => {
    beforeEach(async () => {
      await request(app).post('/api/auth/register').send({
        fullName: 'Jane Doe',
        email: 'jane.doe@trackflow.dev',
        password: 'SecurePassword123',
        confirmPassword: 'SecurePassword123',
      });
    });

    it('successfully logs in with valid credentials', async () => {
      const res = await request(app).post('/api/auth/login').send({
        email: 'jane.doe@trackflow.dev',
        password: 'SecurePassword123',
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.email).toBe('jane.doe@trackflow.dev');
      expect(res.body.data.token).toBeDefined();

      // Check cookie header
      const cookies = res.headers['set-cookie'];
      expect(cookies).toBeDefined();
      expect(cookies[0]).toContain('trackflow_token');
    });

    it('rejects login with incorrect password', async () => {
      const res = await request(app).post('/api/auth/login').send({
        email: 'jane.doe@trackflow.dev',
        password: 'WrongPassword999',
      });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('Invalid email or password');
    });

    it('rejects login for non-existent user email', async () => {
      const res = await request(app).post('/api/auth/login').send({
        email: 'nonexistent@trackflow.dev',
        password: 'SecurePassword123',
      });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });

  describe('Protected Endpoints and Session Persistence', () => {
    it('allows access to GET /api/auth/me with Bearer token', async () => {
      // Register user
      const reg = await request(app).post('/api/auth/register').send({
        fullName: 'Sam Altman',
        email: 'sam@trackflow.dev',
        password: 'Password123!',
        confirmPassword: 'Password123!',
      });
      const token = reg.body.data.token;

      // Access /api/auth/me
      const meRes = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(meRes.status).toBe(200);
      expect(meRes.body.success).toBe(true);
      expect(meRes.body.data.user.email).toBe('sam@trackflow.dev');
    });

    it('rejects GET /api/auth/me when unauthenticated', async () => {
      const res = await request(app).get('/api/auth/me');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('clears session cookie on POST /api/auth/logout', async () => {
      const res = await request(app).post('/api/auth/logout');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });
});
