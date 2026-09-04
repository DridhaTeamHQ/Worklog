/**
 * Personal to-do controller.
 *
 * Every handler works from `req.user.id` and never from anything in the request, so
 * there is no parameter a caller could set to reach someone else's list. The routes
 * are authenticated but carry no role gate: a private list is private to whoever owns
 * it, and every role has one.
 *
 * "Today" is `req.today` — the date in the caller's own timezone, resolved by
 * requireAuth — so a list opened late at night lands on the right day.
 */
import { ok, created } from '../utils/http.js';
import { asyncHandler, badRequest } from '../utils/errors.js';
import { listTodos, createTodo, updateTodo, deleteTodo } from '../models/todo.js';

const parseId = (raw) => {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) throw badRequest('Invalid to-do id.');
  return id;
};

export const list = asyncHandler(async (req, res) => {
  const date = req.validatedQuery.date || req.today;
  const todos = await listTodos(req.user.id, date);
  return ok(res, todos, { date, total: todos.length });
});

export const create = asyncHandler(async (req, res) => {
  const todo = await createTodo(req.user.id, {
    title: req.body.title,
    todoDate: req.body.date || req.today,
    projectId: req.body.projectId,
    taskId: req.body.taskId,
  });
  return created(res, todo);
});

export const update = asyncHandler(async (req, res) => {
  const todo = await updateTodo(req.user.id, parseId(req.params.id), {
    title: req.body.title,
    todoDate: req.body.date,
    isDone: req.body.isDone,
    projectId: req.body.projectId,
    taskId: req.body.taskId,
  });
  return ok(res, todo);
});

export const remove = asyncHandler(async (req, res) => {
  const id = parseId(req.params.id);
  await deleteTodo(req.user.id, id);
  return ok(res, { id, message: 'To-do removed.' });
});
