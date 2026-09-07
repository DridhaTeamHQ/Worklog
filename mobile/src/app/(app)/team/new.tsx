import { useState } from 'react';
import { useRouter } from 'expo-router';
import { useCreateTeamMember, useCreateManager } from '@/hooks/useTeam';
import { ApiError, errorMessage } from '@/api/client';
import { Screen, ScreenHeader, useToast } from '@/components';
import { MemberForm } from '@/features/MemberForm';

/**
 * Add someone to the roster at the tier they belong to. Members and elevated accounts
 * are created through different endpoints — both admin-only, both invite-based — so
 * the role picked here decides which one runs.
 */
export default function NewTeamMember() {
  const router = useRouter();
  const toast = useToast();
  const createMember = useCreateTeamMember();
  const createManager = useCreateManager();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const busy = createMember.isPending || createManager.isPending;

  return (
    <Screen>
      <ScreenHeader tone="iris" title="Add a team member" subtitle="Pick their access, then they set their own password from the invite." />
      <MemberForm
        submitLabel="Send invite"
        busy={busy}
        errors={errors}
        onSubmit={(values) => {
          const member = values.role === 'team_member';
          const next: Record<string, string> = {};
          if (!values.name.trim()) next.name = 'Enter their full name.';
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) next.email = 'Enter a valid work email.';
          // The roster groups members by both, so a blank leaves a hole in every view.
          if (member && !values.department.trim()) next.department = 'Which department are they in?';
          if (member && !values.jobTitle.trim()) next.jobTitle = 'What do they do?';
          setErrors(next);
          if (Object.keys(next).length) return;

          const input = {
            name: values.name.trim(),
            email: values.email.trim().toLowerCase(),
            department: values.department.trim(),
            jobTitle: values.jobTitle.trim(),
            phone: values.phone.trim() || undefined,
          };
          const done = {
            onSuccess: (res: { data: { message: string } }) => {
              toast.success('Invite sent', res.data.message);
              // Opened as a modal from the roster; a deep link has nothing behind it.
              if (router.canGoBack()) router.back(); else router.replace('/(app)/(manager)/team');
            },
            onError: (err: unknown) => {
              if (err instanceof ApiError && err.details?.length) setErrors(err.fieldErrors);
              else toast.error('Could not add them', errorMessage(err));
            },
          };

          if (member) createMember.mutate(input, done);
          else createManager.mutate({ ...input, role: values.role as 'manager' | 'admin' }, done);
        }}
      />
    </Screen>
  );
}
