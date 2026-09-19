-- Internal Employee Task Management & Daily Work Reporting — SQLite schema.
-- Dates are ISO-8601 TEXT ('YYYY-MM-DD' for calendar dates, full ISO for timestamps)
-- to stay byte-identical with the PostgreSQL schema.

CREATE TABLE IF NOT EXISTS users (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
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

CREATE TABLE IF NOT EXISTS tickets (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
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
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id          INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  title            TEXT NOT NULL,
  message          TEXT NOT NULL,
  type             TEXT NOT NULL DEFAULT 'general',
  related_task_id  INTEGER REFERENCES assigned_tasks (id) ON DELETE CASCADE,
  related_ticket_id INTEGER REFERENCES tickets (id) ON DELETE CASCADE,
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

-- Personal to-dos: private notes-to-self about what someone plans to do on a day.
-- Deliberately unrelated to assigned_tasks. Nothing here is assigned by a manager,
-- reaches a daily report, or counts towards any analytic — it is the owner's own
-- list, readable and writable by nobody else.
CREATE TABLE IF NOT EXISTS personal_todos (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  title      TEXT NOT NULL,
  -- The day the note is for, 'YYYY-MM-DD'.
  todo_date  TEXT NOT NULL,
  -- Optional context: which project, and which of the owner's tasks, this note is
  -- about. Both are ON DELETE SET NULL — losing the task must not delete the note,
  -- which is the owner's own writing.
  project_id INTEGER REFERENCES projects (id) ON DELETE SET NULL,
  task_id    INTEGER REFERENCES assigned_tasks (id) ON DELETE SET NULL,
  is_done    INTEGER NOT NULL DEFAULT 0,
  done_at    TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_personal_todos_owner_day ON personal_todos (user_id, todo_date, id);

-- Direct messages between two people.
--
-- One flat table rather than conversations + participants: every thread here is a
-- pair, so the pair *is* the conversation and a second table would only restate the
-- two ids already on the row. A thread is read with a symmetric WHERE over the pair,
-- which is why both directions are indexed.
--
-- Everyone in the company has this: team members, managers and admins alike. The
-- department scoping that confines a manager's task and report views deliberately
-- does not apply — a message is addressed to a person, not filed against a department.
CREATE TABLE IF NOT EXISTS chat_messages (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  sender_id     INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  recipient_id  INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  body          TEXT NOT NULL,
  -- NULL until the recipient opens the thread. Only the recipient ever sets it, so a
  -- sender cannot mark their own message as read on someone else's behalf.
  read_at       TEXT,
  created_at    TEXT NOT NULL
);
-- Reading one thread: both directions of the same pair, oldest first.
CREATE INDEX IF NOT EXISTS idx_chat_pair ON chat_messages (sender_id, recipient_id, id);
CREATE INDEX IF NOT EXISTS idx_chat_pair_reverse ON chat_messages (recipient_id, sender_id, id);
-- The unread badge, which asks only about mail addressed to one person.
CREATE INDEX IF NOT EXISTS idx_chat_unread ON chat_messages (recipient_id, read_at, id DESC);

-- The team channel: one company-wide room everybody reads and writes.
--
-- Deliberately a single room rather than a `channels` table. There is exactly one,
-- every active account is in it, and membership is therefore not a thing that can be
-- stored or changed — which means there is no join table to keep correct and no way
-- for someone to be accidentally left out of it.
CREATE TABLE IF NOT EXISTS team_messages (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  sender_id  INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  body       TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_team_messages_recent ON team_messages (id DESC);

-- Who was tagged in a message.
--
-- Stored rather than re-parsed from the body on every read: the body is free text and
-- a name can be typed that was never meant as a tag. The row is what makes a mention
-- real — it is what the "@" badge counts and what the notification was sent for.
CREATE TABLE IF NOT EXISTS team_message_mentions (
  message_id INTEGER NOT NULL REFERENCES team_messages (id) ON DELETE CASCADE,
  user_id    INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  PRIMARY KEY (message_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_team_mentions_user ON team_message_mentions (user_id, message_id DESC);

-- How far each person has read.
--
-- A high-water mark rather than a read flag per person per message: the channel is
-- read top to bottom, so one integer answers "what is new for me" without writing a
-- row per reader per message.
CREATE TABLE IF NOT EXISTS team_channel_reads (
  user_id      INTEGER PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
  last_read_id INTEGER NOT NULL DEFAULT 0,
  updated_at   TEXT NOT NULL
);

-- Group chats: named rooms an admin creates for a chosen set of people.
--
-- Unlike the single team channel, membership here is real data — the whole point is
-- that a group is *some* people and not others — so it gets a join table and every
-- read and write is gated on a row in it.
CREATE TABLE IF NOT EXISTS chat_groups (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL,
  -- Kept as SET NULL: closing the account of whoever made the group must not take
  -- the group and its history with it.
  created_by INTEGER REFERENCES users (id) ON DELETE SET NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS chat_group_members (
  group_id INTEGER NOT NULL REFERENCES chat_groups (id) ON DELETE CASCADE,
  user_id  INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  added_at TEXT NOT NULL,
  PRIMARY KEY (group_id, user_id)
);
-- "Which groups am I in" — the question every listing starts from.
CREATE INDEX IF NOT EXISTS idx_group_members_user ON chat_group_members (user_id, group_id);

CREATE TABLE IF NOT EXISTS chat_group_messages (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  group_id   INTEGER NOT NULL REFERENCES chat_groups (id) ON DELETE CASCADE,
  sender_id  INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  body       TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_group_messages_room ON chat_group_messages (group_id, id DESC);

-- How far each member has read each group, the same high-water mark the team
-- channel uses — one row per member per group rather than per message.
CREATE TABLE IF NOT EXISTS chat_group_reads (
  group_id     INTEGER NOT NULL REFERENCES chat_groups (id) ON DELETE CASCADE,
  user_id      INTEGER NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  last_read_id INTEGER NOT NULL DEFAULT 0,
  updated_at   TEXT NOT NULL,
  PRIMARY KEY (group_id, user_id)
);
