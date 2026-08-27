import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import config from './config/env.js';
import { notFoundHandler, errorHandler } from './middleware/errorHandler.js';

import authRoutes from './routes/auth.js';
import taskRoutes from './routes/tasks.js';
import reportRoutes from './routes/reports.js';
import notificationRoutes from './routes/notifications.js';
import teamRoutes from './routes/team.js';
import projectRoutes from './routes/projects.js';
import ticketRoutes from './routes/tickets.js';
import adminRoutes from './routes/admins.js';
import dashboardRoutes from './routes/dashboard.js';
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
        // The API serves JSON only, so nothing needs to execute or embed.
        'default-src': ["'none'"],
        'frame-ancestors': ["'none'"],
      },
    },
    crossOriginResourcePolicy: { policy: 'same-site' },
  }));

  app.use(cors({
    origin(origin, callback) {
      // Same-origin/curl requests send no Origin header and are allowed through;
      // browser origins must be on the configured allow-list.
      if (!origin || config.corsOrigins.includes(origin)) return callback(null, true);
      return callback(new Error('Origin not allowed by CORS policy'));
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

  app.get('/api/health', (_req, res) => res.json({
    success: true,
    data: { status: 'ok', app: config.appName, db: config.db.client, time: new Date().toISOString() },
  }));

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

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

export default createApp;
