import { FormSection } from '@/components';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTicket, useUpdateTicket } from '@/hooks/useTickets';
import { ApiError, errorMessage } from '@/api/client';
import type { TicketSeverity } from '@/types';
import { ErrorState, PillButton, Screen, ScreenHeader, SkeletonList, TextField, useToast } from '@/components';
import { SeverityPicker } from '@/features/TicketForm';

/** Correct a ticket's wording — the screen the web app had an API for but never built. */
export default function EditTicket() {
  const router = useRouter();
  const toast = useToast();
  const { id: raw } = useLocalSearchParams<{ id: string }>();
  const id = Number(raw) || null;
  const ticket = useTicket(id);
  const update = useUpdateTicket();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [severity, setSeverity] = useState<TicketSeverity>('medium');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [seeded, setSeeded] = useState(false);

  useEffect(() => {
    if (!ticket.data || seeded) return;
    setTitle(ticket.data.title);
    setDescription(ticket.data.description);
    setSeverity(ticket.data.severity);
    setSeeded(true);
  }, [ticket.data, seeded]);

  const submit = () => {
    if (!ticket.data) return;
    const next: Record<string, string> = {};
    if (!title.trim()) next.title = 'Give it a short summary.';
    if (!description.trim()) next.description = 'Describe what went wrong.';
    setErrors(next);
    if (Object.keys(next).length) return;
    const patch: { title?: string; description?: string; severity?: TicketSeverity } = {};
    if (title.trim() !== ticket.data.title) patch.title = title.trim();
    if (description.trim() !== ticket.data.description) patch.description = description.trim();
    if (severity !== ticket.data.severity) patch.severity = severity;
    if (!Object.keys(patch).length) { router.back(); return; }
    update.mutate({ id: ticket.data.id, patch }, {
      onSuccess: () => { toast.success('Ticket updated'); router.back(); },
      onError: (err) => {
        if (err instanceof ApiError && err.details?.length) setErrors(err.fieldErrors);
        else toast.error('Could not save', errorMessage(err));
      },
    });
  };

  return (
    <Screen>
      <ScreenHeader tone="clay" title="Edit ticket" subtitle={ticket.data?.ticket_key} />
      {ticket.isPending ? <SkeletonList count={2} /> : ticket.isError ? <ErrorState error={ticket.error} onRetry={() => ticket.refetch()} /> : (
        <View style={{ gap: 16 }}>
          <FormSection title="Issue details">
<TextField label="Summary" required value={title} onChangeText={setTitle} maxLength={160} error={errors.title} />
          <TextField label="What happened" required value={description} onChangeText={setDescription} multiline maxLength={6000} error={errors.description} style={{ minHeight: 140 }} />
          <SeverityPicker value={severity} onChange={setSeverity} />
          </FormSection>
          <PillButton label="Save changes" size="lg" block onPress={submit} loading={update.isPending} />
        </View>
      )}
    </Screen>
  );
}
