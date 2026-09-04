/**
 * Activity threads and comments on tasks and tickets.
 *
 * Who may read a thread is exactly who may read the thing it hangs off, so every
 * handler first resolves the task or ticket through the same scope checks the task
 * and ticket controllers use. Nothing here re-decides visibility.
 */
import { ok, created } from '../utils/http.js';
import { asyncHandler, badRequest, forbidden } from '../utils/errors.js';
import { isTeamMember, MANAGER_ROLES } from '../utils/roles.js';
import { getDb } from '../db/index.js';
import { getTaskInScope } from './tasks.js';
import { getTicketInScope } from './tickets.js';
import { listActivity, addComment, editComment, deleteComment, getActivityById } from '../models/activity.js';
import { createNotification } from '../models/notification.js';

const parseId = (raw, label) => {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) throw badRequest(`Invalid ${label} id.`);
  return id;
};

/** The task or ticket, already checked for this caller. */
async function resolveEntity(req, entity) {
  if (entity === 'task') {
    const task = await getTaskInScope(req, parseId(req.params.id, 'task'));
    if (isTeamMember(req.user.role) && task.employee_id !== req.user.id) {
      throw forbidden('You can only view tasks assigned to you.');
    }
    return { taskId: task.id, ticketId: null, row: task };
  }
  const ticket = await getTicketInScope(req, parseId(req.params.id, 'ticket'));
  if (isTeamMember(req.user.role) && ticket.reporter_id !== req.user.id) {
    throw forbidden('You can only view tickets you raised.');
  }
  return { taskId: null, ticketId: ticket.id, row: ticket };
}

/**
 * Everyone allowed to see the entity, for validating @mentions: the two parties, every
 * admin, and the manager-level people in the assignee's / reporter's department.
 */
async function audience(entity, row) {
  const db = await getDb();
  const ids = new Set();
  const roleList = MANAGER_ROLES.map((r) => `'${r}'`).join(', ');
  let department;
  let taskManagerId = null;
  if (entity === 'task') {
    ids.add(row.employee_id);
    ids.add(row.manager_id);
    department = row.employee_department;
  } else {
    ids.add(row.reporter_id);
    department = row.reporter_department;
    if (row.task_id) {
      const task = await db.get('SELECT manager_id FROM assigned_tasks WHERE id = ?', [row.task_id]);
      taskManagerId = task?.manager_id ?? null;
      if (taskManagerId) ids.add(taskManagerId);
    }
  }
  const rows = await db.query(
    `SELECT id FROM users WHERE is_active = 1 AND role IN (${roleList}) AND (role = 'admin' OR department = ?)`,
    [department ?? null],
  );
  rows.forEach((r) => ids.add(Number(r.id)));
  return { ids, taskManagerId };
}

/** The person on the other side of the conversation from the actor. */
function counterpart(entity, row, actor, taskManagerId) {
  if (entity === 'task') {
    return actor.id === row.employee_id ? row.manager_id : row.employee_id;
  }
  return actor.id === row.reporter_id ? taskManagerId : row.reporter_id;
}

export const listThread = (entity) => asyncHandler(async (req, res) => {
  const { taskId, ticketId } = await resolveEntity(req, entity);
  const { items, total } = await listActivity({ taskId, ticketId });
  return ok(res, items, { total });
});

export const comment = (entity) => asyncHandler(async (req, res) => {
  const { taskId, ticketId, row } = await resolveEntity(req, entity);
  const { ids: canSee, taskManagerId } = await audience(entity, row);

  // Mentions arrive as user ids. Anyone who could not open the thing is dropped
  // rather than notified about something they cannot then read.
  const mentions = [...new Set((req.body.mentions || []).map(Number))]
    .filter((id) => id !== req.user.id && canSee.has(id));

  const db = await getDb();
  const label = entity === 'task' ? (row.task_key || row.title || 'a task') : (row.ticket_key || 'a ticket');
  const excerpt = req.body.body.length > 120 ? `${req.body.body.slice(0, 117)}…` : req.body.body;
  const link = entity === 'task' ? { relatedTaskId: taskId } : { relatedTicketId: ticketId };

  const commentId = await db.transaction(async (tx) => {
    const id = await addComment({ taskId, ticketId, actorId: req.user.id, body: req.body.body, mentions }, tx);

    for (const userId of mentions) {
      await createNotification({
        userId,
        title: `${req.user.name} mentioned you`,
        message: `On ${label}: ${excerpt}`,
        type: 'mentioned',
        relatedUserId: req.user.id,
        ...link,
      }, tx);
    }

    const other = counterpart(entity, row, req.user, taskManagerId);
    if (other && other !== req.user.id && !mentions.includes(other)) {
      await createNotification({
        userId: other,
        title: `New comment on ${label}`,
        message: `${req.user.name}: ${excerpt}`,
        type: entity === 'task' ? 'task_commented' : 'ticket_commented',
        relatedUserId: req.user.id,
        ...link,
      }, tx);
    }
    return id;
  });

  return created(res, await getActivityById(commentId));
});

export const edit = (entity) => asyncHandler(async (req, res) => {
  const { taskId, ticketId } = await resolveEntity(req, entity);
  const updated = await editComment({
    commentId: parseId(req.params.commentId, 'comment'), actor: req.user, body: req.body.body, taskId, ticketId,
  });
  return ok(res, updated);
});

export const remove = (entity) => asyncHandler(async (req, res) => {
  const { taskId, ticketId } = await resolveEntity(req, entity);
  await deleteComment({ commentId: parseId(req.params.commentId, 'comment'), actor: req.user, taskId, ticketId });
  return ok(res, { message: 'Comment deleted.' });
});
