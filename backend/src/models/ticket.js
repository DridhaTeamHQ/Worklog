import { getDb } from '../db/index.js';
import { nowIso } from '../utils/dates.js';
import { createNotification } from './notification.js';
import { notFound, forbidden, badRequest } from '../utils/errors.js';
import { isTeamMember } from '../utils/roles.js';
import { SEVERITIES, TICKET_STATUSES } from '../utils/constants.js';

export { SEVERITIES, TICKET_STATUSES } from '../utils/constants.js';

/** Statuses that mean the bug still needs someone's attention. */
export const OPEN_STATUSES = ['open', 'in_progress'];

const STATUS_LABEL = {
  open: 'Open',
  in_progress: 'In Progress',
  resolved: 'Resolved',
  closed: 'Closed',
};

const SELECT_TICKET = `
  SELECT t.id, t.project_id, t.task_id, t.reporter_id, t.ticket_number,
         t.title, t.description, t.severity, t.status,
         t.resolution_note, t.resolved_at, t.created_at, t.updated_at,
         p.name AS project_name, p.project_key,
         p.project_key || '-B' || t.ticket_number AS ticket_key,
         r.name AS reporter_name, r.email AS reporter_email,
         r.department AS reporter_department, r.profile_image AS reporter_profile_image,
         a.title AS task_title,
         CASE WHEN a.id IS NULL THEN NULL
              ELSE p.project_key || '-' || a.task_number END AS task_key
    FROM tickets t
    JOIN projects p ON p.id = t.project_id
    JOIN users r ON r.id = t.reporter_id
    LEFT JOIN assigned_tasks a ON a.id = t.task_id`;

/**
 * List tickets. `reporterId` is forced by the route for team members, which is what
 * stops one person reading another's bug reports.
 */
export async function listTickets({
  reporterId, projectId, taskId, status, severity, search, department,
  sort = 'created_desc', limit = 100, offset = 0,
} = {}) {
  const db = await getDb();
  const where = [];
  const params = [];

  if (reporterId) { where.push('t.reporter_id = ?'); params.push(reporterId); }
  // Filters on the reporter's department, which is what confines a manager to
  // the tickets their own people raised.
  if (department) { where.push('r.department = ?'); params.push(department); }
  if (projectId) { where.push('t.project_id = ?'); params.push(projectId); }
  if (taskId) { where.push('t.task_id = ?'); params.push(taskId); }
  if (severity) { where.push('t.severity = ?'); params.push(severity); }
  if (status === 'unresolved') {
    where.push("t.status IN ('open', 'in_progress')");
  } else if (status) {
    where.push('t.status = ?');
    params.push(status);
  }
  if (search) {
    where.push(`(LOWER(t.title) LIKE ? OR LOWER(t.description) LIKE ? OR LOWER(r.name) LIKE ?
                 OR LOWER(p.project_key || '-B' || t.ticket_number) LIKE ?)`);
    const like = `%${search.toLowerCase()}%`;
    params.push(like, like, like, like);
  }

  const orderBy = {
    created_desc: 't.created_at DESC, t.id DESC',
    created_asc: 't.created_at ASC, t.id ASC',
    severity_desc: "CASE t.severity WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END, t.created_at DESC",
    status_asc: "CASE t.status WHEN 'open' THEN 0 WHEN 'in_progress' THEN 1 WHEN 'resolved' THEN 2 ELSE 3 END, t.created_at DESC",
  }[sort] || 't.created_at DESC, t.id DESC';

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const items = await db.query(
    `${SELECT_TICKET} ${whereSql} ORDER BY ${orderBy} LIMIT ? OFFSET ?`,
    [...params, limit, offset],
  );
  const countRow = await db.get(
    `SELECT COUNT(*) AS c
       FROM tickets t
       JOIN projects p ON p.id = t.project_id
       JOIN users r ON r.id = t.reporter_id
       ${whereSql}`,
    params,
  );

  return { items, total: Number(countRow?.c || 0) };
}

export async function getTicketById(id) {
  const db = await getDb();
  return db.get(`${SELECT_TICKET} WHERE t.id = ?`, [id]);
}

/** Next ticket number within a project; see nextTaskNumber for the same pattern. */
async function nextTicketNumber(tx, projectId) {
  const row = await tx.get(
    'SELECT COALESCE(MAX(ticket_number), 0) AS n FROM tickets WHERE project_id = ?',
    [projectId],
  );
  return Number(row?.n || 0) + 1;
}

/**
 * Raise a bug ticket against a task the reporter is actually working on.
 *
 * The task must belong to the reporter and sit in the stated project — both are checked
 * server-side rather than trusted from the form, so a tampered request cannot file a
 * ticket against someone else's work.
 */
export async function createTicket({ reporterId, projectId, taskId, title, description, severity }) {
  const db = await getDb();

  const project = await db.get('SELECT id, project_key, is_archived FROM projects WHERE id = ?', [projectId]);
  if (!project) throw notFound('That project could not be found.');
  if (project.is_archived) throw badRequest('That project is archived, so tickets cannot be raised against it.');

  const task = await db.get(
    'SELECT id, employee_id, project_id, manager_id, title FROM assigned_tasks WHERE id = ?',
    [taskId],
  );
  if (!task) throw notFound('That task could not be found.');
  if (task.employee_id !== reporterId) {
    throw forbidden('You can only raise tickets against tasks assigned to you.');
  }
  if (task.project_id !== project.id) {
    throw badRequest('That task does not belong to the selected project.');
  }

  const ts = nowIso();
  const ticketId = await db.transaction(async (tx) => {
    const ticketNumber = await nextTicketNumber(tx, project.id);
    const id = await tx.insert(
      `INSERT INTO tickets
         (project_id, task_id, reporter_id, ticket_number, title, description, severity,
          status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'open', ?, ?)`,
      [project.id, task.id, reporterId, ticketNumber, title, description, severity, ts, ts],
    );

    const reporter = await tx.get('SELECT name FROM users WHERE id = ?', [reporterId]);
    // The manager who assigned the task is the person who needs to know about it.
    await createNotification({
      userId: task.manager_id,
      title: 'New bug ticket raised',
      message: `${reporter?.name || 'A team member'} raised ${project.project_key}-B${ticketNumber} on "${task.title}": ${title}`,
      type: 'ticket_raised',
      relatedTicketId: id,
    }, tx);

    return id;
  });

  return getTicketById(ticketId);
}

/**
 * Status change. A manager may move any ticket; the reporter may only close or reopen
 * their own — deciding something is *resolved* is the manager's call, not the reporter's.
 */
export async function updateTicketStatus({ ticketId, status, resolutionNote, actor }) {
  const db = await getDb();
  const ticket = await db.get('SELECT * FROM tickets WHERE id = ?', [ticketId]);
  if (!ticket) throw notFound('That ticket no longer exists.');

  if (isTeamMember(actor.role)) {
    if (ticket.reporter_id !== actor.id) {
      throw forbidden('You can only update tickets you raised.');
    }
    if (!['closed', 'open'].includes(status)) {
      throw forbidden('Only your manager can mark a ticket as in progress or resolved.');
    }
  }

  const ts = nowIso();
  const resolvedAt = status === 'resolved' ? (ticket.resolved_at || ts) : null;

  await db.transaction(async (tx) => {
    await tx.run(
      `UPDATE tickets
          SET status = ?, resolved_at = ?, resolution_note = COALESCE(?, resolution_note), updated_at = ?
        WHERE id = ?`,
      [status, resolvedAt, resolutionNote ?? null, ts, ticketId],
    );
    if (ticket.status === status) return;

    const project = await tx.get('SELECT project_key FROM projects WHERE id = ?', [ticket.project_id]);
    const key = `${project?.project_key}-B${ticket.ticket_number}`;

    // Tell the other side. A reporter closing their own ticket informs the manager;
    // a manager moving it informs the reporter.
    if (isTeamMember(actor.role)) {
      const task = await tx.get('SELECT manager_id FROM assigned_tasks WHERE id = ?', [ticket.task_id]);
      if (task?.manager_id) {
        await createNotification({
          userId: task.manager_id,
          title: 'Ticket updated',
          message: `${actor.name} set ${key} to ${STATUS_LABEL[status]}.`,
          type: 'ticket_updated',
          relatedTicketId: ticketId,
        }, tx);
      }
    } else {
      await createNotification({
        userId: ticket.reporter_id,
        title: 'Your ticket was updated',
        message: `${actor.name} set ${key} to ${STATUS_LABEL[status]}.`,
        type: 'ticket_updated',
        relatedTicketId: ticketId,
      }, tx);
    }
  });

  return getTicketById(ticketId);
}

/** The reporter may correct the wording of their own ticket while it is still open. */
export async function updateTicket({ ticketId, actor, patch }) {
  const db = await getDb();
  const ticket = await db.get('SELECT * FROM tickets WHERE id = ?', [ticketId]);
  if (!ticket) throw notFound('That ticket no longer exists.');

  if (isTeamMember(actor.role)) {
    if (ticket.reporter_id !== actor.id) throw forbidden('You can only edit tickets you raised.');
    if (!OPEN_STATUSES.includes(ticket.status)) {
      throw badRequest('This ticket has been resolved or closed, so it can no longer be edited.');
    }
  }

  const columns = { title: patch.title, description: patch.description, severity: patch.severity };
  const sets = [];
  const params = [];
  for (const [col, val] of Object.entries(columns)) {
    if (val !== undefined) { sets.push(`${col} = ?`); params.push(val); }
  }
  if (!sets.length) return getTicketById(ticketId);

  sets.push('updated_at = ?');
  params.push(nowIso(), ticketId);
  await db.run(`UPDATE tickets SET ${sets.join(', ')} WHERE id = ?`, params);
  return getTicketById(ticketId);
}

export async function deleteTicket({ ticketId, actor }) {
  const db = await getDb();
  const ticket = await db.get('SELECT id, reporter_id, status FROM tickets WHERE id = ?', [ticketId]);
  if (!ticket) throw notFound('That ticket no longer exists.');
  if (isTeamMember(actor.role) && ticket.reporter_id !== actor.id) {
    throw forbidden('You can only delete tickets you raised.');
  }
  await db.run('DELETE FROM tickets WHERE id = ?', [ticketId]);
  return true;
}

/** Counts for the dashboards. `reporterId` scopes it to one person. */
export async function ticketCounts({ reporterId, department } = {}) {
  const db = await getDb();
  const where = [];
  const params = [];
  if (reporterId) { where.push('t.reporter_id = ?'); params.push(reporterId); }
  // Same rule as listTickets: a ticket belongs to the department of whoever raised it.
  if (department) { where.push('r.department = ?'); params.push(department); }
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const row = await db.get(
    `SELECT
       COUNT(*) AS total,
       SUM(CASE WHEN t.status = 'open' THEN 1 ELSE 0 END) AS open,
       SUM(CASE WHEN t.status = 'in_progress' THEN 1 ELSE 0 END) AS in_progress,
       SUM(CASE WHEN t.status = 'resolved' THEN 1 ELSE 0 END) AS resolved,
       SUM(CASE WHEN t.status = 'closed' THEN 1 ELSE 0 END) AS closed,
       SUM(CASE WHEN t.status IN ('open', 'in_progress') AND t.severity = 'critical' THEN 1 ELSE 0 END) AS critical_open
     FROM tickets t
     JOIN users r ON r.id = t.reporter_id
     ${clause}`,
    params,
  );
  const n = (v) => Number(v || 0);
  return {
    total: n(row?.total),
    open: n(row?.open),
    in_progress: n(row?.in_progress),
    resolved: n(row?.resolved),
    closed: n(row?.closed),
    critical_open: n(row?.critical_open),
    unresolved: n(row?.open) + n(row?.in_progress),
  };
}
