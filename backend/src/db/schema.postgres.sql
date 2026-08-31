-- Internal Employee Task Management & Daily Work Reporting — PostgreSQL schema.
-- Dates are ISO-8601 TEXT ('YYYY-MM-DD' for calendar dates, full ISO for timestamps)
-- match the SQLite schema exactly (see schema.sqlite.sql).

CREATE TABLE IF NOT EXISTS users (
  id             SERIAL PRIMARY KEY,
  name           TEXT NOT NULL,
  email          TEXT NOT NULL UNIQUE,
  -- NULL until the person accepts their invite and chooses a password. An account
  -- in that state cannot sign in: every credential check compares against a hash,
  -- and there is none to compare with yet.
  password_hash  TEXT,
  role           TEXT NOT NULL CHECK (role IN ('admin', 'manager', 'team_member')),
  department     TEXT,
  job_title      TEXT,
  phone          TEXT,
  profile_image  TEXT,
  is_active      SMALLINT NOT NULL DEFAULT 1,
  created_at     TEXT NOT NULL,
  updated_at     TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_users_role ON users (role);
CREATE INDEX IF NOT EXISTS idx_users_department ON users (department);

CREATE TABLE IF NOT EXISTS daily_task_reports (
  id                SERIAL PRIMARY KEY,
  employee_id       INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  report_date       TEXT NOT NULL,
  task_description  TEXT NOT NULL,
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL,
  UNIQUE (employee_id, report_date)
);
CREATE INDEX IF NOT EXISTS idx_reports_employee_date ON daily_task_reports (employee_id, report_date DESC);
CREATE INDEX IF NOT EXISTS idx_reports_date ON daily_task_reports (report_date DESC);

CREATE TABLE IF NOT EXISTS projects (
  id           SERIAL PRIMARY KEY,
  name         TEXT NOT NULL,
  project_key  TEXT NOT NULL UNIQUE,
  description  TEXT,
  lead_id      INTEGER REFERENCES users (id) ON DELETE SET NULL,
  is_archived  SMALLINT NOT NULL DEFAULT 0,
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_projects_archived ON projects (is_archived, name);

CREATE TABLE IF NOT EXISTS assigned_tasks (
  id           SERIAL PRIMARY KEY,
  project_id   INTEGER REFERENCES projects (id) ON DELETE CASCADE,
  task_number  INTEGER,
  employee_id  INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  manager_id   INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  description  TEXT NOT NULL,
  notes        TEXT,
  priority     TEXT NOT NULL CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  start_date   TEXT,
  deadline     TEXT,
  status       TEXT NOT NULL DEFAULT 'pending'
               CHECK (status IN ('pending', 'in_progress', 'completed')),
  completed_at TEXT,
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_tasks_employee ON assigned_tasks (employee_id, status);
CREATE INDEX IF NOT EXISTS idx_tasks_manager ON assigned_tasks (manager_id);
CREATE INDEX IF NOT EXISTS idx_tasks_deadline ON assigned_tasks (deadline);
CREATE INDEX IF NOT EXISTS idx_tasks_project ON assigned_tasks (project_id, status);
-- The task key (e.g. SHMOB-5) is project_key + task_number, so the pair must be unique.
CREATE UNIQUE INDEX IF NOT EXISTS idx_tasks_key ON assigned_tasks (project_id, task_number);

CREATE TABLE IF NOT EXISTS tickets (
  id             SERIAL PRIMARY KEY,
  project_id     INTEGER NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
  -- The task the person was working on when they hit the bug. Kept as SET NULL so a
  -- deleted task does not take the bug report down with it.
  task_id        INTEGER REFERENCES assigned_tasks (id) ON DELETE SET NULL,
  reporter_id    INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  ticket_number  INTEGER NOT NULL,
  title          TEXT NOT NULL,
  description    TEXT NOT NULL,
  severity       TEXT NOT NULL DEFAULT 'medium'
                 CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  status         TEXT NOT NULL DEFAULT 'open'
                 CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  resolution_note TEXT,
  resolved_at    TEXT,
  created_at     TEXT NOT NULL,
  updated_at     TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_tickets_project ON tickets (project_id, status);
CREATE INDEX IF NOT EXISTS idx_tickets_reporter ON tickets (reporter_id, status);
CREATE INDEX IF NOT EXISTS idx_tickets_task ON tickets (task_id);
-- The ticket key (e.g. SHMOB-B3) is project_key + ticket_number, so the pair is unique.
CREATE UNIQUE INDEX IF NOT EXISTS idx_tickets_key ON tickets (project_id, ticket_number);

CREATE TABLE IF NOT EXISTS notifications (
  id               SERIAL PRIMARY KEY,
  user_id          INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  title            TEXT NOT NULL,
  message          TEXT NOT NULL,
  type             TEXT NOT NULL DEFAULT 'general',
  related_task_id  INTEGER REFERENCES assigned_tasks (id) ON DELETE CASCADE,
  related_ticket_id INTEGER REFERENCES tickets (id) ON DELETE CASCADE,
  is_read          SMALLINT NOT NULL DEFAULT 0,
  created_at       TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications (user_id, is_read, id DESC);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id          SERIAL PRIMARY KEY,
  user_id     INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  token_hash  TEXT NOT NULL UNIQUE,
  expires_at  TEXT NOT NULL,
  used_at     TEXT,
  created_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_reset_user ON password_reset_tokens (user_id);

-- Personal to-dos: private notes-to-self about what someone plans to do on a day.
-- Deliberately unrelated to assigned_tasks. Nothing here is assigned by a manager,
-- reaches a daily report, or counts towards any analytic — it is the owner's own
-- list, readable and writable by nobody else.
CREATE TABLE IF NOT EXISTS personal_todos (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  title      TEXT NOT NULL,
  -- The day the note is for, 'YYYY-MM-DD'.
  todo_date  TEXT NOT NULL,
  -- Optional context: which project, and which of the owner's tasks, this note is
  -- about. Both are ON DELETE SET NULL — losing the task must not delete the note,
  -- which is the owner's own writing.
  project_id INTEGER REFERENCES projects (id) ON DELETE SET NULL,
  task_id    INTEGER REFERENCES assigned_tasks (id) ON DELETE SET NULL,
  is_done    SMALLINT NOT NULL DEFAULT 0,
  done_at    TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_personal_todos_owner_day ON personal_todos (user_id, todo_date, id);
