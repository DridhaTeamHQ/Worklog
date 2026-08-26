import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Users, Eye, CheckCircle2, Clock, UserPlus } from 'lucide-react';
import { teamApi } from '../../api/endpoints';
import { ApiError } from '../../api/client';
import { Avatar, EmptyState, ErrorState, LoadingBlock, PageHeader, SearchInput } from '../../components/ui';
import { StatusBadge } from '../../components/Badges';
import { AddTeamMemberModal } from '../../components/AddTeamMemberModal';
import { formatDateShort } from '../../lib/format';
import type { TeamMember } from '../../types';

export function TeamMembersPage() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [departments, setDepartments] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [department, setDepartment] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [addOpen, setAddOpen] = useState(false);

  const loadDepartments = useCallback(() => {
    teamApi.departments().then(({ data }) => setDepartments(data)).catch(() => setDepartments([]));
  }, []);

  useEffect(() => { loadDepartments(); }, [loadDepartments]);

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError('');
    try {
      const { data } = await teamApi.list({ search: search || undefined, department: department || undefined }, signal);
      setMembers(data);
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      setError(err instanceof ApiError ? err.message : 'Could not load the team.');
    } finally {
      setLoading(false);
    }
  }, [search, department]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => { void load(controller.signal); }, search ? 300 : 0);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [load, search]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Team Members"
        subtitle="Everyone on the team, with their current workload at a glance."
        actions={(
          <button type="button" onClick={() => setAddOpen(true)} className="btn-primary">
            <UserPlus className="h-4 w-4" /> Add team member
          </button>
        )}
      />

      <div className="card">
        <div className="flex flex-col gap-3 border-b border-ink-200 p-4 sm:flex-row sm:items-center sm:justify-between">
          <SearchInput value={search} onChange={setSearch} placeholder="Search by name, email or department" className="sm:w-80" />
          <select
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            aria-label="Filter by department"
            className="input sm:w-52"
          >
            <option value="">All departments</option>
            {departments.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>

        {loading ? (
          <LoadingBlock label="Loading team members" rows={4} />
        ) : error ? (
          <ErrorState message={error} onRetry={() => void load()} />
        ) : members.length === 0 ? (
          <EmptyState
            icon={<Users className="h-6 w-6" />}
            title={search || department ? 'No matching team members' : 'No team members found.'}
            description={
              search || department
                ? 'Try a different search term or clear the department filter.'
                : 'Once employee accounts exist, they will be listed here.'
            }
            action={(search || department) ? (
              <button type="button" onClick={() => { setSearch(''); setDepartment(''); }} className="btn-secondary">
                Clear filters
              </button>
            ) : (
              <button type="button" onClick={() => setAddOpen(true)} className="btn-primary">
                <UserPlus className="h-4 w-4" /> Add team member
              </button>
            )}
          />
        ) : (
          <div className="table-wrap p-4 sm:p-0">
            <table className="table">
              <thead>
                <tr>
                  <th scope="col">Employee</th>
                  <th scope="col">Department</th>
                  <th scope="col">Current status</th>
                  <th scope="col" className="text-right">Pending</th>
                  <th scope="col" className="text-right">Completed</th>
                  <th scope="col">Today's report</th>
                  <th scope="col" className="text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {members.map((m) => (
                  <tr key={m.id} className="hover:bg-ink-50">
                    <td>
                      <Link to={`/manager/team/${m.id}`} className="flex items-center gap-3 group">
                        <Avatar name={m.name} src={m.profile_image} />
                        <span className="min-w-0">
                          <span className="block truncate font-semibold text-ink-900 group-hover:text-brand-600">{m.name}</span>
                          <span className="block truncate text-xs text-ink-500">{m.email}</span>
                        </span>
                      </Link>
                    </td>
                    <td className="text-ink-600">{m.department || '—'}</td>
                    <td><StatusBadge status={m.current_status} /></td>
                    <td className="text-right font-semibold tabular-nums text-ink-900">{m.counts.pending}</td>
                    <td className="text-right font-semibold tabular-nums text-ink-900">{m.counts.completed}</td>
                    <td>
                      {m.submitted_today ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700">
                          <CheckCircle2 className="h-3.5 w-3.5" aria-hidden /> Submitted
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-700">
                          <Clock className="h-3.5 w-3.5" aria-hidden />
                          {m.last_report_date ? `Last ${formatDateShort(m.last_report_date)}` : 'None yet'}
                        </span>
                      )}
                    </td>
                    <td className="text-right">
                      <Link to={`/manager/team/${m.id}`} className="btn-secondary btn-sm">
                        <Eye className="h-3.5 w-3.5" /> View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <AddTeamMemberModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        departments={departments}
        onCreated={() => { void load(); loadDepartments(); }}
      />
    </div>
  );
}
