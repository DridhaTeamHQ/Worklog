import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Users, Eye, CheckCircle2, Clock, UserPlus, ShieldCheck, ShieldPlus } from 'lucide-react';
import { adminApi, teamApi } from '../../api/endpoints';
import { ApiError } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import { Avatar, EmptyState, ErrorState, LoadingBlock, PageHeader, SearchInput } from '../../components/ui';
import { StatusBadge } from '../../components/Badges';
import { AddUserModal } from '../../components/AddUserModal';
import { formatDate, formatDateShort } from '../../lib/format';
import type { Manager, Role, TeamMember } from '../../types';
import { isAdmin, roleLabel } from '../../types';

type Tab = 'team' | 'admins';

export function TeamMembersPage() {
  const { user } = useAuth();

  const [tab, setTab] = useState<Tab>('team');
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [admins, setAdmins] = useState<Manager[]>([]);
  const [departments, setDepartments] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [department, setDepartment] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  /** Which kind of account the modal is creating, or null when it is closed. */
  const [addingRole, setAddingRole] = useState<Role | null>(null);

  // Mirrors the server rule in backend/src/utils/roles.js: only an admin mints admins.
  const canGrantAdmin = isAdmin(user?.role);

  const loadDepartments = useCallback(() => {
    teamApi.departments().then(({ data }) => setDepartments(data)).catch(() => setDepartments([]));
  }, []);

  useEffect(() => { loadDepartments(); }, [loadDepartments]);

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError('');
    try {
      if (tab === 'team') {
        const { data } = await teamApi.list(
          { search: search || undefined, department: department || undefined },
          signal,
        );
        setMembers(data);
      } else {
        const { data } = await adminApi.list({ search: search || undefined }, signal);
        setAdmins(data);
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      setError(err instanceof ApiError ? err.message : 'Could not load the list.');
    } finally {
      setLoading(false);
    }
  }, [tab, search, department]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => { void load(controller.signal); }, search ? 300 : 0);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [load, search]);

  // Both counts should stay current whichever tab is showing.
  const reloadBoth = useCallback(() => {
    void load();
    loadDepartments();
    if (tab === 'team') adminApi.list().then(({ data }) => setAdmins(data)).catch(() => {});
    else teamApi.list().then(({ data }) => setMembers(data)).catch(() => {});
  }, [load, loadDepartments, tab]);

  useEffect(() => {
    // Prime the other tab's count once on mount.
    adminApi.list().then(({ data }) => setAdmins(data)).catch(() => setAdmins([]));
  }, []);

  const isTeam = tab === 'team';
  const filtered = Boolean(search || (isTeam && department));

  return (
    <div className="space-y-6">
      <PageHeader
        title={isTeam ? 'Team Members' : 'Admins'}
        subtitle={isTeam
          ? 'Everyone on the team, with their current workload at a glance.'
          : 'Admins and managers who can sign in to this portal.'}
        actions={isTeam ? (
          <button type="button" onClick={() => setAddingRole('team_member')} className="btn-primary">
            <UserPlus className="h-4 w-4" /> Add team member
          </button>
        ) : (
          <span className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => setAddingRole('manager')} className="btn-secondary">
              <ShieldPlus className="h-4 w-4" /> Add manager
            </button>
            {/* Only an admin can grant admin access, so only an admin is offered it. */}
            {canGrantAdmin && (
              <button type="button" onClick={() => setAddingRole('admin')} className="btn-primary">
                <ShieldPlus className="h-4 w-4" /> Add admin
              </button>
            )}
          </span>
        )}
      />

      <div className="flex gap-1" role="tablist" aria-label="People">
        {([
          { key: 'team' as const, label: 'Team Members', icon: <Users className="h-4 w-4" />, count: members.length },
          { key: 'admins' as const, label: 'Admins', icon: <ShieldCheck className="h-4 w-4" />, count: admins.length },
        ]).map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => { setTab(t.key); setSearch(''); setDepartment(''); }}
            className={`flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold transition-colors ${
              tab === t.key
                ? 'border-brand-600 bg-brand-600 text-white'
                : 'border-ink-300 bg-white text-ink-700 hover:border-ink-400 hover:bg-ink-50'
            }`}
          >
            {t.icon}
            {t.label}
            <span className={`rounded-full px-1.5 text-[11px] tabular-nums ${
              tab === t.key ? 'bg-white/20 text-white' : 'bg-ink-100 text-ink-600'
            }`}
            >
              {t.count}
            </span>
          </button>
        ))}
      </div>

      <div className="card">
        <div className="flex flex-col gap-3 border-b border-ink-200 p-4 sm:flex-row sm:items-center sm:justify-between">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder={isTeam ? 'Search by name, email or department' : 'Search admins'}
            className="sm:w-80"
          />
          {isTeam && (
            <select
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              aria-label="Filter by department"
              className="input sm:w-52"
            >
              <option value="">All departments</option>
              {departments.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          )}
        </div>

        {loading ? (
          <LoadingBlock label="Loading" rows={4} />
        ) : error ? (
          <ErrorState message={error} onRetry={() => void load()} />
        ) : isTeam ? (
          members.length === 0 ? (
            <EmptyState
              icon={<Users className="h-6 w-6" />}
              title={filtered ? 'No matching team members' : 'No team members found.'}
              description={
                filtered
                  ? 'Try a different search term or clear the department filter.'
                  : 'Add your first team member so they can start receiving tasks.'
              }
              action={filtered ? (
                <button type="button" onClick={() => { setSearch(''); setDepartment(''); }} className="btn-secondary">
                  Clear filters
                </button>
              ) : (
                <button type="button" onClick={() => setAddingRole('team_member')} className="btn-primary">
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
          )
        ) : admins.length === 0 ? (
          <EmptyState
            icon={<ShieldCheck className="h-6 w-6" />}
            title={filtered ? 'No matching admins' : 'No admins found.'}
            description={filtered ? 'Try a different search term.' : 'Add someone who should reach this portal.'}
            action={filtered ? (
              <button type="button" onClick={() => setSearch('')} className="btn-secondary">Clear search</button>
            ) : (
              <button type="button" onClick={() => setAddingRole(canGrantAdmin ? 'admin' : 'manager')} className="btn-primary">
                <ShieldPlus className="h-4 w-4" /> {canGrantAdmin ? 'Add admin' : 'Add manager'}
              </button>
            )}
          />
        ) : (
          <>
            <div className="table-wrap p-4 sm:p-0">
              <table className="table">
                <thead>
                  <tr>
                    <th scope="col">Name</th>
                    <th scope="col">Role</th>
                    <th scope="col">Department</th>
                    <th scope="col">Job title</th>
                    <th scope="col" className="text-right">Tasks assigned</th>
                    <th scope="col" className="text-right">Still open</th>
                    <th scope="col">Added</th>
                  </tr>
                </thead>
                <tbody>
                  {admins.map((a) => (
                    <tr key={a.id} className="hover:bg-ink-50">
                      <td>
                        <span className="flex items-center gap-3">
                          <Avatar name={a.name} src={a.profile_image} />
                          <span className="min-w-0">
                            <span className="flex items-center gap-2">
                              <span className="truncate font-semibold text-ink-900">{a.name}</span>
                              {a.id === user?.id && (
                                <span className="badge border-brand-200 bg-brand-50 text-brand-700">You</span>
                              )}
                            </span>
                            <span className="block truncate text-xs text-ink-500">{a.email}</span>
                          </span>
                        </span>
                      </td>
                      <td>
                        <span className={a.role === 'admin'
                          ? 'badge border-violet-200 bg-violet-50 text-violet-700'
                          : 'badge border-ink-200 bg-ink-50 text-ink-600'}>
                          {roleLabel(a.role)}
                        </span>
                      </td>
                      <td className="text-ink-600">{a.department || '—'}</td>
                      <td className="text-ink-600">{a.job_title || '—'}</td>
                      <td className="text-right font-semibold tabular-nums text-ink-900">{a.assigned_tasks}</td>
                      <td className="text-right tabular-nums text-ink-600">{a.open_tasks}</td>
                      <td className="whitespace-nowrap text-xs text-ink-500">{formatDate(a.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="border-t border-ink-100 px-4 py-3 text-xs text-ink-500">
              Everyone listed here reaches this portal. <strong>Admins</strong> hold every
              manager right and are the only role that can grant admin access.{' '}
              <strong>Managers</strong> can add further managers and team members, but
              cannot create admins.
            </p>
          </>
        )}
      </div>

      <AddUserModal
        open={addingRole !== null}
        role={addingRole ?? 'team_member'}
        onClose={() => setAddingRole(null)}
        departments={departments}
        onCreated={reloadBoth}
      />
    </div>
  );
}
