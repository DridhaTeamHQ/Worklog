-- Internal Employee Task Management & Daily Work Reporting — SQLite schema.
-- Dates are ISO-8601 TEXT ('YYYY-MM-DD' for calendar dates, full ISO for timestamps)
-- to stay byte-identical with the PostgreSQL schema.

CREATE TABLE IF NOT EXISTS users (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  name           TEXT NOT NULL,
  email          TEXT NOT NULL UNIQUE,
  password_hash  TEXT NOT NULL,
  role           TEXT NOT NULL CHECK (role IN ('manager', 'team_member')),
  department     TEXT,
  job_title      TEXT,
  phone          TEXT,
  profile_image  TEXT,
  is_active      INTEGER NOT NULL DEFAULT 1,
  created_at     TEXT NOT NULL,
  updated_at     TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_users_role ON users (role);
CREATE INDEX IF NOT EXISTS idx_users_department ON users (department);

CREATE TABLE IF NOT EXISTS daily_task_reports (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
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
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  name         TEXT NOT NULL,
  project_key  TEXT NOT NULL UNIQUE,
  description  TEXT,
  lead_id      INTEGER REFERENCES users (id) ON DELETE SET NULL,
  is_archived  INTEGER NOT NULL DEFAULT 0,
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_projects_archived ON projects (is_archived, name);

CREATE TABLE IF NOT EXISTS assigned_tasks (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
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

CREATE TABLE IF NOT EXISTS notifications (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id          INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  title            TEXT NOT NULL,
  message          TEXT NOT NULL,
  type             TEXT NOT NULL DEFAULT 'general',
  related_task_id  INTEGER REFERENCES assigned_tasks (id) ON DELETE CASCADE,
  is_read          INTEGER NOT NULL DEFAULT 0,
  created_at       TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications (user_id, is_read, id DESC);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  token_hash  TEXT NOT NULL UNIQUE,
  expires_at  TEXT NOT NULL,
  used_at     TEXT,
  created_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_reset_user ON password_reset_tokens (user_id);
