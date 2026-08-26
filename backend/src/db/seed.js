/**
 * Seeds development/demo data: one manager, three team members, a spread of assigned
 * tasks (including a deliberately overdue one) and a fortnight of daily reports.
 *
 * Idempotent: existing accounts are reused rather than duplicated, and demo tasks and
 * reports are only created the first time an account is seeded.
 *
 * Passwords come from SEED_MANAGER_PASSWORD / SEED_EMPLOYEE_PASSWORD.
 * Usage: node src/db/seed.js
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import config from '../config/env.js';
import { getDb, closeDb } from './index.js';
import { migrate } from './migrate.js';
import { createUser, findByEmail } from '../services/users.js';
import { createProject, listProjects } from '../services/projects.js';
import { assignTask, updateTaskStatus } from '../services/tasks.js';
import { createTicket } from '../services/tickets.js';
import { today, addDays } from '../utils/dates.js';

const MANAGER = {
  name: 'Sanjana Verma',
  email: config.seed.managerEmail,
  role: 'manager',
  department: 'Management',
  jobTitle: 'Engineering Manager',
  phone: '+91 98200 11223',
};

const PROJECTS = [
  { name: 'Shortly – Mobile', key: 'SHMOB', description: 'iOS and Android apps for the Shortly news reader.' },
  { name: 'Shortly – Web', key: 'SHWEB', description: 'Marketing site and the web reader.' },
  { name: 'Internal Platform', key: 'PLAT', description: 'Shared services, tooling and internal dashboards.' },
];

const EMPLOYEES = [
  { name: 'Rahul Kumar', email: 'employee1@company.com', department: 'Development', jobTitle: 'Backend Engineer', phone: '+91 98200 44556' },
  { name: 'Priya Sharma', email: 'employee2@company.com', department: 'Marketing', jobTitle: 'Marketing Executive', phone: '+91 98200 77889' },
  { name: 'Anil Kumar', email: 'employee3@company.com', department: 'Design', jobTitle: 'Product Designer', phone: '+91 98200 33445' },
];

/** [daysFromToday for deadline, ...] — one entry becomes an overdue task on purpose. */
const TASK_TEMPLATES = {
  'employee1@company.com': [
    { project: 'PLAT', title: 'Develop Login API', description: 'Create the authentication API for the employee portal, including JWT issuing and refresh handling.', priority: 'high', start: 0, due: 4, status: 'in_progress', notes: 'Coordinate with the design team on error copy.' },
    { project: 'PLAT', title: 'Customer database integration', description: 'Wire the CRM export into the reporting service and backfill the last quarter of records.', priority: 'medium', start: -3, due: -1, status: 'pending', notes: 'Blocked on VPN access last week.' },
    { project: 'PLAT', title: 'Write API integration tests', description: 'Cover the task and report endpoints with integration tests before the release freeze.', priority: 'low', start: -6, due: 7, status: 'completed' },
  ],
  'employee2@company.com': [
    { project: 'SHWEB', title: 'Q3 campaign brief', description: 'Draft the Q3 product campaign brief and circulate it for review by Friday.', priority: 'urgent', start: 0, due: 2, status: 'pending' },
    { project: 'SHWEB', title: 'Update landing page copy', description: 'Refresh the pricing page copy to match the new positioning.', priority: 'medium', start: -4, due: 3, status: 'in_progress' },
    { project: 'SHWEB', title: 'Client meeting follow-up', description: 'Send the recap and next steps from the Tuesday client meeting.', priority: 'low', start: -5, due: -2, status: 'completed' },
  ],
  'employee3@company.com': [
    { project: 'SHMOB', title: 'Dashboard UI revamp', description: 'Redesign the manager dashboard cards and the status badge system.', priority: 'high', start: -2, due: 5, status: 'in_progress' },
    { project: 'SHMOB', title: 'Icon set for notifications', description: 'Produce a consistent icon set for the notification types.', priority: 'low', start: -1, due: 9, status: 'pending' },
  ],
};

/** Bug tickets raised against a task, keyed by that task's title. */
const TICKET_TEMPLATES = {
  'Develop Login API': [
    {
      title: 'Refresh token rejected after password change',
      description: [
        'Steps: sign in, change the password from Profile, then wait for the access token to expire.',
        'Expected: the refresh call issues a new token.',
        'Actual: it returns 401 and the user is silently signed out.',
      ].join('\n'),
      severity: 'high',
    },
  ],
  'Customer database integration': [
    {
      title: 'CRM export drops rows with non-ASCII names',
      description: 'Roughly 40 of 5,000 rows are skipped on import. All of them have accented characters in the customer name. Looks like an encoding mismatch on the staging table.',
      severity: 'critical',
    },
  ],
  'Dashboard UI revamp': [
    {
      title: 'Status badges overlap on narrow screens',
      description: 'Below about 380px the priority and status badges wrap on top of each other in the task card. Reproduced on an iPhone SE and in the responsive inspector.',
      severity: 'low',
    },
  ],
};

const REPORT_TEMPLATES = {
  'employee1@company.com': [
    'Completed customer database integration\nFixed login authentication issue\nAttended team meeting\nTested API endpoints\nUpdated project documentation',
    'Developed REST API for daily reports\nFixed a token refresh bug\nReviewed two pull requests',
    'Set up the staging database\nPaired with Anil on the dashboard API contract',
    'Investigated slow queries on the reports table\nAdded indexes and re-ran the benchmark',
  ],
  'employee2@company.com': [
    'Drafted the Q3 campaign outline\nReviewed competitor messaging\nAttended the client sync',
    'Updated the pricing page copy\nBriefed the design team on the new banner',
    'Prepared the monthly performance report\nScheduled the newsletter for Thursday',
  ],
  'employee3@company.com': [
    'Worked on frontend dashboard\nAttended client meeting',
    'Built the status badge components\nExported the new icon set',
    'Ran an accessibility pass on the login screen\nFixed contrast issues on the sidebar',
  ],
};

async function ensureUser(spec, password) {
  const existing = await findByEmail(spec.email);
  if (existing) return { user: existing, isNew: false };
  const user = await createUser({ ...spec, password, role: spec.role || 'team_member' });
  return { user, isNew: true };
}

export async function seed() {
  await migrate();
  const db = await getDb();
  const t = today();

  const { user: manager, isNew: managerIsNew } = await ensureUser(MANAGER, config.seed.managerPassword);
  console.log(`[seed] manager ${manager.email} ${managerIsNew ? 'created' : 'already present'}`);

  const existingProjects = await listProjects({ includeArchived: true });
  const projectByKey = new Map(existingProjects.map((p) => [p.project_key, p]));
  for (const spec of PROJECTS) {
    if (projectByKey.has(spec.key)) {
      console.log(`[seed] project ${spec.key} already present`);
      continue;
    }
    const project = await createProject({ ...spec, leadId: manager.id });
    projectByKey.set(project.project_key, project);
    console.log(`[seed] project ${project.project_key} (${project.name}) created`);
  }

  for (const spec of EMPLOYEES) {
    const { user: employee, isNew } = await ensureUser(spec, config.seed.employeePassword);
    console.log(`[seed] team member ${employee.email} ${isNew ? 'created' : 'already present'}`);
    if (!isNew) continue;

    const createdTasks = [];
    for (const tpl of TASK_TEMPLATES[spec.email] || []) {
      const task = await assignTask({
        employeeId: employee.id,
        managerId: manager.id,
        projectId: projectByKey.get(tpl.project).id,
        title: tpl.title,
        description: tpl.description,
        notes: tpl.notes,
        priority: tpl.priority,
        startDate: addDays(t, tpl.start),
        deadline: addDays(t, tpl.due),
      });
      createdTasks.push(task);
      if (tpl.status !== 'pending') {
        await updateTaskStatus({
          taskId: task.id,
          status: tpl.status,
          actor: { id: employee.id, role: 'team_member', name: employee.name },
        });
      }
    }

    // Bug tickets against the tasks just assigned.
    for (const [taskTitle, tickets] of Object.entries(TICKET_TEMPLATES)) {
      const task = createdTasks.find((c) => c.title === taskTitle);
      if (!task) continue;
      for (const spec of tickets) {
        await createTicket({
          reporterId: employee.id,
          projectId: task.project_id,
          taskId: task.id,
          ...spec,
        });
      }
    }

    // Daily reports for the last few working days, newest first in the template list.
    const reports = REPORT_TEMPLATES[spec.email] || [];
    for (let i = 0; i < reports.length; i += 1) {
      const reportDate = addDays(t, -i);
      const ts = `${reportDate}T${String(17 + (i % 2)).padStart(2, '0')}:${String(10 + i * 7).padStart(2, '0')}:00.000Z`;
      await db.insert(
        `INSERT INTO daily_task_reports (employee_id, report_date, task_description, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?)`,
        [employee.id, reportDate, reports[i], ts, ts],
      );
    }
  }

  const counts = await db.get(
    `SELECT
       (SELECT COUNT(*) FROM users) AS users,
       (SELECT COUNT(*) FROM projects) AS projects,
       (SELECT COUNT(*) FROM assigned_tasks) AS tasks,
       (SELECT COUNT(*) FROM daily_task_reports) AS reports,
       (SELECT COUNT(*) FROM tickets) AS tickets,
       (SELECT COUNT(*) FROM notifications) AS notifications`,
  );

  return { counts, manager: manager.email };
}

const isEntry = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isEntry) {
  seed()
    .then(async ({ counts }) => {
      console.log('[seed] done —', counts);
      console.log('');
      console.log('  Sign in with:');
      console.log(`    Manager      ${config.seed.managerEmail} / ${config.seed.managerPassword}`);
      for (const e of EMPLOYEES) console.log(`    Team member  ${e.email} / ${config.seed.employeePassword}`);
      console.log('');
      await closeDb();
    })
    .catch((err) => {
      console.error('[seed] failed:', err);
      process.exit(1);
    });
}
