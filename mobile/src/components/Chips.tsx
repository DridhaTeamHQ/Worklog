import { View, type StyleProp, type ViewStyle } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { AlertOctagon, ArrowUp, Bug, Circle, CircleDot, CircleSlash, Clock } from 'lucide-react-native';
import { alpha, useTheme } from '@/theme';
import type { EffectiveStatus, Label, Priority, TicketSeverity, TicketStatus } from '@/types';
import { Text } from './Text';

interface ChipProps {
  label: string;
  color?: string;
  /** Tinted background (default) or solid fill. */
  filled?: boolean;
  icon?: LucideIcon;
  size?: 'sm' | 'md';
  mono?: boolean;
  style?: StyleProp<ViewStyle>;
}

/**
 * A small rounded tag in sentence case. Quiet by default — a tint of its colour on a
 * transparent ground — and solid only when it must stand out on the hero.
 */
export function Chip({ label, color, filled = false, icon: Icon, size = 'md', mono = false, style }: ChipProps) {
  const t = useTheme();
  const base = color ?? t.colors.inkMuted;
  const bg = filled ? base : alpha(base, t.isDark ? 0.18 : 0.12);
  const fg = filled ? '#FFFFFF' : base;
  const pad = size === 'sm' ? { paddingHorizontal: 8, height: 22 } : { paddingHorizontal: 10, height: 26 };
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: t.radius.pill, backgroundColor: bg }, pad, style]}>
      {Icon ? <Icon size={size === 'sm' ? 11 : 13} color={fg} strokeWidth={2.4} /> : null}
      <Text variant={mono ? 'mono' : 'caption'} color={fg} style={mono ? undefined : { fontFamily: t.fonts.semibold }}>{label}</Text>
    </View>
  );
}

const STATUS: Record<EffectiveStatus | 'idle', { label: string; icon: LucideIcon }> = {
  pending: { label: 'Pending', icon: Circle },
  in_progress: { label: 'In progress', icon: CircleDot },
  completed: { label: 'Done', icon: Circle },
  overdue: { label: 'Overdue', icon: Clock },
  idle: { label: 'Idle', icon: CircleSlash },
};

export function StatusChip({ status, size, filled }: { status: EffectiveStatus | 'idle'; size?: 'sm' | 'md'; filled?: boolean }) {
  const t = useTheme();
  const s = STATUS[status] ?? STATUS.idle;
  return <Chip label={s.label} icon={filled ? s.icon : undefined} color={t.tone('status', status).color} size={size} filled={filled} />;
}

const PRIORITY: Record<Priority, { label: string; icon?: LucideIcon }> = {
  low: { label: 'Low' },
  medium: { label: 'Medium' },
  high: { label: 'High', icon: ArrowUp },
  urgent: { label: 'Urgent', icon: AlertOctagon },
};

/** Priority is only worth a chip when it is unusual: high or urgent. Pass `always` to override. */
export function PriorityChip({ priority, size, filled, always }: { priority: Priority; size?: 'sm' | 'md'; filled?: boolean; always?: boolean }) {
  const t = useTheme();
  const p = PRIORITY[priority] ?? PRIORITY.medium;
  if (!always && (priority === 'low' || priority === 'medium')) return null;
  return <Chip label={p.label} icon={priority === 'urgent' ? p.icon : undefined} color={t.tone('priority', priority).color} size={size} filled={!!filled} />;
}

const SEVERITY: Record<TicketSeverity, string> = { low: 'Low', medium: 'Medium', high: 'High', critical: 'Critical' };

export function SeverityChip({ severity, size, filled }: { severity: TicketSeverity; size?: 'sm' | 'md'; filled?: boolean }) {
  const t = useTheme();
  return <Chip label={SEVERITY[severity] ?? severity} icon={severity === 'critical' ? Bug : undefined} color={t.tone('severity', severity).color} size={size} filled={!!filled} />;
}

export const TICKET_STATUS_LABEL: Record<TicketStatus, string> = {
  open: 'Open', in_progress: 'In progress', resolved: 'Resolved', closed: 'Closed',
};

export function TicketStatusChip({ status, size, filled }: { status: TicketStatus; size?: 'sm' | 'md'; filled?: boolean }) {
  const t = useTheme();
  return <Chip label={TICKET_STATUS_LABEL[status] ?? status} color={t.tone('ticket', status).color} size={size} filled={filled} />;
}

/** The task/ticket key — SHMOB-5, SHMOB-B3 — as quiet mono text, not a badge. */
export function KeyChip({ value, onHero, size = 'sm' }: { value: string | null | undefined; onHero?: boolean; size?: 'sm' | 'md' }) {
  const t = useTheme();
  if (!value) return null;
  if (onHero) return <Chip label={value} mono size={size} color="#FFFFFF" style={{ backgroundColor: 'rgba(255,255,255,0.22)' }} />;
  return <Text variant="mono" color={t.colors.inkMuted}>{value}</Text>;
}

export function LabelChip({ label, size = 'sm' }: { label: Label; size?: 'sm' | 'md' }) {
  return <Chip label={label.name} color={label.color} size={size} />;
}

/** A row of label chips; nothing when there are none. Two by default — labels are context, not the point. */
export function LabelRow({ labels, max = 2 }: { labels: Label[] | undefined; max?: number }) {
  const t = useTheme();
  if (!labels?.length) return null;
  const shown = labels.slice(0, max);
  const extra = labels.length - shown.length;
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
      {shown.map((l) => <LabelChip key={l.id} label={l} />)}
      {extra > 0 ? <Chip label={`+${extra}`} color={t.colors.inkMuted} size="sm" /> : null}
    </View>
  );
}
