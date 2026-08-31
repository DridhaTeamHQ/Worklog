import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Users, Eye, Pencil, CheckCircle2, Clock, UserPlus, ShieldCheck, ShieldPlus, Trash2, AlertTriangle,
} from 'lucide-react';
import { adminApi, teamApi } from '../../api/endpoints';
import { ApiError } from '../../api/client';
import { useAuth } from '../../context/AuthContext';
import {
  Avatar, EmptyState, ErrorState, LoadingBlock, Modal, PageHeader, SearchInput, Spinner, Select,
} from '../../components/ui';
import { StatusBadge } from '../../components/Badges';
import { AddUserModal } from '../../components/AddUserModal';
import { EditTeamMemberModal } from '../../components/EditTeamMemberModal';
import { useToast } from '../../components/Toast';
import { formatDate, formatDateShort } from '../../lib/format';
import { chipTint } from '../../lib/tints';
import type { Manager, Role, TeamMember } from '../../types';
import { isAdmin, roleLabel } from '../../types';

type Tab = 'team' | 'admins';

export function TeamMembersPage() {
  const { user } = useAuth();
  const toast = useToast();

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

  /** The member being edited, or null when that modal is closed. */
  const [editing, setEditing] = useState<TeamMember | null>(null);

  /** The member awaiting delete confirmation, or null when nothing is pending. */
  const [confirmRemove, setConfirmRemove] = useState<TeamMember | null>(null);
  /** The manager-level account awaiting delete confirmation. */
  const [confirmRemoveAdmin, setConfirmRemoveAdmin] = useState<Manager | null>(null);
  const [removing, setRemoving] = useState(false);

  /*
   * Mirrors the server rules in backend/src/utils/roles.js and the route guards, so
   * nothing on screen can produce a request the API would refuse.
   *
   * Only an admin administers accounts: creating people, removing them, and seeing who
   * holds elevated access. A manager runs one department — they assign its work, read
   * its reports and triage its tickets — and the roster they see is confined to it, so
   * the department filter and the department column have nothing left to say.
   */
  const canAdminister = isAdmin(user?.role);

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
    // Same reason as the other list pages: the debounce must not leave the previous
    // tab's rows on screen after the tab has changed.
    setLoading(true);
    const controller = new AbortController();
    const timer = window.setTimeout(() => { void load(controller.signal); }, search ? 300 : 0);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [load, search]);

  // Both counts should stay current whichever tab is showing.
  const reloadBoth = useCallback(() => {
    void load();
    loadDepartments();
    if (!canAdminister) return;
    if (tab === 'team') adminApi.list().then(({ data }) => setAdmins(data)).catch(() => {});
    else teamApi.list().then(({ data }) => setMembers(data)).catch(() => {});
  }, [load, loadDepartments, tab, canAdminister]);

  useEffect(() => {
    // Prime the other tab's count once on mount. A manager has no other tab, and the
    // endpoint would refuse them anyway, so this is skipped rather than swallowed.
    if (!canAdminister) return;
    adminApi.list().then(({ data }) => setAdmins(data)).catch(() => setAdmins([]));
  }, [canAdminister]);

  /**
   * Removes a team member for good. The server reports what went with them, and that
   * message is what the admin is shown — a bare "deleted" would understate it.
   */
  const removeMember = async () => {
    if (!confirmRemove) return;
    setRemoving(true);
    try {
      const { data } = await teamApi.remove(confirmRemove.id);
      setMembers((prev) => prev.filter((m) => m.id !== confirmRemove.id));
      toast.success(data.message);
      setConfirmRemove(null);
      loadDepartments();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not remove that team member.');
    } finally {
      setRemoving(false);
    }
  };

  /**
   * Closes a manager-level account. The server moves anything they had assigned to the
   * signed-in admin, and its message reports how many moved — which is what gets shown,
   * because "removed" alone would not mention that work changed hands.
   */
  const removeAdmin = async () => {
    if (!confirmRemoveAdmin) return;
    setRemoving(true);
    try {
      const { data } = await adminApi.remove(confirmRemoveAdmin.id);
      setAdmins((prev) => prev.filter((a) => a.id !== confirmRemoveAdmin.id));
      toast.success(data.message);
      setConfirmRemoveAdmin(null);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not remove that account.');
    } finally {
      setRemoving(false);
    }
  };

  // A manager has no Admins tab to switch to, so the team view is the only one.
  const isTeam = tab === 'team' || !canAdminister;
  const filtered = Boolean(search || (isTeam && department));

  return (
    <div className="space-y-6">
      <PageHeader
        title={isTeam ? 'Team Members' : 'Admins'}
        subtitle={isTeam
          ? canAdminister
            ? 'Everyone on the team, with their current workload at a glance.'
            : `Your department${user?.department ? ` — ${user.department}` : ''}, with each person's current workload.`
          : 'Admins and managers who can sign in to this portal.'}
        actions={!canAdminister ? undefined : isTeam ? (
          <button type="button" onClick={() => setAddingRole('team_member')} className="btn-primary">
            <UserPlus className="h-4 w-4" /> Add team member
          </button>
        ) : (
          <span className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => setAddingRole('manager')} className="btn-secondary">
              <ShieldPlus className="h-4 w-4" /> Add manager
            </button>
            <button type="button" onClick={() => setAddingRole('admin')} className="btn-primary">
              <ShieldPlus className="h-4 w-4" /> Add admin
            </button>
          </span>
        )}
      />

      {/* The Admins list is administration, so a manager is not offered the tab at all. */}
      {canAdminister && (
        <div className="flex gap-1" role="tablist" aria-label="People">
          {([
            { key: 'team' as const, label: 'Team Members', icon: <Users className="h-4 w-4" />, count: members.length },
            { key: 'admins' as const, label: 'Admins', icon: <ShieldCheck className="h-4 w-4" />, count: admins.length },
          ]).map((t, i) => (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={tab === t.key}
              onClick={() => { setTab(t.key); setSearch(''); setDepartment(''); }}
              className={`flex items-center gap-2 rounded-xl border px-4 py-2 text-sm font-semibold
                transition-all duration-200 ease-out active:scale-[0.97] ${chipTint(i, tab === t.key)}`}
            >
              {t.icon}
              {t.label}
              <span className={`rounded-full bg-white/70 px-1.5 text-[11px] tabular-nums ${
                tab === t.key ? '' : 'opacity-80'
              }`}
              >
                {t.count}
              </span>
            </button>
          ))}
        </div>
      )}

      <div className="card">
        <div className="flex flex-col gap-3 border-b border-ink-200 p-4 sm:flex-row sm:items-center sm:justify-between">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder={isTeam ? 'Search by name or email' : 'Search admins'}
            className="sm:w-80"
          />
          {/*
            Only an admin spans more than one department, so only an admin has anything
            to filter by. A manager's roster is already confined to theirs by the server.
          */}
          {isTeam && canAdminister && (
            <Select value={department} onChange={(v) => setDepartment(v)} options={[{ value: '', label: `All departments` }, ...departments.map((d) => ({ value: String(d), label: `${d}` }))]} ariaLabel="Filter by department" className="sm:w-52" />
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
                  ? 'Try a different search term.'
                  : canAdminister
                    ? 'Add your first team member so they can start receiving tasks.'
                    : user?.department
                      ? `Nobody has been added to ${user.department} yet. An admin can add people to your department.`
                      : 'Your account has no department set, so there is no team to show. Ask an admin to set one.'
              }
              action={filtered ? (
                <button type="button" onClick={() => { setSearch(''); setDepartment(''); }} className="btn-secondary">
                  Clear filters
                </button>
              ) : canAdminister ? (
                <button type="button" onClick={() => setAddingRole('team_member')} className="btn-primary">
                  <UserPlus className="h-4 w-4" /> Add team member
                </button>
              ) : undefined}
            />
          ) : (
            <div className="table-wrap p-4 sm:p-0">
              <table className="table">
                <thead>
                  <tr>
                    <th scope="col">Employee</th>
                    <th scope="col">Current status</th>
                    <th scope="col" className="text-right">Pending</th>
                    <th scope="col" className="text-right">Completed</th>
                    <th scope="col">Today's report</th>
                    <th scope="col" className="text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {members.map((m) => (
                    <tr key={m.id}>
                      <td>
                        <Link to={`/manager/team/${m.id}`} className="flex items-center gap-3 group">
                          <Avatar name={m.name} src={m.profile_image} />
                          <span className="min-w-0">
                            <span className="flex items-center gap-2">
                              <span className="truncate font-semibold text-ink-900 group-hover:text-brand-600">{m.name}</span>
                              {/* Until they claim the invite they have no password and
                                  have never signed in — worth seeing at a glance. */}
                              {m.invited && (
                                <span className="badge shrink-0 border-amber-200 bg-amber-50 text-amber-700">Invited</span>
                              )}
                            </span>
                            {/*
                              Department sits under the name rather than in a column of
                              its own — it identifies the person, it is not something
                              the table is scanned by.
                            */}
                            <span className="block truncate text-xs text-ink-500">
                              {m.email}
                              {m.department && <span className="text-ink-400"> · {m.department}</span>}
                            </span>
                          </span>
                        </Link>
                      </td>
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
                        <div className="flex items-center justify-end gap-1.5">
                          <Link to={`/manager/team/${m.id}`} className="btn-secondary btn-sm">
                            <Eye className="h-3.5 w-3.5" /> View
                          </Link>
                          {/* Editing and removing an account are both administration,
                              like creating one, so they travel with the same right. */}
                          {canAdminister && (
                            <button
                              type="button"
                              onClick={() => setEditing(m)}
                              aria-label={`Edit ${m.name}`}
                              title={`Edit ${m.name}`}
                              className="rounded-md p-1.5 text-ink-400 hover:bg-brand-50 hover:text-brand-600"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                          )}
                          {canAdminister && (
                            <button
                              type="button"
                              onClick={() => setConfirmRemove(m)}
                              aria-label={`Remove ${m.name}`}
                              title={`Remove ${m.name}`}
                              className="rounded-md p-1.5 text-ink-400 hover:bg-red-50 hover:text-red-600"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
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
              <button type="button" onClick={() => setAddingRole('admin')} className="btn-primary">
                <ShieldPlus className="h-4 w-4" /> Add admin
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
                    <th scope="col">Job title</th>
                    <th scope="col" className="text-right">Tasks assigned</th>
                    <th scope="col" className="text-right">Still open</th>
                    <th scope="col">Added</th>
                    <th scope="col" className="text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {admins.map((a) => (
                    <tr key={a.id}>
                      <td>
                        <span className="flex items-center gap-3">
                          <Avatar name={a.name} src={a.profile_image} />
                          <span className="min-w-0">
                            <span className="flex items-center gap-2">
                              <span className="truncate font-semibold text-ink-900">{a.name}</span>
                              {a.id === user?.id && (
                                <span className="badge border-brand-200 bg-brand-50 text-brand-700">You</span>
                              )}
                              {a.invited && (
                                <span className="badge shrink-0 border-amber-200 bg-amber-50 text-amber-700">Invited</span>
                              )}
                            </span>
                            <span className="block truncate text-xs text-ink-500">
                              {a.email}
                              {a.department && <span className="text-ink-400"> · {a.department}</span>}
                            </span>
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
                      <td className="text-ink-600">{a.job_title || '—'}</td>
                      <td className="text-right font-semibold tabular-nums text-ink-900">{a.assigned_tasks}</td>
                      <td className="text-right tabular-nums text-ink-600">{a.open_tasks}</td>
                      <td className="whitespace-nowrap text-xs text-ink-500">{formatDate(a.created_at)}</td>
                      <td className="text-right">
                        {/*
                          No delete on your own row: signing yourself out permanently is
                          not something a confirm dialog should be the first warning of.
                          The server refuses it independently.
                        */}
                        {a.id !== user?.id && (
                          <button
                            type="button"
                            onClick={() => setConfirmRemoveAdmin(a)}
                            aria-label={`Remove ${a.name}`}
                            title={`Remove ${a.name}`}
                            className="rounded-md p-1.5 text-ink-400 transition-colors hover:bg-red-50 hover:text-red-600"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="border-t border-ink-100 px-4 py-3 text-xs text-ink-500">
              Everyone listed here reaches this portal. <strong>Admins</strong> administer
              accounts and see the whole company. <strong>Managers</strong> see only their
              own department and cannot add or remove people.
            </p>
          </>
        )}
      </div>

      <Modal
        open={!!confirmRemove}
        onClose={() => setConfirmRemove(null)}
        title="Remove this team member?"
        size="sm"
        footer={(
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" onClick={() => setConfirmRemove(null)} className="btn-secondary">Cancel</button>
            <button type="button" onClick={() => void removeMember()} disabled={removing} className="btn-danger">
              {removing
                ? <><Spinner className="h-4 w-4" /> Removing…</>
                : <><Trash2 className="h-4 w-4" /> Remove permanently</>}
            </button>
          </div>
        )}
      >
        {confirmRemove && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 rounded-lg border border-ink-200 bg-ink-50 p-4">
              <Avatar name={confirmRemove.name} src={confirmRemove.profile_image} />
              <div className="min-w-0">
                <p className="truncate font-semibold text-ink-900">{confirmRemove.name}</p>
                <p className="truncate text-sm text-ink-500">{confirmRemove.email}</p>
              </div>
            </div>

            {/*
              Their history is destroyed with them — the foreign keys cascade — so the
              cost is stated before the click rather than discovered after it.
            */}
            <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" aria-hidden />
              <div className="min-w-0 text-sm">
                <p className="font-semibold text-red-900">This cannot be undone</p>
                <p className="mt-0.5 text-red-800">
                  Their account and everything attached to it is deleted: every task
                  assigned to them, every daily report they submitted, every ticket they
                  raised, and their notifications.
                </p>
                <p className="mt-2 text-red-800">
                  They currently have{' '}
                  <strong>{confirmRemove.counts.total} task{confirmRemove.counts.total === 1 ? '' : 's'}</strong>
                  {confirmRemove.counts.completed > 0 && (
                    <> ({confirmRemove.counts.completed} completed)</>
                  )}.
                </p>
              </div>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={!!confirmRemoveAdmin}
        onClose={() => setConfirmRemoveAdmin(null)}
        title="Remove this account?"
        size="sm"
        footer={(
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" onClick={() => setConfirmRemoveAdmin(null)} className="btn-secondary">Cancel</button>
            <button type="button" onClick={() => void removeAdmin()} disabled={removing} className="btn-danger">
              {removing
                ? <><Spinner className="h-4 w-4" /> Removing…</>
                : <><Trash2 className="h-4 w-4" /> Remove permanently</>}
            </button>
          </div>
        )}
      >
        {confirmRemoveAdmin && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 rounded-xl border border-ink-200 bg-ink-50 p-4">
              <Avatar name={confirmRemoveAdmin.name} src={confirmRemoveAdmin.profile_image} />
              <div className="min-w-0">
                <p className="truncate font-semibold text-ink-900">{confirmRemoveAdmin.name}</p>
                <p className="truncate text-sm text-ink-500">
                  {roleLabel(confirmRemoveAdmin.role)} · {confirmRemoveAdmin.email}
                </p>
              </div>
            </div>

            {/*
              The transfer is stated before the click rather than discovered after it.
              Without it these tasks would cascade away with the account, taking other
              people's work with them.
            */}
            {confirmRemoveAdmin.assigned_tasks > 0 ? (
              <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" aria-hidden />
                <div className="min-w-0 text-sm">
                  <p className="font-semibold text-ink-900">
                    Their {confirmRemoveAdmin.assigned_tasks} assigned task
                    {confirmRemoveAdmin.assigned_tasks === 1 ? '' : 's'} will move to you
                  </p>
                  <p className="mt-0.5 text-ink-700">
                    Nothing is deleted — the tasks and the employees' progress on them stay
                    exactly as they are. Only the record of who assigned them changes.
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-ink-600">
                They have no assigned tasks, so nothing else is affected.
              </p>
            )}

            <p className="text-sm text-ink-600">
              They lose access to this portal immediately. This cannot be undone.
            </p>
          </div>
        )}
      </Modal>

      <EditTeamMemberModal
        open={editing !== null}
        member={editing}
        departments={departments}
        onClose={() => setEditing(null)}
        onSaved={reloadBoth}
      />

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
