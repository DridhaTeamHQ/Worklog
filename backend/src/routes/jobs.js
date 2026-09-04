import { Router } from 'express';
import config from '../config/env.js';
import { unauthorized } from '../utils/errors.js';
import { tick } from '../controllers/jobs.js';

const router = Router();

/**
 * There is no user behind a cron call, so the job is guarded by a shared secret in
 * the Authorization header — the form Vercel Cron sends automatically when the
 * project has CRON_SECRET set. With no secret configured the route is closed, not
 * open: a reminder job anyone can trigger is a spam button.
 */
function requireCronSecret(req, _res, next) {
  const expected = config.jobs.cronSecret;
  const header = req.get('authorization') || '';
  const given = header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : '';
  if (!expected || !given || given !== expected) {
    return next(unauthorized('This job needs the cron secret.'));
  }
  return next();
}

router.get('/tick', requireCronSecret, tick);
router.post('/tick', requireCronSecret, tick);

export default router;
