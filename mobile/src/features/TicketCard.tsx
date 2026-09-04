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
  return (
    <BentoCard onPress={onPress}>
      <View style={{ gap: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <KeyChip value={ticket.ticket_key} />
          <View style={{ flex: 1 }} />
          <Text variant="caption" color="inkFaint">{relativeTime(ticket.created_at)}</Text>
        </View>
        <Text variant="h3" numberOfLines={2}>{ticket.title}</Text>
        <Text variant="small" color="inkMuted" numberOfLines={2}>
          {ticket.task_key ? `${ticket.task_key} · ` : ''}{ticket.task_title || ticket.project_name}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 }}>
          <SeverityChip severity={ticket.severity} size="sm" />
          <TicketStatusChip status={ticket.status} size="sm" />
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
