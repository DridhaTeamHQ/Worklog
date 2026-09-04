import { Pressable, View } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import {
  AtSign, Bell, Bug, CalendarClock, CheckCircle2, ClipboardCheck, ClipboardList, ClipboardPlus, Clock, MessageCircle, Users,
} from 'lucide-react-native';
import { alpha, useTheme } from '@/theme';
import { relativeTime } from '@/lib/format';
import type { AppNotification, NotificationType } from '@/types';
import { Text } from '@/components';

const LOOK: Record<NotificationType, { icon: LucideIcon; tone: 'info' | 'success' | 'warning' | 'danger' | 'inkMuted'; label: string }> = {
  task_assigned: { icon: ClipboardPlus, tone: 'info', label: 'Task assigned' },
  task_updated: { icon: ClipboardList, tone: 'info', label: 'Task updated' },
  status_changed: { icon: CheckCircle2, tone: 'success', label: 'Status changed' },
  report_submitted: { icon: ClipboardCheck, tone: 'success', label: 'Report submitted' },
  ticket_raised: { icon: Bug, tone: 'danger', label: 'Ticket raised' },
  ticket_updated: { icon: Bug, tone: 'info', label: 'Ticket updated' },
  general: { icon: Bell, tone: 'inkMuted', label: 'General' },
  task_commented: { icon: MessageCircle, tone: 'info', label: 'Comment' },
  ticket_commented: { icon: MessageCircle, tone: 'info', label: 'Comment' },
  mentioned: { icon: AtSign, tone: 'warning', label: 'Mentioned you' },
  due_tomorrow: { icon: CalendarClock, tone: 'warning', label: 'Due tomorrow' },
  overdue: { icon: Clock, tone: 'danger', label: 'Overdue' },
  report_missing: { icon: ClipboardCheck, tone: 'warning', label: 'Report missing' },
  team_overdue_digest: { icon: Users, tone: 'danger', label: 'Team overdue' },
};

export function notificationLabel(type: NotificationType) {
  return LOOK[type]?.label ?? 'Notification';
}

interface Props {
  notification: AppNotification;
  onPress?: () => void;
}

export function NotificationRow({ notification: n, onPress }: Props) {
  const t = useTheme();
  const look = LOOK[n.type] ?? LOOK.general;
  const Icon = look.icon;
  const color = t.colors[look.tone];
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole="button"
      style={({ pressed }) => [
        // Unread is a dot and full-strength ink, not a tinted slab — thirteen orange cards is noise.
        { flexDirection: 'row', gap: 12, padding: t.spacing.md, borderRadius: t.radius.lg, backgroundColor: t.colors.card, borderWidth: 1, borderColor: t.colors.hairline, opacity: n.is_read ? 0.72 : 1 },
        pressed ? { opacity: 0.85 } : null,
      ]}
    >
      <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: alpha(color, t.isDark ? 0.22 : 0.13), alignItems: 'center', justifyContent: 'center' }}>
        <Icon size={18} color={color} strokeWidth={2.3} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Text variant="bodyStrong" numberOfLines={2} style={{ flex: 1 }}>{n.title}</Text>
          {!n.is_read ? <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: t.colors.hero }} /> : null}
        </View>
        <Text variant="small" color="inkMuted" numberOfLines={3}>{n.message}</Text>
        <Text variant="caption" color="inkFaint" style={{ marginTop: 4 }}>{look.label} · {relativeTime(n.created_at)}</Text>
      </View>
    </Pressable>
  );
}
