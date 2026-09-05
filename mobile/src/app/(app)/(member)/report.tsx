import { useEffect, useMemo, useState } from 'react';
import { Alert, View } from 'react-native';
import { ClipboardCheck } from 'lucide-react-native';
import { useTheme } from '@/theme';
import { useDeleteReport, useReportSuggestions, useReports, useSaveReport, useTodayReport } from '@/hooks/useReports';
import { errorMessage } from '@/api/client';
import { formatDate, formatMinutes, formatTime, todayIso } from '@/lib/format';
import {
  BentoCard, BigNumber, EmptyState, ErrorState, PillButton, Reveal, Screen, ScreenHeader, SearchField, SectionTitle, SkeletonCard, SkeletonList, Text,
  TextButton, TextField, useToast,
} from '@/components';
import { ReportCard } from '@/features/ReportCard';
import { ReportItemsEditor, draftsFromReport, type DraftItem } from '@/features/ReportItemsEditor';

/**
 * Today's report. A large title with the date, a line saying whether it is in, then
 * the editor — task lines first, free text after, one button — and previous days below.
 */
export default function MemberReport() {
  const t = useTheme();
  const toast = useToast();
  const today = useTodayReport();
  const suggestions = useReportSuggestions();
  const save = useSaveReport();
  const remove = useDeleteReport();
  const [search, setSearch] = useState('');
  const history = useReports({ search: search || undefined, limit: 60 });

  const [text, setText] = useState('');
  const [items, setItems] = useState<DraftItem[]>([]);
  const [seeded, setSeeded] = useState<number | null>(null);

  useEffect(() => {
    const report = today.data?.report;
    const stamp = report ? report.id + report.updated_at.length : 0;
    if (!today.data || seeded === stamp) return;
    setText(report?.task_description ?? '');
    setItems(report ? draftsFromReport(report.items) : []);
    setSeeded(stamp);
  }, [today.data, seeded]);

  const saved = today.data?.report;
  const dirty = useMemo(() => {
    const savedItems = saved ? draftsFromReport(saved.items) : [];
    const norm = (list: DraftItem[]) => JSON.stringify(list.map((i) => [i.taskId ?? null, i.text.trim(), i.minutes ?? null]));
    return text.trim() !== (saved?.task_description ?? '').trim() || norm(items) !== norm(savedItems);
  }, [text, items, saved]);
  const empty = !text.trim() && items.every((i) => !i.text.trim());

  const submit = async () => {
    try {
      const res = await save.mutateAsync({
        taskDescription: text.trim(),
        items: items.filter((i) => i.text.trim()).map((i) => ({ taskId: i.taskId ?? null, text: i.text.trim(), minutes: i.minutes ?? null })),
      });
      toast.success(res.data.createdNew ? 'Report submitted' : 'Report updated', res.data.createdNew ? 'Your manager has been told.' : undefined);
    } catch (err) {
      toast.error('Could not save', errorMessage(err));
    }
  };

  const discard = () => {
    setText(saved?.task_description ?? '');
    setItems(saved ? draftsFromReport(saved.items) : []);
  };

  const confirmDelete = (id: number, date: string) => {
    Alert.alert('Delete this report?', `The report for ${formatDate(date)} will be removed.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => remove.mutate(id, { onError: (err) => toast.error('Could not delete', errorMessage(err)) }) },
    ]);
  };

  const day = today.data?.today || todayIso();
  // Structured lines plus the paragraphs of free text, so the number is never zero
  // while the report is visibly full.
  const freeLines = text.split('\n').filter((line) => line.trim()).length;
  const lineCount = items.filter((i) => i.text.trim()).length + freeLines;
  const totalMinutes = items.reduce((sum, i) => sum + (Number(i.minutes) || 0), 0);
  const previous = (history.data?.items ?? []).filter((r) => r.report_date !== day);

  return (
    <Screen tabBar refreshing={today.isRefetching} onRefresh={() => { void today.refetch(); void suggestions.refetch(); void history.refetch(); }}>
      <ScreenHeader back={false} tone="rose" eyebrow="A DAY WELL SPENT" title="Daily report" subtitle="Capture the work behind the progress." />
      {today.isPending ? null : (
        <Reveal>
          <BigNumber
            size="md"
            icon={ClipboardCheck}
            value={totalMinutes ? formatMinutes(totalMinutes) : lineCount}
            unit={totalMinutes ? 'logged today' : lineCount === 1 ? 'line today' : 'lines today'}
            verdict={`${formatDate(day)} · ${saved ? `submitted ${formatTime(saved.created_at)}${saved.updated_at !== saved.created_at ? `, edited ${formatTime(saved.updated_at)}` : ''}.` : 'not submitted yet.'}`}
          />
        </Reveal>
      )}

      {today.isPending ? <SkeletonCard lines={4} height={220} /> : today.isError ? <ErrorState error={today.error} onRetry={() => today.refetch()} /> : (
        <>
          <Reveal index={1}>
            <BentoCard>
              <View style={{ gap: 18 }}>
                <ReportItemsEditor items={items} onChange={setItems} suggestions={suggestions.data ?? []} />
                <TextField
                  label="Anything else"
                  value={text}
                  onChangeText={setText}
                  multiline
                  placeholder="Meetings, reviews, things that fit no task…"
                  maxLength={8000}
                />
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                  <View style={{ flex: 1 }}>
                    <PillButton label={saved ? 'Update report' : 'Submit report'} size="lg" onPress={submit} loading={save.isPending} disabled={empty || !dirty} haptic="success" block />
                  </View>
                  {dirty && saved ? <TextButton label="Discard" color="inkMuted" onPress={discard} /> : null}
                </View>
              </View>
            </BentoCard>
          </Reveal>
        </>
      )}

      <SectionTitle title="Previous days" />
      <SearchField value={search} onChange={setSearch} placeholder="Search your reports" loading={history.isFetching && !!search} />
      {history.isPending ? <SkeletonList count={2} /> : history.isError ? <ErrorState error={history.error} onRetry={() => history.refetch()} compact /> : previous.length === 0 ? (
        <EmptyState icon={ClipboardCheck} title={search ? 'No reports match' : 'Nothing earlier'} body={search ? 'Try a different word.' : 'Past days collect here.'} compact />
      ) : previous.map((r, i) => (
        <Reveal key={r.id} index={i}>
          <ReportCard report={r} onLongPress={() => confirmDelete(r.id, r.report_date)} />
        </Reveal>
      ))}
      {previous.length ? <Text variant="caption" color="inkFaint" align="center">Press and hold a report to delete it.</Text> : null}
    </Screen>
  );
}
