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
      <ScreenHeader title="Projects" subtitle="Tasks live inside projects; each issues its own keys." right={<IconPillButton icon={Plus} tone="ink" onPress={() => router.push('/projects/new')} accessibilityLabel="New project" />} />
      <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
        <TextButton label={showArchived ? 'Hide archived' : 'Show archived'} icon={Archive} color="inkMuted" onPress={() => setShowArchived((v) => !v)} />
      </View>
      {projects.isPending ? <SkeletonList count={3} /> : projects.isError ? <ErrorState error={projects.error} onRetry={() => projects.refetch()} /> : list.length === 0 ? (
        <EmptyState icon={FolderKanban} title="No projects yet" body="Create the first one and tasks can start being assigned." action={{ label: 'New project', onPress: () => router.push('/projects/new') }} />
      ) : list.map((p, i) => (
        <Reveal key={p.id} index={i}>
          <BentoCard onPress={() => router.push(`/projects/${p.id}`)} style={p.is_archived ? { opacity: 0.7 } : undefined}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{ flex: 1, gap: 6 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <KeyChip value={p.project_key} size="md" />
                  {p.is_archived ? <Text variant="caption" color="inkFaint">Archived</Text> : null}
                </View>
                <Text variant="h3">{p.name}</Text>
                {p.description ? <Text variant="small" color="inkMuted" numberOfLines={2}>{p.description}</Text> : null}
                <Text variant="small" color="inkFaint">{p.counts.total} tasks · {p.counts.completed} done{p.counts.overdue ? ` · ${p.counts.overdue} overdue` : ''}{p.lead_name ? ` · Lead ${p.lead_name}` : ''}</Text>
              </View>
              <MiniBars data={[{ value: p.counts.pending }, { value: p.counts.in_progress }, { value: p.counts.completed }, { value: p.counts.overdue, highlight: true }]} color={t.colors.hero} height={40} barWidth={8} />
            </View>
          </BentoCard>
        </Reveal>
      ))}
    </Screen>
  );
}
