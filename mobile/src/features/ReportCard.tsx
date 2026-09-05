import { View } from 'react-native';
import { CheckCircle2, Clock } from 'lucide-react-native';
import { useTheme } from '@/theme';
import { formatDayHeading, formatMinutes, formatTime, reportLines } from '@/lib/format';
import type { DailyReport } from '@/types';
import { Avatar, BentoCard, KeyChip, Text } from '@/components';

interface Props {
  report: DailyReport;
  /** Show who wrote it (manager views). */
  showEmployee?: boolean;
  onPress?: () => void;
  onLongPress?: () => void;
  maxLines?: number;
}

/**
 * A daily report as the reference's checklist card: each line with a green tick,
 * linked tasks showing their key, minutes on the right.
 */
export function ReportCard({ report, showEmployee, onPress, onLongPress, maxLines = 6 }: Props) {
  const t = useTheme();
  const free = reportLines(report.task_description);
  const rows: { key: string; text: string; taskKey?: string | null; minutes?: number | null }[] = [
    ...report.items.map((i) => ({ key: `i${i.id}`, text: i.text, taskKey: i.task_key, minutes: i.minutes })),
    ...free.map((text, idx) => ({ key: `f${idx}`, text })),
  ];
  const shown = rows.slice(0, maxLines);
  const more = rows.length - shown.length;
  const edited = report.updated_at !== report.created_at;

  return (
    <BentoCard onPress={onPress} onLongPress={onLongPress}>
      <View style={{ gap: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          {showEmployee ? <Avatar name={report.employee_name} size="sm" /> : null}
          <View style={{ flex: 1 }}>
            <Text variant="bodyStrong" numberOfLines={1}>{showEmployee ? report.employee_name : formatDayHeading(report.report_date)}</Text>
            <Text variant="small" color="inkMuted" numberOfLines={1}>
              {showEmployee ? `${formatDayHeading(report.report_date)} · ` : ''}
              {formatTime(report.created_at)}{edited ? ` · edited ${formatTime(report.updated_at)}` : ''}
            </Text>
          </View>
          {report.total_minutes ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Clock size={13} color={t.colors.inkFaint} />
              <Text variant="smallStrong" color="inkMuted">{formatMinutes(report.total_minutes)}</Text>
            </View>
          ) : null}
        </View>
        <View style={{ gap: 12, paddingTop: 16, borderTopWidth: 1, borderTopColor: t.colors.hairline }}>
          {shown.map((row) => (
            <View key={row.key} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
              <CheckCircle2 size={16} color={t.colors.success} strokeWidth={2} style={{ marginTop: 3 }} />
              <View style={{ flex: 1 }}>
                <Text variant="body" style={{ flexShrink: 1 }}>{row.text}</Text>
                {row.taskKey ? <KeyChip value={row.taskKey} /> : null}
              </View>
              {row.minutes ? <Text variant="caption" color="inkFaint" style={{ marginTop: 3 }}>{formatMinutes(row.minutes)}</Text> : null}
            </View>
          ))}
          {more > 0 ? <Text variant="small" color="inkFaint" style={{ marginLeft: 24 }}>+{more} more</Text> : null}
          {rows.length === 0 ? <Text variant="small" color="inkFaint">Nothing written.</Text> : null}
        </View>
      </View>
    </BentoCard>
  );
}
