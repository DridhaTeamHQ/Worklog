import { useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAssignTask } from '@/hooks/useTasks';
import { ApiError, errorMessage } from '@/api/client';
import { Screen, ScreenHeader, Text, useToast } from '@/components';
import { TaskForm, type TaskFormValues } from '@/features/TaskForm';

/** Assign a task. Opened from Tasks (+), a person's page (pinned to them) or a project. */
export default function AssignTask() {
  const router = useRouter();
  const toast = useToast();
  const params = useLocalSearchParams<{ employeeId?: string; projectId?: string }>();
  const assign = useAssignTask();
  const [errors, setErrors] = useState<Record<string, string>>({});

  const submit = (values: TaskFormValues) => {
    const next: Record<string, string> = {};
    if (!values.employeeId) next.employeeId = 'Choose who this is for.';
    if (!values.projectId) next.projectId = 'Choose a project.';
    if (values.startDate && values.deadline && values.startDate > values.deadline) next.deadline = 'The deadline cannot be earlier than the start.';
    setErrors(next);
    if (Object.keys(next).length) return;
    assign.mutate({
      employeeId: values.employeeId!, projectId: values.projectId!, title: values.title.trim(), description: values.description.trim(),
      notes: values.notes.trim() || undefined, priority: values.priority, startDate: values.startDate, deadline: values.deadline,
      labelIds: values.labelIds.length ? values.labelIds : undefined,
    }, {
      onSuccess: (res) => {
        toast.success('Task assigned', res.data.message);
        router.replace(`/tasks/${res.data.task.id}`);
      },
      onError: (err) => {
        if (err instanceof ApiError && err.details?.length) setErrors(err.fieldErrors);
        else toast.error('Could not assign', errorMessage(err));
      },
    });
  };

  return (
    <Screen>
      <ScreenHeader tone="sage" title="Assign a task" subtitle="Only who and which project are required." />
      <TaskForm
        initial={{ employeeId: Number(params.employeeId) || null, projectId: Number(params.projectId) || null }}
        submitLabel="Assign task"
        busy={assign.isPending}
        errors={errors}
        onSubmit={submit}
      />
      <Text variant="small" color="inkFaint" align="center">The person is notified the moment you assign it.</Text>
    </Screen>
  );
}
