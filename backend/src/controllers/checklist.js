/**
 * Checklist items on a task.
 *
 * Ticking a sub-step is part of doing the work, so the assignee may do it; the manager
 * who owns the task and any admin may too. Everyone else is refused — a manager from
 * another department never gets this far (`getTaskInScope` answers 404 first).
 */
import { ok, created } from '../utils/http.js';
import { asyncHandler, badRequest, forbidden } from '../utils/errors.js';
import { ROLES, isTeamMember } from '../utils/roles.js';
import { getTaskInScope } from './tasks.js';
import {
  listChecklist, addChecklistItem, updateChecklistItem, deleteChecklistItem,
} from '../models/checklist.js';

const parseId = (raw, label) => {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) throw badRequest(`Invalid ${label} id.`);
  return id;
};

async function editableTask(req) {
  const task = await getTaskInScope(req, parseId(req.params.id, 'task'));
  if (isTeamMember(req.user.role) && task.employee_id !== req.user.id) {
    throw forbidden('You can only work on tasks assigned to you.');
  }
  if (req.user.role === ROLES.MANAGER && task.manager_id !== req.user.id) {
    throw forbidden('You can only edit tasks you assigned.');
  }
  return task;
}

export const list = asyncHandler(async (req, res) => {
  const task = await getTaskInScope(req, parseId(req.params.id, 'task'));
  if (isTeamMember(req.user.role) && task.employee_id !== req.user.id) {
    throw forbidden('You can only view tasks assigned to you.');
  }
  const items = await listChecklist(task.id);
  return ok(res, items, { total: items.length, done: items.filter((i) => i.is_done).length });
});

export const add = asyncHandler(async (req, res) => {
  const task = await editableTask(req);
  const item = await addChecklistItem({ taskId: task.id, title: req.body.title, actor: req.user });
  return created(res, item);
});

export const update = asyncHandler(async (req, res) => {
  const task = await editableTask(req);
  const item = await updateChecklistItem({
    taskId: task.id, itemId: parseId(req.params.itemId, 'checklist item'), patch: req.body, actor: req.user,
  });
  return ok(res, item);
});

export const remove = asyncHandler(async (req, res) => {
  const task = await editableTask(req);
  await deleteChecklistItem({ taskId: task.id, itemId: parseId(req.params.itemId, 'checklist item'), actor: req.user });
  return ok(res, { message: 'Checklist item removed.' });
});
