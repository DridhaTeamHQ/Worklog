import { View } from 'react-native';
import { useTheme } from '@/theme';
import type { TeamMember } from '@/types';
import { Avatar, BentoCard, Chip, Text, ProgressBar } from '@/components';

interface Props {
  member: TeamMember;
  onPress?: () => void;
}

/** A person in the roster: avatar, name, where they sit, and two quiet facts. */
export function MemberRow({ member, onPress }: Props) {
  const t = useTheme();
  const c = member.counts;
  const open = c.pending + c.in_progress;
  return (
    <BentoCard onPress={onPress} padding={t.spacing.lg}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <Avatar name={member.name} src={member.profile_image} size="md" />
        <View style={{ flex: 1, gap: 2 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text variant="bodyStrong" numberOfLines={1} style={{ flexShrink: 1 }}>{member.name}</Text>
            {member.invited ? <Chip label="Invited" color={t.colors.warning} size="sm" /> : null}
            {c.overdue ? <Chip label={`${c.overdue} overdue`} color={t.colors.danger} size="sm" /> : null}
          </View>
          <Text variant="small" color="inkMuted" numberOfLines={1}>
            {[member.department, member.job_title].filter(Boolean).join(' · ') || member.email}
          </Text>
        </View>

      </View>
      <View style={{ gap: 10, marginTop: 20, paddingTop: 16, borderTopWidth: 1, borderTopColor: t.colors.hairline }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
          <Text variant="small" color="inkMuted">{open} open · {c.completed} done</Text>
          <Text variant="caption" color={member.submitted_today ? 'success' : 'inkFaint'}>{member.submitted_today ? 'Reported today' : 'No report today'}</Text>
        </View>
        <ProgressBar value={c.total ? c.completed / c.total : 0} height={3} />
      </View>
    </BentoCard>
  );
}
