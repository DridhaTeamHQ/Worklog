/**
 * Task controller.
 *
 * Managers and admins see every task and may filter by employee; team members are
 * pinned to their own id regardless of what they send, so the `employeeId` parameter
 * cannot be abused. Ownership rules for editing live in the model.
 */
import { ok, created } from '../utils/http.js';
import { asyncHandler, forbidden, notFound, badRequest } from '../utils/errors.js';
import { isManagerLevel, isTeamMember } from '../utils/roles.js';
import {
  listTasks, getTaskById, assignTask, updateTaskStatus, updateTask, deleteTask,
} from '../models/task.js';

const parseId = (raw) => {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) throw badRequest('Invalid task id.');
  return id;
};

export const list = asyncHandler(async (req, res) => {
  const q = req.validatedQuery;
  const filters = isManagerLevel(req.user.role)
    ? { ...q }
    : { ...q, employeeId: req.user.id, department: undefined };

  const { items, total } = await listTasks(filters);
  return ok(res, items, { total, limit: q.limit, offset: q.offset });
});

export const getOne = asyncHandler(async (req, res) => {
  const task = await getTaskById(parseId(req.params.id));
  if (!task) throw notFound('That task no longer exists.');
  if (isTeamMember(req.user.role) && task.employee_id !== req.user.id) {
    throw forbidden('You can only view tasks assigned to you.');
  }
  return ok(res, task);
});

/** Manager-level only. Creates the task and notifies the employee. */
export const assign = asyncHandler(async (req, res) => {
  const task = await assignTask({ ...req.body, managerId: req.user.id });
  return created(res, {
    task,
    message: `Task successfully assigned to ${task.employee_name}.`,
  });
});

/** The employee's own status control; a manager may also move their own tasks. */
export const setStatus = asyncHandler(async (req, res) => {
  const task = await updateTaskStatus({
    taskId: parseId(req.params.id),
    status: req.body.status,
    actor: req.user,
  });
  return ok(res, task);
});

export const update = asyncHandler(async (req, res) => {
  const task = await updateTask({ taskId: parseId(req.params.id), actor: req.user, patch: req.body });
  return ok(res, task);
});

export const remove = asyncHandler(async (req, res) => {
  await deleteTask({ taskId: parseId(req.params.id), actor: req.user });
  return ok(res, { message: 'Task deleted.' });
});
