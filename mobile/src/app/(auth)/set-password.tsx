import { FormSection } from '@/components';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { KeyRound } from 'lucide-react-native';
import { useTheme } from '@/theme';
import { authApi } from '@/api/endpoints';
import { errorMessage } from '@/api/client';
import { useAuthStore } from '@/auth/store';
import { EmptyState, PillButton, Screen, ScreenHeader, Text, TextField } from '@/components';

/**
 * Claim an invite. Re-verifies on arrival (the screen can be opened from a link),
 * and signs the person straight in once the password is set.
 */
export default function SetPassword() {
  const t = useTheme();
  const router = useRouter();
  const { email: raw } = useLocalSearchParams<{ email?: string }>();
  const email = String(raw || '').trim().toLowerCase();
  const setSession = useAuthStore((s) => s.setSession);
  const [state, setState] = useState<'checking' | 'ok' | 'invalid'>('checking');
  const [name, setName] = useState<string | undefined>();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!email) { setState('invalid'); return; }
    authApi.inviteStatus(email)
      .then(({ data }) => { if (!cancelled) { setName(data.name); setState(data.invited ? 'ok' : 'invalid'); } })
      .catch(() => { if (!cancelled) setState('invalid'); });
    return () => { cancelled = true; };
  }, [email]);

  const submit = async () => {
    setError(null);
    if (password.length < 8) { setError('Use at least 8 characters.'); return; }
    if (password !== confirm) { setError('The two passwords do not match.'); return; }
    setBusy(true);
    try {
      const { data } = await authApi.acceptInvite(email, password);
      await setSession(data);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen statusBar={t.isDark ? 'light' : 'dark'}>
      <ScreenHeader tone="sage" title={`Welcome${name ? `, ${name}` : ''}`} subtitle="Choose the password you will sign in with. Nobody else knows it, and nobody else can set it." />
      {state === 'invalid' ? (
        <EmptyState
          title="No invitation waiting"
          body="This address is not a pending invite. If you have already set a password, sign in — or use Forgot password."
          action={{ label: 'Back to sign in', onPress: () => router.replace('/(auth)/login') }}
        />
      ) : (
        <View style={{ gap: 16 }}>
          <FormSection title="Secure your account">
<TextField label="Email" value={email} editable={false} />
          <TextField label="New password" icon={KeyRound} value={password} onChangeText={setPassword} password placeholder="At least 8 characters" textContentType="newPassword" />
          <TextField label="Confirm password" icon={KeyRound} value={confirm} onChangeText={setConfirm} password placeholder="Type it again" onSubmitEditing={submit} returnKeyType="go" error={error} />
          </FormSection>
          <PillButton label="Set password and sign in" size="lg" block onPress={submit} loading={busy || state === 'checking'} haptic="success" />
          <Text variant="small" color="inkFaint" align="center">You will be signed in on this phone straight away.</Text>
        </View>
      )}
    </Screen>
  );
}
