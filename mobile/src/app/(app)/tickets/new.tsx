import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { FolderKanban, ListChecks } from 'lucide-react-native';
import { useTasks } from '@/hooks/useTasks';
import { useCreateTicket } from '@/hooks/useTickets';
import { ApiError, errorMessage } from '@/api/client';
import { taskLabel } from '@/lib/format';
import type { TicketSeverity } from '@/types';
import { BentoCard, EmptyState, KeyChip, PickerField, PickerSheet, PillButton, Screen, ScreenHeader, Text, TextField, useSheet, useToast } from '@/components';
import { SeverityPicker, TICKET_PLACEHOLDER } from '@/features/TicketForm';

/** Raise a bug against one of your own tasks: project → task → what went wrong. */
export default function NewTicket() {
  const router = useRouter();
  const toast = useToast();
  const params = useLocalSearchParams<{ taskId?: string; projectId?: string }>();
  const tasks = useTasks({ limit: 200, sort: 'created_desc' });
  const create = useCreateTicket();
  const [projectId, setProjectId] = useState<number | null>(Number(params.projectId) || null);
  const [taskId, setTaskId] = useState<number | null>(Number(params.taskId) || null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [severity, setSeverity] = useState<TicketSeverity>('medium');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const projectSheet = useSheet();
  const taskSheet = useSheet();

  const projects = useMemo(() => {
    const map = new Map<number, { id: number; key: string; name: string; count: number }>();
    for (const task of tasks.data?.items ?? []) {
      if (!task.project_id || !task.project_key) continue;
      const cur = map.get(task.project_id) ?? { id: task.project_id, key: task.project_key, name: task.project_name ?? task.project_key, count: 0 };
      cur.count += 1;
      map.set(task.project_id, cur);
    }
    return [...map.values()];
  }, [tasks.data]);
  const inProject = useMemo(() => (tasks.data?.items ?? []).filter((x) => x.project_id === projectId), [tasks.data, projectId]);
  const chosen = inProject.find((x) => x.id === taskId) ?? null;

  useEffect(() => {
    if (taskId && !projectId) {
      const found = (tasks.data?.items ?? []).find((x) => x.id === taskId);
      if (found?.project_id) setProjectId(found.project_id);
    }
  }, [taskId, projectId, tasks.data]);

  const submit = () => {
    const next: Record<string, string> = {};
    if (!projectId) next.projectId = 'Pick the project.';
    if (!taskId) next.taskId = 'Pick the task you were working on.';
    if (!title.trim()) next.title = 'Give it a short summary.';
    if (!description.trim()) next.description = 'Describe what went wrong.';
    setErrors(next);
    if (Object.keys(next).length) return;
    create.mutate({ projectId: projectId!, taskId: taskId!, title: title.trim(), description: description.trim(), severity }, {
      onSuccess: (res) => { toast.success('Ticket raised', res.data.message); router.replace(`/tickets/${res.data.ticket.id}`); },
      onError: (err) => {
        if (err instanceof ApiError && err.details?.length) setErrors(err.fieldErrors);
        else toast.error('Could not raise the ticket', errorMessage(err));
      },
    });
  };

  const noTasks = !tasks.isPending && (tasks.data?.items.length ?? 0) === 0;

  return (
    <Screen>
      <ScreenHeader title="Raise a ticket" subtitle="A bug you hit while working on a task." />
      {noTasks ? <EmptyState icon={ListChecks} title="No tasks yet" body="Tickets are raised against a task assigned to you. Once you have one, come back here." /> : (
        <View style={{ gap: 16 }}>
          <PickerField label="Project" required icon={FolderKanban} value={projects.find((p) => p.id === projectId) ? `${projects.find((p) => p.id === projectId)!.key} · ${projects.find((p) => p.id === projectId)!.name}` : null} placeholder="Choose a project" onPress={projectSheet.open} error={errors.projectId} />
          <PickerField label="Task" required icon={ListChecks} value={chosen ? `${chosen.task_key ?? ''} ${taskLabel(chosen)}`.trim() : null} placeholder={projectId ? 'Choose the task' : 'Pick a project first'} onPress={taskSheet.open} disabled={!projectId} error={errors.taskId} />
          {chosen ? (
            <BentoCard tone="alt" elevated={false} padding={12}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <KeyChip value={chosen.task_key} />
                <Text variant="small" color="inkMuted" numberOfLines={1} style={{ flex: 1 }}>Working on: {taskLabel(chosen)}</Text>
              </View>
            </BentoCard>
          ) : null}
          <TextField label="Summary" required value={title} onChangeText={setTitle} placeholder="Crash when saving twice" maxLength={160} error={errors.title} />
          <TextField label="What happened" required value={description} onChangeText={setDescription} placeholder={TICKET_PLACEHOLDER} multiline maxLength={6000} error={errors.description} style={{ minHeight: 140 }} />
          <SeverityPicker value={severity} onChange={setSeverity} />
          <PillButton label="Raise ticket" size="lg" block onPress={submit} loading={create.isPending} haptic="success" />
          <Text variant="small" color="inkFaint" align="center">The manager who assigned the task is notified.</Text>
        </View>
      )}
      <PickerSheet ref={projectSheet.ref} title="Project" options={projects.map((p) => ({ value: p.id, label: p.name, hint: `${p.key} · ${p.count} of your tasks` }))} value={projectId} onSelect={(v) => { setProjectId(v); setTaskId(null); }} />
      <PickerSheet ref={taskSheet.ref} title="Task" options={inProject.map((x) => ({ value: x.id, label: taskLabel(x), hint: x.task_key ?? undefined }))} value={taskId} onSelect={setTaskId} searchable={inProject.length > 6} empty="No tasks in this project." />
    </Screen>
  );
}
