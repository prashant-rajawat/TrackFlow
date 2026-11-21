import { Request, Response, NextFunction } from 'express';
import { getDBStatus, isProductionEnvironment } from '../config/db.js';

export const requireDatabase = (req: Request, res: Response, next: NextFunction) => {
  const dbStatus = getDBStatus();
  const isProd = isProductionEnvironment();

  // In production, database must be connected via MongoDB
  const isAvailable = isProd
    ? dbStatus.type === 'mongodb' && dbStatus.isConnected
    : dbStatus.isConnected;

  if (!isAvailable) {
    return res.status(503).json({
      success: false,
      message: isProd
        ? 'Database service unavailable. A persistent MongoDB connection is required in production mode.'
        : 'Database service unavailable. A database connection is required to perform data operations.',
      code: 'DATABASE_UNAVAILABLE',
      error: dbStatus.error || (isProd && dbStatus.type !== 'mongodb' ? 'MongoDB connection required in production' : undefined),
    });
  }

  next();
};
