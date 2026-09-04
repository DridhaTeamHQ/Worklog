import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { UserRound } from 'lucide-react-native';
import { useTeam, useAdmins } from '@/hooks/useTeam';
import { useUser } from '@/auth/store';
import { isAdmin } from '@/types';
import { PickerField, PickerSheet, PillButton, Text, TextField, useSheet } from '@/components';

export interface ProjectFormValues {
  name: string;
  key: string;
  description: string;
  leadId: number | null;
}

interface Props {
  initial?: Partial<ProjectFormValues>;
  submitLabel: string;
  busy?: boolean;
  errors?: Record<string, string>;
  /** Editing an existing project: warn that re-keying renames every task. */
  editing?: boolean;
  onSubmit: (values: ProjectFormValues) => void;
}

/** "Shop Mobile" → "SHMOB": the first letters of each word, padded from the first word. */
export function suggestKey(name: string): string {
  const words = name.trim().toUpperCase().replace(/[^A-Z0-9 ]/g, '').split(/\s+/).filter(Boolean);
  if (!words.length) return '';
  let key = words.length === 1 ? words[0].slice(0, 5) : words.map((w) => w[0]).join('');
  if (key.length < 3 && words[0]) key = (key + words[0].slice(1)).slice(0, 5);
  if (!/^[A-Z]/.test(key)) key = `P${key}`;
  return key.slice(0, 10);
}

export function ProjectForm({ initial, submitLabel, busy, errors = {}, editing, onSubmit }: Props) {
  const user = useUser();
  const [values, setValues] = useState<ProjectFormValues>({ name: '', key: '', description: '', leadId: null, ...initial });
  const [keyTouched, setKeyTouched] = useState(Boolean(initial?.key));
  const leadSheet = useSheet();
  const team = useTeam();
  const admins = useAdmins(isAdmin(user?.role));

  const leads = useMemo(() => {
    const seen = new Map<number, { value: number; label: string; hint?: string }>();
    for (const m of admins.data ?? []) seen.set(m.id, { value: m.id, label: m.name, hint: m.role === 'admin' ? 'Admin' : 'Manager' });
    for (const m of team.data ?? []) seen.set(m.id, { value: m.id, label: m.name, hint: m.department ?? undefined });
    if (user && !seen.has(user.id)) seen.set(user.id, { value: user.id, label: `${user.name} (you)` });
    return [...seen.values()];
  }, [admins.data, team.data, user]);

  return (
    <View style={{ gap: 16 }}>
      <TextField
        label="Name" required value={values.name}
        onChangeText={(name) => setValues((v) => ({ ...v, name, key: keyTouched ? v.key : suggestKey(name) }))}
        placeholder="Shop Mobile" maxLength={120} error={errors.name}
      />
      <TextField
        label="Key" required value={values.key}
        onChangeText={(key) => { setKeyTouched(true); setValues((v) => ({ ...v, key: key.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10) })); }}
        placeholder="SHMOB" autoCapitalize="characters" autoCorrect={false} maxLength={10} error={errors.key}
        hint={editing ? 'Changing the key renames every task in this project (SHMOB-4 becomes NEW-4).' : `Tasks will be keyed ${values.key || 'KEY'}-1, ${values.key || 'KEY'}-2, …`}
      />
      <TextField label="Description" value={values.description} onChangeText={(description) => setValues((v) => ({ ...v, description }))} placeholder="What this project is for" multiline maxLength={1000} error={errors.description} />
      <PickerField label="Lead" icon={UserRound} value={leads.find((l) => l.value === values.leadId)?.label ?? null} placeholder="Nobody yet" onPress={leadSheet.open} />
      <PillButton label={submitLabel} size="lg" block loading={busy} onPress={() => onSubmit(values)} haptic="success" />
      <PickerSheet ref={leadSheet.ref} title="Project lead" options={leads} value={values.leadId} onSelect={(v) => setValues((s) => ({ ...s, leadId: v }))} searchable clearLabel="Nobody" onClear={() => setValues((s) => ({ ...s, leadId: null }))} />
      <Text variant="small" color="inkFaint" align="center">Keys are 2–10 letters and digits, starting with a letter.</Text>
    </View>
  );
}
