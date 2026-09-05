import { TicketWorkflow } from '@/features/TicketWorkflow';
import { useState } from 'react';
import { Alert, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { MoreHorizontal, Pencil, Trash2 } from 'lucide-react-native';
import { useTheme } from '@/theme';
import { useUser } from '@/auth/store';
import { useDeleteTicket, useTicket, useUpdateTicketStatus } from '@/hooks/useTickets';
import { errorMessage } from '@/api/client';
import { formatDateTime } from '@/lib/format';
import { isManagerLevel, type TicketStatus } from '@/types';
import {
  BentoCard, CheckRow, ErrorState, IconPillButton, KeyChip, ListGroup, PersonRow, PillButton, Reveal, Screen, ScreenHeader,
  SectionTitle, SeverityChip, Sheet, LoadingState, Text, TextField, TicketStatusChip, TitleBlock, ValueRow,
  TICKET_STATUS_LABEL, useSheet, useToast,
} from '@/components';
import { ActivityThread } from '@/features/ActivityThread';

/**
 * A ticket in full. The reporter may edit its wording while it is open and close or
 * reopen it; deciding it is resolved is the manager's call, with a note.
 */
export default function TicketDetail() {
  const t = useTheme();
  const router = useRouter();
  const toast = useToast();
  const user = useUser();
  const { id: raw } = useLocalSearchParams<{ id: string }>();
  const id = Number(raw) || null;
  const ticket = useTicket(id);
  const move = useUpdateTicketStatus();
  const remove = useDeleteTicket();
  const menu = useSheet();
  const [resolving, setResolving] = useState(false);
  const [note, setNote] = useState('');

  const manager = isManagerLevel(user?.role);
  const data = ticket.data;
  const reporter = data?.reporter_id === user?.id;
  const editable = data ? (manager || (reporter && ['open', 'in_progress'].includes(data.status))) : false;

  const setStatus = (status: TicketStatus, resolutionNote?: string) => {
    if (!data || data.status === status) return;
    move.mutate({ id: data.id, status, resolutionNote }, {
      onSuccess: () => { toast.success(`Ticket ${TICKET_STATUS_LABEL[status].toLowerCase()}`); setResolving(false); },
      onError: (err) => toast.error('Could not update', errorMessage(err)),
    });
  };

  const confirmDelete = () => {
    if (!data) return;
    menu.close();
    Alert.alert('Delete this ticket?', `${data.ticket_key} will be removed for good.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => remove.mutate(data.id, { onSuccess: () => { toast.success('Ticket deleted'); router.back(); }, onError: (err) => toast.error('Could not delete', errorMessage(err)) }) },
    ]);
  };

  if (ticket.isError) return <Screen><ScreenHeader tone="clay" title="Ticket" /><ErrorState error={ticket.error} onRetry={() => ticket.refetch()} /></Screen>;

  return (
    <Screen refreshing={ticket.isRefetching} onRefresh={() => ticket.refetch()}>
      <ScreenHeader tone="clay" big={false} right={data && (manager || reporter) ? <IconPillButton icon={MoreHorizontal} tone="plain" onPress={menu.open} accessibilityLabel="More actions" /> : undefined} />

      {ticket.isPending || !data ? <LoadingState /> : (
        <>
          <Reveal>
            <TitleBlock tone="clay"
              eyebrow={<><KeyChip value={data.ticket_key} /><Text variant="caption" color="inkFaint">·</Text><Text variant="caption" color="inkMuted">{data.project_name}</Text></>}
              title={data.title}
              meta={<><SeverityChip severity={data.severity} /><TicketStatusChip status={data.status} /><Text variant="small" color="inkMuted">{formatDateTime(data.created_at)}</Text></>}
            />
          </Reveal>

          <Reveal index={1}>
            <TicketWorkflow value={data.status} busy={move.isPending} onChange={manager ? (status) => status === 'resolved' ? setResolving(true) : setStatus(status) : undefined} />
          </Reveal>
          {resolving && manager ? <Reveal><BentoCard>
            <View style={{ gap: 16 }}>
              <Text variant="h3">Close the loop.</Text>
              <Text variant="small" color="inkMuted">Leave a note about the fix so the reporter knows what changed.</Text>
              <TextField label="Resolution note" value={note} onChangeText={setNote} multiline placeholder="What did you change?" maxLength={2000} />
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}><PillButton label="Resolve ticket" block onPress={() => setStatus('resolved', note.trim() || undefined)} loading={move.isPending} haptic="success" /></View>
                <PillButton label="Cancel" size="md" variant="soft" disabled={move.isPending} onPress={() => setResolving(false)} />
              </View>
            </View>
          </BentoCard></Reveal> : null}
          {!manager && reporter ? (
            <Reveal index={1}>
              <BentoCard padding={t.spacing.lg}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <View style={{ flex: 1 }}>
                    <Text variant="bodyStrong">{data.status === 'closed' ? 'Closed' : data.status === 'resolved' ? 'Resolved by your manager' : 'Waiting on your manager'}</Text>
                    <Text variant="small" color="inkMuted">{data.status === 'closed' ? 'Reopen it if the problem is back.' : 'Close it if it no longer matters.'}</Text>
                  </View>
                  <PillButton label={data.status === 'closed' ? 'Reopen' : 'Close'} size="sm" variant={data.status === 'closed' ? 'ink' : 'soft'} onPress={() => setStatus(data.status === 'closed' ? 'open' : 'closed')} loading={move.isPending} />
                </View>
              </BentoCard>
            </Reveal>
          ) : null}

          <Reveal index={2}>
            <BentoCard><Text variant="caption" color="inkMuted" style={{ letterSpacing: 1.5, marginBottom: 12 }}>WHAT HAPPENED</Text><Text variant="body">{data.description}</Text></BentoCard>
          </Reveal>

          {data.resolution_note ? (
            <Reveal index={3}>
              <BentoCard tone="alt" elevated={false}>
                <Text variant="caption" color="success">Resolution</Text>
                <Text variant="body" style={{ marginTop: 4 }}>{data.resolution_note}</Text>
                {data.resolved_at ? <Text variant="caption" color="inkFaint" style={{ marginTop: 8 }}>{formatDateTime(data.resolved_at)}</Text> : null}
              </BentoCard>
            </Reveal>
          ) : null}

          <Reveal index={4}>
            <ListGroup>
              <View style={{ paddingHorizontal: t.spacing.xl, paddingVertical: 12 }}>
                <PersonRow name={data.reporter_name} subtitle="Reported by" src={data.reporter_profile_image} onPress={manager ? () => router.push(`/team/${data.reporter_id}`) : undefined} chevron={manager} />
              </View>
              {data.task_id ? (
                <ValueRow label="On task" value={data.task_key ?? data.task_title ?? 'Open task'} divider onPress={() => router.push(`/tasks/${data.task_id}`)} />
              ) : (
                <ValueRow label="On task" value="Deleted since" color={t.colors.inkFaint} divider />
              )}
            </ListGroup>
          </Reveal>

          <SectionTitle title="Activity" />
          <Reveal index={5}><ActivityThread entity="ticket" id={data.id} /></Reveal>
        </>
      )}

      <Sheet ref={menu.ref} title={data?.ticket_key ?? 'Ticket'}>
        <View style={{ gap: 6 }}>
          {editable ? <CheckRow checked={false} label="Edit wording" meta="Title, description, severity" strike={false} onPressLabel={() => { menu.close(); router.push(`/tickets/${id}/edit`); }} right={<Pencil size={18} color={t.colors.inkMuted} />} /> : null}
          <CheckRow checked={false} label="Delete ticket" strike={false} onPressLabel={confirmDelete} right={<Trash2 size={18} color={t.colors.danger} />} />
        </View>
      </Sheet>

    </Screen>
  );
}
