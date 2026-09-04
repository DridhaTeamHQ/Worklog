import { View } from 'react-native';
import { useTheme } from '@/theme';
import type { TeamMember } from '@/types';
import { Avatar, BentoCard, Chip, Text } from '@/components';

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
        <View style={{ alignItems: 'flex-end', gap: 4 }}>
          <Text variant="smallStrong">{open} open</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: member.submitted_today ? t.colors.success : t.colors.inkFaint }} />
            <Text variant="caption" color={member.submitted_today ? 'success' : 'inkFaint'}>{member.submitted_today ? 'Reported' : 'No report'}</Text>
          </View>
        </View>
      </View>
    </BentoCard>
  );
}
