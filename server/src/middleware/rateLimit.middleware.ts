import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './auth.middleware.js';

interface RateLimitOptions {
  bucket: string;
  windowMs: number;
  maxRequests: number;
  testMaxRequests?: number;
  message: string;
  keyGenerator?: (req: Request) => string;
}

const bucketTimestamps = new Map<string, Map<string, number[]>>();
const maxOverridesForTest = new Map<string, number>();

export const resetAllRateLimitsForTest = (): void => {
  bucketTimestamps.clear();
  maxOverridesForTest.clear();
};

export const setRateLimitMaxForTest = (bucket: string, maxRequests: number | null): void => {
  if (maxRequests === null) {
    maxOverridesForTest.delete(bucket);
  } else {
    maxOverridesForTest.set(bucket, maxRequests);
  }
};

/**
 * In-memory sliding-window rate limiter per Express instance.
 * Multi-instance horizontal scaling requires a shared external store (e.g. Redis)
 * or edge gateway rate limiting.
 */
export const createRateLimiter = (options: RateLimitOptions) => {
  const {
    bucket,
    windowMs,
    maxRequests,
    testMaxRequests,
    message,
    keyGenerator,
  } = options;

  return (req: Request, res: Response, next: NextFunction) => {
    const isTest = process.env.NODE_ENV === 'test' || !!process.env.VITEST;
    const overrideMax = maxOverridesForTest.get(bucket);
    const effectiveMax =
      overrideMax !== undefined
        ? overrideMax
        : isTest && testMaxRequests !== undefined
        ? testMaxRequests
        : maxRequests;

    if (effectiveMax <= 0) {
      return next();
    }

    const identity = keyGenerator
      ? keyGenerator(req)
      : req.ip || req.socket?.remoteAddress || 'unknown';

    let store = bucketTimestamps.get(bucket);
    if (!store) {
      store = new Map<string, number[]>();
      bucketTimestamps.set(bucket, store);
    }

    const now = Date.now();
    const cutoff = now - windowMs;
    const history = (store.get(identity) || []).filter((ts) => ts > cutoff);

    if (history.length >= effectiveMax) {
      const oldestInWindow = history[0] || now;
      const retryAfterSec = Math.max(1, Math.ceil((oldestInWindow + windowMs - now) / 1000));
      res.setHeader('Retry-After', String(retryAfterSec));
      res.setHeader('RateLimit-Limit', String(effectiveMax));
      res.setHeader('RateLimit-Remaining', '0');
      res.setHeader('RateLimit-Reset', String(retryAfterSec));

      return res.status(429).json({
        success: false,
        code: 'RATE_LIMIT_EXCEEDED',
        message,
      });
    }

    history.push(now);
    store.set(identity, history);

    res.setHeader('RateLimit-Limit', String(effectiveMax));
    res.setHeader('RateLimit-Remaining', String(Math.max(0, effectiveMax - history.length)));

    return next();
  };
};

export const loginRateLimiter = createRateLimiter({
  bucket: 'auth_login',
  windowMs: 15 * 60 * 1000,
  maxRequests: Number(process.env.RATE_LIMIT_LOGIN_MAX) || 20,
  testMaxRequests: 200,
  message: 'Too many login attempts. Please wait before trying again.',
  keyGenerator: (req) => {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const ip = req.ip || 'unknown';
    return email ? `${ip}:${email}` : ip;
  },
});

export const registerRateLimiter = createRateLimiter({
  bucket: 'auth_register',
  windowMs: 15 * 60 * 1000,
  maxRequests: Number(process.env.RATE_LIMIT_REGISTER_MAX) || 20,
  testMaxRequests: 200,
  message: 'Too many registration requests. Please wait before trying again.',
  keyGenerator: (req) => req.ip || 'unknown',
});

export const invitationRateLimiter = createRateLimiter({
  bucket: 'invitations',
  windowMs: 15 * 60 * 1000,
  maxRequests: Number(process.env.RATE_LIMIT_INVITATION_MAX) || 30,
  testMaxRequests: 200,
  message: 'Too many invitation requests. Please wait before trying again.',
  keyGenerator: (req: AuthenticatedRequest) => req.user?.id || req.ip || 'unknown',
});
