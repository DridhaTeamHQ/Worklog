import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { AlertOctagon, ArrowDown, ArrowUp, Minus, FolderKanban, UserRound } from 'lucide-react-native';
import { alpha, useTheme } from '@/theme';
import { useTeam } from '@/hooks/useTeam';
import { useProjects } from '@/hooks/useProjects';
import { useLabels } from '@/hooks/useLabels';
import { todayIso } from '@/lib/format';
import type { Priority } from '@/types';
import { Chip, DateField, Field, PickerField, PickerSheet, PillButton, Text, TextField, useSheet } from '@/components';
import { Pressable } from 'react-native';

export interface TaskFormValues {
  employeeId: number | null;
  projectId: number | null;
  title: string;
  description: string;
  notes: string;
  priority: Priority;
  startDate: string | null;
  deadline: string | null;
  labelIds: number[];
}

interface Props {
  initial?: Partial<TaskFormValues>;
  /** Assignee and project are fixed after creation (they issue the key). */
  lockAssignment?: boolean;
  submitLabel: string;
  busy?: boolean;
  errors?: Record<string, string>;
  onSubmit: (values: TaskFormValues) => void;
}

const PRIORITIES: { value: Priority; label: string; hint: string; icon: typeof Minus }[] = [
  { value: 'low', label: 'Low', hint: 'Whenever', icon: ArrowDown },
  { value: 'medium', label: 'Medium', hint: 'Normal', icon: Minus },
  { value: 'high', label: 'High', hint: 'Soon', icon: ArrowUp },
  { value: 'urgent', label: 'Urgent', hint: 'Drop the rest', icon: AlertOctagon },
];

/**
 * The assign/edit form. Only assignee and project are required, as on the web —
 * the rest can be filled in later. Priority is a row of cards; labels are chips.
 */
export function TaskForm({ initial, lockAssignment, submitLabel, busy, errors = {}, onSubmit }: Props) {
  const t = useTheme();
  const [values, setValues] = useState<TaskFormValues>({
    employeeId: null, projectId: null, title: '', description: '', notes: '', priority: 'medium',
    startDate: todayIso(), deadline: null, labelIds: [], ...initial,
  });
  const set = <K extends keyof TaskFormValues>(key: K, value: TaskFormValues[K]) => setValues((v) => ({ ...v, [key]: value }));
  const team = useTeam({}, { enabled: !lockAssignment });
  const projects = useProjects(false);
  const labels = useLabels();
  const employeeSheet = useSheet();
  const projectSheet = useSheet();

  const employeeOptions = useMemo(() => (team.data ?? []).map((m) => ({
    value: m.id, label: m.name,
    hint: [m.department, m.counts.pending + m.counts.in_progress ? `${m.counts.pending + m.counts.in_progress} open` : null, m.counts.overdue ? `${m.counts.overdue} overdue` : null].filter(Boolean).join(' · '),
  })), [team.data]);
  const projectOptions = useMemo(() => (projects.data ?? []).map((p) => ({ value: p.id, label: p.name, hint: `${p.project_key} · keys look like ${p.project_key}-12` })), [projects.data]);

  return (
    <View style={{ gap: 16 }}>
      {!lockAssignment ? (
        <>
          <PickerField label="Assign to" required icon={UserRound} value={employeeOptions.find((o) => o.value === values.employeeId)?.label ?? null} placeholder="Choose a team member" onPress={employeeSheet.open} error={errors.employeeId} />
          <PickerField label="Project" required icon={FolderKanban} value={projectOptions.find((o) => o.value === values.projectId)?.label ?? null} placeholder="Choose a project" onPress={projectSheet.open} error={errors.projectId} hint={values.projectId ? undefined : 'The task key is issued from the project.'} />
        </>
      ) : null}
      <TextField label="Title" value={values.title} onChangeText={(v) => set('title', v)} placeholder="What needs doing" maxLength={160} error={errors.title} />
      <TextField label="Description" value={values.description} onChangeText={(v) => set('description', v)} placeholder="Context, links, what done looks like" multiline maxLength={4000} error={errors.description} />
      <Field label="Priority">
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {PRIORITIES.map((p) => {
            const selected = values.priority === p.value;
            const color = t.tone('priority', p.value).color;
            const Icon = p.icon;
            return (
              <Pressable key={p.value} onPress={() => set('priority', p.value)} style={{ flex: 1, borderRadius: t.radius.md, padding: 10, borderWidth: 1.5, borderColor: selected ? color : t.colors.border, backgroundColor: selected ? alpha(color, t.isDark ? 0.22 : 0.1) : t.colors.cardAlt, alignItems: 'center', gap: 4 }}>
                <Icon size={16} color={selected ? color : t.colors.inkFaint} strokeWidth={2.6} />
                <Text variant="smallStrong" color={selected ? color : 'inkMuted'}>{p.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </Field>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <View style={{ flex: 1 }}><DateField label="Starts" value={values.startDate} onChange={(v) => set('startDate', v)} /></View>
        <View style={{ flex: 1 }}><DateField label="Deadline" value={values.deadline} onChange={(v) => set('deadline', v)} min={values.startDate} error={errors.deadline} /></View>
      </View>
      {(labels.data?.length ?? 0) > 0 ? (
        <Field label="Labels">
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {(labels.data ?? []).map((l) => {
              const on = values.labelIds.includes(l.id);
              return (
                <Pressable key={l.id} onPress={() => set('labelIds', on ? values.labelIds.filter((x) => x !== l.id) : [...values.labelIds, l.id])}>
                  <Chip label={l.name} color={l.color} filled={on} />
                </Pressable>
              );
            })}
          </View>
        </Field>
      ) : null}
      <TextField label="Notes" value={values.notes} onChangeText={(v) => set('notes', v)} placeholder="Anything the assignee should know" multiline maxLength={2000} error={errors.notes} />
      <PillButton label={submitLabel} size="lg" block loading={busy} onPress={() => onSubmit(values)} haptic="success" />

      <PickerSheet ref={employeeSheet.ref} title="Assign to" options={employeeOptions} value={values.employeeId} onSelect={(v) => set('employeeId', v)} searchable empty="No team members in your department yet." />
      <PickerSheet ref={projectSheet.ref} title="Project" options={projectOptions} value={values.projectId} onSelect={(v) => set('projectId', v)} searchable empty="No projects yet — create one from More › Projects." />
    </View>
  );
}
