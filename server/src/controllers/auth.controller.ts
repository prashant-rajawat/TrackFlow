import { Request, Response, NextFunction } from 'express';
import { registerSchema, loginSchema } from '../validators/auth.validator.js';
import { UserModelAdapter } from '../models/User.js';
import jwt from 'jsonwebtoken';
import { revokeToken } from '../models/RevokedToken.js';
import { LoginAttemptModelAdapter } from '../models/LoginAttempt.js';
import {
  signToken,
  setAuthCookie,
  clearAuthCookie,
  extractToken,
  AuthenticatedRequest,
} from '../middleware/auth.middleware.js';

export const register = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const validatedData = registerSchema.parse(req.body);

    const user = await UserModelAdapter.create({
      fullName: validatedData.fullName,
      email: validatedData.email,
      password: validatedData.password,
    });

    const formattedUser = UserModelAdapter.formatUser(user);
    const token = signToken({ id: formattedUser.id, email: formattedUser.email });

    setAuthCookie(res, token, req);

    return res.status(201).json({
      success: true,
      message: 'Account registered successfully',
      data: {
        user: formattedUser,
        token,
      },
    });
  } catch (error: any) {
    next(error);
  }
};

export const login = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const validatedData = loginSchema.parse(req.body);
    const email = validatedData.email.trim();
    const ip = req.ip || req.socket?.remoteAddress || 'unknown';

    // 1. Check if currently locked out
    const lockout = await LoginAttemptModelAdapter.checkLockout(email, ip);
    if (lockout.isLocked) {
      res.setHeader('Retry-After', String(lockout.retryAfterSeconds));
      return res.status(429).json({
        success: false,
        code: 'LOGIN_TEMPORARILY_LOCKED',
        message: 'Too many failed login attempts. Please try again after 5 minutes.',
        retryAfterSeconds: lockout.retryAfterSeconds,
      });
    }

    const user = await UserModelAdapter.findByEmail(email);
    if (!user) {
      const failure = await LoginAttemptModelAdapter.recordFailure(email, ip);
      if (failure.isLocked) {
        res.setHeader('Retry-After', String(failure.retryAfterSeconds));
        return res.status(429).json({
          success: false,
          code: 'LOGIN_TEMPORARILY_LOCKED',
          message: 'Too many failed login attempts. Please try again after 5 minutes.',
          retryAfterSeconds: failure.retryAfterSeconds,
        });
      }
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password. Please check your details and try again.',
      });
    }

    const isMatch = await user.comparePassword(validatedData.password);
    if (!isMatch) {
      const failure = await LoginAttemptModelAdapter.recordFailure(email, ip);
      if (failure.isLocked) {
        res.setHeader('Retry-After', String(failure.retryAfterSeconds));
        return res.status(429).json({
          success: false,
          code: 'LOGIN_TEMPORARILY_LOCKED',
          message: 'Too many failed login attempts. Please try again after 5 minutes.',
          retryAfterSeconds: failure.retryAfterSeconds,
        });
      }
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password. Please check your details and try again.',
      });
    }

    // Reset failed attempts on successful login
    await LoginAttemptModelAdapter.resetAttempts(email, ip);

    const formattedUser = UserModelAdapter.formatUser(user);
    const token = signToken({ id: formattedUser.id, email: formattedUser.email });

    setAuthCookie(res, token, req);

    return res.status(200).json({
      success: true,
      message: 'Login successful! Welcome back. You are now logged in.',
      data: {
        user: formattedUser,
        token,
      },
    });
  } catch (error: any) {
    next(error);
  }
};

export const getMe = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'User session not found',
      });
    }

    const formattedUser = UserModelAdapter.formatUser(req.user);

    return res.status(200).json({
      success: true,
      data: {
        user: formattedUser,
      },
    });
  } catch (error: any) {
    next(error);
  }
};

export const logout = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const token = extractToken(req);
    if (token) {
      try {
        const decoded: any = jwt.decode(token);
        const expiresAt = decoded?.exp
          ? new Date(decoded.exp * 1000)
          : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        await revokeToken(token, expiresAt);
      } catch (_e) {
        // Safe fallback
      }
    }

    clearAuthCookie(res, req);

    return res.status(200).json({
      success: true,
      message: 'Logged out successfully and session revoked',
    });
  } catch (error: any) {
    next(error);
  }
};
