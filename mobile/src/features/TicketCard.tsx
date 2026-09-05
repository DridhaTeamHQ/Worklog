import { View } from 'react-native';
import { useTheme } from '@/theme';
import { relativeTime } from '@/lib/format';
import type { Ticket } from '@/types';
import { Avatar, BentoCard, KeyChip, SeverityChip, Text, TicketStatusChip } from '@/components';

interface Props {
  ticket: Ticket;
  onPress?: () => void;
  showReporter?: boolean;
}

export function TicketCard({ ticket, onPress, showReporter }: Props) {
  const t = useTheme();
  const severity = { low: 1, medium: 2, high: 3, critical: 4 }[ticket.severity];
  const severityColor = t.tone('severity', ticket.severity).color;
  return (
    <BentoCard onPress={onPress} accessibilityLabel={`${ticket.ticket_key}: ${ticket.title}. ${ticket.severity} severity, ${ticket.status.replace('_', ' ')}.`}>
      <View style={{ gap: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <KeyChip value={ticket.ticket_key} />
          <View style={{ flex: 1 }} />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View accessible={false} style={{ flexDirection: 'row', gap: 2, alignItems: 'flex-end' }}>{[1, 2, 3, 4].map((level) => <View key={level} style={{ width: 3, height: 3 + level * 3, borderRadius: 2, backgroundColor: level <= severity ? severityColor : t.colors.border }} />)}</View>
            <Text variant="caption" color={severityColor}>{ticket.severity.charAt(0).toUpperCase() + ticket.severity.slice(1)}</Text>
          </View>
        </View>
        <Text variant="h3" numberOfLines={2}>{ticket.title}</Text>
        <Text variant="small" color="inkMuted" numberOfLines={2}>
          {ticket.task_key ? `${ticket.task_key} · ` : ''}{ticket.task_title || ticket.project_name}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginTop: 2, paddingTop: 12, borderTopWidth: 1, borderTopColor: t.colors.hairline }}>
          <TicketStatusChip status={ticket.status} size="sm" />
          <Text variant="caption" color="inkFaint">{relativeTime(ticket.created_at)}</Text>
          <View style={{ flex: 1 }} />
          {showReporter ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Avatar name={ticket.reporter_name} src={ticket.reporter_profile_image} size="sm" />
              <Text variant="small" color="inkMuted" numberOfLines={1} style={{ maxWidth: 120 }}>{ticket.reporter_name.split(' ')[0]}</Text>
            </View>
          ) : null}
        </View>
        {ticket.resolution_note ? (
          <View style={{ backgroundColor: t.colors.successSoft, borderRadius: t.radius.sm, padding: 10 }}>
            <Text variant="small" color="success" numberOfLines={2}>{ticket.resolution_note}</Text>
          </View>
        ) : null}
      </View>
    </BentoCard>
  );
}
