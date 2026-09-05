import { useState } from 'react';
import { useRouter } from 'expo-router';
import { useCreateProject } from '@/hooks/useProjects';
import { ApiError, errorMessage } from '@/api/client';
import { Screen, ScreenHeader, useToast } from '@/components';
import { ProjectForm } from '@/features/ProjectForm';

export default function NewProject() {
  const router = useRouter();
  const toast = useToast();
  const create = useCreateProject();
  const [errors, setErrors] = useState<Record<string, string>>({});

  return (
    <Screen>
      <ScreenHeader tone="iris" title="New project" subtitle="A home for tasks, with its own keys." />
      <ProjectForm
        submitLabel="Create project"
        busy={create.isPending}
        errors={errors}
        onSubmit={(values) => {
          const next: Record<string, string> = {};
          if (!values.name.trim()) next.name = 'Give the project a name.';
          if (!/^[A-Z][A-Z0-9]{1,9}$/.test(values.key)) next.key = 'Use 2–10 letters or digits, starting with a letter.';
          setErrors(next);
          if (Object.keys(next).length) return;
          create.mutate({ name: values.name.trim(), key: values.key, description: values.description.trim() || undefined, leadId: values.leadId }, {
            onSuccess: (res) => { toast.success('Project created', `Tasks will be keyed ${res.data.project.project_key}-1, -2, …`); router.back(); },
            onError: (err) => {
              if (err instanceof ApiError && err.details?.length) setErrors(err.fieldErrors);
              else toast.error('Could not create', errorMessage(err));
            },
          });
        }}
      />
    </Screen>
  );
}
