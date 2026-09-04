import { useMemo, useRef, useState } from 'react';
import { Alert, Pressable, TextInput, View } from 'react-native';
import { AtSign, Send, Trash2 } from 'lucide-react-native';
import { alpha, useTheme } from '@/theme';
import { relativeTime } from '@/lib/format';
import { useActivity, useAddComment, useDeleteComment } from '@/hooks/useActivity';
import { useTeam } from '@/hooks/useTeam';
import { useUser } from '@/auth/store';
import { errorMessage } from '@/api/client';
import type { ActivityEntity } from '@/api/endpoints';
import type { ActivityEntry } from '@/types';
import { isManagerLevel } from '@/types';
import { Avatar, Chip, IconPillButton, PickerSheet, Skeleton, Text, useSheet, useToast } from '@/components';

const STATUS_WORD: Record<string, string> = { pending: 'Pending', in_progress: 'In progress', completed: 'Done', open: 'Open', resolved: 'Resolved', closed: 'Closed' };

/** One line of plain English for a system row. */
function describe(entry: ActivityEntry): string {
  const m = (entry.meta ?? {}) as Record<string, unknown>;
  switch (entry.kind) {
    case 'assigned': return `assigned this to ${String(m.toName ?? 'someone')}`;
    case 'status_changed': return `moved ${STATUS_WORD[String(m.from)] ?? m.from} → ${STATUS_WORD[String(m.to)] ?? m.to}${m.resolutionNote ? ` · "${String(m.resolutionNote)}"` : ''}`;
    case 'field_changed': return `edited ${(m.fields as string[] | undefined)?.map((f) => f.replace('_', ' ')).join(', ') || 'details'}`;
    case 'checklist': {
      const action = String(m.action);
      const title = String(m.title ?? '');
      return action === 'done' ? `ticked "${title}"` : action === 'reopened' ? `unticked "${title}"` : action === 'removed' ? `removed "${title}"` : `added "${title}"`;
    }
    case 'report_linked': return `mentioned this in their daily report${m.minutes ? ` (${String(m.minutes)} min)` : ''}`;
    case 'labels_changed': return 'changed the labels';
    case 'ticket_raised': return m.ticketId ? `raised ticket ${String(m.key ?? '')}` : 'raised this ticket';
    case 'attachment': return 'added an attachment';
    default: return entry.kind;
  }
}

interface Props {
  entity: ActivityEntity;
  id: number;
  /** Whether the current user may write — always true for anyone who can see it. */
  canComment?: boolean;
}

/**
 * The thread: system rows as quiet one-liners, comments as speech bubbles, and a
 * composer with an @mention picker at the bottom.
 */
export function ActivityThread({ entity, id, canComment = true }: Props) {
  const t = useTheme();
  const user = useUser();
  const toast = useToast();
  const activity = useActivity(entity, id);
  const add = useAddComment(entity, id);
  const remove = useDeleteComment(entity, id);
  const [draft, setDraft] = useState('');
  const [mentions, setMentions] = useState<{ id: number; name: string }[]>([]);
  const input = useRef<TextInput>(null);
  const mentionSheet = useSheet();
  const manager = isManagerLevel(user?.role);
  // Only manager-level users can list the team; members mention their manager from
  // the thread itself.
  const team = useTeam({}, { enabled: manager });

  const people = useMemo(() => {
    const seen = new Map<number, string>();
    for (const row of activity.data ?? []) if (row.actor_id && row.actor_name && row.actor_id !== user?.id) seen.set(row.actor_id, row.actor_name);
    for (const m of team.data ?? []) if (m.id !== user?.id) seen.set(m.id, m.name);
    return [...seen.entries()].map(([value, label]) => ({ value, label }));
  }, [activity.data, team.data, user?.id]);

  const submit = async () => {
    const body = draft.trim();
    if (!body) return;
    try {
      await add.mutateAsync({ body, mentions: mentions.map((m) => m.id) });
      setDraft('');
      setMentions([]);
    } catch (err) {
      toast.error('Could not post', errorMessage(err));
    }
  };

  const confirmDelete = (commentId: number) => {
    Alert.alert('Delete comment?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => remove.mutate(commentId) },
    ]);
  };

  return (
    <View style={{ gap: 12 }}>
      {activity.isPending ? (
        <View style={{ gap: 10 }}><Skeleton height={14} width="60%" /><Skeleton height={14} width="80%" /><Skeleton height={44} /></View>
      ) : (activity.data ?? []).length === 0 ? (
        <Text variant="small" color="inkFaint">Nothing has happened here yet.</Text>
      ) : (
        (activity.data ?? []).map((row) => (row.kind === 'comment' ? (
          <View key={row.id} style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-end' }}>
            <Avatar name={row.actor_name ?? '?'} src={row.actor_profile_image} size="sm" />
            <View style={{ flex: 1, backgroundColor: row.actor_id === user?.id ? alpha(t.colors.hero, t.isDark ? 0.14 : 0.08) : t.colors.cardAlt, borderRadius: t.radius.md, borderBottomLeftRadius: 4, padding: 12, gap: 4 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text variant="smallStrong" style={{ flex: 1 }}>{row.actor_name ?? 'Someone'}</Text>
                <Text variant="caption" color="inkFaint" style={{ letterSpacing: 0 }}>{relativeTime(row.created_at)}{row.edited_at ? ' · edited' : ''}</Text>
                {row.actor_id === user?.id || user?.role === 'admin' ? (
                  <Pressable onPress={() => confirmDelete(row.id)} hitSlop={8} accessibilityLabel="Delete comment">
                    <Trash2 size={14} color={t.colors.inkFaint} />
                  </Pressable>
                ) : null}
              </View>
              <Text variant="body">{row.body}</Text>
            </View>
          </View>
        ) : (
          <View key={row.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 4 }}>
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: t.colors.inkFaint }} />
            <Text variant="small" color="inkMuted" style={{ flex: 1 }}>
              <Text variant="smallStrong" color="inkMuted">{row.actor_name ?? 'System'}</Text> {describe(row)}
            </Text>
            <Text variant="caption" color="inkFaint" style={{ letterSpacing: 0 }}>{relativeTime(row.created_at)}</Text>
          </View>
        )))
      )}

      {canComment ? (
        <View style={{ gap: 8 }}>
          {mentions.length ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {mentions.map((m) => (
                <Pressable key={m.id} onPress={() => setMentions((cur) => cur.filter((x) => x.id !== m.id))}>
                  <Chip label={`@${m.name}`} color={t.colors.hero} icon={AtSign} />
                </Pressable>
              ))}
            </View>
          ) : null}
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8 }}>
            <View style={{ flex: 1, backgroundColor: t.colors.cardAlt, borderRadius: t.radius.lg, paddingHorizontal: 14, paddingVertical: 8, minHeight: 46, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <TextInput
                maxFontSizeMultiplier={1.15}
                ref={input}
                value={draft}
                onChangeText={setDraft}
                placeholder="Write a comment…"
                placeholderTextColor={t.colors.inkFaint}
                multiline
                style={{ flex: 1, color: t.colors.ink, fontFamily: t.fonts.medium, fontSize: 15, maxHeight: 120, paddingVertical: 4 }}
              />
              {people.length ? (
                <Pressable onPress={mentionSheet.open} hitSlop={8} accessibilityLabel="Mention someone">
                  <AtSign size={18} color={t.colors.inkFaint} />
                </Pressable>
              ) : null}
            </View>
            <IconPillButton icon={Send} onPress={submit} disabled={!draft.trim() || add.isPending} accessibilityLabel="Post comment" />
          </View>
        </View>
      ) : null}

      <PickerSheet
        ref={mentionSheet.ref}
        title="Mention"
        options={people}
        searchable={people.length > 6}
        onSelect={(value) => {
          const person = people.find((p) => p.value === value);
          if (person && !mentions.some((m) => m.id === value)) setMentions((cur) => [...cur, { id: value, name: person.label }]);
        }}
      />
    </View>
  );
}
