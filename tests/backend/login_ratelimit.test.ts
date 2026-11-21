import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../server/src/app.js';
import { connectDB } from '../../server/src/config/db.js';
import { UserModelAdapter } from '../../server/src/models/User.js';
import { LoginAttemptModelAdapter } from '../../server/src/models/LoginAttempt.js';

describe('TrackFlow Brute-Force Rate Limiting & Login UX', () => {
  let app: any;

  beforeEach(async () => {
    await connectDB();
    LoginAttemptModelAdapter.clearMemory();
    app = createApp();
  });

  afterEach(() => {
    LoginAttemptModelAdapter.clearMemory();
  });

  it('successful login returns exact success message and session cookie', async () => {
    // Register user first
    const email = `testlogin_${Date.now()}@trackflow.dev`;
    const password = 'Password123';

    await request(app)
      .post('/api/auth/register')
      .send({
        fullName: 'Test User',
        email,
        password,
        confirmPassword: password,
      });

    // Attempt login
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email, password });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toBe('Login successful! Welcome back. You are now logged in.');
    expect(res.headers['set-cookie']).toBeDefined();
  });

  it('incorrect password returns generic error and increments failure count', async () => {
    const email = `testfail_${Date.now()}@trackflow.dev`;
    const password = 'Password123';

    await request(app)
      .post('/api/auth/register')
      .send({
        fullName: 'Test User',
        email,
        password,
        confirmPassword: password,
      });

    // 5 consecutive failed attempts
    for (let i = 1; i <= 5; i++) {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email, password: 'WrongPassword' });

      if (i < 5) {
        expect(res.status).toBe(401);
        expect(res.body.message).toBe('Invalid email or password. Please check your details and try again.');
      } else {
        // 5th attempt triggers lockout (429)
        expect(res.status).toBe(429);
        expect(res.body.code).toBe('LOGIN_TEMPORARILY_LOCKED');
        expect(res.body.retryAfterSeconds).toBeGreaterThan(0);
      }
    }

    // 6th attempt during lockout is also rejected with 429
    const lockoutRes = await request(app)
      .post('/api/auth/login')
      .send({ email, password: 'WrongPassword' });

    expect(lockoutRes.status).toBe(429);
    expect(lockoutRes.body.code).toBe('LOGIN_TEMPORARILY_LOCKED');
  });
});
