import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, Save, RefreshCw, FileText, CheckCircle2, Search } from 'lucide-react';
import { reportApi } from '../../api/endpoints';
import { useAuth } from '../../context/AuthContext';
import { ApiError } from '../../api/client';
import { useToast } from '../../components/Toast';
import { EmptyState, ErrorState, LoadingBlock, PageHeader, SearchInput, Spinner } from '../../components/ui';
import { formatDate, formatTime, reportLines, todayIso } from '../../lib/format';
import type { DailyReport } from '../../types';

const PLACEHOLDER = 'Describe the tasks you completed today...';
const MAX_LENGTH = 8000;

export function TasksDonePage() {
  const { user } = useAuth();
  const toast = useToast();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [text, setText] = useState('');
  const [todayReport, setTodayReport] = useState<DailyReport | null>(null);
  const [history, setHistory] = useState<DailyReport[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [fieldError, setFieldError] = useState('');

  const today = todayIso();

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [{ data: current }, { data: list }] = await Promise.all([
        reportApi.today(),
        reportApi.list({ limit: 60 }),
      ]);
      setTodayReport(current);
      setText(current?.task_description ?? '');
      setHistory(list);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load your reports.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const save = async () => {
    setFieldError('');
    const trimmed = text.trim();
    if (!trimmed) {
      setFieldError('Write at least one line describing what you completed.');
      textareaRef.current?.focus();
      return;
    }

    setSaving(true);
    try {
      const { data } = await reportApi.save(trimmed);
      setTodayReport(data.report);
      setText(data.report.task_description);
      // Replace today's entry in place rather than refetching the whole history.
      setHistory((prev) => {
        const rest = prev.filter((r) => r.report_date !== data.report.report_date);
        return [data.report, ...rest].sort((a, b) => b.report_date.localeCompare(a.report_date));
      });
      toast.success(data.message);
    } catch (err) {
      if (err instanceof ApiError) {
        const fieldMessage = err.fieldErrors.taskDescription;
        if (fieldMessage) setFieldError(fieldMessage);
        toast.error(err.message);
      } else {
        toast.error('Could not save your report. Please try again.');
      }
    } finally {
      setSaving(false);
    }
  };

  const isEditing = Boolean(todayReport);
  const dirty = text.trim() !== (todayReport?.task_description ?? '').trim();

  const previous = useMemo(() => history.filter((r) => r.report_date !== today), [history, today]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return previous;
    return previous.filter(
      (r) => r.task_description.toLowerCase().includes(q) || formatDate(r.report_date).toLowerCase().includes(q),
    );
  }, [previous, search]);

  // Ctrl/Cmd+Enter saves — the shortcut people reach for in a text box like this.
  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      void save();
    }
  };

  if (loading) return <LoadingBlock label="Loading your reports" rows={4} />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tasks Done"
        subtitle="Log the work you completed today. Your manager sees this straight away."
      />

      <section className="card overflow-hidden">
        <header className="flex flex-col gap-2 border-b border-ink-200 bg-ink-50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2.5">
            <CalendarDays className="h-5 w-5 text-brand-600" aria-hidden />
            <div>
              <p className="font-semibold text-ink-900">{formatDate(today)}</p>
              <p className="text-xs text-ink-500">{user?.name}{user?.department ? ` · ${user.department}` : ''}</p>
            </div>
          </div>
          {isEditing && (
            <span className="badge border-emerald-200 bg-emerald-50 text-emerald-700 self-start sm:self-auto">
              <CheckCircle2 className="h-3 w-3" aria-hidden />
              Submitted {formatTime(todayReport?.created_at)}
            </span>
          )}
        </header>

        <div className="p-5">
          <label className="label" htmlFor="report">
            What did you complete today?
          </label>
          <textarea
            id="report"
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, MAX_LENGTH))}
            onKeyDown={onKeyDown}
            rows={10}
            maxLength={MAX_LENGTH}
            placeholder={PLACEHOLDER}
            aria-invalid={!!fieldError}
            aria-describedby="report-hint"
            className={`input resize-y font-normal leading-relaxed ${fieldError ? 'input-error' : ''}`}
          />
          <div className="mt-1.5 flex flex-wrap items-baseline justify-between gap-2">
            <p id="report-hint" className={fieldError ? 'field-error' : 'hint'}>
              {fieldError || 'Put each completed task on its own line. Press Ctrl+Enter to save.'}
            </p>
            <p className="text-xs tabular-nums text-ink-400">{text.length.toLocaleString()} / {MAX_LENGTH.toLocaleString()}</p>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button type="button" onClick={save} disabled={saving || (isEditing && !dirty)} className="btn-primary">
              {saving
                ? <><Spinner className="h-4 w-4" /> Saving…</>
                : isEditing
                  ? <><RefreshCw className="h-4 w-4" /> Update</>
                  : <><Save className="h-4 w-4" /> Save</>}
            </button>
            {isEditing && dirty && (
              <button
                type="button"
                onClick={() => { setText(todayReport?.task_description ?? ''); setFieldError(''); }}
                className="btn-secondary"
              >
                Discard changes
              </button>
            )}
            {isEditing && !dirty && (
              <p className="text-xs text-ink-500">
                Last updated {formatTime(todayReport?.updated_at)} — edit the text above to make changes.
              </p>
            )}
          </div>
        </div>
      </section>

      <section className="card">
        <header className="flex flex-col gap-3 border-b border-ink-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-semibold text-ink-900">Previous reports</h2>
            <p className="text-xs text-ink-500">
              {previous.length} earlier report{previous.length === 1 ? '' : 's'}, newest first
            </p>
          </div>
          <SearchInput value={search} onChange={setSearch} placeholder="Search your reports" className="sm:w-64" />
        </header>

        {previous.length === 0 ? (
          <EmptyState
            icon={<FileText className="h-6 w-6" />}
            title="No previous reports"
            description="Once you submit reports on other days, they will be listed here by date."
          />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<Search className="h-6 w-6" />}
            title="No matching reports"
            description={`Nothing in your reports matches "${search}".`}
            action={<button type="button" onClick={() => setSearch('')} className="btn-secondary">Clear search</button>}
          />
        ) : (
          <ol className="divide-y divide-ink-100">
            {filtered.map((report) => (
              <li key={report.id} className="px-5 py-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="font-semibold text-ink-900">{formatDate(report.report_date)}</h3>
                  <p className="text-xs text-ink-400">
                    Submitted {formatTime(report.created_at)}
                    {report.updated_at !== report.created_at && ` · edited ${formatTime(report.updated_at)}`}
                  </p>
                </div>
                <ul className="mt-2.5 space-y-1.5">
                  {reportLines(report.task_description).map((line, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-sm text-ink-700">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" aria-hidden />
                      <span className="min-w-0">{line}</span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
