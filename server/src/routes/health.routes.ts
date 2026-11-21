import { Router, Request, Response } from 'express';
import { getDBStatus, isProductionEnvironment } from '../config/db.js';

const router = Router();

router.get('/health', (_req: Request, res: Response) => {
  const dbStatus = getDBStatus();
  const isProd = isProductionEnvironment();

  // In production, database MUST be mongodb and connected to be considered healthy
  const isHealthy = isProd
    ? dbStatus.type === 'mongodb' && dbStatus.isConnected
    : dbStatus.isConnected;

  const isMemory = dbStatus.type === 'memory' || dbStatus.type === 'test-mock';

  const responseBody = {
    success: isHealthy,
    data: {
      status: isHealthy ? 'healthy' : 'degraded',
      service: 'TrackFlow API',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      database: {
        connected: dbStatus.isConnected,
        type: dbStatus.type,
        persistent: dbStatus.type === 'mongodb',
        host: dbStatus.host || 'none',
        name: dbStatus.name || 'none',
        warning: isMemory
          ? 'Running in ephemeral in-memory storage mode. Data will reset on server restart. Configure MONGODB_URI for persistence.'
          : undefined,
        error: dbStatus.error,
      },
    },
  };

  return res.status(isHealthy ? 200 : 503).json(responseBody);
});

export default router;
