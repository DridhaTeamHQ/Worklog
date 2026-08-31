import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ClipboardList, Filter, Trash2, X, ClipboardPlus, FolderPlus, Pencil } from 'lucide-react';
import { projectApi, taskApi, teamApi } from '../../api/endpoints';
import { ApiError } from '../../api/client';
import { useToast } from '../../components/Toast';
import { AssignTaskModal } from '../../components/AssignTaskModal';
import { ProjectSwitcher } from '../../components/ProjectSwitcher';
import { TaskTable } from '../../components/TaskTable';
import { CreateProjectModal } from '../../components/CreateProjectModal';
import { EditProjectModal } from '../../components/EditProjectModal';
import { EditTaskModal } from '../../components/EditTaskModal';
import {
  EmptyState, ErrorState, LoadingBlock, Modal, PageHeader, SearchInput, Spinner, Select,
} from '../../components/ui';
import { STATUS_LABEL, taskLabel } from '../../lib/format';
import type { Project, Task, TaskStatus, TeamMember } from '../../types';

export function AllTasksPage() {
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const highlightId = Number(params.get('highlight')) || null;

  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [projectId, setProjectId] = useState<number | null>(
    params.get('projectId') ? Number(params.get('projectId')) : null,
  );
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState(params.get('status') ?? '');
  const [priority, setPriority] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [assignedFrom, setAssignedFrom] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [deadlineTo, setDeadlineTo] = useState('');
  const [sort, setSort] = useState('created_desc');
  const [showFilters, setShowFilters] = useState(false);

  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);

  const [assignOpen, setAssignOpen] = useState(false);
  const [createProjectOpen, setCreateProjectOpen] = useState(false);
  const [editProjectOpen, setEditProjectOpen] = useState(false);
  const [editTask, setEditTask] = useState<Task | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Task | null>(null);
  const [deleting, setDeleting] = useState(false);
  /** True while the "delete everything selected" confirmation is open. */
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);

  const highlightRef = useRef<HTMLTableRowElement | null>(null);

  const loadProjects = useCallback(async () => {
    try {
      const { data } = await projectApi.list();
      setProjects(data);
    } catch {
      setProjects([]);
    }
  }, []);

  useEffect(() => {
    void loadProjects();
    teamApi.list().then(({ data }) => setMembers(data)).catch(() => setMembers([]));
  }, [loadProjects]);

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError('');
    try {
      const { data } = await taskApi.list({
        projectId: projectId ?? undefined,
        search: search || undefined,
        status: status || undefined,
        priority: (priority || undefined) as never,
        employeeId: employeeId ? Number(employeeId) : undefined,
        assignedFrom: assignedFrom || undefined,
        assignedTo: assignedTo || undefined,
        deadlineTo: deadlineTo || undefined,
        sort,
        limit: 200,
      }, signal);
      setTasks(data);
      // Drop selections for rows that are no longer on screen.
      setSelected((prev) => new Set([...prev].filter((id) => data.some((t) => t.id === id))));
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      setError(err instanceof ApiError ? err.message : 'Could not load tasks.');
    } finally {
      setLoading(false);
    }
  }, [projectId, search, status, priority, employeeId, assignedFrom, assignedTo, deadlineTo, sort]);

  useEffect(() => {
    /*
      Loading is flipped here rather than inside `load`, which runs behind a debounce
      timer. Waiting for the timer left the previous results on screen for the frame
      after a project tab or filter changed — briefly showing one set of rows under
      another set's heading, which is what read as a glitch.
    */
    setLoading(true);
    const controller = new AbortController();
    const timer = window.setTimeout(() => { void load(controller.signal); }, search ? 300 : 0);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [load, search]);

  // Keep the chosen project in the URL so the view is linkable and survives a refresh.
  useEffect(() => {
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      if (projectId) next.set('projectId', String(projectId));
      else next.delete('projectId');
      return next;
    }, { replace: true });
  }, [projectId, setParams]);

  useEffect(() => {
    if (!highlightId || loading) return;
    highlightRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [highlightId, loading, tasks.length]);

  const activeFilterCount = useMemo(
    () => [status, priority, employeeId, assignedFrom, assignedTo, deadlineTo].filter(Boolean).length,
    [status, priority, employeeId, assignedFrom, assignedTo, deadlineTo],
  );

  const activeProject = projects.find((p) => p.id === projectId) ?? null;

  const clearFilters = () => {
    setStatus(''); setPriority(''); setEmployeeId('');
    setAssignedFrom(''); setAssignedTo(''); setDeadlineTo('');
  };

  const changeStatus = async (task: Task, next: TaskStatus) => {
    if (next === task.status) return;
    setUpdatingId(task.id);
    try {
      const { data } = await taskApi.updateStatus(task.id, next);
      setTasks((prev) => prev.map((t) => (t.id === task.id ? data : t)));
      toast.success(`${task.task_key ?? task.title} set to ${STATUS_LABEL[next]}.`);
      void loadProjects();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not update the task status.');
    } finally {
      setUpdatingId(null);
    }
  };

  /** Applies one status to every selected task, reporting partial failures honestly. */
  const bulkStatus = async (next: TaskStatus) => {
    const ids = [...selected];
    if (!ids.length) return;
    setBulkBusy(true);
    const failures: string[] = [];
    for (const id of ids) {
      try {
        const { data } = await taskApi.updateStatus(id, next);
        setTasks((prev) => prev.map((t) => (t.id === id ? data : t)));
      } catch {
        failures.push(tasks.find((t) => t.id === id)?.task_key ?? `#${id}`);
      }
    }
    setBulkBusy(false);
    setSelected(new Set());
    void loadProjects();
    if (failures.length) {
      toast.error(`${ids.length - failures.length} updated, ${failures.length} failed: ${failures.join(', ')}`);
    } else {
      toast.success(`${ids.length} task${ids.length === 1 ? '' : 's'} set to ${STATUS_LABEL[next]}.`);
    }
  };

  /**
   * Deletes every selected task. Failures are collected rather than thrown so one
   * refusal cannot strand the rest half-done and unreported.
   */
  const bulkDelete = async () => {
    const ids = [...selected];
    if (!ids.length) return;
    setBulkBusy(true);
    const failures: string[] = [];
    const deleted: number[] = [];
    for (const id of ids) {
      try {
        await taskApi.remove(id);
        deleted.push(id);
      } catch {
        failures.push(tasks.find((t) => t.id === id)?.task_key ?? `#${id}`);
      }
    }
    setTasks((prev) => prev.filter((t) => !deleted.includes(t.id)));
    setBulkBusy(false);
    setSelected(new Set());
    setConfirmBulkDelete(false);
    void loadProjects();
    if (failures.length) {
      toast.error(`${deleted.length} deleted, ${failures.length} failed: ${failures.join(', ')}`);
    } else {
      toast.success(`${deleted.length} task${deleted.length === 1 ? '' : 's'} deleted.`);
    }
  };

  const remove = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      await taskApi.remove(confirmDelete.id);
      setTasks((prev) => prev.filter((t) => t.id !== confirmDelete.id));
      toast.success(`${confirmDelete.task_key ?? confirmDelete.title} was deleted.`);
      setConfirmDelete(null);
      void loadProjects();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not delete the task.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-5">
      <PageHeader
        title="All Assigned Tasks"
        subtitle={activeProject
          ? `${activeProject.project_key} · ${activeProject.name}`
          : 'Every task assigned across the company.'}
        actions={
          <>
            {activeProject && (
              <button type="button" onClick={() => setEditProjectOpen(true)} className="btn-secondary">
                <Pencil className="h-4 w-4" /> Edit project
              </button>
            )}
            <button type="button" onClick={() => setCreateProjectOpen(true)} className="btn-secondary">
              <FolderPlus className="h-4 w-4" /> New project
            </button>
            {members.length > 0 && (
              <button type="button" onClick={() => setAssignOpen(true)} className="btn-primary">
                <ClipboardPlus className="h-4 w-4" /> Assign Task
              </button>
            )}
          </>
        }
      />

      {projects.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<FolderPlus className="h-6 w-6" />}
            title="No projects yet"
            description="Tasks live inside projects. Create your first one to start assigning work."
            action={(
              <button type="button" onClick={() => setCreateProjectOpen(true)} className="btn-primary">
                <FolderPlus className="h-4 w-4" /> Create a project
              </button>
            )}
          />
        </div>
      ) : (
        <>
          <ProjectSwitcher projects={projects} value={projectId} onChange={setProjectId} />

          <div className="card">
            <div className="flex flex-col gap-3 border-b border-border p-3 lg:flex-row lg:items-center lg:justify-between">
              <SearchInput
                value={search}
                onChange={setSearch}
                placeholder="Search work, key or assignee"
                className="lg:w-80"
              />
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowFilters((s) => !s)}
                  aria-expanded={showFilters}
                  className="btn-secondary"
                >
                  <Filter className="h-4 w-4" /> Filter
                  {activeFilterCount > 0 && (
                    <span className="rounded-full bg-primary px-1.5 text-[11px] font-bold text-primary-foreground">
                      {activeFilterCount}
                    </span>
                  )}
                </button>
                <Select value={sort} onChange={(v) => setSort(v)} options={[{ value: 'created_desc', label: `Newest first` }, { value: 'created_asc', label: `Oldest first` }, { value: 'deadline_asc', label: `Deadline (soonest)` }, { value: 'priority_desc', label: `Priority (highest)` }]} ariaLabel="Sort tasks" className="w-44" />
              </div>
            </div>

            {showFilters && (
              <div className="filter-bar grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <div>
                  <label className="label" htmlFor="f-employee">Employee</label>
                  <Select id="f-employee" value={employeeId} onChange={(v) => setEmployeeId(v)} options={[{ value: '', label: `All employees` }, ...members.map((m) => ({ value: String(m.id), label: `${m.name}` }))]} />
                </div>
                <div>
                  <label className="label" htmlFor="f-status">Status</label>
                  <Select id="f-status" value={status} onChange={(v) => setStatus(v)} options={[{ value: '', label: `All statuses` }, { value: 'pending', label: `Pending` }, { value: 'in_progress', label: `In Progress` }, { value: 'completed', label: `Completed` }, { value: 'overdue', label: `Overdue` }]} />
                </div>
                <div>
                  <label className="label" htmlFor="f-priority">Priority</label>
                  <Select id="f-priority" value={priority} onChange={(v) => setPriority(v)} options={[{ value: '', label: `All priorities` }, { value: 'low', label: `Low` }, { value: 'medium', label: `Medium` }, { value: 'high', label: `High` }, { value: 'urgent', label: `Urgent` }]} />
                </div>
                <div>
                  <label className="label" htmlFor="f-from">Assigned from</label>
                  <input id="f-from" type="date" value={assignedFrom} max={assignedTo || undefined} onChange={(e) => setAssignedFrom(e.target.value)} className="input" />
                </div>
                <div>
                  <label className="label" htmlFor="f-to">Assigned to</label>
                  <input id="f-to" type="date" value={assignedTo} min={assignedFrom || undefined} onChange={(e) => setAssignedTo(e.target.value)} className="input" />
                </div>
                <div>
                  <label className="label" htmlFor="f-deadline">Deadline before</label>
                  <input id="f-deadline" type="date" value={deadlineTo} onChange={(e) => setDeadlineTo(e.target.value)} className="input" />
                </div>
                {activeFilterCount > 0 && (
                  <div className="sm:col-span-2 lg:col-span-3">
                    <button type="button" onClick={clearFilters} className="btn-ghost">
                      <X className="h-4 w-4" /> Clear all filters
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Bulk action bar — only present when something is actually selected. */}
            {selected.size > 0 && (
              <div className="flex flex-wrap items-center gap-3 border-b border-border bg-muted px-4 py-2.5">
                <p className="text-sm font-semibold text-foreground">
                  {selected.size} selected
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  {(['pending', 'in_progress', 'completed'] as TaskStatus[]).map((s) => (
                    <button
                      key={s}
                      type="button"
                      disabled={bulkBusy}
                      onClick={() => void bulkStatus(s)}
                      className="btn-secondary btn-sm"
                    >
                      {STATUS_LABEL[s]}
                    </button>
                  ))}
                  <span className="mx-1 h-5 w-px bg-border" aria-hidden />
                  <button
                    type="button"
                    disabled={bulkBusy}
                    onClick={() => setConfirmBulkDelete(true)}
                    className="btn-danger btn-sm"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Delete
                  </button>
                  {bulkBusy && <Spinner className="h-4 w-4 text-primary-strong" />}
                </div>
                <button
                  type="button"
                  onClick={() => setSelected(new Set())}
                  className="ml-auto text-sm font-semibold text-primary-strong hover:text-foreground"
                >
                  Clear selection
                </button>
              </div>
            )}

            {/*
              Every load shows the skeleton, including a project switch or a filter
              change. Keeping the previous rows on screen while new ones were fetched
              meant two different lists were briefly readable in the same place.
              The minimum height matches a populated table, so the card does not
              resize underneath the pointer.
            */}
            {loading ? (
              <LoadingBlock label="Loading tasks" rows={5} className="min-h-[420px]" />
            ) : error ? (
              <ErrorState message={error} onRetry={() => void load()} />
            ) : tasks.length === 0 ? (
              <EmptyState
                icon={<ClipboardList className="h-6 w-6" />}
                title={search || activeFilterCount || projectId ? 'No tasks match these filters' : 'No tasks have been assigned yet.'}
                description={
                  search || activeFilterCount || projectId
                    ? 'Try another project, a wider date range, or clear a filter.'
                    : 'Open a team member from the Team Members page to assign their first task.'
                }
                action={(search || activeFilterCount > 0 || projectId) && (
                  <button
                    type="button"
                    onClick={() => { setSearch(''); clearFilters(); setProjectId(null); }}
                    className="btn-secondary"
                  >
                    Clear filters
                  </button>
                )}
              />
            ) : (
              /*
                Keyed on the project so React replays the fade when the tab changes;
                without the key it would patch the same DOM in place and the switch
                would be instantaneous rather than animated.
              */
              <div key={projectId ?? 'all'} className="fade-in min-h-[420px]">
                <p className="px-4 py-2 text-xs text-muted-foreground">
                  {tasks.length} task{tasks.length === 1 ? '' : 's'}
                </p>
                <TaskTable
                  tasks={tasks}
                  highlightId={highlightId}
                  updatingId={updatingId}
                  onStatusChange={changeStatus}
                  onEdit={setEditTask}
                  onDelete={setConfirmDelete}
                  selectable
                  selected={selected}
                  onSelectedChange={setSelected}
                  linkAssignee
                  rowRef={(id) => (id === highlightId ? (el) => { highlightRef.current = el; } : undefined)}
                />
              </div>
            )}
          </div>
        </>
      )}

      <AssignTaskModal
        open={assignOpen}
        onClose={() => setAssignOpen(false)}
        defaultProjectId={projectId}
        onAssigned={(task) => { setTasks((prev) => [task, ...prev]); void loadProjects(); }}
      />

      <EditProjectModal
        open={editProjectOpen}
        onClose={() => setEditProjectOpen(false)}
        project={activeProject}
        onSaved={(updated) => {
          void loadProjects();
          // An archived project disappears from the switcher, so fall back to All.
          if (updated.is_archived) setProjectId(null);
          // Task keys are composed from the project key, so refresh the rows too.
          void load();
        }}
      />

      <EditTaskModal
        open={!!editTask}
        onClose={() => setEditTask(null)}
        task={editTask}
        onSaved={(updated) => setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)))}
      />

      <CreateProjectModal
        open={createProjectOpen}
        onClose={() => setCreateProjectOpen(false)}
        onCreated={(project) => { void loadProjects(); setProjectId(project.id); }}
      />

      <Modal
        open={confirmBulkDelete}
        onClose={() => setConfirmBulkDelete(false)}
        title={`Delete ${selected.size} task${selected.size === 1 ? '' : 's'}?`}
        description="They are removed from their assignees' lists as well. This cannot be undone."
        size="sm"
        footer={(
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" onClick={() => setConfirmBulkDelete(false)} className="btn-secondary">
              Cancel
            </button>
            <button type="button" onClick={() => void bulkDelete()} disabled={bulkBusy} className="btn-danger">
              <Trash2 className="h-4 w-4" />
              {bulkBusy ? 'Deleting…' : `Delete ${selected.size} task${selected.size === 1 ? '' : 's'}`}
            </button>
          </div>
        )}
      >
        {/* Named rather than counted: deleting the wrong five is easy to do blind. */}
        <ul className="max-h-64 space-y-1.5 overflow-y-auto rounded-lg border border-border bg-muted p-3">
          {tasks.filter((t) => selected.has(t.id)).map((t) => (
            <li key={t.id} className="flex items-baseline gap-2 text-sm">
              {t.task_key && <span className="font-mono text-xs text-muted-foreground">{t.task_key}</span>}
              <span className="min-w-0 truncate text-foreground">{taskLabel(t)}</span>
              <span className="ml-auto shrink-0 text-xs text-muted-foreground">{t.employee_name}</span>
            </li>
          ))}
        </ul>
      </Modal>

      <Modal
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        title="Delete this task?"
        description="This removes it from the employee's list as well. It cannot be undone."
        size="sm"
        footer={(
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" onClick={() => setConfirmDelete(null)} className="btn-secondary">Cancel</button>
            <button type="button" onClick={remove} disabled={deleting} className="btn-danger">
              <Trash2 className="h-4 w-4" /> {deleting ? 'Deleting…' : 'Delete task'}
            </button>
          </div>
        )}
      >
        {confirmDelete && (
          <div className="rounded-lg border border-border bg-muted p-4">
            <p className="font-semibold text-foreground">
              {confirmDelete.task_key && (
                <span className="mr-2 font-mono text-xs text-muted-foreground">{confirmDelete.task_key}</span>
              )}
              {taskLabel(confirmDelete)}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">Assigned to {confirmDelete.employee_name}</p>
          </div>
        )}
      </Modal>
    </div>
  );
}
