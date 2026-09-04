import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { KeyRound, Ticket } from 'lucide-react-native';
import { useTheme } from '@/theme';
import { authApi } from '@/api/endpoints';
import { errorMessage } from '@/api/client';
import { PillButton, Screen, ScreenHeader, TextField, useToast } from '@/components';

/** Finish a reset: the code from the email (pre-filled from a link) and a new password. */
export default function ResetPassword() {
  const t = useTheme();
  const router = useRouter();
  const toast = useToast();
  const params = useLocalSearchParams<{ token?: string }>();
  const [token, setToken] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (params.token) setToken(String(params.token)); }, [params.token]);

  const submit = async () => {
    setError(null);
    if (!token.trim()) { setError('Paste the reset code from the email.'); return; }
    if (password.length < 8) { setError('Use at least 8 characters.'); return; }
    if (password !== confirm) { setError('The two passwords do not match.'); return; }
    setBusy(true);
    try {
      await authApi.resetPassword(token.trim(), password);
      toast.success('Password updated', 'Sign in with your new password.');
      router.replace('/(auth)/login');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen statusBar={t.isDark ? 'light' : 'dark'}>
      <ScreenHeader title="Reset password" subtitle="Choose a new password." />
      <View style={{ gap: 16 }}>
        <TextField label="Reset code" icon={Ticket} value={token} onChangeText={setToken} autoCapitalize="none" autoCorrect={false} placeholder="From the email" />
        <TextField label="New password" icon={KeyRound} value={password} onChangeText={setPassword} password placeholder="At least 8 characters" textContentType="newPassword" />
        <TextField label="Confirm password" icon={KeyRound} value={confirm} onChangeText={setConfirm} password placeholder="Type it again" error={error} onSubmitEditing={submit} returnKeyType="go" />
        <PillButton label="Update password" size="lg" block onPress={submit} loading={busy} haptic="success" />
      </View>
    </Screen>
  );
}
