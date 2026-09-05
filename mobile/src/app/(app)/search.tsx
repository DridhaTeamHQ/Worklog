import { useMemo, useState } from 'react';
import { Keyboard, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowUpRight, ChevronLeft, ChevronRight, FolderKanban, Search } from 'lucide-react-native';
import { useTasks } from '@/hooks/useTasks';
import { useTickets } from '@/hooks/useTickets';
import { useProjects } from '@/hooks/useProjects';
import { useUser } from '@/auth/store';
import { isManagerLevel } from '@/types';
import { useTheme } from '@/theme';
import { AuroraCard } from '@/components/AuroraCard';
import { BentoCard, EmptyState, ErrorState, IconPillButton, ProgressBar, Reveal, Screen, ScreenHeader, SearchField, SegmentedTabs, SkeletonList, Text } from '@/components';
import { TaskCard } from '@/features/TaskCard';
import { TicketCard } from '@/features/TicketCard';

const PAGE_SIZE = 20;
type Category = 'tasks' | 'tickets' | 'projects';

/** Search uses the same permission-scoped APIs as each workspace list. */
export default function WorkspaceSearch() {
  const t = useTheme();
  const router = useRouter();
  const manager = isManagerLevel(useUser()?.role);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<Category>('tasks');
  const [page, setPage] = useState(0);
  const query = search.trim();
  const tasks = useTasks({ search: query, limit: PAGE_SIZE, offset: page * PAGE_SIZE, sort: 'created_desc' }, { enabled: !!query && category === 'tasks' });
  const tickets = useTickets({ search: query, limit: PAGE_SIZE, offset: page * PAGE_SIZE, sort: 'created_desc' }, { enabled: !!query && category === 'tickets' });
  const projects = useProjects(true);
  const matchingProjects = useMemo(() => (projects.data ?? []).filter((p) => `${p.project_key} ${p.name} ${p.description ?? ''}`.toLowerCase().includes(query.toLowerCase())), [projects.data, query]);
  const active = category === 'tasks' ? tasks : category === 'tickets' ? tickets : projects;
  const placeholder = category === 'tasks' ? tasks.isPlaceholderData : category === 'tickets' ? tickets.isPlaceholderData : false;
  const pending = active.isPending || placeholder;
  const total = category === 'tasks' ? tasks.data?.total ?? 0 : category === 'tickets' ? tickets.data?.total ?? 0 : matchingProjects.length;
  const open = (path: string) => { Keyboard.dismiss(); router.push(path as never); };

  return <Screen keyboardDismissMode="on-drag">
    <ScreenHeader big={false} title="Workspace search" />
    <SearchField value={search} onChange={(next) => { setSearch(next); setPage(0); }} placeholder="Search your workspace" loading={!!query && active.isFetching} />
    <SegmentedTabs items={[{ key: 'tasks', label: 'Tasks' }, { key: 'tickets', label: 'Tickets' }, { key: 'projects', label: 'Projects' }]} value={category} onChange={(next) => { setCategory(next); setPage(0); }} />
    {!query ? <Reveal>
      <AuroraCard tone="sage" style={{ minHeight: 220, justifyContent: 'space-between' }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}><Text variant="caption" color="#E0E9D8" style={{ letterSpacing: 2 }}>LESS LOOKING. MORE DOING.</Text><Search size={22} color="#E5EDCE" /></View>
        <View style={{ gap: 10, marginTop: 36 }}><Text variant="h2" color="#FFFFFF">Everything has a place.</Text><Text variant="small" color="#E0E9D8">Find a task by its key or title, track down a ticket, or jump into a project.</Text></View>
      </AuroraCard>
      <Text variant="small" color="inkMuted" style={{ padding: 16 }}>Choose a category and start typing to find the work shared with you.</Text>
    </Reveal> : pending ? <SkeletonList count={3} /> : active.isError ? <ErrorState error={active.error} onRetry={() => active.refetch()} /> : total === 0 ? <EmptyState icon={Search} title="No matches yet" body={`No ${category} match “${query}”. Try a shorter phrase or another category.`} action={{ label: 'Clear search', onPress: () => { setSearch(''); setPage(0); } }} /> : <>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View style={{ flex: 1 }}><Text variant="smallStrong">{total} {total === 1 ? 'result' : 'results'}</Text><Text variant="caption" color="inkMuted">{page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} shown</Text></View>
        <IconPillButton icon={ChevronLeft} tone="soft" disabled={page === 0} accessibilityLabel="Previous results" onPress={() => setPage((p) => p - 1)} />
        <IconPillButton icon={ChevronRight} tone="soft" disabled={(page + 1) * PAGE_SIZE >= total} accessibilityLabel="Next results" onPress={() => setPage((p) => p + 1)} />
      </View>
      {category === 'tasks' ? tasks.data?.items.map((task, i) => <Reveal key={task.id} index={Math.min(i, 3)}><TaskCard task={task} compact showAssignee={manager} onPress={() => open(`/tasks/${task.id}`)} /></Reveal>) : category === 'tickets' ? tickets.data?.items.map((ticket, i) => <Reveal key={ticket.id} index={Math.min(i, 3)}><TicketCard ticket={ticket} showReporter={manager} onPress={() => open(`/tickets/${ticket.id}`)} /></Reveal>) : matchingProjects.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE).map((project, i) => <Reveal key={project.id} index={Math.min(i, 3)}>
        <BentoCard onPress={() => open(`/projects/${project.id}`)} accessibilityLabel={`Open project ${project.project_key}: ${project.name}`}>
          <View style={{ gap: 14 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}><FolderKanban size={20} color={t.colors.hero} /><Text variant="caption" color="inkMuted" style={{ flex: 1 }}>{project.project_key}{project.is_archived ? ' · Archived' : ''}</Text><ArrowUpRight size={18} color={t.colors.hero} /></View>
            <Text variant="h3">{project.name}</Text>
            {project.description ? <Text variant="small" color="inkMuted" numberOfLines={2}>{project.description}</Text> : null}
            <ProgressBar value={project.counts.total ? project.counts.completed / project.counts.total : 0} />
            <Text variant="caption" color="inkMuted">{project.counts.completed} of {project.counts.total} tasks complete</Text>
          </View>
        </BentoCard>
      </Reveal>)}
    </>}
  </Screen>;
}
