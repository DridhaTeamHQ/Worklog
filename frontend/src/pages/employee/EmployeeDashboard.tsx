import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowRight, CheckCircle2, Clock3, ListTodo, Loader2 } from 'lucide-react';
import { dashboardApi, taskApi } from '../../api/endpoints';
import { useAuth } from '../../context/AuthContext';
import { ApiError } from '../../api/client';
import { EmptyState, ErrorState, PageLoader } from '../../components/ui';
import { formatDate } from '../../lib/format';
import type { EmployeeDashboard as DashboardData, Task } from '../../types';

export function EmployeeDashboard() {
  const { user } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [completed, setCompleted] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [dashboard, done] = await Promise.all([dashboardApi.load(), taskApi.list({ status: 'completed', sort: 'created_desc', limit: 3 })]);
      setData(dashboard.data as DashboardData); setCompleted(done.data.slice(0, 3));
    } catch (err) { setError(err instanceof ApiError ? err.message : 'Could not load your home page.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  if (loading) return <PageLoader />;
  if (!data) return <ErrorState message={error || 'No data available.'} onRetry={load} />;
  const { summary, upcoming_tasks } = data;
  const stats = [
    { label: 'My tasks', value: summary.total_tasks, icon: <ListTodo />, tone: 'brand', href: '/employee/tasks-assigned' },
    { label: 'Completed', value: summary.completed_tasks, icon: <CheckCircle2 />, tone: 'success', href: '/employee/tasks-assigned?status=completed' },
    { label: 'In progress', value: summary.in_progress_tasks, icon: <Loader2 />, tone: 'info', href: '/employee/tasks-assigned?status=in_progress' },
    { label: 'Overdue', value: summary.overdue_tasks, icon: <AlertTriangle />, tone: 'danger', href: '/employee/tasks-assigned?status=overdue' },
  ];
  return <div className="space-y-7">
    <div className="flex items-end justify-between gap-4"><div><p className="text-sm font-medium text-primary-strong">{formatDate(new Date().toISOString())}</p><h1 className="display-title mt-1 text-3xl text-foreground sm:text-4xl">Good morning, {user?.name.split(' ')[0]}</h1><p className="mt-2 text-sm text-muted-foreground">Here’s your work at a glance.</p></div><Link to="/employee/tasks-assigned" className="btn-secondary hidden sm:inline-flex">View all tasks <ArrowRight className="h-4 w-4" /></Link></div>
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{stats.map((s) => <Link key={s.label} to={s.href} className="card card-hover p-4"><span className={`inline-flex h-9 w-9 items-center justify-center rounded-lg ${s.tone === 'danger' ? 'bg-destructive/10 text-destructive' : s.tone === 'success' ? 'bg-success/10 text-success' : s.tone === 'info' ? 'bg-info/10 text-info' : 'bg-primary/10 text-primary-strong'}`}>{s.icon}</span><p className="mt-4 text-sm text-muted-foreground">{s.label}</p><p className="mt-1 text-3xl font-bold text-foreground">{s.value}</p></Link>)}</div>
    <div className="grid gap-5 lg:grid-cols-2">
      <section className="card"><header className="flex items-center justify-between border-b border-border px-5 py-4"><div><h2 className="font-semibold text-foreground">Latest tasks</h2><p className="text-xs text-muted-foreground">Your next three items</p></div><Clock3 className="h-5 w-5 text-muted-foreground" /></header>{upcoming_tasks.length ? <ul className="divide-y divide-border">{upcoming_tasks.slice(0, 3).map((task) => <li key={task.id}><Link to={`/employee/tasks-assigned?highlight=${task.id}`} className="flex items-center gap-3 px-5 py-4 hover:bg-muted"><span className="min-w-0 flex-1"><span className="block truncate font-medium text-foreground">{task.title}</span><span className="mt-1 block text-xs text-muted-foreground">{task.deadline ? `Due ${formatDate(task.deadline)}` : 'No deadline'}</span></span><span className="badge bg-muted text-muted-foreground">{task.effective_status === 'overdue' ? 'Overdue' : task.status === 'in_progress' ? 'In progress' : 'New'}</span></Link></li>)}</ul> : <EmptyState title="No active tasks" description="New work assigned to you will appear here." />}</section>
      <section className="card"><header className="flex items-center justify-between border-b border-border px-5 py-4"><div><h2 className="font-semibold text-foreground">Last completed</h2><p className="text-xs text-muted-foreground">Your most recent wins</p></div><CheckCircle2 className="h-5 w-5 text-success" /></header>{completed.length ? <ul className="divide-y divide-border">{completed.map((task) => <li key={task.id} className="flex items-center gap-3 px-5 py-4"><span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-success/10 text-success"><CheckCircle2 className="h-4 w-4" /></span><span className="min-w-0 flex-1"><span className="block truncate font-medium text-foreground">{task.title}</span><span className="mt-1 block text-xs text-muted-foreground">Completed {task.completed_at ? formatDate(task.completed_at) : 'recently'}</span></span></li>)}</ul> : <EmptyState title="Nothing completed yet" description="Completed tasks will be listed here." />}</section>
    </div>{error && <p className="text-sm text-destructive">{error}</p>}
  </div>;
}

