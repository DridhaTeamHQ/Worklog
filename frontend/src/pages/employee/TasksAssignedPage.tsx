import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ClipboardList } from 'lucide-react';
import { projectApi, taskApi } from '../../api/endpoints';
import { ApiError } from '../../api/client';
import { useToast } from '../../components/Toast';
import { ProjectSwitcher } from '../../components/ProjectSwitcher';
import { TaskTable } from '../../components/TaskTable';
import { EmptyState, ErrorState, LoadingBlock, PageHeader, SearchInput, Select } from '../../components/ui';
import { STATUS_LABEL } from '../../lib/format';
import type { Project, Task, TaskStatus } from '../../types';

const STATUS_TABS: { value: string; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'overdue', label: 'Overdue' },
];

export function TasksAssignedPage() {
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const highlightId = Number(params.get('highlight')) || null;

  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState<number | null>(
    params.get('projectId') ? Number(params.get('projectId')) : null,
  );
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('deadline_asc');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  /** Every task this employee has, unfiltered — used for the project tab counts. */
  const [allMyTasks, setAllMyTasks] = useState<Task[]>([]);

  const highlightRef = useRef<HTMLTableRowElement | null>(null);

  useEffect(() => {
    projectApi.list().then(({ data }) => setProjects(data)).catch(() => setProjects([]));
    taskApi.list({ limit: 200 }).then(({ data }) => setAllMyTasks(data)).catch(() => setAllMyTasks([]));
  }, []);

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError('');
    try {
      const { data } = await taskApi.list({
        projectId: projectId ?? undefined,
        status: status || undefined,
        search: search || undefined,
        sort,
      }, signal);
      setTasks(data);
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      setError(err instanceof ApiError ? err.message : 'Could not load your tasks.');
    } finally {
      setLoading(false);
    }
  }, [projectId, status, search, sort]);

  // Debounced so typing in the search box does not fire a request per keystroke.
  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => { void load(controller.signal); }, search ? 300 : 0);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [load, search]);

  useEffect(() => {
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      if (projectId) next.set('projectId', String(projectId));
      else next.delete('projectId');
      return next;
    }, { replace: true });
  }, [projectId, setParams]);

  // Arriving from a notification: scroll the task into view, then clear the marker so a
  // later refresh does not keep re-highlighting it.
  useEffect(() => {
    if (!highlightId || loading) return;
    highlightRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const timer = window.setTimeout(() => {
      setParams((prev) => {
        const next = new URLSearchParams(prev);
        next.delete('highlight');
        return next;
      }, { replace: true });
    }, 3000);
    return () => window.clearTimeout(timer);
  }, [highlightId, loading, setParams, tasks.length]);

  const changeStatus = async (task: Task, next: TaskStatus) => {
    if (next === task.status) return;
    setUpdatingId(task.id);
    try {
      const { data } = await taskApi.updateStatus(task.id, next);
      setTasks((prev) => prev.map((t) => (t.id === task.id ? data : t)));
      setAllMyTasks((prev) => prev.map((t) => (t.id === task.id ? data : t)));
      toast.success(`${task.task_key ?? task.title} marked as ${STATUS_LABEL[next]}.`);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not update the task status.');
    } finally {
      setUpdatingId(null);
    }
  };

  const overdueCount = useMemo(
    () => tasks.filter((t) => t.effective_status === 'overdue').length,
    [tasks],
  );

  // Only show projects the employee actually has work in — an empty tab is just noise.
  const myProjects = useMemo(() => {
    const ids = new Set(allMyTasks.map((t) => t.project_id));
    return projects.filter((p) => ids.has(p.id));
  }, [projects, allMyTasks]);

  const countForProject = useCallback(
    (project: Project) => allMyTasks.filter((t) => t.project_id === project.id).length,
    [allMyTasks],
  );

  return (
    <div className="space-y-5">
      <PageHeader
        title="Tasks Assigned"
        subtitle="Everything your manager has assigned to you. Update the status as you go."
      />

      {myProjects.length > 1 && (
        <ProjectSwitcher
          projects={myProjects}
          value={projectId}
          onChange={setProjectId}
          countFor={countForProject}
          totalCount={allMyTasks.length}
        />
      )}

      <div className="card">
        <div className="flex flex-col gap-3 border-b border-border p-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="overflow-x-auto">
            <div
              className="segmented min-w-max"
              role="tablist"
              aria-label="Filter tasks by status"
            >
              {STATUS_TABS.map((tab) => (
                <button
                  key={tab.value || 'all'}
                  type="button"
                  role="tab"
                  aria-selected={status === tab.value}
                  onClick={() => setStatus(tab.value)}
                  className={`segmented-item ${status === tab.value ? 'segmented-item-active' : ''}`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <SearchInput value={search} onChange={setSearch} placeholder="Search work or key" className="sm:w-60" />
            <Select value={sort} onChange={(v) => setSort(v)} options={[{ value: 'deadline_asc', label: `Deadline (soonest)` }, { value: 'deadline_desc', label: `Deadline (latest)` }, { value: 'priority_desc', label: `Priority (highest)` }, { value: 'created_desc', label: `Newest first` }, { value: 'created_asc', label: `Oldest first` }]} ariaLabel="Sort tasks" className="sm:w-44" />
          </div>
        </div>

        {loading ? (
          <LoadingBlock label="Loading your tasks" rows={4} />
        ) : error ? (
          <ErrorState message={error} onRetry={() => void load()} />
        ) : tasks.length === 0 ? (
          <EmptyState
            icon={<ClipboardList className="h-6 w-6" />}
            title={search || status || projectId ? 'No matching tasks' : 'No tasks have been assigned to you yet.'}
            description={
              search || status || projectId
                ? 'Try another project, a different search term, or clear the status filter.'
                : 'When your manager assigns you work, it will show up here and you will get a notification.'
            }
            action={(search || status || projectId) && (
              <button
                type="button"
                onClick={() => { setSearch(''); setStatus(''); setProjectId(null); }}
                className="btn-secondary"
              >
                Clear filters
              </button>
            )}
          />
        ) : (
          <>
            <p className="px-4 py-2 text-xs text-muted-foreground">
              Showing {tasks.length} task{tasks.length === 1 ? '' : 's'}
              {overdueCount > 0 && <span className="font-semibold text-destructive"> · {overdueCount} overdue</span>}
            </p>
            <TaskTable
              tasks={tasks}
              highlightId={highlightId}
              updatingId={updatingId}
              onStatusChange={changeStatus}
              showAssignee={false}
              rowRef={(id) => (id === highlightId ? (el) => { highlightRef.current = el; } : undefined)}
            />
          </>
        )}
      </div>
    </div>
  );
}
