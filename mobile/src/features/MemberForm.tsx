import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Building2, Mail, Phone, ShieldCheck, UserCog, UserRound } from 'lucide-react-native';
import { useTheme } from '@/theme';
import { useDepartments } from '@/hooks/useTeam';
import type { Role } from '@/types';
import { Chip, FormSection, PillButton, SegmentedTabs, Text, TextField } from '@/components';

export interface MemberFormValues {
  role: Role;
  name: string;
  email: string;
  department: string;
  jobTitle: string;
  phone: string;
}

interface Props {
  submitLabel: string;
  busy?: boolean;
  errors?: Record<string, string>;
  onSubmit: (values: MemberFormValues) => void;
}

const EMPTY: MemberFormValues = { role: 'team_member', name: '', email: '', department: '', jobTitle: '', phone: '' };

const ROLES = [
  { key: 'team_member' as const, label: 'Member', icon: UserRound },
  { key: 'manager' as const, label: 'Manager', icon: UserCog },
  { key: 'admin' as const, label: 'Admin', icon: ShieldCheck },
];

/** What each tier may do, in one line, so the choice is made on purpose. */
const ROLE_DETAIL: Record<Role, string> = {
  team_member: 'Works through their own tasks, files a daily report, raises tickets.',
  manager: 'Everything a member does, plus assigning tasks, reading the team\'s reports and resolving tickets.',
  admin: 'Everything a manager does, across every department, plus adding and removing people.',
};

/**
 * Adding someone to the roster. The admin identifies the person and picks the tier;
 * the person chooses their own password when they claim the invite, so there is no
 * password field here. Departments already in use are offered as chips — the roster
 * groups by them, and a typo makes a second department of one.
 */
export function MemberForm({ submitLabel, busy, errors = {}, onSubmit }: Props) {
  const t = useTheme();
  const [values, setValues] = useState<MemberFormValues>(EMPTY);
  const departments = useDepartments(true);
  const set = <K extends keyof MemberFormValues>(key: K, value: MemberFormValues[K]) => setValues((v) => ({ ...v, [key]: value }));

  const member = values.role === 'team_member';
  const suggestions = (departments.data ?? []).filter((d) => d && d !== values.department).slice(0, 6);

  return (
    <View style={{ gap: 16 }}>
      <FormSection title="Access" detail={ROLE_DETAIL[values.role]}>
        <SegmentedTabs items={ROLES} value={values.role} onChange={(role) => set('role', role)} />
      </FormSection>

      <FormSection title="Who they are" detail="The name and address they will sign in with.">
        <TextField
          label="Full name" required icon={UserRound} value={values.name}
          onChangeText={(v) => set('name', v)}
          placeholder="Priya Sharma" maxLength={120} autoCapitalize="words" error={errors.name}
        />
        <TextField
          label="Work email" required icon={Mail} value={values.email}
          onChangeText={(v) => set('email', v)}
          placeholder="priya@company.com" maxLength={190}
          autoCapitalize="none" autoCorrect={false} keyboardType="email-address" error={errors.email}
        />
      </FormSection>

      <FormSection title="Where they sit" detail={member ? 'The roster is grouped and filtered by both.' : 'Optional for managers and admins, who work across departments.'}>
        <TextField
          label="Department" required={member} icon={Building2} value={values.department}
          onChangeText={(v) => set('department', v)}
          placeholder="Engineering" maxLength={120} autoCapitalize="words" error={errors.department}
        />
        {suggestions.length ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: -8 }}>
            {suggestions.map((d) => (
              <Pressable key={d} onPress={() => set('department', d)} accessibilityRole="button" accessibilityLabel={`Use department ${d}`}>
                <Chip label={d} color={t.colors.inkMuted} size="sm" />
              </Pressable>
            ))}
          </View>
        ) : null}
        <TextField
          label="Job title" required={member} value={values.jobTitle}
          onChangeText={(v) => set('jobTitle', v)}
          placeholder={member ? 'Developer' : 'Engineering Manager'} maxLength={120} autoCapitalize="words" error={errors.jobTitle}
        />
        <TextField
          label="Phone" icon={Phone} value={values.phone}
          onChangeText={(v) => set('phone', v)}
          placeholder="Optional" maxLength={40} keyboardType="phone-pad" error={errors.phone}
        />
      </FormSection>

      <PillButton label={submitLabel} size="lg" block loading={busy} onPress={() => onSubmit(values)} haptic="success" />
      <Text variant="small" color="inkFaint" align="center">
        They get an email with a link to set their own password. If mail is off, they can type their address on the sign-in screen and the app offers to set it there.
      </Text>
    </View>
  );
}
