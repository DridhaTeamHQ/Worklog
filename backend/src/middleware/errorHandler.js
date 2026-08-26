import config from '../config/env.js';
import { AppError } from '../utils/errors.js';

export function notFoundHandler(req, _res, next) {
  next(new AppError(404, `No API route matches ${req.method} ${req.originalUrl}`));
}

/* eslint-disable no-unused-vars */
export function errorHandler(err, req, res, _next) {
  const status = err instanceof AppError ? err.status : err.status || 500;

  if (status >= 500) {
    console.error(`[error] ${req.method} ${req.originalUrl}`, err);
  }

  const body = {
    success: false,
    error: {
      message: err.expose || status < 500
        ? err.message
        : 'Something went wrong on our end. Please try again.',
      code: err.code || undefined,
      details: err.details || undefined,
    },
  };
  if (!config.isProd && status >= 500) body.error.stack = err.stack;

  res.status(status).json(body);
}
