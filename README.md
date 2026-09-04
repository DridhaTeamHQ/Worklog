# Taskr

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
| `users` | Accounts. `role` is `admin`, `manager` or `team_member`. Holds `password_hash`, never a password — and that hash is NULL until the person accepts their invite and chooses one. |
| `projects` | Work areas, each with a unique key (e.g. `SHMOB`). Tasks belong to one project. |
| `daily_task_reports` | One row per employee per day — `UNIQUE (employee_id, report_date)` is what makes "Save" and "Update" the same action. |
| `assigned_tasks` | Tasks, linked to a project plus the employee and the manager who assigned them. `UNIQUE (project_id, task_number)` guarantees one task per key. |
| `tickets` | Bug reports raised by a team member against a task they are working on. Keyed per project as `SHMOB-B1`. |
| `notifications` | Per-user feed, optionally linked to the task, ticket or person it is about. |
| `password_reset_tokens` | Single-use, 30-minute reset tokens, stored as SHA-256 hashes. |
| `personal_todos` | Private notes-to-self per day. Nobody else can read them. |
| `activity` | The thread on a task or ticket: comments, plus the changes the system recorded (status moves, edits, checklist ticks, linked reports). |
| `report_items` | The lines of a daily report, each optionally tied to one of the writer's tasks with the minutes spent. |
| `task_checklist_items` | Sub-steps of a task; the done/total counts ride along on every task row. |
| `labels` / `task_labels` | Company-wide colour tags and which tasks carry them. |
| `device_tokens` | Phones registered for push notifications (one row per Expo push token). |

Foreign keys cascade on delete, so removing a user takes their reports, tasks,
notifications, comments, devices and checklist items with them.

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
├── frontend/
│   └── src/
│       ├── api/                  fetch client + typed endpoints
│       ├── components/           layout, guards, shared UI
│       ├── context/              auth and notification state
│       ├── lib/                  formatting helpers
│       ├── pages/                auth · employee · manager
│       └── types/                shared API types
└── mobile/                       the Expo app — see mobile/README.md
    └── src/
        ├── app/                  expo-router routes: (auth), (app)/(member), (app)/(manager), shared stacks
        ├── api/ hooks/ auth/     the same endpoints, wrapped in TanStack Query
        ├── components/ features/ the bento/glass design system and the task, ticket, report widgets
        ├── push/                 Expo push registration, tap routing, badge sync
        └── theme/                tokens and the light / dark theme
```

## The mobile app

`mobile/` is an Expo app (SDK 57) for iOS and Android that talks to the same API and
database as the web app. Team members get Home, Tasks, Report, Tickets and More; managers
and admins get Home, Tasks, Team, Tickets and More — plus task and ticket detail screens
with the activity thread, checklist and comments, structured daily reports, projects,
labels, the team's reports, analytics, My Day and the profile. Adding and removing
accounts stays on the web.

```bash
PORT=4000 npm run dev:backend      # the API, in one terminal
npm run dev:mobile                 # Metro, in another — scan the QR code with Expo Go
```

The app derives the API address from the machine Metro runs on, so a phone on the same
Wi-Fi reaches a local backend with no configuration; set `EXPO_PUBLIC_API_URL` for
anything else. Push notifications need an EAS project and a development build; the
[mobile README](mobile/README.md) walks through it.

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
- **Team Members** — every employee with their current status, pending and completed
  counts, and whether today's report is in. Each person's department sits under their
  name rather than in a column of its own. Searchable; an admin can also filter by
  department, which a manager is not offered because they only ever span one.

  **An admin sees the whole company and a manager sees only their own department.**
  Creating and removing accounts is admin-only, so a manager gets neither the delete
  action nor the add button, and the Admins tab is not rendered for them at all.

  **Add team member** (admin only) creates an account from four required details — name, work email,
  department and job title — plus an optional phone number. No password is set: the
  account is created without one and the new joiner chooses their own (see
  **Invitations** below). They are emailed a link to do it, and the dialog says plainly
  whether that email actually went out, since if it did not the manager is the one who
  has to tell them.
- **Admins** — a second tab on the same page listing everyone with manager access, with how
  many tasks each has assigned. **Add admin** creates another manager account the same way,
  and they land on the Admin Dashboard when they sign in.
- **Employee detail** — profile and counts, then two cards: **Tasks Done** (their reports,
  newest first, filtered by today/week/month/custom range and searchable) and
  **Assign Task**.
- **All Assigned Tasks** — company-wide table with project tabs across the top, filtered by
  employee, status (including overdue), priority, assigned date range and deadline. Rows
  can be selected for bulk status changes or bulk deletion, edited in place (pencil) or
  deleted one at a time, and the
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
  `password_hash`. A password is only ever set by the person it belongs to: no manager
  sets one, and none is generated, emailed or displayed anywhere.
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
- **Account enumeration** is blocked on password reset, which always answers
  identically. Sign-in is a **deliberate exception**: an address nobody has added and an
  account whose access has been blocked are each named, because both are dead ends that
  no amount of retyping fixes and the person needs to know to go and ask an admin. A
  wrong password on a live account is still answered generically. The trade is accepted
  because this is an internal portal whose roster is not secret to the people using it.
  `POST /api/auth/invite-status` makes the same trade for the same reason — it is what
  puts the "Invited" button on the sign-in page, and it necessarily confirms that a given
  address is an account somebody added and nobody has claimed.
- **Errors** never leak internals — 5xx responses return a generic message and log the
  detail server-side.

---

## Invitations

Nobody but the account's owner ever sets its password.

A manager adds someone with four required details — **name, work email, department and
job title** — and an optional phone number. That creates the account with a NULL
`password_hash`. There is no password to email, to show on screen, or to write down.

The new joiner opens the sign-in page and types their work email. If that address is an
account somebody added and nobody has claimed, an **Invited** button appears; it leads to
a page where they choose a password, and setting it signs them straight in. From then on
they sign in normally, and the button never appears for that address again.

Until it is claimed, the account:

- **cannot sign in** — the credential check has no hash to compare against, so it is
  refused exactly like an unknown address
- **shows as `Invited`** on the manager's Team Members and Admins lists, so it is obvious
  who has not been in yet

Managers and admins added through **Add admin** are invited the same way. Department and
job title are optional for them, because unlike an employee they do not appear in the
rosters that filter and group by those fields.

### The tradeoff, stated plainly

The "Invited" button only works if the server will tell an anonymous caller whether a
given address is a pending invite, and `POST /api/auth/invite-status` does exactly that.
Two things follow, and neither is hidden:

1. **It confirms that an address exists** while an invite is outstanding — a deliberate
   departure from the enumeration-blocking that sign-in and password-reset keep. It is
   rate limited (20 requests per 15 minutes in production) so sweeping a company address
   list is impractical, and it answers `false` identically for an unknown address, a
   claimed account and a deactivated one, so only the pending-invite state is ever
   distinguishable.

2. **Anyone who knows the address can claim the invite**, because knowing it is the only
   thing `POST /api/auth/accept-invite` requires. Between the moment a manager adds
   someone and the moment that person sets their password, a third party who guesses or
   learns the address could set it first. The window closes permanently on the first
   claim — the invite cannot be claimed twice — but it is real while it is open.

This is a considered choice for an internal tool on a trusted network, where the
alternative costs the thing that makes the flow pleasant: no email to find, no code to
paste. **If you want it closed**, the change is small and the machinery already exists —
issue a single-use token at invite time (`password_reset_tokens` and the reset flow are
exactly this), email the link, and require the token in `accept-invite`. The "Invited"
button would then verify a token from the URL rather than an address typed into a box.

## Email

Two messages go out:

- **Invitation** — when a manager adds someone, that person is emailed a link to the
  sign-in page and told to claim their account there. It carries no password, because
  none exists yet.
- **Password reset** — a single-use link valid for 30 minutes. The link opens the reset
  page with the code already filled in.

Configure SMTP in `backend/.env`:

```bash
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=you@company.com
SMTP_PASS=your-app-password
MAIL_FROM=Taskr <no-reply@company.com>
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
the manager still sees a warning on screen that they need to tell the person their
account is waiting. Mail connections are given short timeouts so a dead server cannot
hang the request.

> Earlier versions emailed a manager-set temporary password in plain text. That is gone:
> no password is generated, transmitted or displayed at any point, so there is nothing in
> an inbox to leak and nothing for a manager to know.

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

The API must be running, and the suite needs an admin plus two team members to drive.
On a fresh local database, `npm run test:setup` creates them (and three projects) from the
seeded admin and prints the `TEST_*` variables to run the suite with. `npm run jobs:tick --
--force` exercises the reminder job by hand. Type checking:

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
| `JWT_EXPIRES_IN` | `8h` | Web session length |
| `JWT_MOBILE_EXPIRES_IN` | `30d` | Session length for the mobile app (`X-Client: mobile`) |
| `APP_TIMEZONE` | *(server zone)* | What "today" means when neither the client nor the profile says |
| `PUSH_ENABLED` | `true` | `false` prints pushes to the log instead of calling Expo |
| `EXPO_ACCESS_TOKEN` | *(empty)* | Optional; raises Expo's push rate limits |
| `CRON_SECRET` | *(empty)* | Guards `GET /api/jobs/tick`; Vercel Cron sends it automatically |
| `BCRYPT_ROUNDS` | `10` | Raise for production |
| `COOKIE_SECURE` | `false` | Set `true` behind HTTPS |
| `SMTP_HOST` | *(empty)* | Set to enable real email; empty means log mode |
| `SMTP_PORT` | `587` | `465` implies TLS |
| `SMTP_USER` / `SMTP_PASS` | *(empty)* | Omit for an unauthenticated relay |
| `MAIL_FROM` | `Taskr <no-reply@company.com>` | Envelope sender |
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
| `POST` | `/auth/invite-status` | — | Whether an address is an unclaimed invite |
| `POST` | `/auth/accept-invite` | — | Claim an invite by setting its password |
| `POST` | `/auth/forgot-password` | — | Request a reset token |
| `POST` | `/auth/reset-password` | — | Complete a reset |
| `POST` | `/auth/change-password` | any | Change own password (signs out every other session) |
| `POST` | `/auth/logout-all` | any | Sign out everywhere — revokes every outstanding token |
| `GET`/`PATCH` | `/profile` | any | Read/update own profile, including `timezone` |
| `GET` | `/dashboard` | any | Role-specific dashboard payload |
| `GET` | `/dashboard/analytics` | manager | Productivity and activity |
| `GET` | `/tasks` | any | List tasks, filterable by `projectId` (scoped to self for employees) |
| `GET` | `/tasks/:id` | any | One task |
| `POST` | `/tasks` | manager | Assign a task + notify |
| `PATCH` | `/tasks/:id` | manager | Correct a task's wording, priority or dates |
| `PATCH` | `/tasks/:id/status` | any | Update status |
| `DELETE` | `/tasks/:id` | manager | Delete a task |
| `GET` | `/tasks/:id/activity` | any | The task's thread: comments and recorded changes |
| `POST` | `/tasks/:id/comments` | any | Comment, with optional `mentions` (user ids) |
| `PATCH`/`DELETE` | `/tasks/:id/comments/:commentId` | author (delete: or admin) | Edit or remove a comment |
| `GET`/`POST` | `/tasks/:id/checklist` | assignee, owning manager, admin | Read / add checklist items |
| `PATCH`/`DELETE` | `/tasks/:id/checklist/:itemId` | same | Tick, rename, reorder or remove an item |
| `PUT` | `/tasks/:id/labels` | manager | Replace the labels on a task |
| `GET` | `/labels` | any | The label set |
| `POST`/`PATCH` | `/labels`, `/labels/:id` | manager | Create / rename a label |
| `DELETE` | `/labels/:id` | **admin** | Delete a label |
| `GET` | `/reports` | any | List reports with their lines (scoped to self for employees) |
| `GET` | `/reports/today` | team member | Today's own report; `meta.today` is the date in the caller's timezone |
| `GET` | `/reports/suggestions` | team member | Tasks worth adding as lines to today's report |
| `POST` | `/reports` | team member | Save or update today's report: free text and/or `items[]` |
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
| `GET` | `/tickets/:id/activity` | any | The ticket's thread |
| `POST` | `/tickets/:id/comments` | any | Comment on a ticket |
| `PATCH`/`DELETE` | `/tickets/:id/comments/:commentId` | author (delete: or admin) | Edit or remove a comment |
| `GET`/`POST` | `/devices` | any | List / register this phone for push (`expoPushToken`, `platform`) |
| `DELETE` | `/devices/:token` | any | Unregister a phone (called on sign-out) |
| `GET` | `/jobs/tick` | cron secret | The hourly reminder job; see **Reminders** |
| `GET` | `/team` | manager | Team list with counts |
| `POST` | `/team` | **admin** | Add a team member |
| `GET` | `/admins` | **admin** | List everyone with manager access |
| `POST` | `/admins` | **admin** | Grant manager access to a new person |
| `DELETE` | `/admins/:id` | **admin** | Close a manager-level account, moving their assigned work |
| `GET` | `/team/departments` | manager | Departments for filters |
| `GET` | `/team/:id` | manager | Employee detail |
| `DELETE` | `/team/:id` | **admin** | Remove a team member and all their data |
| `GET` | `/team/:id/reports` | manager | That employee's reports |
| `GET` | `/team/:id/tasks` | manager | That employee's tasks |

---

## Notes on a few decisions

**Notifications poll rather than use websockets.** The bell checks a deliberately tiny
unread-count endpoint every 20 seconds and only refetches the list when the number
actually moves. It pauses while the tab is hidden and catches up on focus. That keeps the
deployment to a single HTTP service; if you later want instant delivery, the notification
service is the one place to add a socket push.

**New accounts have no password at all until the person sets one.** A manager supplies
only who the person is — name, work email, department and job title. The account is
created with a NULL `password_hash`, which is the single source of truth for "invited but
not yet claimed": such an account cannot sign in, because every credential check compares
against a hash and there is none to compare with.

The person claims it from the sign-in page. Typing their address reveals an **Invited**
button, which leads to a page where they choose a password; setting it signs them in.
The `password_hash IS NULL` test is part of the `UPDATE` that claims the invite rather
than a check performed before it, so two requests racing for the same invite cannot both
succeed and a claimed invite can never be claimed twice.

**Adding a member cannot create a manager.** `POST /api/team` fixes the role to
`team_member` rather than reading it from the request, so the endpoint cannot be used to
escalate. Manager accounts are created by the seed or directly in the database.

**An admin administers; a manager runs one department.** The two tiers are not the
same job, and the split is enforced on the server rather than by hiding buttons.

An **admin** sees the whole company and is the only role that can create or remove
accounts — team members and other admins alike. `grantableRoles` returns nothing for
a manager, and `POST /api/team`, `DELETE /api/team/:id` and the whole `/api/admins`
section sit behind `requireAdmin`, so a hand-written request is refused exactly like
a hidden button.

A **manager** is confined to their own department. Every list, count and chart in the
portal — the roster, tasks, reports, tickets, the dashboard and analytics — is filtered
by it. The department is read from their account rather than the query string, so
`?department=Design` narrows nothing and widens nothing: `scopedDepartment` in
`backend/src/utils/scope.js` overrides whatever arrived. Records outside the
department answer **404 rather than 403**, so the difference between the two cannot be
used to work out which ids exist elsewhere.

A manager with **no department recorded sees nothing**, which is deliberate. Treating
an empty department as "everything" would quietly turn a half-filled account into an
admin, so `isEmptyScope` answers those requests with an empty result instead.

Because a manager only ever spans one department, the department filter and the
department column have nothing left to say and are not rendered for them; each
person's department appears under their name instead.

**Manager access used to be transitive** — any manager could grant it onward. It is not
any more: only an admin creates accounts, and an admin granting admin access is still
handing over everything they have, including the power to grant it again. Admins remain
a single tier with nothing above them.

Granting access lives on its own endpoint rather than as a `role` field on `POST /api/team`.
That keeps the everyday "add a colleague" path structurally incapable of escalation: it
hard-codes `team_member` and ignores any role sent to it.

**A ticket is a report from the person doing the work.** Only a team member can raise one,
and only against a task assigned to them — both checked server-side, not just in the form.
The reporter can close or reopen their own ticket but cannot mark it *Resolved*: deciding
the bug is actually fixed is the manager's call. Deleting a task leaves its tickets intact
and simply detaches them, because the bug report is usually the more durable record.

**Assigning a task asks for almost nothing.** Only the assignee and the project are
required, and both for structural reasons rather than editorial ones: `employee_id` is
NOT NULL because a task without an owner is not a task, and the human-facing key
(`SHMOB-12`) is issued from the project, so a task without one cannot be referred to.
Title, description, notes, priority and dates are all things a manager may not know at
the moment they hand work over, so none of them is demanded up front and every one of
them can be filled in later from the edit dialog. An untitled task is listed under its
key, which is what people call it by anyway.

**Deleting a manager moves their work rather than destroying it.** `assigned_tasks.manager_id`
is NOT NULL and cascades, so removing a manager outright would take every task they had
ever assigned — other people's work, not theirs — with them. `DELETE /api/admins/:id`
re-points those rows to the admin doing the deleting, inside the same transaction as the
delete, and the confirmation says how many will move before the click. Two accounts are
refused outright: your own, and the last remaining admin, since nobody else could create
another one.

**Deleting a team member deletes their history with them.** Every table that references
`users(id)` cascades, so removing someone takes their assigned tasks, daily reports,
tickets and notifications too. The confirmation says so before the click, and the
response reports the counts afterwards rather than a bare "deleted".

The endpoint is scoped to `role = 'team_member'` inside the SQL, not merely checked
before it. That is not tidiness: `assigned_tasks.manager_id` cascades as well, so the
same statement pointed at a manager would delete every task that manager had ever
assigned to anybody. Restricting the WHERE clause makes that unreachable, and a
manager-level id simply comes back as not found. If you would rather keep the history,
the alternative is to deactivate instead — `users.is_active` already exists and
`requireAuth` already refuses an inactive account on every request.

**Editing is deliberately narrow.** A project's name, key and description can all be
corrected, and a task's title, description, notes, priority and dates can too — those are
the things people actually get wrong. What cannot be edited is a task's *assignee* or
*project*: moving a task between people or projects would invalidate its key and quietly
rewrite who was accountable, so the honest move is to close it and assign a new one.
Archiving a project keeps its tasks readable while blocking new ones.

**Reports can only be written for today — in the employee's own timezone.** Back-dating
would let someone quietly rewrite history, and the manager relies on these being a
same-day record. "Today" is judged in the zone the client sends (`X-Client-Timezone`,
which the mobile app always does) or the one saved on the profile, falling back to
`APP_TIMEZONE`, so a person eleven hours ahead of the server is never refused their own
day. Editing today's entry is unrestricted. A report is free text, a list of lines each
optionally tied to one of the writer's tasks with the minutes spent, or both; the first
save of a day notifies the managers who have work out with that person.

**Overdue is computed, not stored** — see the schema section above.

**Every task and ticket has a thread.** Comments people write sit in the same ordered list
as the changes the system records — assignment, status moves, edits, checklist ticks,
labels, linked daily reports, tickets raised — so "what happened here" is one screen. A
comment notifies the other party (assignee or manager, reporter or manager); `@mentions`
arrive as user ids and notify each mentioned person who can actually open the item, and
nobody who cannot.

**Reminders are a scheduled job, not a background process.** `GET /api/jobs/tick` runs
hourly (Vercel Cron; `npm run jobs:tick` locally) and, for each person, works out the local
hour in their own timezone: at `REMINDER_DEADLINE_HOUR` (9) it sends "due tomorrow" and
"overdue" for every open task and a digest to managers; at `REMINDER_REPORT_HOUR` (17)
it nags anyone who has not filed today's report. Each reminder goes out once per task per
day — the notifications table itself is the record, so there is nothing to drift.

**Push notifications go through Expo.** The mobile app registers its push token at
`POST /api/devices`; every notification the app creates is pushed to the recipient's
phones after the transaction that created it commits (`db.transaction` exposes
`afterCommit` for exactly this). Sends are bounded by a short timeout and never fail the
request; dead tokens Expo reports are removed. With `PUSH_ENABLED=false`, or when no
token is registered, nothing is sent and the log says so.

**Mobile sessions last 30 days.** A request carrying `X-Client: mobile` gets a long-lived
token and no cookie. That is safe because every request re-loads the account (blocking
takes effect at once) and because tokens carry the account's `session_version`: changing
the password, blocking access or calling `POST /api/auth/logout-all` moves it on, and every
token issued before that moment is refused.
#   w o r k  
 