import { useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSetTaskLabels, useTask, useUpdateTask } from '@/hooks/useTasks';
import { ApiError, errorMessage } from '@/api/client';
import { ErrorState, Screen, ScreenHeader, SkeletonList, Text, useToast } from '@/components';
import { TaskForm, type TaskFormValues } from '@/features/TaskForm';

/** Correct a task's wording, priority, dates, notes and labels. Assignee and project stay put. */
export default function EditTask() {
  const router = useRouter();
  const toast = useToast();
  const { id: raw } = useLocalSearchParams<{ id: string }>();
  const id = Number(raw) || null;
  const task = useTask(id);
  const update = useUpdateTask();
  const setLabels = useSetTaskLabels();
  const [errors, setErrors] = useState<Record<string, string>>({});

  const submit = async (values: TaskFormValues) => {
    if (!task.data) return;
    if (values.startDate && values.deadline && values.startDate > values.deadline) { setErrors({ deadline: 'The deadline cannot be earlier than the start.' }); return; }
    setErrors({});
    try {
      await update.mutateAsync({ id: task.data.id, patch: {
        title: values.title.trim(), description: values.description.trim(), notes: values.notes.trim() || undefined,
        priority: values.priority, startDate: values.startDate, deadline: values.deadline,
      } });
      const before = task.data.labels.map((l) => l.id).sort().join(',');
      const after = [...values.labelIds].sort().join(',');
      if (before !== after) await setLabels.mutateAsync({ id: task.data.id, labelIds: values.labelIds });
      toast.success('Task updated');
      router.back();
    } catch (err) {
      if (err instanceof ApiError && err.details?.length) setErrors(err.fieldErrors);
      else toast.error('Could not save', errorMessage(err));
    }
  };

  return (
    <Screen>
      <ScreenHeader tone="sage" title="Edit task" subtitle={task.data?.task_key ?? undefined} />
      {task.isPending ? <SkeletonList count={3} /> : task.isError || !task.data ? <ErrorState error={task.error} onRetry={() => task.refetch()} /> : (
        <>
          <TaskForm
            lockAssignment
            initial={{
              title: task.data.title, description: task.data.description, notes: task.data.notes ?? '', priority: task.data.priority,
              startDate: task.data.start_date, deadline: task.data.deadline, labelIds: task.data.labels.map((l) => l.id),
            }}
            submitLabel="Save changes"
            busy={update.isPending || setLabels.isPending}
            errors={errors}
            onSubmit={submit}
          />
          <Text variant="small" color="inkFaint" align="center">Assignee and project cannot change — they issue the key. Close this task and assign a new one instead.</Text>
        </>
      )}
    </Screen>
  );
}
