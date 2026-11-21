import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { createApp } from './server/src/app.js';
import { connectDB, isProductionEnvironment } from './server/src/config/db.js';
import { getJwtSecret } from './server/src/middleware/auth.middleware.js';
import { seedDemoData } from './server/src/services/seed.service.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const isProd = isProductionEnvironment();

  // Fail fast in production if JWT_SECRET is missing or insecure
  if (isProd) {
    getJwtSecret();
  }

  const app = createApp();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

  // Connect to Database (throws in production if MONGODB_URI is missing or unreachable)
  await connectDB();

  // Demo seeding is strictly opt-in and strictly non-production
  if (!isProd && process.env.ENABLE_DEMO_SEED === 'true') {
    await seedDemoData();
  }

  if (!isProd) {
    // In development: mount Vite dev server middlewares
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR !== 'true',
      },
      appType: 'spa',
    });

    app.use(vite.middlewares);
  } else {
    // In production: serve static assets from dist
    const distPath = path.resolve(__dirname, 'dist');
    if (fs.existsSync(distPath)) {
      const express = (await import('express')).default;
      app.use(express.static(distPath));
      app.get('*', (_req, res) => {
        res.sendFile(path.resolve(distPath, 'index.html'));
      });
    }
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[TrackFlow] Full-stack server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('[TrackFlow] Failed to start server:', err);
  process.exit(1);
});
