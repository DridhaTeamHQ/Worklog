import { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { KeyRound } from 'lucide-react-native';
import { useChangePassword } from '@/hooks/useProfile';
import { errorMessage } from '@/api/client';
import { authApi } from '@/api/endpoints';
import { useAuthStore } from '@/auth/store';
import { PillButton, Screen, ScreenHeader, Text, TextField, useToast } from '@/components';

/**
 * Change password. The server revokes every other session when this succeeds, and
 * this one too — so the app signs in again with the new password to stay put.
 */
export default function ChangePassword() {
  const router = useRouter();
  const toast = useToast();
  const change = useChangePassword();
  const user = useAuthStore((s) => s.user);
  const setSession = useAuthStore((s) => s.setSession);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError(null);
    if (!current) { setError('Enter your current password.'); return; }
    if (next.length < 8) { setError('Use at least 8 characters.'); return; }
    if (next !== confirm) { setError('The two new passwords do not match.'); return; }
    setBusy(true);
    try {
      await change.mutateAsync({ currentPassword: current, newPassword: next });
      if (user) {
        const { data } = await authApi.login(user.email, next);
        await setSession(data);
      }
      toast.success('Password changed', 'Your other devices have been signed out.');
      router.back();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <ScreenHeader title="Change password" />
      <View style={{ gap: 16 }}>
        <TextField label="Current password" icon={KeyRound} value={current} onChangeText={setCurrent} password textContentType="password" />
        <TextField label="New password" icon={KeyRound} value={next} onChangeText={setNext} password placeholder="At least 8 characters" textContentType="newPassword" />
        <TextField label="Confirm new password" icon={KeyRound} value={confirm} onChangeText={setConfirm} password error={error} onSubmitEditing={submit} returnKeyType="go" />
        <PillButton label="Change password" size="lg" block onPress={submit} loading={busy} haptic="success" />
        <Text variant="small" color="inkFaint" align="center">Every other phone and browser is signed out. This one stays signed in.</Text>
      </View>
    </Screen>
  );
}
