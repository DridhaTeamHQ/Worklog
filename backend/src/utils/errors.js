/** Errors that are safe to show the client. Anything else becomes a generic 500. */
export class AppError extends Error {
  constructor(status, message, details) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.details = details;
    this.expose = true;
  }
}

export const badRequest = (msg = 'Invalid request', details) => new AppError(400, msg, details);
export const unauthorized = (msg = 'Authentication required') => new AppError(401, msg);
export const forbidden = (msg = 'You do not have access to this resource') => new AppError(403, msg);
export const notFound = (msg = 'Resource not found') => new AppError(404, msg);
export const conflict = (msg = 'Conflict') => new AppError(409, msg);

/** Wraps an async route handler so rejected promises reach the error middleware. */
export const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};
