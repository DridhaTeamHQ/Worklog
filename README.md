# Dridha Worklog

Internal employee task management and daily work reporting app.

Two portals behind one login. **Team members** log what they completed each day and work
through the tasks assigned to them. **Managers** assign work, watch progress across the
team, and read every daily report.

---

## Quick start

```bash
npm run setup
```

That installs both workspaces, creates the schema and seeds demo data. Then:

```bash
npm run dev
```

- Web app → http://localhost:5173
- API → http://localhost:4000/api

### Sign in

The app ships with **no accounts and no sample content**. Everything you see comes from
the database, and everything in the database is put there through the app.

On an empty database, create the first admin — the one account that cannot be made
through the UI — by setting these in `backend/.env`:

```
SEED_ADMIN_EMAIL=you@yourcompany.com
SEED_ADMIN_PASSWORD=a-strong-password
SEED_ADMIN_NAME=Your Name
```

then run:

```bash
npm run db:seed
```

That creates one admin and nothing else. Sign in as that admin and add your projects,
managers and team members from the app. Re-running the seed is safe: it does nothing
once an admin exists. Change the password from **Profile** after your first sign-in.

---

## The database

The app targets **PostgreSQL**. It also ships with an embedded **SQLite** fallback so it
runs with no database server installed, which is the default when `DATABASE_URL` is
empty.

Both drivers sit behind one adapter (`backend/src/db/index.js`). Every query is written
once with `?` placeholders and portable column types — calendar dates as `YYYY-MM-DD`
text, timestamps as ISO-8601 text, booleans as `0`/`1` — so the same SQL runs unchanged on
either. There are two schema files that differ only in `SERIAL` vs `AUTOINCREMENT` and
`SMALLINT` vs `INTEGER`.

### Upgrading an existing database

`npm run db:migrate` is idempotent and safe to re-run. On a database created before
projects existed it adds the two new columns to `assigned_tasks`, creates a `GEN`
project, and moves every existing task into it so nothing is left without a key.

### Running on PostgreSQL

Set the connection string in `backend/.env` and re-run the migration:

```bash
DATABASE_URL=postgresql://worklog:secret@localhost:5432/worklog
```

```bash
npm run db:reset
```

The driver switches automatically when `DATABASE_URL` is present.

> **Note:** no PostgreSQL server was available in the environment this was built in, so
> the PostgreSQL path is written and wired but has not been executed against a live
> server. Everything documented below was verified end to end on SQLite. Expect the
> PostgreSQL run to need nothing more than the connection string, but do run
> `npm run db:reset && npm test` against it once before relying on it.

### Schema

| Table | Purpose |
| --- | --- |
| `users` | Accounts. `role` is `manager` or `team_member`. Holds `password_hash`, never a password. |
| `projects` | Work areas, each with a unique key (e.g. `SHMOB`). Tasks belong to one project. |
| `daily_task_reports` | One row per employee per day — `UNIQUE (employee_id, report_date)` is what makes "Save" and "Update" the same action. |
| `assigned_tasks` | Tasks, linked to a project plus the employee and the manager who assigned them. `UNIQUE (project_id, task_number)` guarantees one task per key. |
| `tickets` | Bug reports raised by a team member against a task they are working on. Keyed per project as `SHMOB-B1`. |
| `notifications` | Per-user feed, optionally linked to the task or ticket that caused it. |
| `password_reset_tokens` | Single-use, 30-minute reset tokens, stored as SHA-256 hashes. |

Foreign keys cascade on delete, so removing a user takes their reports, tasks and
notifications with them.

**Task keys are issued per project.** A task's key is its project key plus a number that counts up within that project — `SHMOB-1`, `SHMOB-2`, `PLAT-1`. The number is allocated inside the same transaction that inserts the task, and a unique index on `(project_id, task_number)` turns any concurrent double-allocation into a loud error rather than two tasks quietly sharing a key.

The key is **composed at read time** rather than stored on each task, which is what makes a project key editable: renaming `SHMOB` to `SHM` re-renders every key in that project (`SHMOB-4` becomes `SHM-4`) while the task numbers stay exactly where they were. The edit dialog warns before doing it, since anyone holding the old key in a note or a chat message will find it out of date.

**Overdue is derived, not stored.** A task is overdue when its deadline has passed and it
is not complete — computed at read time, so it is correct the moment a deadline passes
with no scheduled job to run and nothing to go stale.

---

## Layout

```
task management/
├── backend/
│   ├── scripts/test-flow.js      end-to-end workflow + authorization test
│   └── src/
│       ├── config/env.js         configuration and secrets
│       ├── db/                   adapter, schemas, migrate, seed
│       ├── middleware/           auth, validation, error handling
│       ├── routes/               HTTP layer
│       ├── services/             business logic
│       └── utils/                dates, errors, response helpers
└── frontend/
    └── src/
        ├── api/                  fetch client + typed endpoints
        ├── components/           layout, guards, shared UI
        ├── context/              auth and notification state
        ├── lib/                  formatting helpers
        ├── pages/                auth · employee · manager
        └── types/                shared API types
```

**Stack:** React 18 + TypeScript + Vite + Tailwind CSS v4 + Recharts on the front;
Node + Express + JWT + bcrypt + Zod on the back.

Routes are thin: they validate input and check the role, then hand off to a service. All
data access lives in services, so authorization rules are stated once each.

---

## What each portal does

### Team member

- **Dashboard** — two large cards (Tasks Done, Tasks Assigned) plus status counts, and a
  prompt when today's report is still missing.
- **Tasks Done** — today's date and name, one large text box, Save/Update. Saving again on
  the same day edits in place. Previous reports are listed below by date and searchable.
- **Tasks Assigned** — a dense table of every assigned task: key, summary, reporter,
  priority, status, resolution, created and updated. Rows expand for the description,
  notes and deadline. Status is changed inline; the manager is notified. Project tabs
  appear when the employee has work in more than one project, counted against their own
  tasks rather than the project totals.
- **Tickets** — raise a bug hit while working: pick the project, then the task (the list
  narrows to that project, and only their own tasks are ever offered), then describe what
  went wrong and set a severity. Their own tickets are listed with status and history.
- **Notifications** — unread count, mark one or all read, timestamps. Clicking one jumps
  straight to the task or ticket it refers to.
- **Profile** — personal details and password change.

### Manager

- **Dashboard** — team size, assigned/completed today, pending, in progress, overdue,
  report submission progress, a 14-day activity chart, and recent activity.
- **Team Members** — every employee with department, current status, pending and completed
  counts, and whether today's report is in. Searchable and filterable by department.
  **Add team member** creates an account: name, work email, department, job title, phone,
  and a temporary password (generated by default, or type your own). The new joiner is
  emailed their sign-in details, and the credentials are shown once afterwards with a copy
  button — the dialog says plainly whether the email actually went out.
- **Admins** — a second tab on the same page listing everyone with manager access, with how
  many tasks each has assigned. **Add admin** creates another manager account the same way,
  and they land on the Manager Dashboard when they sign in.
- **Employee detail** — profile and counts, then two cards: **Tasks Done** (their reports,
  newest first, filtered by today/week/month/custom range and searchable) and
  **Assign Task**.
- **All Assigned Tasks** — company-wide table with project tabs across the top, filtered by
  employee, status (including overdue), priority, assigned date range and deadline. Rows
  can be selected for bulk status changes, edited in place (pencil) or deleted, and the
  search box matches task keys, so pasting `SHMOB-5` jumps straight to it. **Assign Task**
  from here lets you pick the assignee; opened from an employee's page it is fixed to
  them. Projects are created and edited from here too.
- **Task Reports** — every report company-wide, grouped by day, filtered by employee,
  department and date range.
- **Tickets** — every bug the team has reported, defaulting to the ones that still need
  attention. Filter by project, reporter and severity; move a ticket through its statuses,
  and record a resolution note when closing one out.
- **Analytics** — per-employee productivity, status breakdown, and daily/weekly activity,
  all filterable by employee, department and date range.

---

## Security

- **Passwords** are bcrypt hashed and never leave the database — no endpoint returns
  `password_hash`.
- **JWTs** are signed with `JWT_SECRET` (required to be ≥32 characters in production) and
  sent as a bearer token and an httpOnly cookie. Every request re-loads the user, so a
  deactivated account stops working immediately rather than at token expiry.
- **Role authorization** is enforced on the server for every route. The React guards are
  convenience only — typing the other portal's URL redirects, and the API refuses it
  independently.
- **Scope enforcement**: a team member's `employeeId` is forced to their own id on the
  server, so query-string tampering cannot widen what they see. Reading a colleague's
  task, changing its status, or marking someone else's notification read are all refused.
- **SQL injection**: every value is bound as a parameter; no user input is interpolated
  into SQL.
- **XSS**: React escapes all rendered content and the app never uses
  `dangerouslySetInnerHTML`; the API sets a strict CSP via Helmet and stores text without
  interpreting it.
- **Input validation**: Zod schemas validate and *replace* each request part, so handlers
  can only read values that passed — unknown fields are dropped, which is why a team
  member cannot promote themselves by adding `role` to a profile update.
- **Rate limiting** on sign-in and password reset, plus a global API limit.
- **Account enumeration** is blocked: wrong-password and no-such-user return the same
  message, and forgot-password always answers identically.
- **Errors** never leak internals — 5xx responses return a generic message and log the
  detail server-side.

---

## Email

Two messages go out:

- **Welcome** — when a manager adds a team member, that person is emailed their sign-in
  link, email address and temporary password.
- **Password reset** — a single-use link valid for 30 minutes. The link opens the reset
  page with the code already filled in.

Configure SMTP in `backend/.env`:

```bash
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=you@company.com
SMTP_PASS=your-app-password
MAIL_FROM=Dridha Worklog <no-reply@company.com>
APP_URL=https://worklog.company.com
```

`APP_URL` is what the links in the emails point at, so it must be the address people can
actually reach — not `localhost` in production.

### Checking it works

```bash
npm run mail:test
```

Prints the current settings and verifies the connection and login. Add an address to
send a real message:

```bash
npm run mail:test -- you@example.com
```

It explains the actual failure — wrong password, unreachable host, bad port/TLS pairing,
DNS typo — rather than a generic error. Add `MAIL_DEBUG=true` for the full SMTP
conversation.

**Gmail and Google Workspace need an App Password**, not your normal account password:
turn on 2-Step Verification, then create one at <https://myaccount.google.com/apppasswords>
and use the 16-character value as `SMTP_PASS`.

**With no `SMTP_HOST` set, the app runs in log mode**: messages are printed to the server
log in full instead of being sent, and the server prints a warning at startup saying so.
Nothing fails and nothing is silently swallowed, so a local run needs no mail server. The password-reset endpoint additionally returns the token
in the response outside production, so that flow is completable too.

Sending is **best-effort and never blocks the work that triggered it**. If the mail server
is unreachable, the account is still created, the API reports `email.delivered: false`, and
the manager still sees the temporary password on screen with a warning that they need to
pass it on themselves. Mail connections are given short timeouts so a dead server cannot
hang the request.

> Emailing a temporary password in plain text is what was asked for here and is common for
> internal tools. If you later want to avoid it, the change is small: send a set-password
> link (the same mechanism as the reset flow) instead of the password itself.

---

## Testing

```bash
npm test
```

Runs `backend/scripts/test-flow.js` against the live API — 207 assertions covering the full
workflow from the brief (manager assigns → employee is notified → views the task → updates
status → submits a report → manager sees both), plus adding a team member and signing in as
them, project creation and key allocation, project filtering on both portals, the
authorization boundaries, validation rules, derived overdue behaviour, analytics filters,
the password reset cycle, the onboarding email, the bug-ticket rules, and the editing rules
— including that renaming a project key re-renders existing task keys without moving their
numbers, and that deleting a task keeps the bug reports raised against it. It cleans up the tasks it creates.

The API must be running. Type checking:

```bash
npm run typecheck
```

---

## Configuration

Copy `backend/.env.example` to `backend/.env`. The values that matter:

| Variable | Default | Notes |
| --- | --- | --- |
| `PORT` | `4000` | API port |
| `CORS_ORIGIN` | `http://localhost:5173` | Comma-separated allow-list |
| `DATABASE_URL` | *(empty)* | Set to use PostgreSQL; empty means SQLite |
| `JWT_SECRET` | *(dev fallback)* | **Required in production**, ≥32 chars |
| `JWT_EXPIRES_IN` | `8h` | Session length |
| `BCRYPT_ROUNDS` | `10` | Raise for production |
| `COOKIE_SECURE` | `false` | Set `true` behind HTTPS |
| `SMTP_HOST` | *(empty)* | Set to enable real email; empty means log mode |
| `SMTP_PORT` | `587` | `465` implies TLS |
| `SMTP_USER` / `SMTP_PASS` | *(empty)* | Omit for an unauthenticated relay |
| `MAIL_FROM` | `Dridha Worklog <no-reply@company.com>` | Envelope sender |
| `APP_URL` | `http://localhost:5173` | Base for links inside emails |

Generate a secret with:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

---

## Deploying

1. Set `NODE_ENV=production`, a real `JWT_SECRET`, `DATABASE_URL`, `COOKIE_SECURE=true`,
   `CORS_ORIGIN` to your web origin, and the `SMTP_*` / `APP_URL` values so onboarding and
   password-reset emails actually reach people.
2. `npm run db:migrate`.
3. `npm run db:seed` once, with `SEED_ADMIN_*` set, to create the first admin. There is
   no default account, so nothing well-known is ever live.
4. `npm run build` and serve `frontend/dist` from your web server or CDN.
5. `npm start` to run the API behind your reverse proxy.

---

## API

All routes are under `/api`. Everything except health and the auth endpoints requires a
bearer token. Responses are `{ success, data, meta? }` or `{ success: false, error }`.

| Method | Route | Role | Purpose |
| --- | --- | --- | --- |
| `POST` | `/auth/login` | — | Sign in |
| `POST` | `/auth/logout` | any | Clear the session cookie |
| `GET` | `/auth/me` | any | Current user |
| `POST` | `/auth/forgot-password` | — | Request a reset token |
| `POST` | `/auth/reset-password` | — | Complete a reset |
| `POST` | `/auth/change-password` | any | Change own password |
| `GET`/`PATCH` | `/profile` | any | Read/update own profile |
| `GET` | `/dashboard` | any | Role-specific dashboard payload |
| `GET` | `/dashboard/analytics` | manager | Productivity and activity |
| `GET` | `/tasks` | any | List tasks, filterable by `projectId` (scoped to self for employees) |
| `GET` | `/tasks/:id` | any | One task |
| `POST` | `/tasks` | manager | Assign a task + notify |
| `PATCH` | `/tasks/:id` | manager | Correct a task's wording, priority or dates |
| `PATCH` | `/tasks/:id/status` | any | Update status |
| `DELETE` | `/tasks/:id` | manager | Delete a task |
| `GET` | `/reports` | any | List reports (scoped to self for employees) |
| `GET` | `/reports/today` | team member | Today's own report |
| `POST` | `/reports` | team member | Save or update today's report |
| `DELETE` | `/reports/:id` | team member | Delete own report |
| `GET` | `/notifications` | any | Own notifications |
| `GET` | `/notifications/unread-count` | any | Badge count |
| `PATCH` | `/notifications/:id/read` | any | Mark one read |
| `PATCH` | `/notifications/read-all` | any | Mark all read |
| `GET` | `/projects` | any | Projects with task counts |
| `GET` | `/projects/:id` | any | One project |
| `POST` | `/projects` | manager | Create a project |
| `PATCH` | `/projects/:id` | manager | Rename, re-key, re-describe or archive a project |
| `GET` | `/tickets` | any | List tickets (scoped to self for employees) |
| `GET` | `/tickets/:id` | any | One ticket |
| `POST` | `/tickets` | team member | Raise a bug ticket against one of their tasks |
| `PATCH` | `/tickets/:id` | any | Correct the wording of an open ticket |
| `PATCH` | `/tickets/:id/status` | any | Move a ticket's status |
| `DELETE` | `/tickets/:id` | any | Delete a ticket |
| `GET` | `/team` | manager | Team list with counts |
| `POST` | `/team` | manager | Add a team member |
| `GET` | `/admins` | manager | List everyone with manager access |
| `POST` | `/admins` | manager | Grant manager access to a new person |
| `GET` | `/team/departments` | manager | Departments for filters |
| `GET` | `/team/:id` | manager | Employee detail |
| `GET` | `/team/:id/reports` | manager | That employee's reports |
| `GET` | `/team/:id/tasks` | manager | That employee's tasks |

---

## Notes on a few decisions

**Notifications poll rather than use websockets.** The bell checks a deliberately tiny
unread-count endpoint every 20 seconds and only refetches the list when the number
actually moves. It pauses while the tab is hidden and catches up on focus. That keeps the
deployment to a single HTTP service; if you later want instant delivery, the notification
service is the one place to add a socket push.

**New accounts are emailed a temporary password.** The manager sets it (or generates one),
and the new joiner is emailed their sign-in details; they change it from their profile, or
reset it themselves via Forgot password. The password is still shown to the manager because
email is not guaranteed — see the Email section for what happens when it fails.

**Adding a member cannot create a manager.** `POST /api/team` fixes the role to
`team_member` rather than reading it from the request, so the endpoint cannot be used to
escalate. Manager accounts are created by the seed or directly in the database.

**Manager access is a single tier, and it is transitive.** Anyone with manager access can
grant it to someone else — there is no separate owner or super-admin above it. That is a
deliberate choice for a small internal team, but it does mean adding an admin hands over
the same power you have, including the power to add more. If you later want a tier that
cannot do this, the place to add it is `POST /api/admins`.

Granting access lives on its own endpoint rather than as a `role` field on `POST /api/team`.
That keeps the everyday "add a colleague" path structurally incapable of escalation: it
hard-codes `team_member` and ignores any role sent to it.

**A ticket is a report from the person doing the work.** Only a team member can raise one,
and only against a task assigned to them — both checked server-side, not just in the form.
The reporter can close or reopen their own ticket but cannot mark it *Resolved*: deciding
the bug is actually fixed is the manager's call. Deleting a task leaves its tickets intact
and simply detaches them, because the bug report is usually the more durable record.

**Editing is deliberately narrow.** A project's name, key and description can all be
corrected, and a task's title, description, notes, priority and dates can too — those are
the things people actually get wrong. What cannot be edited is a task's *assignee* or
*project*: moving a task between people or projects would invalidate its key and quietly
rewrite who was accountable, so the honest move is to close it and assign a new one.
Archiving a project keeps its tasks readable while blocking new ones.

**Reports can only be written for today.** Back-dating would let someone quietly rewrite
history, and the manager relies on these being a same-day record. Editing today's entry is
unrestricted.

**Overdue is computed, not stored** — see the schema section above.
