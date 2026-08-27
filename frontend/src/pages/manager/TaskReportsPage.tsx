import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FileText, CheckCircle2, Search } from 'lucide-react';
import { reportApi, teamApi } from '../../api/endpoints';
import { useAuth } from '../../context/AuthContext';
import { ApiError } from '../../api/client';
import { Avatar, EmptyState, ErrorState, LoadingBlock, PageHeader, SearchInput } from '../../components/ui';
import { formatDate, formatTime, reportLines, todayIso } from '../../lib/format';
import type { DailyReport, TeamMember } from '../../types';
import { isAdmin } from '../../types';

type RangeKey = 'all' | 'today' | 'week' | 'month' | 'custom';

const RANGES: { value: RangeKey; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This week' },
  { value: 'month', label: 'This month' },
  { value: 'all', label: 'All time' },
  { value: 'custom', label: 'Custom range' },
];

/** Company-wide view of every daily report, grouped by date. */
export function TaskReportsPage() {
  const { user } = useAuth();
  /** Only an admin spans more than one department, so only they get the filter. */
  const canSeeAllDepartments = isAdmin(user?.role);
  const [reports, setReports] = useState<DailyReport[]>([]);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [departments, setDepartments] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [range, setRange] = useState<RangeKey>('week');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState(todayIso());
  const [employeeId, setEmployeeId] = useState('');
  const [department, setDepartment] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    teamApi.list().then(({ data }) => setMembers(data)).catch(() => setMembers([]));
    teamApi.departments().then(({ data }) => setDepartments(data)).catch(() => setDepartments([]));
  }, []);

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError('');
    try {
      const { data } = await reportApi.list({
        range: range === 'all' ? undefined : range,
        from: range === 'custom' ? from || undefined : undefined,
        to: range === 'custom' ? to || undefined : undefined,
        employeeId: employeeId ? Number(employeeId) : undefined,
        department: department || undefined,
        search: search || undefined,
        limit: 200,
      }, signal);
      setReports(data);
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      setError(err instanceof ApiError ? err.message : 'Could not load reports.');
    } finally {
      setLoading(false);
    }
  }, [range, from, to, employeeId, department, search]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => { void load(controller.signal); }, search ? 300 : 0);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [load, search]);

  // Group by date so the page reads as a company-wide daily log.
  const grouped = reports.reduce<Record<string, DailyReport[]>>((acc, report) => {
    (acc[report.report_date] ||= []).push(report);
    return acc;
  }, {});
  const dates = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

  const hasFilters = Boolean(search || employeeId || department || range !== 'week');

  return (
    <div className="space-y-6">
      <PageHeader title="Task Reports" subtitle="Daily work reports submitted across the company." />

      <div className="card">
        <div className="flex flex-col gap-3 border-b border-ink-200 p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="table-wrap sm:overflow-visible">
            <div className="flex min-w-max gap-1 rounded-lg bg-ink-100 p-1">
              {RANGES.map((r) => (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => setRange(r.value)}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                    range === r.value ? 'bg-white text-ink-900 shadow-sm' : 'text-ink-600 hover:text-ink-900'
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>
          <SearchInput value={search} onChange={setSearch} placeholder="Search report text or employee" className="lg:w-72" />
        </div>

        <div className="grid gap-4 border-b border-ink-200 bg-ink-50 p-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="label" htmlFor="rp-employee">Employee</label>
            <select id="rp-employee" value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} className="input">
              <option value="">All employees</option>
              {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
          {/* One department for a manager, so nothing to filter by. */}
          {canSeeAllDepartments && (
            <div>
              <label className="label" htmlFor="rp-dept">Department</label>
              <select id="rp-dept" value={department} onChange={(e) => setDepartment(e.target.value)} className="input">
                <option value="">All departments</option>
                {departments.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
          )}
          {range === 'custom' && (
            <>
              <div>
                <label className="label" htmlFor="rp-from">From</label>
                <input id="rp-from" type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} className="input" />
              </div>
              <div>
                <label className="label" htmlFor="rp-to">To</label>
                <input id="rp-to" type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} className="input" />
              </div>
            </>
          )}
        </div>

        {loading ? (
          <LoadingBlock label="Loading reports" rows={4} />
        ) : error ? (
          <ErrorState message={error} onRetry={() => void load()} />
        ) : reports.length === 0 ? (
          <EmptyState
            icon={search ? <Search className="h-6 w-6" /> : <FileText className="h-6 w-6" />}
            title={hasFilters ? 'No reports match these filters' : 'No reports submitted yet'}
            description={
              hasFilters
                ? 'Try a wider date range, a different employee, or clear the search.'
                : 'Daily reports from your team will appear here as they are submitted.'
            }
            action={hasFilters && (
              <button
                type="button"
                onClick={() => { setSearch(''); setEmployeeId(''); setDepartment(''); setRange('week'); }}
                className="btn-secondary"
              >
                Clear filters
              </button>
            )}
          />
        ) : (
          <div className="divide-y divide-ink-200">
            {dates.map((date) => (
              <section key={date}>
                <h2 className="sticky top-16 z-10 border-b border-ink-200 bg-ink-50/95 px-5 py-2.5 text-sm font-semibold text-ink-800 backdrop-blur">
                  {formatDate(date)}
                  <span className="ml-2 font-normal text-ink-500">
                    · {grouped[date].length} report{grouped[date].length === 1 ? '' : 's'}
                  </span>
                </h2>
                <ul className="divide-y divide-ink-100">
                  {grouped[date].map((report) => (
                    <li key={report.id} className="flex gap-4 px-5 py-4">
                      <Avatar name={report.employee_name} size="md" />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                          <Link
                            to={`/manager/team/${report.employee_id}`}
                            className="font-semibold text-ink-900 hover:text-brand-600"
                          >
                            {report.employee_name}
                          </Link>
                          <p className="text-xs text-ink-400">
                            {report.employee_department || '—'} · submitted {formatTime(report.created_at)}
                            {report.updated_at !== report.created_at && ` · edited ${formatTime(report.updated_at)}`}
                          </p>
                        </div>
                        <ul className="mt-2 space-y-1.5">
                          {reportLines(report.task_description).map((line, i) => (
                            <li key={i} className="flex items-start gap-2.5 text-sm text-ink-700">
                              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" aria-hidden />
                              <span className="min-w-0">{line}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
