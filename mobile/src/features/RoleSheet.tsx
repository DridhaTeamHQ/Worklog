import { forwardRef, useEffect, useState } from 'react';
import { View } from 'react-native';
import { ShieldCheck, UserCog, UserRound } from 'lucide-react-native';
import { useSetRole } from '@/hooks/useTeam';
import { errorMessage } from '@/api/client';
import { roleLabel, type Role } from '@/types';
import { PillButton, SegmentedTabs, Sheet, Text, TextField, useToast, type SheetHandle } from '@/components';

const ROLES = [
  { key: 'team_member' as const, label: 'Member', icon: UserRound },
  { key: 'manager' as const, label: 'Manager', icon: UserCog },
  { key: 'admin' as const, label: 'Admin', icon: ShieldCheck },
];

const ROLE_DETAIL: Record<Role, string> = {
  team_member: 'Works through their own tasks, files a daily report, raises tickets.',
  manager: 'Everything a member does, plus assigning tasks, reading the team\'s reports and resolving tickets.',
  admin: 'Everything a manager does, across every department, plus adding and removing people.',
};

export interface RolePerson {
  id: number;
  name: string;
  role: Role;
  department?: string | null;
  job_title?: string | null;
}

/**
 * Move somebody between tiers. A demotion to member needs a department and a job
 * title — the roster groups by both — so the two fields appear only when the person
 * being demoted has neither, rather than cluttering the common case.
 */
export const RoleSheet = forwardRef<SheetHandle, { person: RolePerson | null; onDone?: () => void }>(
  function RoleSheet({ person, onDone }, ref) {
    const toast = useToast();
    const setRole = useSetRole();
    const [role, setRoleValue] = useState<Role>(person?.role ?? 'team_member');
    const [department, setDepartment] = useState('');
    const [jobTitle, setJobTitle] = useState('');

    // Re-seed whenever the sheet is pointed at somebody else.
    useEffect(() => {
      setRoleValue(person?.role ?? 'team_member');
      setDepartment(person?.department ?? '');
      setJobTitle(person?.job_title ?? '');
    }, [person?.id, person?.role, person?.department, person?.job_title]);

    if (!person) return <Sheet ref={ref} title="Access"><View /></Sheet>;

    const needsPlacement = role === 'team_member' && (!department.trim() || !jobTitle.trim());
    const unchanged = role === person.role;

    const save = () => {
      setRole.mutate(
        { id: person.id, role, department: department.trim() || undefined, jobTitle: jobTitle.trim() || undefined },
        {
          onSuccess: (res) => {
            const said = typeof res.meta?.message === 'string' ? res.meta.message : `${person.name} is now ${roleLabel(role).toLowerCase()}.`;
            toast.success('Access updated', said);
            onDone?.();
          },
          onError: (err) => toast.error('Could not change access', errorMessage(err)),
        },
      );
    };

    return (
      <Sheet ref={ref} title={`${person.name}'s access`}>
        <View style={{ gap: 16 }}>
          <SegmentedTabs items={ROLES} value={role} onChange={setRoleValue} />
          <Text variant="small" color="inkMuted">{ROLE_DETAIL[role]}</Text>

          {needsPlacement ? (
            <>
              <Text variant="small" color="inkMuted">A member sits in a department, so the roster can group them.</Text>
              <TextField label="Department" required value={department} onChangeText={setDepartment} placeholder="Engineering" maxLength={120} autoCapitalize="words" />
              <TextField label="Job title" required value={jobTitle} onChangeText={setJobTitle} placeholder="Developer" maxLength={120} autoCapitalize="words" />
            </>
          ) : null}

          <PillButton
            label={unchanged ? `Already ${roleLabel(role).toLowerCase()}` : `Make ${roleLabel(role).toLowerCase()}`}
            size="lg" block haptic="success"
            disabled={unchanged || (role === 'team_member' && (!department.trim() || !jobTitle.trim()))}
            loading={setRole.isPending}
            onPress={save}
          />
          <Text variant="small" color="inkFaint" align="center">
            Changing access signs them out, so they come back in the right portal.
          </Text>
        </View>
      </Sheet>
    );
  },
);
