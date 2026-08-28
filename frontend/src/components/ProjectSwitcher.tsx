import { FolderKanban } from 'lucide-react';
import type { Project } from '../types';
import { Select } from './ui';

interface Props {
  projects: Project[];
  /** null means "All projects". */
  value: number | null;
  onChange: (projectId: number | null) => void;
  /** Per-project task counts to show on each tab. */
  showCounts?: boolean;
  /** Counts scoped to the current user, overriding project totals. */
  countFor?: (project: Project) => number;
  totalCount?: number;
}

/**
 * Project selector for the task list. Renders as tabs on wide screens and collapses to
 * a single select on narrow ones, so the same control works on a phone without the tab
 * strip turning into an awkward horizontal scroll.
 */
export function ProjectSwitcher({
  projects, value, onChange, showCounts = true, countFor, totalCount,
}: Props) {
  const countOf = (project: Project) => (countFor ? countFor(project) : project.counts.total);
  const allCount = totalCount ?? projects.reduce((sum, p) => sum + countOf(p), 0);

  if (projects.length === 0) return null;

  return (
    <>
      {/* Narrow screens */}
      <div className="sm:hidden">
        <label className="label" htmlFor="project-switcher">Project</label>
        <Select
          id="project-switcher"
          value={value === null ? '' : String(value)}
          onChange={(v) => onChange(v ? Number(v) : null)}
          options={[
            { value: '', label: `All projects${showCounts ? ` (${allCount})` : ''}` },
            ...projects.map((p) => ({
              value: String(p.id),
              label: `${p.name}${showCounts ? ` (${countOf(p)})` : ''}`,
              badge: p.project_key,
            })),
          ]}
        />
      </div>

      {/* Wide screens */}
      <div
        className="hidden sm:flex sm:flex-wrap sm:items-center sm:gap-1"
        role="tablist"
        aria-label="Filter tasks by project"
      >
        <Tab
          active={value === null}
          onClick={() => onChange(null)}
          label="All projects"
          count={showCounts ? allCount : undefined}
          icon={<FolderKanban className="h-3.5 w-3.5" aria-hidden />}
        />
        {projects.map((p) => (
          <Tab
            key={p.id}
            active={value === p.id}
            onClick={() => onChange(p.id)}
            label={p.name}
            badge={p.project_key}
            count={showCounts ? countOf(p) : undefined}
          />
        ))}
      </div>
    </>
  );
}

function Tab({
  active, onClick, label, badge, count, icon,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  badge?: string;
  count?: number;
  icon?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`flex items-center gap-2 rounded-xl border px-3 py-1.5 text-sm font-medium
        transition-all duration-200 ease-out active:scale-[0.97] ${
        active
          ? 'border-brand-600 bg-brand-600 text-white shadow-sm shadow-brand-600/30'
          : 'border-ink-300 bg-white text-ink-700 hover:border-brand-300 hover:bg-brand-50'
      }`}
    >
      {icon}
      {badge && (
        <span className={`font-mono text-[11px] font-bold ${active ? 'text-brand-100' : 'text-brand-700'}`}>
          {badge}
        </span>
      )}
      <span>{label}</span>
      {count !== undefined && (
        <span
          className={`rounded-full px-1.5 text-[11px] font-semibold tabular-nums ${
            active ? 'bg-white/20 text-white' : 'bg-ink-100 text-ink-600'
          }`}
        >
          {count}
        </span>
      )}
    </button>
  );
}
