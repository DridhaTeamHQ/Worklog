import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import config from './config/env.js';
import { getDb } from './db/index.js';
import { notFoundHandler, errorHandler } from './middleware/errorHandler.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

import authRoutes from './routes/auth.js';
import taskRoutes from './routes/tasks.js';
import reportRoutes from './routes/reports.js';
import notificationRoutes from './routes/notifications.js';
import teamRoutes from './routes/team.js';
import projectRoutes from './routes/projects.js';
import ticketRoutes from './routes/tickets.js';
import adminRoutes from './routes/admins.js';
import dashboardRoutes from './routes/dashboard.js';
import todoRoutes from './routes/todos.js';
import profileRoutes from './routes/profile.js';

export function createApp() {
  const app = express();

  // Behind a reverse proxy the client IP must come from X-Forwarded-For for rate
  // limiting to work; trust exactly one hop rather than blanket-trusting headers.
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  app.use(helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
        imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
        connectSrc: ["'self'"],
        frameAncestors: ["'none'"],
      },
    },
    crossOriginResourcePolicy: { policy: 'same-origin' },
  }));

  app.use(cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      let isAllowed = config.corsOrigins.includes(origin) || (config.mail.appUrl && config.mail.appUrl === origin);
      try {
        const parsed = new URL(origin);
        if (parsed.hostname.endsWith('.vercel.app') || process.env.VERCEL) {
          isAllowed = true;
        }
      } catch {
        /* invalid url */
      }
      if (isAllowed) return callback(null, true);
      return callback(new Error(`Origin ${origin} not allowed by CORS policy`));
    },
    credentials: true,
  }));

  app.use(express.json({ limit: '256kb' }));
  app.use(express.urlencoded({ extended: false, limit: '256kb' }));
  app.use(cookieParser());

  app.use('/api', rateLimit({
    windowMs: 60 * 1000,
    limit: config.isProd ? 300 : 5000,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, error: { message: 'Too many requests. Please slow down.' } },
  }));

  /*
   * Health actually checks the database rather than reporting which driver was
   * configured. The difference matters on a deployment: a version that only echoes
   * config answers 200 while every real request fails, which tells an operator
   * nothing. One trivial query separates "the function is broken" from "the function
   * is fine and cannot reach the database", which are unrelated problems.
   *
   * Only the error *code* is reported — ETIMEDOUT, ECONNREFUSED, 28P01 and so on.
   * That is what identifies the fault, and unlike a full message it cannot carry a
   * host name or a credential.
   */
  app.get('/api/health', async (_req, res) => {
    const base = { app: config.appName, db: config.db.client, time: new Date().toISOString() };
    try {
      const db = await getDb();
      await db.get('SELECT 1 AS ok');
      return res.json({ success: true, data: { ...base, status: 'ok', database: { ok: true } } });
    } catch (err) {
      return res.status(503).json({
        success: false,
        data: { ...base, status: 'degraded', database: { ok: false, code: err.code || 'UNKNOWN' } },
        error: { message: 'The API is running but cannot reach its database.' },
      });
    }
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/profile', profileRoutes);
  app.use('/api/tasks', taskRoutes);
  app.use('/api/reports', reportRoutes);
  app.use('/api/notifications', notificationRoutes);
  app.use('/api/team', teamRoutes);
  app.use('/api/projects', projectRoutes);
  app.use('/api/tickets', ticketRoutes);
  app.use('/api/admins', adminRoutes);
  app.use('/api/dashboard', dashboardRoutes);
  app.use('/api/todos', todoRoutes);

  // Serve frontend SPA if built files are present (frontend/dist or backend/public)
  const candidateDirs = [
    path.resolve(__dirname, '../../frontend/dist'),
    path.resolve(__dirname, '../public'),
    path.resolve(__dirname, '../../public'),
  ];
  const staticDir = candidateDirs.find((dir) => fs.existsSync(path.join(dir, 'index.html')));

  if (staticDir) {
    app.use(express.static(staticDir));
    app.get('*', (req, res, next) => {
      // Don't intercept API routes with HTML; let them 404 cleanly below
      if (req.path.startsWith('/api')) {
        return next();
      }
      return res.sendFile(path.join(staticDir, 'index.html'));
    });
  }

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

export default createApp;
