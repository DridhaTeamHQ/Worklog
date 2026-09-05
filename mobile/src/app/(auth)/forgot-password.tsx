import { FormSection } from '@/components';
import { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { Mail, MailCheck } from 'lucide-react-native';
import { useTheme } from '@/theme';
import { authApi } from '@/api/endpoints';
import { errorMessage } from '@/api/client';
import { BentoCard, EmptyState, PillButton, Screen, ScreenHeader, Text, TextField, TextButton } from '@/components';

export default function ForgotPassword() {
  const t = useTheme();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [devToken, setDevToken] = useState<string | undefined>();

  const submit = async () => {
    setError(null);
    if (!email.trim()) { setError('Enter your work email.'); return; }
    setBusy(true);
    try {
      const { data } = await authApi.forgotPassword(email.trim().toLowerCase());
      setDevToken(data.devResetToken);
      setSent(true);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen statusBar={t.isDark ? 'light' : 'dark'}>
      <ScreenHeader tone="sage" title="Forgot password" subtitle="We will email a link that lets you choose a new one. It works for 30 minutes." />
      {sent ? (
        <View style={{ gap: 16 }}>
          <EmptyState icon={MailCheck} title="Check your inbox" body={`If ${email.trim()} is an account, a reset link is on its way. Open it on this phone to continue here.`} compact />
          {devToken ? (
            <BentoCard tone="accent">
              <Text variant="smallStrong" color="onAccent">Development build</Text>
              <Text variant="small" color="onAccent" style={{ marginTop: 4 }}>The API returned the reset code because no mail server is configured.</Text>
              <PillButton label="Use it now" variant="ink" size="sm" style={{ marginTop: 12 }} onPress={() => router.push({ pathname: '/(auth)/reset-password', params: { token: devToken } })} />
            </BentoCard>
          ) : null}
          <PillButton label="I have a reset code" variant="soft" block onPress={() => router.push('/(auth)/reset-password')} />
          <View style={{ alignItems: 'center' }}><TextButton label="Back to sign in" onPress={() => router.replace('/(auth)/login')} /></View>
        </View>
      ) : (
        <View style={{ gap: 16 }}>
          <FormSection title="Account recovery">
<TextField label="Work email" icon={Mail} value={email} onChangeText={setEmail} error={error} autoCapitalize="none" keyboardType="email-address" autoComplete="email" placeholder="you@company.com" onSubmitEditing={submit} returnKeyType="send" />
          </FormSection>
          <PillButton label="Send reset link" size="lg" block onPress={submit} loading={busy} />
        </View>
      )}
    </Screen>
  );
}
