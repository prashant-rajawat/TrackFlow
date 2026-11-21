import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';

export interface ApiError extends Error {
  statusCode?: number;
  code?: number | string;
  errors?: any;
}

export const notFoundHandler = (req: Request, res: Response, _next: NextFunction) => {
  res.status(404).json({
    success: false,
    message: `API route not found: ${req.method} ${req.originalUrl}`,
  });
};

export const errorHandler = (
  err: ApiError,
  _req: Request,
  res: Response,
  _next: NextFunction
) => {
  // Handle Zod validation errors
  if (err instanceof ZodError || err.name === 'ZodError') {
    const issues = (err as any).issues || (err as any).errors || [];
    const formattedErrors = issues.map((e: any) => ({
      field: Array.isArray(e.path) ? e.path.join('.') : String(e.path || ''),
      message: e.message || 'Validation error',
    }));

    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: formattedErrors,
    });
  }

  // Handle malformed JSON request bodies
  if (err instanceof SyntaxError && (err as any).status === 400 && 'body' in err) {
    return res.status(400).json({
      success: false,
      code: 'INVALID_JSON',
      message: 'Malformed JSON request body.',
    });
  }

  // Handle oversized request payload errors
  if ((err as any).type === 'entity.too.large') {
    return res.status(413).json({
      success: false,
      code: 'PAYLOAD_TOO_LARGE',
      message: 'Request payload exceeds the maximum allowed size.',
    });
  }

  // Handle Mongoose CastError (malformed ObjectId)
  if (err.name === 'CastError') {
    return res.status(400).json({
      success: false,
      code: 'INVALID_ID',
      message: 'Invalid resource identifier format.',
    });
  }

  // Handle MongoDB duplicate key errors (code 11000)
  if (err.code === 11000) {
    const keyPattern = (err as any).keyPattern || {};
    let message = err.message || 'Duplicate resource conflict';
    if (keyPattern.email) {
      message = 'An account with this email address already exists';
    } else if (keyPattern.issueKey) {
      message = 'An issue with this key already exists';
    } else if (keyPattern.key) {
      message = 'A project with this key already exists in this workspace';
    }
    return res.status(409).json({
      success: false,
      message,
    });
  }

  const statusCode = err.statusCode || 500;
  const isProduction = process.env.NODE_ENV === 'production';
  const safeMessage =
    isProduction && statusCode >= 500 && statusCode !== 503
      ? 'Internal server error'
      : err.message || 'Internal server error';

  return res.status(statusCode).json({
    success: false,
    message: safeMessage,
    ...(typeof err.code === 'string' && err.code ? { code: err.code } : {}),
    ...(isProduction ? {} : { stack: err.stack }),
  });
};
