import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { UserModelAdapter, IUser } from '../models/User.js';
import { isTokenRevoked } from '../models/RevokedToken.js';

export interface AuthenticatedRequest extends Request {
  user?: IUser;
  token?: string;
}

export const DEFAULT_DEV_JWT_SECRET = 'trackflow-super-secret-jwt-key-change-in-production';
export const COOKIE_NAME = 'trackflow_token';

export const getJwtSecret = (): string => {
  const secret = process.env.JWT_SECRET;
  const isProd = process.env.NODE_ENV === 'production';

  if (isProd) {
    if (!secret || secret === DEFAULT_DEV_JWT_SECRET) {
      throw new Error(
        'Fatal security configuration error: A strong, unique JWT_SECRET environment variable is required in production.'
      );
    }
  }

  return secret || DEFAULT_DEV_JWT_SECRET;
};

export const getCookieOptions = (req?: Request) => {
  const isProd = process.env.NODE_ENV === 'production';
  const isHttps =
    isProd ||
    (req ? req.protocol === 'https' || req.get('x-forwarded-proto') === 'https' : false) ||
    process.env.FORCE_SECURE_COOKIES === 'true';

  const configuredSameSite = process.env.COOKIE_SAMESITE?.toLowerCase() as 'lax' | 'strict' | 'none' | undefined;
  const sameSite: 'lax' | 'strict' | 'none' =
    configuredSameSite && ['lax', 'strict', 'none'].includes(configuredSameSite)
      ? configuredSameSite
      : process.env.CROSS_SITE_COOKIES === 'true'
      ? 'none'
      : 'lax';

  const secure = isProd || sameSite === 'none' || isHttps;

  return {
    httpOnly: true,
    secure,
    sameSite,
    path: '/',
    ...(process.env.COOKIE_DOMAIN ? { domain: process.env.COOKIE_DOMAIN } : {}),
  };
};

export const signToken = (payload: { id: string; email: string }): string => {
  return jwt.sign(payload, getJwtSecret(), {
    expiresIn: '7d',
  });
};

export const setAuthCookie = (res: Response, token: string, req?: Request): void => {
  const options = getCookieOptions(req);
  res.cookie(COOKIE_NAME, token, {
    ...options,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });
};

export const clearAuthCookie = (res: Response, req?: Request): void => {
  const options = getCookieOptions(req);
  res.clearCookie(COOKIE_NAME, options);
};

export const extractToken = (req: Request): string | null => {
  // 1. Check HTTP-only cookie
  if (req.cookies && req.cookies[COOKIE_NAME]) {
    return req.cookies[COOKIE_NAME];
  }

  // 2. Check Authorization header: "Bearer <token>"
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  return null;
};

export const requireAuth = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const token = extractToken(req);

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required. Please log in to continue.',
      });
    }

    // Check if token has been revoked by a previous logout
    const revoked = await isTokenRevoked(token);
    if (revoked) {
      return res.status(401).json({
        success: false,
        message: 'This session has been logged out. Please sign in again.',
      });
    }

    let decoded: any;
    try {
      decoded = jwt.verify(token, getJwtSecret());
    } catch (err: any) {
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          message: 'Your session has expired. Please log in again.',
        });
      }
      return res.status(401).json({
        success: false,
        message: 'Invalid authentication token. Please log in again.',
      });
    }

    if (!decoded || !decoded.id) {
      return res.status(401).json({
        success: false,
        message: 'Invalid session payload.',
      });
    }

    const user = await UserModelAdapter.findById(decoded.id);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User associated with this session no longer exists.',
      });
    }

    req.user = user;
    req.token = token;
    next();
  } catch (error: any) {
    next(error);
  }
};
