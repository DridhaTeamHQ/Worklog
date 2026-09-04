/**
 * Labels. The set is company-wide and small, so listing is open to everyone signed
 * in; creating and applying them is manager-level, deleting is admin-only (a label in
 * use on fifty tasks is not something to lose to a slip).
 */
import { ok, created } from '../utils/http.js';
import { asyncHandler, badRequest, forbidden } from '../utils/errors.js';
import { ROLES } from '../utils/roles.js';
import { getTaskInScope } from './tasks.js';
import { listLabels, createLabel, updateLabel, deleteLabel, setTaskLabels } from '../models/label.js';

const parseId = (raw, label) => {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) throw badRequest(`Invalid ${label} id.`);
  return id;
};

export const list = asyncHandler(async (req, res) => {
  const labels = await listLabels();
  return ok(res, labels, { total: labels.length });
});

export const create = asyncHandler(async (req, res) => created(res, await createLabel(req.body)));

export const update = asyncHandler(async (req, res) =>
  ok(res, await updateLabel(parseId(req.params.id, 'label'), req.body)));

export const remove = asyncHandler(async (req, res) => {
  await deleteLabel(parseId(req.params.id, 'label'));
  return ok(res, { message: 'Label deleted.' });
});

/** PUT /api/tasks/:id/labels — replace the labels on a task. */
export const setForTask = asyncHandler(async (req, res) => {
  const task = await getTaskInScope(req, parseId(req.params.id, 'task'));
  if (req.user.role === ROLES.MANAGER && task.manager_id !== req.user.id) {
    throw forbidden('You can only edit tasks you assigned.');
  }
  const labels = await setTaskLabels({ taskId: task.id, labelIds: req.body.labelIds, actor: req.user });
  return ok(res, labels);
});
