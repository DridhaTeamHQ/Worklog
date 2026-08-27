/**
 * Profile controller — the signed-in user acting on their own record.
 *
 * Handlers are exported already wrapped in `asyncHandler`, so the route file stays
 * pure wiring and a rejected promise still reaches the error middleware.
 */
import { ok } from '../utils/http.js';
import { asyncHandler } from '../utils/errors.js';
import { findById, updateProfile } from '../models/user.js';

export const getProfile = asyncHandler(async (req, res) => ok(res, await findById(req.user.id)));

export const patchProfile = asyncHandler(async (req, res) => {
  const user = await updateProfile(req.user.id, req.body);
  return ok(res, user);
});
