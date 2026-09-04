import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { CheckCircle2 } from 'lucide-react-native';
import { useTheme } from '@/theme';
import { useAnalytics } from '@/hooks/useDashboard';
import { useTeam } from '@/hooks/useTeam';
import { formatWeekday } from '@/lib/format';
import {
  Avatar, BentoCard, BigNumber, Donut, ErrorState, GroupedBars, MiniBars, PickerField, PickerSheet, ProgressBar, Reveal, Screen, ScreenHeader,
  SectionTitle, SegmentedTabs, SkeletonList, Text, TrendChart, useSheet,
} from '@/components';

/** The manager's analytics, sized for a phone: donut, activity, productivity per person. */
export default function Analytics() {
  const t = useTheme();
  const router = useRouter();
  const [employeeId, setEmployeeId] = useState<number | null>(null);
  const [mode, setMode] = useState<'daily' | 'weekly'>('daily');
  const team = useTeam();
  const analytics = useAnalytics({ employeeId: employeeId ?? undefined, days: 30 });
  const employeeSheet = useSheet();
  const d = analytics.data;

  const trend = useMemo(() => {
    const daily = d?.daily ?? [];
    const last = daily.slice(-7).reduce((s, p) => s + p.assigned, 0);
    const prev = daily.slice(-14, -7).reduce((s, p) => s + p.assigned, 0);
    return prev === 0 ? null : Math.round(((last - prev) / prev) * 100);
  }, [d]);

  const breakdown = d?.breakdown;
  const total = breakdown ? breakdown.pending + breakdown.in_progress + breakdown.completed + breakdown.overdue : 0;
  const rate = d?.summary && d.summary.total_tasks ? Math.round((d.summary.completed_tasks / d.summary.total_tasks) * 100) : 0;
  const employeeOptions = (team.data ?? []).map((m) => ({ value: m.id, label: m.name, hint: m.department ?? undefined }));

  return (
    <Screen refreshing={analytics.isRefetching} onRefresh={() => analytics.refetch()}>
      <ScreenHeader big={false} title="Analytics" subtitle="The last 30 days." />
      {analytics.isPending ? <SkeletonList count={3} /> : analytics.isError || !d ? <ErrorState error={analytics.error} onRetry={() => analytics.refetch()} /> : (
        <>
          <Reveal>
            <BigNumber
              icon={CheckCircle2}
              value={`${rate}%`}
              unit="completed"
              verdict={`${d.summary.completed_tasks} of ${d.summary.total_tasks} tasks${employeeId ? ' for this person' : ' across the team'}.`}
              delta={trend === null ? undefined : { label: `${trend >= 0 ? '+' : ''}${trend}% assigned vs the week before`, tone: trend >= 0 ? 'up' : 'down', good: trend >= 0 }}
            />
          </Reveal>
          <PickerField label="Person" value={employeeOptions.find((o) => o.value === employeeId)?.label ?? null} placeholder="Whole team" onPress={employeeSheet.open} />

          <Reveal index={1}>
            <BentoCard>
              <Text variant="h3" style={{ marginBottom: 16 }}>Status breakdown</Text>
              <Donut
                slices={[
                  { label: 'Pending', value: breakdown?.pending ?? 0, color: t.colors.inkFaint },
                  { label: 'In progress', value: breakdown?.in_progress ?? 0, color: t.colors.hero },
                  { label: 'Done', value: breakdown?.completed ?? 0, color: t.colors.success },
                  { label: 'Overdue', value: breakdown?.overdue ?? 0, color: t.colors.danger },
                ]}
                centerLabel={String(total)}
                centerSub="tasks"
              />
            </BentoCard>
          </Reveal>

          <Reveal index={2}>
            <BentoCard>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <Text variant="h3">Activity</Text>
                <View style={{ width: 170 }}><SegmentedTabs items={[{ key: 'daily', label: 'Daily' }, { key: 'weekly', label: 'Weekly' }]} value={mode} onChange={setMode} /></View>
              </View>
              {mode === 'daily' ? (
                <TrendChart
                  data={d.daily.slice(-14).map((p) => p.completed)}
                  data2={d.daily.slice(-14).map((p) => p.assigned)}
                  labels={d.daily.slice(-14).map((p, i) => (i % 2 === 0 ? formatWeekday(p.day).slice(0, 2) : ''))}
                  height={150}
                />
              ) : (
                <MiniBars data={d.weekly.map((w) => ({ value: w.completed, label: w.week_start.slice(5) }))} color={t.colors.hero} height={80} gap={10} barWidth={18} showLabels />
              )}
              <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 8 }}>
                <Legend color={t.colors.hero} label="Completed" />{mode === 'daily' ? <Legend color={t.colors.info} label="Assigned" /> : null}
              </View>
            </BentoCard>
          </Reveal>

          {d.productivity.length ? (
            <>
              <SectionTitle title="By person" />
              <Reveal index={3}>
                <BentoCard>
                  <GroupedBars data={d.productivity.slice(0, 8).map((p) => ({ label: p.employee_name.split(' ')[0], values: [{ value: p.assigned, color: t.colors.cardAlt }, { value: p.completed, color: t.colors.hero }, { value: p.overdue, color: t.colors.danger }] }))} />
                </BentoCard>
              </Reveal>
              {d.productivity.map((p, i) => (
                <Reveal key={p.employee_id} index={4 + i}>
                  <BentoCard padding={t.spacing.md} onPress={() => router.push(`/team/${p.employee_id}`)}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                      <Avatar name={p.employee_name} size="sm" />
                      <View style={{ flex: 1, gap: 6 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                          <Text variant="bodyStrong" numberOfLines={1} style={{ flex: 1 }}>{p.employee_name}</Text>
                          <Text variant="smallStrong" color={p.overdue ? 'danger' : 'inkMuted'}>{p.completed}/{p.assigned}{p.overdue ? ` · ${p.overdue} overdue` : ''}</Text>
                        </View>
                        <ProgressBar value={p.completion_rate / 100} color={t.colors.hero} height={6} />
                      </View>
                    </View>
                  </BentoCard>
                </Reveal>
              ))}
            </>
          ) : null}
        </>
      )}
      <PickerSheet ref={employeeSheet.ref} title="Person" options={employeeOptions} value={employeeId} onSelect={setEmployeeId} searchable clearLabel="Whole team" onClear={() => setEmployeeId(null)} />
    </Screen>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
      <Text variant="caption" color="inkMuted" style={{ letterSpacing: 0.3 }}>{label}</Text>
    </View>
  );
}
