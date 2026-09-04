import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import config from '../config/env.js';
import { requireAuth } from '../middleware/auth.js';
import { validate, safeText } from '../middleware/validate.js';
import {
  login, logout, logoutAll, me, forgotPassword, resetPassword, changeOwnPassword,
  inviteStatus, acceptInvite,
} from '../controllers/auth.js';

const router = Router();

/** Throttles credential stuffing without getting in a real user's way. */
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: config.isProd ? 10 : 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { message: 'Too many sign-in attempts. Please try again in a few minutes.' } },
});

/**
 * The invite endpoints answer whether a given address is a pending invite, so they
 * are the one place an address can be probed. Held tighter than sign-in: a manager
 * onboarding a joiner hits this a handful of times, while sweeping a company address
 * list needs thousands.
 */
const inviteLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: config.isProd ? 20 : 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { message: 'Too many attempts. Please try again in a few minutes.' } },
});

const forgotLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: config.isProd ? 5 : 50,
  standardHeaders: true,
  legacyHeaders: false,
});

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email address.'),
  password: z.string().min(1, 'Password is required.').max(200),
});

const inviteStatusSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email address.').max(190),
});

const acceptInviteSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email address.').max(190),
  password: z.string().min(8, 'Use at least 8 characters.').max(200),
});

const forgotSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email address.'),
});

const resetSchema = z.object({
  token: safeText(200, 'Reset token'),
  password: z.string().min(8, 'Use at least 8 characters.').max(200),
});

const changeSchema = z.object({
  currentPassword: z.string().min(1, 'Enter your current password.'),
  newPassword: z.string().min(8, 'Use at least 8 characters.').max(200),
});

router.post('/login', loginLimiter, validate(loginSchema), login);
router.post('/invite-status', inviteLimiter, validate(inviteStatusSchema), inviteStatus);
router.post('/accept-invite', inviteLimiter, validate(acceptInviteSchema), acceptInvite);
router.post('/logout', logout);
router.post('/logout-all', requireAuth, logoutAll);
router.get('/me', requireAuth, me);
router.post('/forgot-password', forgotLimiter, validate(forgotSchema), forgotPassword);
router.post('/reset-password', validate(resetSchema), resetPassword);
router.post('/change-password', requireAuth, validate(changeSchema), changeOwnPassword);

export default router;
