import { useState } from 'react';
import { Alert, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Archive, ArchiveRestore } from 'lucide-react-native';
import { useProject, useUpdateProject } from '@/hooks/useProjects';
import { ApiError, errorMessage } from '@/api/client';
import { BentoCard, ErrorState, PillButton, Screen, ScreenHeader, SkeletonList, Text, useToast } from '@/components';
import { ProjectForm } from '@/features/ProjectForm';

/** Rename, re-key, re-describe or archive a project. */
export default function EditProject() {
  const router = useRouter();
  const toast = useToast();
  const { id: raw } = useLocalSearchParams<{ id: string }>();
  const id = Number(raw) || null;
  const project = useProject(id);
  const update = useUpdateProject();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const p = project.data;

  const toggleArchive = () => {
    if (!p) return;
    const archiving = !p.is_archived;
    Alert.alert(archiving ? 'Archive this project?' : 'Restore this project?', archiving ? 'Its tasks stay readable, but nothing new can be added to it.' : 'New tasks can be added to it again.', [
      { text: 'Cancel', style: 'cancel' },
      { text: archiving ? 'Archive' : 'Restore', style: archiving ? 'destructive' : 'default', onPress: () => update.mutate({ id: p.id, patch: { isArchived: archiving } }, { onSuccess: () => { toast.success(archiving ? 'Project archived' : 'Project restored'); router.back(); }, onError: (err) => toast.error('Could not update', errorMessage(err)) }) },
    ]);
  };

  return (
    <Screen>
      <ScreenHeader tone="iris" title="Edit project" subtitle={p?.project_key} />
      {project.isPending ? <SkeletonList count={2} /> : project.isError || !p ? <ErrorState error={project.error} onRetry={() => project.refetch()} /> : (
        <>
          <ProjectForm
            editing
            initial={{ name: p.name, key: p.project_key, description: p.description ?? '', leadId: p.lead_id }}
            submitLabel="Save changes"
            busy={update.isPending}
            errors={errors}
            onSubmit={(values) => {
              const next: Record<string, string> = {};
              if (!values.name.trim()) next.name = 'Give the project a name.';
              if (!/^[A-Z][A-Z0-9]{1,9}$/.test(values.key)) next.key = 'Use 2–10 letters or digits, starting with a letter.';
              setErrors(next);
              if (Object.keys(next).length) return;
              const go = () => update.mutate({ id: p.id, patch: { name: values.name.trim(), key: values.key, description: values.description.trim() || null, leadId: values.leadId } }, {
                onSuccess: () => { toast.success('Project updated'); router.back(); },
                onError: (err) => {
                  if (err instanceof ApiError && err.details?.length) setErrors(err.fieldErrors);
                  else toast.error('Could not save', errorMessage(err));
                },
              });
              if (values.key !== p.project_key) {
                Alert.alert('Change the key?', `Every task in this project is renamed: ${p.project_key}-4 becomes ${values.key}-4. Anyone holding the old key in a note will find it out of date.`, [
                  { text: 'Cancel', style: 'cancel' }, { text: 'Change it', style: 'destructive', onPress: go },
                ]);
              } else go();
            }}
          />
          <BentoCard tone="outline">
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{ flex: 1 }}>
                <Text variant="bodyStrong">{p.is_archived ? 'Archived' : 'Archive project'}</Text>
                <Text variant="small" color="inkMuted">{p.is_archived ? 'Tasks stay readable; nothing new can be added.' : 'Keeps its tasks readable while blocking new ones.'}</Text>
              </View>
              <PillButton label={p.is_archived ? 'Restore' : 'Archive'} size="sm" variant={p.is_archived ? 'ink' : 'ghost'} icon={p.is_archived ? ArchiveRestore : Archive} onPress={toggleArchive} />
            </View>
          </BentoCard>
        </>
      )}
    </Screen>
  );
}
