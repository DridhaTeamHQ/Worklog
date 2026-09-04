/**
 * The scheduled job. Called by Vercel Cron (or `npm run jobs:tick` locally) once an
 * hour; it works out, for every person, what their local hour is and sends whatever
 * reminders are due at that hour:
 *
 *   deadlineHour  team member   "due tomorrow" and "overdue" for each open task
 *                 manager       one digest: how many of their team's tasks are overdue
 *   reportHour    team member   "you have not filed today's report yet"
 *
 * Every reminder goes through `createNotification`, so it appears in the in-app list
 * and is pushed to the phone the same way as everything else. Each is sent once per
 * task per day, which the notifications table itself records — there is no separate
 * bookkeeping to drift out of step.
 */
import config from '../config/env.js';
import { ok } from '../utils/http.js';
import { asyncHandler } from '../utils/errors.js';
import { getDb } from '../db/index.js';
import { DEFAULT_TIMEZONE, todayIn, hourIn, addDays, nowIso } from '../utils/dates.js';
import { MANAGER_ROLES } from '../utils/roles.js';
import { createNotification } from '../models/notification.js';

/** True when a notification of this type about this task went to the user today. */
async function alreadySent(db, { userId, type, taskId = null, day }) {
  const row = await db.get(
    `SELECT 1 AS hit FROM notifications
      WHERE user_id = ? AND type = ? AND substr(created_at, 1, 10) = ?
        AND ${taskId ? 'related_task_id = ?' : 'related_task_id IS NULL'}
      LIMIT 1`,
    taskId ? [userId, type, day, taskId] : [userId, type, day],
  );
  return Boolean(row);
}

const keyOf = (t) => (t.project_key && t.task_number ? `${t.project_key}-${t.task_number}` : null);
const label = (t) => [keyOf(t), t.title].filter(Boolean).join(' ') || 'a task';

export async function runTick({ force = null, now = new Date() } = {}) {
  const db = await getDb();
  const serverDay = nowIso().slice(0, 10);
  const sent = { due_tomorrow: 0, overdue: 0, report_missing: 0, team_overdue_digest: 0 };
  const deadlinesNow = (hour) => force === 'all' || force === 'deadlines' || hour === config.jobs.deadlineHour;
  const reportsNow = (hour) => force === 'all' || force === 'reports' || hour === config.jobs.reportHour;

  const members = await db.query(
    `SELECT id, name, timezone, department FROM users WHERE role = 'team_member' AND is_active = 1`,
  );
  for (const person of members) {
    const zone = person.timezone || DEFAULT_TIMEZONE;
    const hour = hourIn(zone, now);
    const localToday = todayIn(zone, now);

    if (deadlinesNow(hour)) {
      const tasks = await db.query(
        `SELECT t.id, t.title, t.deadline, t.task_number, p.project_key
           FROM assigned_tasks t LEFT JOIN projects p ON p.id = t.project_id
          WHERE t.employee_id = ? AND t.status <> 'completed' AND t.deadline IS NOT NULL AND t.deadline <= ?
          ORDER BY t.deadline ASC`,
        [person.id, addDays(localToday, 1)],
      );
      for (const task of tasks) {
        // Due today was announced yesterday as "due tomorrow"; nothing to add today.
        const type = task.deadline < localToday ? 'overdue' : task.deadline === localToday ? null : 'due_tomorrow';
        if (!type) continue;
        if (await alreadySent(db, { userId: person.id, type, taskId: task.id, day: serverDay })) continue;
        await createNotification({
          userId: person.id,
          title: type === 'overdue' ? 'Task overdue' : 'Due tomorrow',
          message: type === 'overdue'
            ? `${label(task)} was due on ${task.deadline} and is still open.`
            : `${label(task)} is due tomorrow (${task.deadline}).`,
          type,
          relatedTaskId: task.id,
        });
        sent[type] += 1;
      }
    }

    if (reportsNow(hour)) {
      const report = await db.get(
        'SELECT id FROM daily_task_reports WHERE employee_id = ? AND report_date = ?',
        [person.id, localToday],
      );
      if (!report && !(await alreadySent(db, { userId: person.id, type: 'report_missing', day: serverDay }))) {
        await createNotification({
          userId: person.id,
          title: "Today's report is still missing",
          message: `You have not filed your daily report for ${localToday} yet. It only takes a minute.`,
          type: 'report_missing',
        });
        sent.report_missing += 1;
      }
    }
  }

  const roleList = MANAGER_ROLES.map((r) => `'${r}'`).join(', ');
  const managers = await db.query(
    `SELECT id, name, role, timezone, department FROM users WHERE role IN (${roleList}) AND is_active = 1`,
  );
  for (const manager of managers) {
    const zone = manager.timezone || DEFAULT_TIMEZONE;
    const hour = hourIn(zone, now);
    if (!deadlinesNow(hour)) continue;
    if (await alreadySent(db, { userId: manager.id, type: 'team_overdue_digest', day: serverDay })) continue;
    const localToday = todayIn(zone, now);
    // An admin sees the company; a manager their department. A manager with no
    // department recorded sees nothing, matching every other manager view.
    const scoped = manager.role !== 'admin';
    if (scoped && !manager.department) continue;
    const row = await db.get(
      `SELECT COUNT(*) AS c FROM assigned_tasks t JOIN users e ON e.id = t.employee_id
        WHERE t.status <> 'completed' AND t.deadline IS NOT NULL AND t.deadline < ?${scoped ? ' AND e.department = ?' : ''}`,
      scoped ? [localToday, manager.department] : [localToday],
    );
    const overdue = Number(row?.c || 0);
    if (!overdue) continue;
    await createNotification({
      userId: manager.id,
      title: `${overdue} overdue task${overdue === 1 ? '' : 's'} in your team`,
      message: `${overdue} task${overdue === 1 ? ' is' : 's are'} past deadline and still open. Review them in Tasks.`,
      type: 'team_overdue_digest',
    });
    sent.team_overdue_digest += 1;
  }

  return { processed: members.length + managers.length, sent, at: now.toISOString() };
}

/** GET /api/jobs/tick — see runTick. `?force=deadlines|reports|all` skips the hour check outside production. */
export const tick = asyncHandler(async (req, res) => {
  const wanted = String(req.query.force || '');
  const force = !config.isProd && ['deadlines', 'reports', 'all'].includes(wanted) ? wanted : null;
  const result = await runTick({ force });
  return ok(res, result);
});
