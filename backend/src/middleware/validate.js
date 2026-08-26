import { z } from 'zod';
import { badRequest } from '../utils/errors.js';

/**
 * Validates and REPLACES the request part with the parsed result, so handlers can
 * only ever read values that passed the schema — unknown keys are dropped, which
 * removes mass-assignment as a concern.
 */
export const validate = (schema, part = 'body') => (req, _res, next) => {
  const result = schema.safeParse(req[part]);
  if (!result.success) {
    const details = result.error.issues.map((i) => ({
      field: i.path.join('.') || part,
      message: i.message,
    }));
    return next(badRequest('Please correct the highlighted fields.', details));
  }
  if (part === 'query') req.validatedQuery = result.data;
  else req[part] = result.data;
  return next();
};

/** Trimmed text with control characters and null bytes removed. */
export const safeText = (max, label = 'This field') =>
  z.string()
    .transform((s) => s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim())
    .pipe(z.string().min(1, `${label} is required.`).max(max, `${label} must be ${max} characters or fewer.`));

export const optionalText = (max) =>
  z.string()
    .transform((s) => s.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim())
    .pipe(z.string().max(max))
    .optional()
    .nullable();

export const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a valid date (YYYY-MM-DD).');
