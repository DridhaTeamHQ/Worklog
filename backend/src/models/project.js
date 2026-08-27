import { getDb } from '../db/index.js';
import { nowIso, today } from '../utils/dates.js';
import { conflict, notFound, badRequest } from '../utils/errors.js';

const SELECT_PROJECT = `
  SELECT p.id, p.name, p.project_key, p.description, p.lead_id, p.is_archived,
         p.created_at, p.updated_at,
         l.name AS lead_name
    FROM projects p
    LEFT JOIN users l ON l.id = p.lead_id`;

const toPublic = (row) => (row ? { ...row, is_archived: Boolean(row.is_archived) } : null);

/** Project keys are the human-facing half of a task key, so they are normalised hard. */
export function normaliseKey(raw) {
  const key = String(raw || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (key.length < 2 || key.length > 10) {
    throw badRequest('A project key must be 2–10 letters or digits, for example SHMOB.');
  }
  if (!/^[A-Z]/.test(key)) {
    throw badRequest('A project key must start with a letter.');
  }
  return key;
}

/**
 * All projects with their task counts. Counts come from one grouped query rather than
 * a per-project round trip, so the switcher stays cheap as projects accumulate.
 */
export async function listProjects({ includeArchived = false } = {}) {
  const db = await getDb();
  const where = includeArchived ? '' : 'WHERE p.is_archived = 0';
  const projects = await db.query(`${SELECT_PROJECT} ${where} ORDER BY p.name ASC`);

  const counts = await db.query(
    `SELECT project_id,
            COUNT(*) AS total,
            SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending,
            SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) AS in_progress,
            SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completed,
            SUM(CASE WHEN status <> 'completed' AND deadline IS NOT NULL AND deadline < ? THEN 1 ELSE 0 END) AS overdue
       FROM assigned_tasks
      WHERE project_id IS NOT NULL
      GROUP BY project_id`,
    [today()],
  );
  const byProject = new Map(counts.map((c) => [Number(c.project_id), {
    total: Number(c.total),
    pending: Number(c.pending),
    in_progress: Number(c.in_progress),
    completed: Number(c.completed),
    overdue: Number(c.overdue),
  }]));

  return projects.map((p) => ({
    ...toPublic(p),
    counts: byProject.get(Number(p.id)) || { total: 0, pending: 0, in_progress: 0, completed: 0, overdue: 0 },
  }));
}

export async function getProject(id) {
  const db = await getDb();
  const row = await db.get(`${SELECT_PROJECT} WHERE p.id = ?`, [id]);
  if (!row) throw notFound('That project could not be found.');
  return toPublic(row);
}

export async function createProject({ name, key, description, leadId }) {
  const db = await getDb();
  const projectKey = normaliseKey(key);

  const existing = await db.get('SELECT id FROM projects WHERE project_key = ?', [projectKey]);
  if (existing) throw conflict(`The project key ${projectKey} is already in use.`);

  const ts = nowIso();
  const id = await db.insert(
    `INSERT INTO projects (name, project_key, description, lead_id, is_archived, created_at, updated_at)
     VALUES (?, ?, ?, ?, 0, ?, ?)`,
    [name, projectKey, description ?? null, leadId ?? null, ts, ts],
  );
  return getProject(id);
}

export async function updateProject(id, patch) {
  const db = await getDb();
  const project = await db.get('SELECT * FROM projects WHERE id = ?', [id]);
  if (!project) throw notFound('That project could not be found.');

  /*
   * The key is editable so a typo can be corrected. That is safe here because a task
   * key is composed at read time from the project key and the task number rather than
   * stored on the task, so renaming the key simply re-renders every key in the project.
   * The task numbers themselves never move. The caller is expected to warn first:
   * anyone holding an old key on paper or in a chat message will find it has changed.
   */
  let projectKey;
  if (patch.key !== undefined) {
    projectKey = normaliseKey(patch.key);
    if (projectKey !== project.project_key) {
      const clash = await db.get(
        'SELECT id FROM projects WHERE project_key = ? AND id <> ?',
        [projectKey, id],
      );
      if (clash) throw conflict(`The project key ${projectKey} is already in use.`);
    }
  }

  const columns = {
    name: patch.name,
    project_key: projectKey,
    description: patch.description,
    lead_id: patch.leadId,
    is_archived: patch.isArchived === undefined ? undefined : (patch.isArchived ? 1 : 0),
  };

  const sets = [];
  const params = [];
  for (const [col, val] of Object.entries(columns)) {
    if (val !== undefined) { sets.push(`${col} = ?`); params.push(val); }
  }
  if (!sets.length) return getProject(id);

  sets.push('updated_at = ?');
  params.push(nowIso(), id);
  await db.run(`UPDATE projects SET ${sets.join(', ')} WHERE id = ?`, params);
  return getProject(id);
}

/**
 * Allocates the next task number within a project. Must run inside the same
 * transaction as the task insert; the UNIQUE (project_id, task_number) index is the
 * backstop that turns a concurrent double-allocation into a loud error rather than
 * two tasks quietly sharing a key.
 */
export async function nextTaskNumber(tx, projectId) {
  const row = await tx.get(
    'SELECT COALESCE(MAX(task_number), 0) AS n FROM assigned_tasks WHERE project_id = ?',
    [projectId],
  );
  return Number(row?.n || 0) + 1;
}
