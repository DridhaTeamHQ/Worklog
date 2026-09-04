import { useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { Plus, Tags, Trash2 } from 'lucide-react-native';
import { useTheme } from '@/theme';
import { useUser } from '@/auth/store';
import { useCreateLabel, useDeleteLabel, useLabels } from '@/hooks/useLabels';
import { ApiError, errorMessage } from '@/api/client';
import { isAdmin } from '@/types';
import { BentoCard, Chip, EmptyState, ErrorState, IconPillButton, Reveal, Screen, ScreenHeader, SkeletonList, Text, TextField, useToast } from '@/components';

const SWATCHES = ['#5B7FE8', '#22A06B', '#D9A21B', '#E5484D', '#8B5CF6', '#EC4899', '#0EA5E9', '#64748B'];

/** The company's labels: create, and (admins) delete. Applying them happens on a task. */
export default function Labels() {
  const t = useTheme();
  const toast = useToast();
  const user = useUser();
  const labels = useLabels();
  const create = useCreateLabel();
  const remove = useDeleteLabel();
  const [name, setName] = useState('');
  const [color, setColor] = useState(SWATCHES[0]);
  const [error, setError] = useState<string | null>(null);
  const admin = isAdmin(user?.role);

  const add = () => {
    const trimmed = name.trim();
    if (!trimmed) { setError('Give the label a name.'); return; }
    setError(null);
    create.mutate({ name: trimmed, color }, {
      onSuccess: () => { setName(''); toast.success('Label created'); },
      onError: (err) => setError(err instanceof ApiError ? err.message : errorMessage(err)),
    });
  };

  return (
    <Screen refreshing={labels.isRefetching} onRefresh={() => labels.refetch()}>
      <ScreenHeader title="Labels" subtitle="Tags that cut across projects." />
      <Reveal>
        <BentoCard>
          <View style={{ gap: 12 }}>
            <TextField label="New label" value={name} onChangeText={setName} placeholder="customer-facing" maxLength={40} error={error} onSubmitEditing={add} returnKeyType="done" />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
              {SWATCHES.map((c) => (
                <Pressable key={c} onPress={() => setColor(c)} accessibilityLabel={`Colour ${c}`} style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: c, borderWidth: color === c ? 3 : 0, borderColor: t.colors.ink }} />
              ))}
              <View style={{ flex: 1 }} />
              <IconPillButton icon={Plus} onPress={add} disabled={!name.trim() || create.isPending} accessibilityLabel="Create label" />
            </View>
            {name.trim() ? <Chip label={name.trim()} color={color} /> : null}
          </View>
        </BentoCard>
      </Reveal>

      {labels.isPending ? <SkeletonList count={2} lines={1} /> : labels.isError ? <ErrorState error={labels.error} onRetry={() => labels.refetch()} /> : (labels.data?.length ?? 0) === 0 ? (
        <EmptyState icon={Tags} title="No labels yet" body="Create a few above — 'blocked', 'customer-facing', 'backend' — and apply them from a task." compact />
      ) : (
        <Reveal index={1}>
          <BentoCard>
            <View style={{ gap: 4 }}>
              {labels.data!.map((l) => (
                <View key={l.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 }}>
                  <Chip label={l.name} color={l.color} filled />
                  <Text variant="small" color="inkMuted" style={{ flex: 1 }}>{l.task_count ?? 0} task{(l.task_count ?? 0) === 1 ? '' : 's'}</Text>
                  {admin ? (
                    <Pressable onPress={() => Alert.alert('Delete label?', `"${l.name}" is removed from every task it is on.`, [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: () => remove.mutate(l.id, { onError: (err) => toast.error('Could not delete', errorMessage(err)) }) }])} hitSlop={8} accessibilityLabel={`Delete ${l.name}`}>
                      <Trash2 size={16} color={t.colors.inkFaint} />
                    </Pressable>
                  ) : null}
                </View>
              ))}
            </View>
          </BentoCard>
        </Reveal>
      )}
      {!admin ? <Text variant="small" color="inkFaint" align="center">Only an admin can delete a label.</Text> : null}
    </Screen>
  );
}
