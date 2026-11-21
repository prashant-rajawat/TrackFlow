import express, { Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import authRoutes from './routes/auth.routes.js';
import healthRoutes from './routes/health.routes.js';
import workspaceRoutes from './routes/workspace.routes.js';
import invitationRoutes from './routes/invitation.routes.js';
import projectRoutes from './routes/project.routes.js';
import issueRoutes from './routes/issue.routes.js';
import commentRoutes from './routes/comment.routes.js';
import attachmentRoutes from './routes/attachment.routes.js';
import { notFoundHandler, errorHandler } from './middleware/error.middleware.js';

export const createApp = (): Express => {
  const app = express();

  // Security Headers via Helmet
  // Configure CSP to allow styles and fonts while securing standard attack surfaces
  app.use(
    helmet({
      contentSecurityPolicy: false, // Vite dev server and Google Fonts need flexible CSP
      crossOriginEmbedderPolicy: false,
    })
  );

  // CORS Configuration
  const isProd = process.env.NODE_ENV === 'production';
  const configuredOrigins = (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  const allowedOrigins = new Set<string>([
    ...(process.env.CLIENT_URL ? [process.env.CLIENT_URL.trim()] : []),
    ...(process.env.APP_URL ? [process.env.APP_URL.trim()] : []),
    ...configuredOrigins,
    ...(!isProd
      ? ['http://localhost:3000', 'http://127.0.0.1:3000', 'http://localhost:5173']
      : []),
  ]);

  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow requests with no Origin header (same-origin navigation, curl, server-to-server)
        if (!origin) {
          return callback(null, true);
        }

        if (allowedOrigins.has(origin)) {
          return callback(null, true);
        }

        // Allow local dev & cloud preview origins strictly outside production
        if (!isProd) {
          if (
            /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin) ||
            (origin.startsWith('https://') && origin.endsWith('.run.app'))
          ) {
            return callback(null, true);
          }
        }

        return callback(null, false);
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: [
        'Content-Type',
        'Authorization',
        'X-Requested-With',
        'x-workspace-id',
        'Idempotency-Key',
      ],
    })
  );

  // Body and cookie parsing
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));
  app.use(cookieParser());

  // API Routes
  app.use('/api/auth', authRoutes);
  app.use('/api/workspaces', workspaceRoutes);
  app.use('/api/invitations', invitationRoutes);
  app.use('/api/projects', projectRoutes);
  app.use('/api/issues', issueRoutes);
  app.use('/api/comments', commentRoutes);
  app.use('/api/attachments', attachmentRoutes);
  app.use('/api', healthRoutes);

  // Fallback 404 for unknown API routes
  app.use('/api/*', notFoundHandler);

  // Global Error Handler
  app.use(errorHandler);

  return app;
};
