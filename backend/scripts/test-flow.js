/**
 * End-to-end check of the workflow described in the brief, run against a live API:
 *
 *   manager login -> select employee -> assign task -> employee is notified ->
 *   employee logs in -> sees the task -> updates its status -> submits a daily report ->
 *   manager logs in -> opens the employee -> sees the report and the updated status
 *
 * It also asserts the authorization boundaries (an employee cannot reach manager
 * routes or another employee's data) and the derived "overdue" behaviour.
 *
 * Usage: node scripts/test-flow.js [baseUrl]
 */
const BASE = (process.argv[2] || process.env.API_URL || 'http://localhost:4000').replace(/\/$/, '');
const API = `${BASE}/api`;

const MANAGER = { email: process.env.SEED_MANAGER_EMAIL || 'manager@company.com', password: process.env.SEED_MANAGER_PASSWORD || 'Manager@123' };
const EMPLOYEE = { email: 'employee1@company.com', password: process.env.SEED_EMPLOYEE_PASSWORD || 'Employee@123' };
const OTHER_EMPLOYEE_EMAIL = 'employee2@company.com';

let passed = 0;
let failed = 0;
const failures = [];

function check(label, condition, detail) {
  if (condition) {
    passed += 1;
    console.log(`  PASS  ${label}`);
  } else {
    failed += 1;
    failures.push(label);
    console.log(`  FAIL  ${label}${detail ? ` — ${JSON.stringify(detail).slice(0, 300)}` : ''}`);
  }
}

function step(title) {
  console.log(`\n${title}`);
}

async function api(path, { method = 'GET', token, body } = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let payload = null;
  try { payload = await res.json(); } catch { payload = null; }
  return { status: res.status, body: payload, data: payload?.data, meta: payload?.meta };
}

const isoDay = (offset = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

async function run() {
  console.log(`Running workflow test against ${BASE}\n${'='.repeat(60)}`);

  step('0. API is reachable');
  const health = await api('/health');
  check('health endpoint responds', health.status === 200 && health.data?.status === 'ok', health.body);
  if (health.status !== 200) throw new Error('API is not reachable — start it with `npm start` first.');

  /* ------------------------------------------------------------- manager login */
  step('1. Manager logs in');
  const mLogin = await api('/auth/login', { method: 'POST', body: MANAGER });
  check('manager login succeeds', mLogin.status === 200 && !!mLogin.data?.token, mLogin.body);
  check('manager role is manager', mLogin.data?.user?.role === 'manager');
  check('password hash is never returned', !JSON.stringify(mLogin.body).includes('password_hash'));
  const managerToken = mLogin.data?.token;

  const badLogin = await api('/auth/login', { method: 'POST', body: { ...MANAGER, password: 'not-the-password' } });
  check('wrong password is rejected with 401', badLogin.status === 401, badLogin.body);

  const noAuth = await api('/dashboard');
  check('unauthenticated request is rejected with 401', noAuth.status === 401);

  /* ---------------------------------------------------------- manager dashboard */
  step('2. Manager dashboard loads');
  const mDash = await api('/dashboard', { token: managerToken });
  check('dashboard returns the manager payload', mDash.status === 200 && mDash.data?.role === 'manager', mDash.body);
  check('summary counts team members', (mDash.data?.summary?.total_team_members ?? 0) >= 3, mDash.data?.summary);

  /* --------------------------------------------------------- select an employee */
  step('3. Manager opens the Team Members list and selects an employee');
  const team = await api('/team', { token: managerToken });
  check('team list returns employees', team.status === 200 && Array.isArray(team.data) && team.data.length >= 3, team.body);
  const employee = team.data.find((m) => m.email === EMPLOYEE.email);
  check(`team list contains ${EMPLOYEE.email}`, !!employee);
  check('team rows carry pending/completed counts', typeof employee?.counts?.pending === 'number' && typeof employee?.counts?.completed === 'number', employee?.counts);

  const detail = await api(`/team/${employee.id}`, { token: managerToken });
  check('employee detail page loads', detail.status === 200 && detail.data?.employee?.id === employee.id, detail.body);
  check('detail includes the employee task list', Array.isArray(detail.data?.tasks));
  check('detail includes the employee daily reports', Array.isArray(detail.data?.reports));

  /* --------------------------------------------------------- add a team member */
  step('3a. Manager adds a team member');
  const newEmail = `probe.${Date.now()}@company.com`;
  const newPassword = 'ProbePass@2026';

  const addMember = await api('/team', {
    method: 'POST',
    token: managerToken,
    body: { name: 'Probe Employee', email: newEmail, password: newPassword, department: 'QA', jobTitle: 'Test Engineer' },
  });
  check('manager can add a team member (201)', addMember.status === 201, addMember.body);
  check('new account is a team member', addMember.data?.employee?.role === 'team_member', addMember.data?.employee?.role);
  check('new account is active', addMember.data?.employee?.is_active === true);
  check('password hash is not returned', !JSON.stringify(addMember.body).includes('password_hash'));
  const addedId = addMember.data?.employee?.id;

  // Onboarding email. The suite runs in whichever mail mode the server is configured
  // with: 'smtp' when SMTP_HOST is set, otherwise 'log', where the message is written
  // to the server log rather than sent. Either way the account must work.
  check('the response reports what happened to the welcome email',
    typeof addMember.data?.email?.delivered === 'boolean' && ['smtp', 'log'].includes(addMember.data?.email?.mode),
    addMember.data?.email);
  check('the confirmation message matches the delivery outcome',
    addMember.data.email.delivered
      ? addMember.data.message.includes('emailed their sign-in details')
      : addMember.data.message === 'Probe Employee has been added to the team.',
    { delivered: addMember.data.email.delivered, message: addMember.data.message });
  check('the temporary password is never echoed back in the account payload',
    !JSON.stringify(addMember.data.employee).includes(newPassword));

  const dupeEmail = await api('/team', {
    method: 'POST', token: managerToken,
    body: { name: 'Duplicate', email: newEmail, password: newPassword },
  });
  check('duplicate email is rejected (409)', dupeEmail.status === 409, dupeEmail.body);

  const badEmail = await api('/team', {
    method: 'POST', token: managerToken,
    body: { name: 'Bad', email: 'not-an-email', password: newPassword },
  });
  check('invalid email is rejected (400)', badEmail.status === 400, badEmail.body);

  const weakPassword = await api('/team', {
    method: 'POST', token: managerToken,
    body: { name: 'Weak', email: `weak.${Date.now()}@company.com`, password: 'short' },
  });
  check('short password is rejected (400)', weakPassword.status === 400, weakPassword.body);

  const roleInjection = await api('/team', {
    method: 'POST', token: managerToken,
    body: { name: 'Sneaky', email: `sneaky.${Date.now()}@company.com`, password: newPassword, role: 'manager' },
  });
  check('role cannot be forced through this endpoint',
    roleInjection.status === 201 && roleInjection.data?.employee?.role === 'team_member',
    roleInjection.data?.employee?.role);

  const newMemberLogin = await api('/auth/login', { method: 'POST', body: { email: newEmail, password: newPassword } });
  check('the new team member can sign in', newMemberLogin.status === 200 && !!newMemberLogin.data?.token, newMemberLogin.body);
  check('they land in the team member portal', newMemberLogin.data?.user?.role === 'team_member');

  const newMemberDash = await api('/dashboard', { token: newMemberLogin.data?.token });
  check('their dashboard loads with no work yet',
    newMemberDash.status === 200 && newMemberDash.data?.summary?.total_tasks === 0,
    newMemberDash.data?.summary);

  const teamAfter = await api('/team', { token: managerToken });
  check('they appear in the team list', teamAfter.data?.some((m) => m.id === addedId));
  check('they start with zero task counts',
    teamAfter.data?.find((m) => m.id === addedId)?.counts?.total === 0,
    teamAfter.data?.find((m) => m.id === addedId)?.counts);

  const deptsAfter = await api('/team/departments', { token: managerToken });
  check('their department joins the filter list', deptsAfter.data?.includes('QA'), deptsAfter.data);

  /* --------------------------------------------------------------------- projects */
  step('3b. Projects');
  const projectList = await api('/projects', { token: managerToken });
  check('project list loads', projectList.status === 200 && Array.isArray(projectList.data), projectList.body);
  check('seeded projects are present', projectList.data.length >= 3, projectList.data?.map((p) => p.project_key));
  check('every project has a valid key', projectList.data.every((p) => /^[A-Z][A-Z0-9]{1,9}$/.test(p.project_key)), projectList.data?.map((p) => p.project_key));
  check('projects carry task counts', typeof projectList.data[0]?.counts?.total === 'number', projectList.data?.[0]?.counts);
  const project = projectList.data[0];

  const madeProject = await api('/projects', {
    method: 'POST',
    token: managerToken,
    body: { name: `Probe Project ${Date.now()}`, key: `PB${String(Date.now()).slice(-4)}`, description: 'Created by the workflow test.' },
  });
  check('manager can create a project', madeProject.status === 201, madeProject.body);
  const probeProject = madeProject.data?.project;

  const dupKey = await api('/projects', {
    method: 'POST', token: managerToken, body: { name: 'Duplicate', key: probeProject?.project_key },
  });
  check('duplicate project key is rejected (409)', dupKey.status === 409, dupKey.body);

  const badKey = await api('/projects', {
    method: 'POST', token: managerToken, body: { name: 'Bad key', key: '9' },
  });
  check('invalid project key is rejected (400)', badKey.status === 400, badKey.body);

  /* ----------------------------------------------------------------- assign task */
  step('4. Manager assigns a new task');
  const unreadBefore = (await api('/notifications/unread-count', { token: null }));
  const empPre = await api('/auth/login', { method: 'POST', body: EMPLOYEE });
  const empPreToken = empPre.data?.token;
  const unreadPre = (await api('/notifications/unread-count', { token: empPreToken })).data?.unread ?? 0;

  const title = `Develop Login API (${Date.now()})`;
  const assign = await api('/tasks', {
    method: 'POST',
    token: managerToken,
    body: {
      employeeId: employee.id,
      projectId: project.id,
      title,
      description: 'Create authentication API for the employee portal.',
      priority: 'high',
      startDate: isoDay(0),
      deadline: isoDay(4),
      notes: 'Coordinate with the design team on error copy.',
    },
  });
  check('task is created (201)', assign.status === 201, assign.body);
  check('confirmation names the employee', assign.data?.message === `Task successfully assigned to ${employee.name}.`, assign.data?.message);
  check('new task starts as pending', assign.data?.task?.status === 'pending');
  check('new task is placed in the chosen project', assign.data?.task?.project_id === project.id, assign.data?.task?.project_id);
  check('new task is issued a key', new RegExp('^' + project.project_key + '-\\d+$').test(assign.data?.task?.task_key || ''), assign.data?.task?.task_key);
  const taskId = assign.data?.task?.id;

  const badTask = await api('/tasks', {
    method: 'POST',
    token: managerToken,
    body: { employeeId: employee.id, projectId: project.id, title: title, description: 'x', priority: 'high', startDate: isoDay(10), deadline: isoDay(2) },
  });
  check('deadline before start date is rejected (400)', badTask.status === 400, badTask.body);

  const badPriority = await api('/tasks', {
    method: 'POST', token: managerToken,
    body: { employeeId: employee.id, projectId: project.id, title: 'x', description: 'y', priority: 'catastrophic' },
  });
  check('invalid priority is rejected (400)', badPriority.status === 400);

  /* ------------------------------------------------------ employee is notified */
  step('5. Employee receives the notification');
  const eLogin = await api('/auth/login', { method: 'POST', body: EMPLOYEE });
  check('employee login succeeds', eLogin.status === 200 && !!eLogin.data?.token, eLogin.body);
  check('employee role is team_member', eLogin.data?.user?.role === 'team_member');
  const employeeToken = eLogin.data?.token;

  const unreadAfter = (await api('/notifications/unread-count', { token: employeeToken })).data?.unread ?? 0;
  check('unread notification count increased', unreadAfter === unreadPre + 1, { unreadPre, unreadAfter });

  const notes = await api('/notifications?limit=10', { token: employeeToken });
  const newest = notes.data?.[0];
  check('newest notification is the assignment', newest?.type === 'task_assigned' && newest?.message.includes(title), newest);
  check('notification links to the task', newest?.related_task_id === taskId, newest?.related_task_id);
  check('notification carries a timestamp', typeof newest?.created_at === 'string' && newest.created_at.length > 10);

  const mark = await api(`/notifications/${newest.id}/read`, { method: 'PATCH', token: employeeToken });
  check('notification can be marked read', mark.status === 200 && mark.data?.is_read === true, mark.body);
  check('unread count drops after marking read', mark.data?.unread === unreadAfter - 1, mark.data);

  /* --------------------------------------------------- employee views the task */
  step('6. Employee views the assigned task');
  const myTasks = await api('/tasks', { token: employeeToken });
  check('employee sees their assigned tasks', myTasks.status === 200 && myTasks.data.some((t) => t.id === taskId), myTasks.body?.meta);
  check('every returned task belongs to the employee', myTasks.data.every((t) => t.employee_id === employee.id));
  const seen = myTasks.data.find((t) => t.id === taskId);
  check('task shows who assigned it', typeof seen?.manager_name === 'string' && seen.manager_name.length > 0, seen?.manager_name);
  check('task shows deadline and priority', seen?.deadline === isoDay(4) && seen?.priority === 'high', { deadline: seen?.deadline, priority: seen?.priority });

  check('task carries its project name and key', !!seen?.project_name && !!seen?.task_key, { project: seen?.project_name, key: seen?.task_key });

  const empProjects = await api('/projects', { token: employeeToken });
  check('employee can read the project list for filtering', empProjects.status === 200 && empProjects.data.length >= 3, empProjects.body);

  const empProjectFilter = await api(`/tasks?projectId=${project.id}`, { token: employeeToken });
  check('employee project filter stays scoped to their own tasks',
    empProjectFilter.status === 200 && empProjectFilter.data.every((t) => t.employee_id === employee.id && t.project_id === project.id),
    empProjectFilter.data?.map((t) => t.employee_id));

  const search = await api(`/tasks?search=${encodeURIComponent('Login API')}`, { token: employeeToken });
  check('employee can search their own tasks', search.status === 200 && search.data.some((t) => t.id === taskId));

  /* ------------------------------------------------------------- status update */
  step('7. Employee updates the task status');
  const toProgress = await api(`/tasks/${taskId}/status`, { method: 'PATCH', token: employeeToken, body: { status: 'in_progress' } });
  check('status updates to in_progress', toProgress.status === 200 && toProgress.data?.status === 'in_progress', toProgress.body);

  const badStatus = await api(`/tasks/${taskId}/status`, { method: 'PATCH', token: employeeToken, body: { status: 'almost_done' } });
  check('invalid status value is rejected (400)', badStatus.status === 400);

  const toDone = await api(`/tasks/${taskId}/status`, { method: 'PATCH', token: employeeToken, body: { status: 'completed' } });
  check('status updates to completed', toDone.status === 200 && toDone.data?.status === 'completed', toDone.body);
  check('completion timestamp is recorded', !!toDone.data?.completed_at);

  const managerNotes = await api('/notifications?limit=5', { token: managerToken });
  check('manager is notified of the status change',
    managerNotes.data?.some((n) => n.type === 'status_changed' && n.related_task_id === taskId), managerNotes.data?.[0]);

  /* ------------------------------------------------------------ daily report */
  step('8. Employee submits the daily task report');
  const reportText = 'Completed customer database integration\nFixed login authentication issue\nAttended team meeting\nTested API endpoints\nUpdated project documentation';
  const save = await api('/reports', { method: 'POST', token: employeeToken, body: { taskDescription: reportText } });
  check('report saves successfully', save.status === 200 && !!save.data?.report, save.body);
  check('report is dated today', save.data?.report?.report_date === isoDay(0), save.data?.report?.report_date);
  check('report is attributed to the employee', save.data?.report?.employee_id === employee.id);

  const edited = `${reportText}\nReviewed the release checklist`;
  const update = await api('/reports', { method: 'POST', token: employeeToken, body: { taskDescription: edited } });
  check('same-day report edits update in place', update.status === 200 && update.data?.createdNew === false, update.data);
  check('edit message says updated', update.data?.message?.includes('updated'), update.data?.message);
  check('updated_at moves forward on edit', update.data?.report?.updated_at >= save.data?.report?.updated_at);

  const backdated = await api('/reports', { method: 'POST', token: employeeToken, body: { taskDescription: 'x', reportDate: isoDay(-3) } });
  check('back-dating a report is rejected (400)', backdated.status === 400, backdated.body);

  const emptyReport = await api('/reports', { method: 'POST', token: employeeToken, body: { taskDescription: '   ' } });
  check('empty report text is rejected (400)', emptyReport.status === 400);

  const myReports = await api('/reports', { token: employeeToken });
  check('employee sees their previous reports', myReports.status === 200 && myReports.data.length >= 1);
  check('reports are newest-first', myReports.data.every((r, i, a) => i === 0 || a[i - 1].report_date >= r.report_date));
  check('every returned report belongs to the employee', myReports.data.every((r) => r.employee_id === employee.id));

  const reportSearch = await api(`/reports?search=${encodeURIComponent('authentication')}`, { token: employeeToken });
  check('employee can search their own reports', reportSearch.status === 200 && reportSearch.data.length >= 1);

  /* ------------------------------------------------- manager sees it all back */
  step('9. Manager reviews the employee again');
  const detail2 = await api(`/team/${employee.id}`, { token: managerToken });
  const managerSeesTask = detail2.data?.tasks?.find((t) => t.id === taskId);
  check('manager sees the updated task status', managerSeesTask?.status === 'completed', managerSeesTask?.status);
  const managerSeesReport = detail2.data?.reports?.find((r) => r.report_date === isoDay(0));
  check('manager sees today\'s submitted report', !!managerSeesReport, detail2.data?.reports?.slice(0, 1));
  check('manager sees the edited report text', managerSeesReport?.task_description?.includes('release checklist'));
  check('report shows submission and last-updated times', !!managerSeesReport?.created_at && !!managerSeesReport?.updated_at);

  const filtered = await api(`/team/${employee.id}/reports?range=today`, { token: managerToken });
  check('manager can filter reports to today', filtered.status === 200 && filtered.data.every((r) => r.report_date === isoDay(0)));

  const weekFiltered = await api(`/team/${employee.id}/reports?range=week`, { token: managerToken });
  check('manager can filter reports to this week', weekFiltered.status === 200 && weekFiltered.data.length >= filtered.data.length);

  const reportTextSearch = await api(`/team/${employee.id}/reports?search=${encodeURIComponent('release checklist')}`, { token: managerToken });
  check('manager can search report text', reportTextSearch.status === 200 && reportTextSearch.data.length >= 1);

  /* ----------------------------------------------------------- overdue + filters */
  step('10. All Assigned Tasks: filters and derived overdue status');
  const overdueTask = await api('/tasks', {
    method: 'POST', token: managerToken,
    body: { employeeId: employee.id, projectId: project.id, title: `Overdue probe ${Date.now()}`, description: 'Deadline already passed.', priority: 'medium', startDate: isoDay(-9), deadline: isoDay(-2) },
  });
  check('task with a past deadline is created', overdueTask.status === 201, overdueTask.body);
  check('it is stored as pending', overdueTask.data?.task?.status === 'pending');
  check('but reads as overdue', overdueTask.data?.task?.effective_status === 'overdue', overdueTask.data?.task?.effective_status);

  const overdueList = await api('/tasks?status=overdue', { token: managerToken });
  check('overdue filter returns it', overdueList.data?.some((t) => t.id === overdueTask.data.task.id));
  check('overdue filter excludes completed work', overdueList.data?.every((t) => t.status !== 'completed'));

  const byPriority = await api('/tasks?priority=high', { token: managerToken });
  check('priority filter works', byPriority.status === 200 && byPriority.data.every((t) => t.priority === 'high'));

  const byEmployee = await api(`/tasks?employeeId=${employee.id}`, { token: managerToken });
  check('employee filter works', byEmployee.status === 200 && byEmployee.data.every((t) => t.employee_id === employee.id));

  const byProject = await api(`/tasks?projectId=${project.id}`, { token: managerToken });
  check('project filter returns only that project\'s tasks',
    byProject.status === 200 && byProject.data.every((t) => t.project_id === project.id),
    byProject.data?.map((t) => t.project_key));
  check('project filter includes the task just assigned', byProject.data.some((t) => t.id === taskId));

  const emptyProject = await api(`/tasks?projectId=${probeProject.id}`, { token: managerToken });
  check('a project with no tasks returns an empty list', emptyProject.status === 200 && emptyProject.data.length === 0, emptyProject.data);

  const keySearch = await api(`/tasks?search=${encodeURIComponent(assign.data.task.task_key)}`, { token: managerToken });
  check('searching by task key finds the task', keySearch.status === 200 && keySearch.data.some((t) => t.id === taskId), keySearch.data?.length);

  const byStatus = await api('/tasks?status=completed', { token: managerToken });
  check('status filter works', byStatus.status === 200 && byStatus.data.every((t) => t.status === 'completed'));

  const byDeadline = await api(`/tasks?deadlineTo=${isoDay(0)}`, { token: managerToken });
  check('deadline filter works', byDeadline.status === 200 && byDeadline.data.every((t) => !t.deadline || t.deadline <= isoDay(0)));

  /* ----------------------------------------------------------------- analytics */
  step('11. Analytics');
  const analytics = await api('/dashboard/analytics', { token: managerToken });
  check('analytics loads for the manager', analytics.status === 200, analytics.body);
  check('per-employee productivity is returned', Array.isArray(analytics.data?.productivity) && analytics.data.productivity.length >= 3);
  check('productivity rows carry assigned/completed', typeof analytics.data?.productivity?.[0]?.assigned === 'number' && typeof analytics.data?.productivity?.[0]?.completed === 'number');
  check('daily activity series is zero-filled', Array.isArray(analytics.data?.daily) && analytics.data.daily.length === 14);
  check('weekly activity is returned', Array.isArray(analytics.data?.weekly) && analytics.data.weekly.length > 0);
  check('status breakdown is returned', typeof analytics.data?.breakdown?.overdue === 'number');

  const scoped = await api(`/dashboard/analytics?employeeId=${employee.id}`, { token: managerToken });
  check('analytics can be filtered to one employee', scoped.status === 200 && scoped.data.productivity.length === 1 && scoped.data.productivity[0].employee_id === employee.id, scoped.data?.productivity);

  const byDept = await api('/dashboard/analytics?department=Development', { token: managerToken });
  check('analytics can be filtered by department', byDept.status === 200 && byDept.data.productivity.every((p) => p.department === 'Development'));

  /* ---------------------------------------------------- editing after the fact */
  step('11b. Manager corrects mistakes');

  const renamed = await api(`/projects/${probeProject.id}`, {
    method: 'PATCH', token: managerToken,
    body: { name: 'Probe Project (corrected)', description: 'Spelling fixed.' },
  });
  check('project name can be corrected', renamed.status === 200 && renamed.data?.name === 'Probe Project (corrected)', renamed.body);
  check('correcting the name leaves the key alone', renamed.data?.project_key === probeProject.project_key);

  // A task in the probe project, so the key rename can be observed on a real key.
  const keyProbeTask = await api('/tasks', {
    method: 'POST', token: managerToken,
    body: { employeeId: employee.id, projectId: probeProject.id, title: 'Key rename probe', description: 'Checks key rename.', priority: 'low' },
  });
  check('task created in the probe project', keyProbeTask.status === 201, keyProbeTask.body);
  const keyProbeId = keyProbeTask.data?.task?.id;
  const originalNumber = keyProbeTask.data?.task?.task_number;
  check('it holds the old key', keyProbeTask.data?.task?.task_key === `${probeProject.project_key}-${originalNumber}`);

  const newKey = `RN${String(Date.now()).slice(-4)}`;
  const rekeyed = await api(`/projects/${probeProject.id}`, {
    method: 'PATCH', token: managerToken, body: { key: newKey },
  });
  check('project key can be corrected', rekeyed.status === 200 && rekeyed.data?.project_key === newKey, rekeyed.body);

  const afterRekey = await api(`/tasks/${keyProbeId}`, { token: managerToken });
  check('existing task keys re-render under the new key',
    afterRekey.data?.task_key === `${newKey}-${originalNumber}`, afterRekey.data?.task_key);
  check('the task number itself does not move', afterRekey.data?.task_number === originalNumber);

  const clashKey = await api(`/projects/${probeProject.id}`, {
    method: 'PATCH', token: managerToken, body: { key: project.project_key },
  });
  check('renaming onto an existing key is rejected (409)', clashKey.status === 409, clashKey.body);

  const badRekey = await api(`/projects/${probeProject.id}`, {
    method: 'PATCH', token: managerToken, body: { key: '1' },
  });
  check('an invalid key is rejected (400)', badRekey.status === 400, badRekey.body);

  // Task edits.
  const editedTask = await api(`/tasks/${keyProbeId}`, {
    method: 'PATCH', token: managerToken,
    body: { title: 'Key rename probe (corrected)', description: 'Description corrected too.', priority: 'urgent' },
  });
  check('task wording can be corrected', editedTask.status === 200 && editedTask.data?.title === 'Key rename probe (corrected)', editedTask.body);
  check('task priority can be corrected', editedTask.data?.priority === 'urgent');
  check('editing does not change the task key', editedTask.data?.task_key === `${newKey}-${originalNumber}`);

  const editNotify = await api('/notifications?limit=5', { token: employeeToken });
  check('the assignee is notified about the edit',
    editNotify.data?.some((n) => n.type === 'task_updated' && n.related_task_id === keyProbeId),
    editNotify.data?.[0]);

  const empEditsTask = await api(`/tasks/${keyProbeId}`, {
    method: 'PATCH', token: employeeToken, body: { title: 'Rogue edit' },
  });
  check('an employee cannot edit task wording (403)', empEditsTask.status === 403, empEditsTask.body);

  const empEditsProject = await api(`/projects/${probeProject.id}`, {
    method: 'PATCH', token: employeeToken, body: { name: 'Rogue rename' },
  });
  check('an employee cannot edit a project (403)', empEditsProject.status === 403, empEditsProject.body);

  // Archiving blocks new work but keeps the old readable.
  const archived = await api(`/projects/${probeProject.id}`, {
    method: 'PATCH', token: managerToken, body: { isArchived: true },
  });
  check('a project can be archived', archived.status === 200 && archived.data?.is_archived === true, archived.body);

  const assignToArchived = await api('/tasks', {
    method: 'POST', token: managerToken,
    body: { employeeId: employee.id, projectId: probeProject.id, title: 'Too late', description: 'Should fail.', priority: 'low' },
  });
  check('assigning into an archived project is rejected (400)', assignToArchived.status === 400, assignToArchived.body);

  const archivedTaskStillReadable = await api(`/tasks/${keyProbeId}`, { token: managerToken });
  check('tasks in an archived project stay readable', archivedTaskStillReadable.status === 200);

  const defaultList = await api('/projects', { token: managerToken });
  check('archived projects are hidden by default', !defaultList.data?.some((pr) => pr.id === probeProject.id));

  const withArchived = await api('/projects?includeArchived=true', { token: managerToken });
  check('archived projects can still be listed explicitly', withArchived.data?.some((pr) => pr.id === probeProject.id));

  const restored = await api(`/projects/${probeProject.id}`, {
    method: 'PATCH', token: managerToken, body: { isArchived: false },
  });
  check('an archived project can be restored', restored.status === 200 && restored.data?.is_archived === false);

  await api(`/tasks/${keyProbeId}`, { method: 'DELETE', token: managerToken });

  /* -------------------------------------------------------- authorization walls */
  step('12. Authorization boundaries');
  const empHitsTeam = await api('/team', { token: employeeToken });
  check('employee cannot list the team (403)', empHitsTeam.status === 403, empHitsTeam.body);

  const empHitsAnalytics = await api('/dashboard/analytics', { token: employeeToken });
  check('employee cannot read analytics (403)', empHitsAnalytics.status === 403);

  const empAssigns = await api('/tasks', { method: 'POST', token: employeeToken, body: { employeeId: employee.id, projectId: project.id, title: 'self-assigned', description: 'nope', priority: 'low' } });
  check('employee cannot assign tasks (403)', empAssigns.status === 403);

  const empAddsMember = await api('/team', {
    method: 'POST', token: employeeToken,
    body: { name: 'Rogue Hire', email: `rogue.${Date.now()}@company.com`, password: 'RoguePass@2026' },
  });
  check('employee cannot add a team member (403)', empAddsMember.status === 403, empAddsMember.body);

  const empCreatesProject = await api('/projects', {
    method: 'POST', token: employeeToken, body: { name: 'Rogue', key: 'ROGUE' },
  });
  check('employee cannot create a project (403)', empCreatesProject.status === 403, empCreatesProject.body);

  const other = await api('/auth/login', { method: 'POST', body: { email: OTHER_EMPLOYEE_EMAIL, password: EMPLOYEE.password } });
  const otherToken = other.data?.token;
  const otherTasks = await api(`/tasks?employeeId=${employee.id}`, { token: otherToken });
  check('employeeId in the query cannot widen an employee\'s scope',
    otherTasks.data.every((t) => t.employee_id !== employee.id), otherTasks.data?.map((t) => t.employee_id));

  const otherReports = await api(`/reports?employeeId=${employee.id}`, { token: otherToken });
  check('an employee cannot read a colleague\'s reports',
    otherReports.data.every((r) => r.employee_id !== employee.id), otherReports.data?.map((r) => r.employee_id));

  const otherReadsTask = await api(`/tasks/${taskId}`, { token: otherToken });
  check('an employee cannot open a colleague\'s task by id (403)', otherReadsTask.status === 403, otherReadsTask.body);

  const otherUpdatesTask = await api(`/tasks/${taskId}/status`, { method: 'PATCH', token: otherToken, body: { status: 'pending' } });
  check('an employee cannot change a colleague\'s task status (403)', otherUpdatesTask.status === 403);

  const otherNotifications = await api('/notifications', { token: otherToken });
  check('notifications are scoped to the signed-in user',
    !otherNotifications.data?.some((n) => n.related_task_id === taskId));

  const forgedMark = await api(`/notifications/${newest.id}/read`, { method: 'PATCH', token: otherToken });
  check('cannot mark another user\'s notification read (404)', forgedMark.status === 404, forgedMark.body);

  const badToken = await api('/dashboard', { token: 'not.a.real.token' });
  check('a forged token is rejected (401)', badToken.status === 401);

  /* ------------------------------------------------------------------ tickets */
  step('11c. Bug tickets');

  const ticketBefore = await api('/tickets', { token: employeeToken });
  check('employee can list their tickets', ticketBefore.status === 200 && Array.isArray(ticketBefore.data), ticketBefore.body);
  check('the list carries counts', typeof ticketBefore.meta?.counts?.unresolved === 'number', ticketBefore.meta?.counts);

  // A task of this employee's to hang the ticket on.
  const ticketTask = await api('/tasks', {
    method: 'POST', token: managerToken,
    body: { employeeId: employee.id, projectId: project.id, title: `Ticket host ${Date.now()}`, description: 'Task the bug is found on.', priority: 'medium' },
  });
  const hostTaskId = ticketTask.data?.task?.id;

  const managerUnreadBefore = (await api('/notifications/unread-count', { token: managerToken })).data?.unread ?? 0;

  const raised = await api('/tickets', {
    method: 'POST', token: employeeToken,
    body: {
      projectId: project.id,
      taskId: hostTaskId,
      title: 'Totals are double-counted on the reports page',
      description: 'Steps: filter to last week. Expected: totals match the table. Actual: doubled.',
      severity: 'high',
    },
  });
  check('employee can raise a ticket (201)', raised.status === 201, raised.body);
  check('the ticket is keyed from its project', new RegExp('^' + project.project_key + '-B\\d+$').test(raised.data?.ticket?.ticket_key || ''), raised.data?.ticket?.ticket_key);
  check('it starts open', raised.data?.ticket?.status === 'open');
  check('it records the project, task and reporter',
    raised.data?.ticket?.project_id === project.id
    && raised.data?.ticket?.task_id === hostTaskId
    && raised.data?.ticket?.reporter_id === employee.id,
    { p: raised.data?.ticket?.project_id, t: raised.data?.ticket?.task_id, r: raised.data?.ticket?.reporter_id });
  check('it carries the task key for display', raised.data?.ticket?.task_key === ticketTask.data.task.task_key, raised.data?.ticket?.task_key);
  const ticketId = raised.data?.ticket?.id;
  const ticketKey = raised.data?.ticket?.ticket_key;

  const managerUnreadAfter = (await api('/notifications/unread-count', { token: managerToken })).data?.unread ?? 0;
  check('the manager is notified of a new ticket', managerUnreadAfter === managerUnreadBefore + 1, { managerUnreadBefore, managerUnreadAfter });

  const mgrNotes = await api('/notifications?limit=5', { token: managerToken });
  const ticketNote = mgrNotes.data?.find((n) => n.type === 'ticket_raised' && n.related_ticket_id === ticketId);
  check('the notification links back to the ticket', !!ticketNote, mgrNotes.data?.[0]);

  // Scope: a ticket belongs to the person who raised it.
  const otherSees = await api('/tickets', { token: otherToken });
  check('an employee sees only their own tickets',
    otherSees.data.every((t) => t.reporter_id !== employee.id), otherSees.data?.map((t) => t.reporter_id));

  const forcedScope = await api(`/tickets?reporterId=${employee.id}`, { token: otherToken });
  check('reporterId in the query cannot widen an employee\'s scope',
    forcedScope.data.every((t) => t.reporter_id !== employee.id), forcedScope.data?.map((t) => t.reporter_id));

  const otherReads = await api(`/tickets/${ticketId}`, { token: otherToken });
  check('an employee cannot open a colleague\'s ticket (403)', otherReads.status === 403, otherReads.body);

  const managerReads = await api(`/tickets/${ticketId}`, { token: managerToken });
  check('the manager can read any ticket', managerReads.status === 200, managerReads.body);

  // Raising rules.
  const foreignTask = await api('/tickets', {
    method: 'POST', token: otherToken,
    body: { projectId: project.id, taskId: hostTaskId, title: 'not mine', description: 'x', severity: 'low' },
  });
  check('cannot raise a ticket on someone else\'s task (403)', foreignTask.status === 403, foreignTask.body);

  const wrongProject = await api('/tickets', {
    method: 'POST', token: employeeToken,
    body: { projectId: probeProject.id, taskId: hostTaskId, title: 'mismatch', description: 'x', severity: 'low' },
  });
  check('task and project must agree (400)', wrongProject.status === 400, wrongProject.body);

  const managerRaises = await api('/tickets', {
    method: 'POST', token: managerToken,
    body: { projectId: project.id, taskId: hostTaskId, title: 'manager bug', description: 'x', severity: 'low' },
  });
  check('a manager cannot raise a ticket (403)', managerRaises.status === 403, managerRaises.body);

  const emptyDescription = await api('/tickets', {
    method: 'POST', token: employeeToken,
    body: { projectId: project.id, taskId: hostTaskId, title: 'x', description: '   ', severity: 'low' },
  });
  check('an empty bug description is rejected (400)', emptyDescription.status === 400);

  // Status rules.
  const selfResolve = await api(`/tickets/${ticketId}/status`, {
    method: 'PATCH', token: employeeToken, body: { status: 'resolved' },
  });
  check('the reporter cannot mark their own ticket resolved (403)', selfResolve.status === 403, selfResolve.body);

  const selfClose = await api(`/tickets/${ticketId}/status`, {
    method: 'PATCH', token: employeeToken, body: { status: 'closed' },
  });
  check('the reporter can close their own ticket', selfClose.status === 200 && selfClose.data?.status === 'closed', selfClose.body);

  const reopen = await api(`/tickets/${ticketId}/status`, {
    method: 'PATCH', token: employeeToken, body: { status: 'open' },
  });
  check('the reporter can reopen it', reopen.status === 200 && reopen.data?.status === 'open');

  const otherUpdates = await api(`/tickets/${ticketId}/status`, {
    method: 'PATCH', token: otherToken, body: { status: 'closed' },
  });
  check('an employee cannot touch a colleague\'s ticket (403)', otherUpdates.status === 403);

  const empUnreadBefore = (await api('/notifications/unread-count', { token: employeeToken })).data?.unread ?? 0;
  const resolved = await api(`/tickets/${ticketId}/status`, {
    method: 'PATCH', token: managerToken,
    body: { status: 'resolved', resolutionNote: 'Fixed the aggregation and added a regression test.' },
  });
  check('the manager can resolve a ticket', resolved.status === 200 && resolved.data?.status === 'resolved', resolved.body);
  check('the resolution note is stored', resolved.data?.resolution_note?.includes('regression test'), resolved.data?.resolution_note);
  check('a resolved timestamp is recorded', !!resolved.data?.resolved_at);

  const empUnreadAfter = (await api('/notifications/unread-count', { token: employeeToken })).data?.unread ?? 0;
  check('the reporter is notified when it is resolved', empUnreadAfter === empUnreadBefore + 1, { empUnreadBefore, empUnreadAfter });

  // Editing rules.
  const lateEdit = await api(`/tickets/${ticketId}`, {
    method: 'PATCH', token: employeeToken, body: { title: 'too late' },
  });
  check('the reporter cannot edit a resolved ticket (400)', lateEdit.status === 400, lateEdit.body);

  // Filters.
  const ticketsBySeverity = await api('/tickets?severity=high', { token: managerToken });
  check('ticket severity filter works', ticketsBySeverity.status === 200 && ticketsBySeverity.data.every((t) => t.severity === 'high'));

  const ticketsByProject = await api(`/tickets?projectId=${project.id}`, { token: managerToken });
  check('ticket project filter works', ticketsByProject.status === 200 && ticketsByProject.data.every((t) => t.project_id === project.id));

  const unresolvedOnly = await api('/tickets?status=unresolved', { token: managerToken });
  check('the unresolved filter excludes resolved and closed',
    unresolvedOnly.status === 200 && unresolvedOnly.data.every((t) => ['open', 'in_progress'].includes(t.status)),
    unresolvedOnly.data?.map((t) => t.status));

  const keyFind = await api(`/tickets?search=${encodeURIComponent(ticketKey)}`, { token: managerToken });
  check('searching by ticket key finds it', keyFind.status === 200 && keyFind.data.some((t) => t.id === ticketId));

  // The dashboards surface ticket counts.
  const mgrDashTickets = await api('/dashboard', { token: managerToken });
  check('the manager dashboard reports open tickets', typeof mgrDashTickets.data?.summary?.open_tickets === 'number', mgrDashTickets.data?.summary?.open_tickets);
  const empDashTickets = await api('/dashboard', { token: employeeToken });
  check('the employee dashboard reports their own tickets', typeof empDashTickets.data?.summary?.total_tickets === 'number', empDashTickets.data?.summary);

  // A deleted task must not take its bug report with it.
  await api(`/tasks/${hostTaskId}`, { method: 'DELETE', token: managerToken });
  const orphaned = await api(`/tickets/${ticketId}`, { token: managerToken });
  check('deleting the task keeps the ticket', orphaned.status === 200, orphaned.body);
  check('the ticket detaches from the deleted task', orphaned.data?.task_id === null, orphaned.data?.task_id);

  await api(`/tickets/${ticketId}`, { method: 'DELETE', token: managerToken });

  /* ------------------------------------------------------------ misc hardening */
  step('13. Input handling');
  const injection = await api(`/tasks?search=${encodeURIComponent("'; DROP TABLE assigned_tasks; --")}`, { token: managerToken });
  check('SQL injection attempt is treated as literal text', injection.status === 200 && Array.isArray(injection.data), injection.body);
  const stillThere = await api('/tasks', { token: managerToken });
  check('tasks table survived the injection attempt', stillThere.data.length > 0);

  const oversize = await api('/tasks', {
    method: 'POST', token: managerToken,
    body: { employeeId: employee.id, projectId: project.id, title: 'x'.repeat(500), description: 'y', priority: 'low' },
  });
  check('over-length input is rejected (400)', oversize.status === 400);

  const missingEmployee = await api('/tasks', {
    method: 'POST', token: managerToken,
    body: { employeeId: 999999, projectId: project.id, title: 'ghost', description: 'y', priority: 'low' },
  });
  check('assigning to a non-existent employee returns 404', missingEmployee.status === 404, missingEmployee.body);

  const unknownRoute = await api('/does-not-exist', { token: managerToken });
  check('unknown API routes return a clean 404', unknownRoute.status === 404 && unknownRoute.body?.success === false);

  /* ---------------------------------------------------------------- profile */
  step('14. Profile and password');
  const me = await api('/auth/me', { token: employeeToken });
  check('/auth/me returns the signed-in user', me.status === 200 && me.data?.user?.email === EMPLOYEE.email);

  const patchProfile = await api('/profile', { method: 'PATCH', token: employeeToken, body: { phone: '+91 90000 00000' } });
  check('profile updates save', patchProfile.status === 200 && patchProfile.data?.phone === '+91 90000 00000', patchProfile.body);

  const escalate = await api('/profile', { method: 'PATCH', token: employeeToken, body: { role: 'manager' } });
  const stillEmployee = await api('/auth/me', { token: employeeToken });
  check('role cannot be self-assigned through the profile endpoint',
    escalate.status === 200 && stillEmployee.data?.user?.role === 'team_member', stillEmployee.data?.user?.role);

  const forgot = await api('/auth/forgot-password', { method: 'POST', body: { email: EMPLOYEE.email } });
  check('forgot-password responds 200', forgot.status === 200 && !!forgot.data?.message, forgot.body);
  check('forgot-password never leaks the token into the public message',
    !forgot.data.message.includes(forgot.data.devResetToken ?? '__none__'), forgot.data?.message);
  const unknownEmail = await api('/auth/forgot-password', { method: 'POST', body: { email: 'nobody@company.com' } });
  check('forgot-password does not reveal whether an account exists',
    unknownEmail.status === 200 && unknownEmail.data?.message === forgot.data?.message);

  if (forgot.data?.devResetToken) {
    const reset = await api('/auth/reset-password', { method: 'POST', body: { token: forgot.data.devResetToken, password: EMPLOYEE.password } });
    check('reset token sets a new password', reset.status === 200, reset.body);
    const reuse = await api('/auth/reset-password', { method: 'POST', body: { token: forgot.data.devResetToken, password: EMPLOYEE.password } });
    check('a reset token cannot be reused (400)', reuse.status === 400, reuse.body);
    const reLogin = await api('/auth/login', { method: 'POST', body: EMPLOYEE });
    check('employee can still sign in after the reset', reLogin.status === 200);
  }

  /* ------------------------------------------------------------------ cleanup */
  await api(`/projects/${probeProject.id}`, { method: 'PATCH', token: managerToken, body: { isArchived: true } });
  await api(`/tasks/${overdueTask.data.task.id}`, { method: 'DELETE', token: managerToken });
  await api(`/tasks/${taskId}`, { method: 'DELETE', token: managerToken });

  console.log(`\n${'='.repeat(60)}`);
  console.log(`${passed} passed, ${failed} failed`);
  if (failed) {
    console.log('\nFailures:');
    for (const f of failures) console.log(`  - ${f}`);
  }
  process.exit(failed ? 1 : 0);
}

run().catch((err) => {
  console.error('\nTest run crashed:', err.message);
  process.exit(1);
});
