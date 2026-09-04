/**
 * Device controller — a phone registering itself for push notifications.
 *
 * Everything is keyed on `req.user.id`, so a caller can only ever list, add or remove
 * their own devices.
 */
import { ok } from '../utils/http.js';
import { asyncHandler, notFound } from '../utils/errors.js';
import { registerDevice, removeDevice, listDevices } from '../models/device.js';

export const listMine = asyncHandler(async (req, res) => {
  const devices = await listDevices(req.user.id);
  return ok(res, devices, { total: devices.length });
});

export const register = asyncHandler(async (req, res) => {
  const device = await registerDevice({
    userId: req.user.id,
    expoPushToken: req.body.expoPushToken,
    platform: req.body.platform,
    appVersion: req.body.appVersion,
  });
  return ok(res, device, { message: 'This device will receive notifications.' });
});

export const remove = asyncHandler(async (req, res) => {
  const token = decodeURIComponent(String(req.params.token || ''));
  const removed = await removeDevice({ userId: req.user.id, expoPushToken: token });
  if (!removed) throw notFound('That device is not registered to you.');
  return ok(res, { message: 'This device will no longer receive notifications.' });
});
