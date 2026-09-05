import { View } from 'react-native';
import { ArrowUpRight, CircleCheck, Layers3 } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '@/theme';
import { useAnimatedNumber } from '@/hooks/useAnimatedNumber';
import type { Project } from '@/types';
import { Avatar, KeyChip, PillButton, ProgressBar, Text } from '@/components';
import { AuroraSurface } from '@/components/AuroraCard';
import { DotNumber } from '@/components/DotNumber';

export function ProjectHero({ project: p, canManage }: { project: Project; canManage: boolean }) {
  const t = useTheme();
  const router = useRouter();
  const rate = p.counts.total ? p.counts.completed / p.counts.total : 0;
  const shown = useAnimatedNumber(Math.round(rate * 100));
  return <View style={{ borderRadius: 32, overflow: 'hidden', borderWidth: 1, borderColor: t.colors.hairline, backgroundColor: t.colors.card }}>
    <View style={{ padding: 24, gap: 22 }}>
      <AuroraSurface tone="iris" />
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}><KeyChip value={p.project_key} onHero /><Text variant="caption" color="#E0E4DC" style={{ letterSpacing: 1.4 }}>{p.is_archived ? 'ARCHIVED' : 'PROJECT SPACE'}</Text></View>
      <Text variant="h1" color="#FAFAF3" style={{ fontFamily: t.fonts.medium }}>{p.name}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
        <View style={{ gap: 8 }}><View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 5 }}><DotNumber value={shown} height={38} color="#F4F6EA" /><Text variant="unit" color="#E0E4DC">%</Text></View><Text variant="caption" color="#E0E4DC">of the work complete</Text></View>
        <View style={{ width: 64, height: 64, borderRadius: 32, borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)', alignItems: 'center', justifyContent: 'center' }}>{rate === 1 ? <CircleCheck size={28} color="#DCEAAB" strokeWidth={1.2} /> : <Layers3 size={28} color="#DCEAAB" strokeWidth={1.2} />}</View>
      </View>
      <ProgressBar value={rate} color="#DCEAAB" track="rgba(255,255,255,0.16)" height={3} />
    </View>
    <View style={{ padding: 22, gap: 18 }}>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        {[{ label: 'Total tasks', value: p.counts.total }, { label: 'Completed', value: p.counts.completed }, { label: 'Overdue', value: p.counts.overdue }].map((stat, i) => <View key={stat.label} style={{ flex: 1, gap: 5, borderLeftWidth: i ? 1 : 0, borderLeftColor: t.colors.hairline, paddingLeft: i ? 14 : 0 }}><Text variant="h2" color={i === 2 && stat.value ? 'danger' : 'ink'}>{stat.value}</Text><Text variant="caption" color="inkMuted">{stat.label}</Text></View>)}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 16, borderTopWidth: 1, borderTopColor: t.colors.hairline }}>
        {p.lead_name ? <Avatar name={p.lead_name} size="sm" /> : null}
        <View style={{ flex: 1, gap: 2 }}><Text variant="caption" color="inkMuted">Project lead</Text><Text variant="smallStrong">{p.lead_name ?? 'Not assigned yet'}</Text></View>
        {canManage && !p.is_archived ? <PillButton label="Add task" size="sm" iconRight={ArrowUpRight} onPress={() => router.push({ pathname: '/tasks/assign', params: { projectId: String(p.id) } })} /> : null}
      </View>
    </View>
  </View>;
}
