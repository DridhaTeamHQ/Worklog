import { useCallback, useEffect, useState } from 'react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  PieChart, Pie, Cell, LineChart, Line,
} from 'recharts';
import { BarChart3, TrendingUp, Users } from 'lucide-react';
import { dashboardApi, teamApi } from '../../api/endpoints';
import { ApiError } from '../../api/client';
import { EmptyState, ErrorState, PageHeader, PageLoader } from '../../components/ui';
import { formatDateShort, todayIso, addDaysIso } from '../../lib/format';
import type { AnalyticsPayload, TeamMember } from '../../types';

/** One colour per status, matching the badges so the charts read the same way. */
const STATUS_COLORS = {
  pending: '#d97706',
  in_progress: '#2563eb',
  completed: '#059669',
  overdue: '#dc2626',
};

export function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsPayload | null>(null);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [departments, setDepartments] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [employeeId, setEmployeeId] = useState('');
  const [department, setDepartment] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [view, setView] = useState<'daily' | 'weekly'>('daily');

  useEffect(() => {
    teamApi.list().then(({ data: d }) => setMembers(d)).catch(() => setMembers([]));
    teamApi.departments().then(({ data: d }) => setDepartments(d)).catch(() => setDepartments([]));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data: payload } = await dashboardApi.analytics({
        employeeId: employeeId ? Number(employeeId) : undefined,
        department: department || undefined,
        from: from || undefined,
        to: to || undefined,
        days: 30,
      });
      setData(payload);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load analytics.');
    } finally {
      setLoading(false);
    }
  }, [employeeId, department, from, to]);

  useEffect(() => { void load(); }, [load]);

  if (loading && !data) return <PageLoader />;
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!data) return null;

  const { summary, productivity, breakdown, daily, weekly } = data;

  const pieData = [
    { name: 'Pending', value: breakdown.pending, color: STATUS_COLORS.pending },
    { name: 'In Progress', value: breakdown.in_progress, color: STATUS_COLORS.in_progress },
    { name: 'Completed', value: breakdown.completed, color: STATUS_COLORS.completed },
    { name: 'Overdue', value: breakdown.overdue, color: STATUS_COLORS.overdue },
  ].filter((slice) => slice.value > 0);

  const trend = view === 'daily'
    ? daily.map((d) => ({ label: formatDateShort(d.day).replace(/,.*/, ''), ...d }))
    : weekly.map((w) => ({ label: `w/c ${formatDateShort(w.week_start).replace(/,.*/, '')}`, ...w }));

  const productivityChart = productivity.map((p) => ({
    ...p,
    // Keep the axis readable when several people share a surname.
    label: p.employee_name.split(' ')[0],
  }));

  const hasTasks = productivity.some((p) => p.assigned > 0);

  return (
    <div className="space-y-6">
      <PageHeader title="Analytics" subtitle="Team productivity and workload over time." />

      <div className="card grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label className="label" htmlFor="a-employee">Employee</label>
          <select id="a-employee" value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} className="input">
            <option value="">All employees</option>
            {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="a-dept">Department</label>
          <select id="a-dept" value={department} onChange={(e) => setDepartment(e.target.value)} className="input">
            <option value="">All departments</option>
            {departments.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="a-from">Assigned from</label>
          <input
            id="a-from"
            type="date"
            value={from}
            max={to || todayIso()}
            onChange={(e) => setFrom(e.target.value)}
            className="input"
          />
        </div>
        <div>
          <label className="label" htmlFor="a-to">Assigned to</label>
          <input
            id="a-to"
            type="date"
            value={to}
            min={from || undefined}
            onChange={(e) => setTo(e.target.value)}
            className="input"
          />
        </div>
        {(employeeId || department || from || to) && (
          <div className="sm:col-span-2 lg:col-span-4">
            <button
              type="button"
              onClick={() => { setEmployeeId(''); setDepartment(''); setFrom(''); setTo(''); }}
              className="btn-ghost"
            >
              Clear filters
            </button>
            <button
              type="button"
              onClick={() => { setFrom(addDaysIso(todayIso(), -30)); setTo(todayIso()); }}
              className="btn-ghost"
            >
              Last 30 days
            </button>
          </div>
        )}
      </div>

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Total tasks', value: summary.total_tasks },
          { label: 'Completed', value: summary.completed_tasks },
          { label: 'Open', value: summary.pending_tasks + summary.in_progress_tasks },
          { label: 'Overdue', value: summary.overdue_tasks },
        ].map((s) => (
          <div key={s.label} className="card p-4">
            <p className="text-sm font-medium text-ink-500">{s.label}</p>
            <p className="mt-1 text-2xl font-bold tabular-nums text-ink-900">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="card p-5 lg:col-span-2">
          <h2 className="font-semibold text-ink-900">Employee productivity</h2>
          <p className="text-xs text-ink-500">Tasks assigned against tasks completed, per person.</p>
          {!hasTasks ? (
            <EmptyState icon={<Users className="h-6 w-6" />} title="No task data for these filters" description="Try widening the date range." />
          ) : (
            <div className="mt-4 h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={productivityChart} margin={{ top: 5, right: 8, left: -18, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} allowDecimals={false} width={40} />
                  <Tooltip contentStyle={{ borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="assigned" name="Assigned" fill="#a5b4fc" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="completed" name="Completed" fill="#059669" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="overdue" name="Overdue" fill="#dc2626" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>

        <section className="card p-5">
          <h2 className="font-semibold text-ink-900">Status breakdown</h2>
          <p className="text-xs text-ink-500">Where all tasks currently stand.</p>
          {pieData.length === 0 ? (
            <EmptyState icon={<BarChart3 className="h-6 w-6" />} title="Nothing to chart yet" />
          ) : (
            <div className="mt-4 h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" innerRadius="55%" outerRadius="80%" paddingAngle={2}>
                    {pieData.map((slice) => <Cell key={slice.name} fill={slice.color} />)}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>
      </div>

      <section className="card p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-semibold text-ink-900">Activity over time</h2>
            <p className="text-xs text-ink-500">
              {view === 'daily' ? 'Last 30 days' : 'Last 8 weeks'} — assignments, completions and reports.
            </p>
          </div>
          <div className="inline-flex gap-1 self-start rounded-lg bg-ink-100 p-1">
            {(['daily', 'weekly'] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setView(v)}
                className={`rounded-md px-3 py-1.5 text-sm font-medium capitalize transition-colors ${
                  view === v ? 'bg-white text-ink-900 shadow-sm' : 'text-ink-600 hover:text-ink-900'
                }`}
              >
                {v}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-4 h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trend} margin={{ top: 5, right: 8, left: -18, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} allowDecimals={false} width={40} />
              <Tooltip contentStyle={{ borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="assigned" name="Assigned" stroke="#6366f1" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="completed" name="Completed" stroke="#059669" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="reports" name="Reports" stroke="#d97706" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="card">
        <header className="flex items-center gap-2 border-b border-ink-200 px-5 py-4">
          <TrendingUp className="h-5 w-5 text-brand-600" aria-hidden />
          <h2 className="font-semibold text-ink-900">Productivity table</h2>
        </header>
        {productivity.length === 0 ? (
          <EmptyState icon={<Users className="h-6 w-6" />} title="No team members match these filters" />
        ) : (
          <div className="table-wrap p-4 sm:p-0">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">Employee</th>
                  <th scope="col">Department</th>
                  <th scope="col" className="text-right">Assigned</th>
                  <th scope="col" className="text-right">Pending</th>
                  <th scope="col" className="text-right">In Progress</th>
                  <th scope="col" className="text-right">Completed</th>
                  <th scope="col" className="text-right">Overdue</th>
                  <th scope="col">Completion rate</th>
                </tr>
              </thead>
              <tbody>
                {productivity.map((p) => (
                  <tr key={p.employee_id} className="hover:bg-ink-50">
                    <td className="font-medium text-ink-900">{p.employee_name}</td>
                    <td className="text-ink-600">{p.department || '—'}</td>
                    <td className="text-right tabular-nums">{p.assigned}</td>
                    <td className="text-right tabular-nums">{p.pending}</td>
                    <td className="text-right tabular-nums">{p.in_progress}</td>
                    <td className="text-right font-semibold tabular-nums text-emerald-700">{p.completed}</td>
                    <td className={`text-right tabular-nums ${p.overdue > 0 ? 'font-semibold text-red-600' : ''}`}>{p.overdue}</td>
                    <td>
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-24 overflow-hidden rounded-full bg-ink-100">
                          <div className="h-full rounded-full bg-emerald-500" style={{ width: `${p.completion_rate}%` }} />
                        </div>
                        <span className="text-xs tabular-nums text-ink-600">{p.completion_rate}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
