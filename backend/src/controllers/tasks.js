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
import { departmentScope, isEmptyScope, scopedDepartment, withinScope } from '../utils/scope.js';
import {
  listTasks, getTaskById, assignTask, updateTaskStatus, updateTask, deleteTask,
} from '../models/task.js';
import { findById } from '../models/user.js';

const parseId = (raw) => {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) throw badRequest('Invalid task id.');
  return id;
};

export const list = asyncHandler(async (req, res) => {
  const q = req.validatedQuery;

  if (!isManagerLevel(req.user.role)) {
    const { items, total } = await listTasks({ ...q, employeeId: req.user.id, department: undefined });
    return ok(res, items, { total, limit: q.limit, offset: q.offset });
  }

  // A manager only sees work belonging to their own department; the department comes
  // from their account, so it cannot be widened from the query string.
  const scope = departmentScope(req.user);
  if (isEmptyScope(scope)) return ok(res, [], { total: 0, limit: q.limit, offset: q.offset });

  const { items, total } = await listTasks({ ...q, department: scopedDepartment(scope, q.department) });
  return ok(res, items, { total, limit: q.limit, offset: q.offset });
});

/**
 * The task, if this caller is allowed to touch it.
 *
 * A manager is confined to their own department, so a task belonging to somebody
 * else's report is reported as missing rather than refused — which id belongs to which
 * department is not something to leak through the difference between 403 and 404.
 */
async function getTaskInScope(req, taskId) {
  const task = await getTaskById(taskId);
  if (!task) throw notFound('That task no longer exists.');
  if (isManagerLevel(req.user.role)
      && !withinScope(departmentScope(req.user), task.employee_department)) {
    throw notFound('That task no longer exists.');
  }
  return task;
}

export const getOne = asyncHandler(async (req, res) => {
  const task = await getTaskInScope(req, parseId(req.params.id));
  if (isTeamMember(req.user.role) && task.employee_id !== req.user.id) {
    throw forbidden('You can only view tasks assigned to you.');
  }
  return ok(res, task);
});

/** Manager-level only. Creates the task and notifies the employee. */
export const assign = asyncHandler(async (req, res) => {
  // Checked before the insert: a manager may only hand work to their own department.
  const assignee = await findById(req.body.employeeId);
  if (!assignee) throw notFound('That team member could not be found.');
  if (!withinScope(departmentScope(req.user), assignee.department)) {
    throw forbidden('You can only assign work to people in your own department.');
  }

  const task = await assignTask({ ...req.body, managerId: req.user.id });
  return created(res, {
    task,
    message: `Task successfully assigned to ${task.employee_name}.`,
  });
});

/** The employee's own status control; a manager may also move their own tasks. */
export const setStatus = asyncHandler(async (req, res) => {
  await getTaskInScope(req, parseId(req.params.id));
  const task = await updateTaskStatus({
    taskId: parseId(req.params.id),
    status: req.body.status,
    actor: req.user,
  });
  return ok(res, task);
});

export const update = asyncHandler(async (req, res) => {
  await getTaskInScope(req, parseId(req.params.id));
  const task = await updateTask({ taskId: parseId(req.params.id), actor: req.user, patch: req.body });
  return ok(res, task);
});

export const remove = asyncHandler(async (req, res) => {
  await getTaskInScope(req, parseId(req.params.id));
  await deleteTask({ taskId: parseId(req.params.id), actor: req.user });
  return ok(res, { message: 'Task deleted.' });
});
