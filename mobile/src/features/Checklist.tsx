import { useState } from 'react';
import { Alert, Pressable, TextInput, View } from 'react-native';
import { Plus, Trash2 } from 'lucide-react-native';
import { useTheme } from '@/theme';
import { useAddChecklistItem, useChecklist, useDeleteChecklistItem, useToggleChecklistItem } from '@/hooks/useChecklist';
import { errorMessage } from '@/api/client';
import { CheckRow, IconPillButton, ProgressBar, Skeleton, Text, useToast } from '@/components';

interface Props {
  taskId: number;
  editable: boolean;
}

/** The sub-steps of a task: tick, add, remove, with a progress bar on top. */
export function Checklist({ taskId, editable }: Props) {
  const t = useTheme();
  const toast = useToast();
  const items = useChecklist(taskId);
  const add = useAddChecklistItem(taskId);
  const toggle = useToggleChecklistItem(taskId);
  const remove = useDeleteChecklistItem(taskId);
  const [draft, setDraft] = useState('');

  const list = items.data ?? [];
  const done = list.filter((i) => i.is_done).length;

  const submit = async () => {
    const title = draft.trim();
    if (!title) return;
    try {
      await add.mutateAsync(title);
      setDraft('');
    } catch (err) {
      toast.error('Could not add', errorMessage(err));
    }
  };

  return (
    <View style={{ gap: 8 }}>
      {list.length ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={{ flex: 1 }}><ProgressBar value={list.length ? done / list.length : 0} color={t.colors.success} height={6} /></View>
          <Text variant="smallStrong" color="inkMuted">{done}/{list.length}</Text>
        </View>
      ) : null}
      {items.isPending ? <Skeleton height={40} /> : null}
      {list.map((item) => (
        <CheckRow
          key={item.id}
          checked={item.is_done}
          label={item.title}
          onToggle={editable ? (next) => toggle.mutate({ itemId: item.id, isDone: next }) : undefined}
          disabled={!editable}
          right={editable ? (
            <Pressable
              onPress={() => Alert.alert('Remove item?', item.title, [{ text: 'Cancel', style: 'cancel' }, { text: 'Remove', style: 'destructive', onPress: () => remove.mutate(item.id) }])}
              hitSlop={8}
              accessibilityLabel="Remove checklist item"
            >
              <Trash2 size={16} color={t.colors.inkFaint} />
            </Pressable>
          ) : undefined}
        />
      ))}
      {!items.isPending && list.length === 0 && !editable ? <Text variant="small" color="inkFaint">No checklist.</Text> : null}
      {editable ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={{ flex: 1, backgroundColor: t.colors.cardAlt, borderRadius: t.radius.pill, borderWidth: 1.5, borderColor: t.colors.border, paddingHorizontal: 14, height: 44, justifyContent: 'center' }}>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder="Add a step…"
              placeholderTextColor={t.colors.inkFaint}
              onSubmitEditing={submit}
              returnKeyType="done"
              blurOnSubmit={false}
              style={{ color: t.colors.ink, fontFamily: t.fonts.medium, fontSize: 15, paddingVertical: 0 }}
            />
          </View>
          <IconPillButton icon={Plus} size={40} onPress={submit} disabled={!draft.trim() || add.isPending} accessibilityLabel="Add checklist item" />
        </View>
      ) : null}
    </View>
  );
}
