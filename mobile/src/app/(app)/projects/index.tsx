import { AuroraSurface } from '@/components/AuroraCard';
import { ProgressBar } from '@/components';
import { ArrowUpRight } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { Archive, FolderKanban, Plus } from 'lucide-react-native';
import { useTheme } from '@/theme';
import { useProjects } from '@/hooks/useProjects';
import { BentoCard, EmptyState, ErrorState, IconPillButton, KeyChip, MiniBars, Reveal, Screen, ScreenHeader, SkeletonList, Text, TextButton } from '@/components';

/** Every project: key, name, counts, lead. Tap to edit or archive; + to create. */
export default function Projects() {
  const t = useTheme();
  const router = useRouter();
  const [showArchived, setShowArchived] = useState(false);
  const projects = useProjects(showArchived);
  const list = (projects.data ?? []).filter((p) => showArchived || !p.is_archived);

  return (
    <Screen refreshing={projects.isRefetching} onRefresh={() => projects.refetch()}>
      <ScreenHeader tone="iris" title="Projects" subtitle="The big picture, one project at a time." right={<IconPillButton icon={Plus} tone="ink" onPress={() => router.push('/projects/new')} accessibilityLabel="New project" />} />
      <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
        <TextButton label={showArchived ? 'Hide archived' : 'Show archived'} icon={Archive} color="inkMuted" onPress={() => setShowArchived((v) => !v)} />
      </View>
      {projects.isPending ? <SkeletonList count={3} /> : projects.isError ? <ErrorState error={projects.error} onRetry={() => projects.refetch()} /> : list.length === 0 ? (
        <EmptyState icon={FolderKanban} title="No projects yet" body="Create the first one and tasks can start being assigned." action={{ label: 'New project', onPress: () => router.push('/projects/new') }} />
      ) : list.map((p, i) => (
        <Reveal key={p.id} index={i}>
          <BentoCard padding={0} onPress={() => router.push(`/projects/${p.id}`)} style={{ overflow: 'hidden', opacity: p.is_archived ? 0.7 : 1 }}>
            <View style={{ padding: 22, minHeight: 144, gap: 20 }}>
              <AuroraSurface tone={(['iris', 'sage', 'rose', 'clay'] as const)[i % 4]} />
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <KeyChip value={p.project_key} onHero />
                <ArrowUpRight size={20} color="#E0E4DC" />
              </View>
              <Text variant="h2" color="#F8F8F1">{p.name}</Text>
            </View>
            <View style={{ padding: 20, gap: 14 }}>
              {p.description ? <Text variant="small" color="inkMuted" numberOfLines={2}>{p.description}</Text> : null}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
                <Text variant="small">{p.counts.completed} / {p.counts.total} tasks done</Text>
                <Text variant="smallStrong" color={p.counts.overdue ? 'danger' : 'hero'}>{p.counts.overdue ? `${p.counts.overdue} overdue` : `${p.counts.total ? Math.round(p.counts.completed / p.counts.total * 100) : 0}%`}</Text>
              </View>
              <ProgressBar value={p.counts.total ? p.counts.completed / p.counts.total : 0} height={4} />
              <Text variant="caption" color="inkMuted">{p.is_archived ? 'Archived' : p.lead_name ? `Led by ${p.lead_name}` : 'No lead assigned'}</Text>
            </View>
          </BentoCard>
        </Reveal>
      ))}
    </Screen>
  );
}
