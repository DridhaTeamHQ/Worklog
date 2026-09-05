import { useUser } from '@/auth/store';
import { isManagerLevel } from '@/types';
import { useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowUpRight, Bug, ListChecks, Pencil } from 'lucide-react-native';
import { useProject, useProjects } from '@/hooks/useProjects';
import { useTasks } from '@/hooks/useTasks';
import { useTickets } from '@/hooks/useTickets';
import { formatDateShort } from '@/lib/format';
import { BentoCard, EmptyState, ErrorState, IconPillButton, ListGroup, Reveal, Screen, ScreenHeader, SearchField, SectionTitle, SegmentedTabs, SkeletonList, Text, TextButton, ValueRow } from '@/components';
import { ProjectHero } from '@/features/ProjectHero';
import { TaskCard } from '@/features/TaskCard';
import { TicketCard } from '@/features/TicketCard';

/** Project home: a live overview and its work, with editing on a separate route. */
export default function ProjectDetail() {
  const router = useRouter();
  const manager = isManagerLevel(useUser()?.role);
  const { id: raw } = useLocalSearchParams<{ id: string }>();
  const id = Number(raw) || null;
  const project = useProject(id);
  const summaries = useProjects(true);
  const [tab, setTab] = useState<'work' | 'tickets' | 'about'>('work');
  const [search, setSearch] = useState('');
  const tasks = useTasks({ projectId: id ?? undefined, search: search || undefined, sort: 'deadline_asc', limit: 200 }, { enabled: !!id && !project.isError });
  const tickets = useTickets({ projectId: id ?? undefined, search: search || undefined, sort: 'created_desc', limit: 200 }, { enabled: !!id && tab === 'tickets' && !project.isError });
  const p = project.data;
  const summary = summaries.data?.find((item) => item.id === id);
  const refresh = () => { void project.refetch(); void summaries.refetch(); void tasks.refetch(); if (tab === 'tickets') void tickets.refetch(); };

  return <Screen refreshing={project.isRefetching} onRefresh={refresh}>
    <ScreenHeader big={false} title="Project" right={p && manager ? <IconPillButton icon={Pencil} tone="soft" accessibilityLabel="Edit project" onPress={() => router.push(`/projects/edit/${p.id}`)} /> : undefined} />
    {project.isPending ? <SkeletonList count={3} /> : project.isError || !p ? <ErrorState error={project.error} onRetry={() => project.refetch()} /> : <>
      <Reveal>{summary ? <ProjectHero project={{ ...p, counts: summary.counts }} canManage={manager} /> : summaries.isPending ? <SkeletonList count={1} /> : <ErrorState error={summaries.error ?? new Error('Project totals are unavailable.')} onRetry={() => summaries.refetch()} />}</Reveal>
      <SegmentedTabs items={[{ key: 'work', label: 'Work' }, { key: 'tickets', label: 'Tickets' }, { key: 'about', label: 'About' }]} value={tab} onChange={(next) => { setTab(next); setSearch(''); }} />
      {tab === 'about' ? <Reveal>
        <View style={{ gap: 20 }}>
          <BentoCard><Text variant="caption" color="inkMuted" style={{ letterSpacing: 1.6, marginBottom: 12 }}>THE BIG PICTURE</Text><Text variant="body">{p.description || 'Every good project starts with a little context. Add a description so the team knows what you are building.'}</Text>{manager ? <View style={{ marginTop: 18 }}><TextButton label="Edit project details" icon={Pencil} onPress={() => router.push(`/projects/edit/${p.id}`)} /></View> : null}</BentoCard>
          <ListGroup><ValueRow label="Project key" value={p.project_key} /><ValueRow label="Created" value={formatDateShort(p.created_at)} divider /><ValueRow label="Updated" value={formatDateShort(p.updated_at)} divider /><ValueRow label="Status" value={p.is_archived ? 'Archived' : 'Active'} divider /></ListGroup>
        </View>
      </Reveal> : <>
        <SearchField value={search} onChange={setSearch} placeholder={tab === 'work' ? 'Search project tasks' : 'Search project tickets'} />
        <SectionTitle title={tab === 'work' ? 'Project tasks' : 'Conversations'} right={tab === 'work' ? <TextButton label="Open board" icon={ArrowUpRight} onPress={() => router.push({ pathname: manager ? '/(app)/(manager)/tasks' : '/(app)/(member)/tasks', params: { projectId: String(p.id), view: 'board', status: 'all' } })} /> : undefined} />
        {tab === 'work' ? tasks.isPending || tasks.isPlaceholderData ? <SkeletonList count={2} /> : tasks.isError ? <ErrorState error={tasks.error} onRetry={() => tasks.refetch()} /> : tasks.data.items.length ? <>
          {tasks.data.items.map((task, i) => <Reveal key={task.id} index={Math.min(i, 4)}><TaskCard task={task} showAssignee onPress={() => router.push(`/tasks/${task.id}`)} /></Reveal>)}
          {tasks.data.total > tasks.data.items.length ? <Text variant="small" color="inkMuted">Showing {tasks.data.items.length} of {tasks.data.total}. Narrow your search to find more.</Text> : null}
        </> : <EmptyState icon={ListChecks} title={search ? 'No matching work' : 'A fresh canvas'} body={search ? 'Try a different word or key.' : 'Give your project its first task.'} action={manager && !search && !p.is_archived ? { label: 'Add a task', onPress: () => router.push({ pathname: '/tasks/assign', params: { projectId: String(p.id) } }) } : undefined} />
        : tickets.isPending || tickets.isPlaceholderData ? <SkeletonList count={2} /> : tickets.isError ? <ErrorState error={tickets.error} onRetry={() => tickets.refetch()} /> : tickets.data.items.length ? <>
          {tickets.data.items.map((ticket, i) => <Reveal key={ticket.id} index={Math.min(i, 4)}><TicketCard ticket={ticket} showReporter onPress={() => router.push(`/tickets/${ticket.id}`)} /></Reveal>)}
          {tickets.data.total > tickets.data.items.length ? <Text variant="small" color="inkMuted">Showing {tickets.data.items.length} of {tickets.data.total}. Narrow your search to find more.</Text> : null}
        </> : <EmptyState icon={Bug} title={search ? 'No matching tickets' : 'A clear path'} body={search ? 'Try a different word or key.' : 'Tickets linked to this project will appear here.'} />}
      </>}
    </>}
  </Screen>;
}
