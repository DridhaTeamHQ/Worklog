import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { Link, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { AnimatePresence, MotiView } from 'moti';
import { Asterisk, KeyRound, Mail, Sparkles } from 'lucide-react-native';
import { useTheme } from '@/theme';
import { authApi } from '@/api/endpoints';
import { ApiError, errorMessage } from '@/api/client';
import { useAuthStore } from '@/auth/store';
import { useInviteStatus } from '@/hooks/useInviteStatus';
import { BentoCard, PillButton, Reveal, Text, TextField, TextButton } from '@/components';

/**
 * Sign in. A quiet white page: the mark, one big line, the form. Typing an invited
 * address reveals the "set your password" card, exactly as the web sign-in does.
 */
export default function Login() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const setSession = useAuthStore((s) => s.setSession);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [banner, setBanner] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const invite = useInviteStatus(email);

  const submit = async () => {
    const next: Record<string, string> = {};
    if (!email.trim()) next.email = 'Enter your work email.';
    if (!password) next.password = 'Enter your password.';
    setErrors(next);
    setBanner(null);
    if (Object.keys(next).length) return;
    setBusy(true);
    try {
      const { data } = await authApi.login(email.trim().toLowerCase(), password);
      await setSession(data);
    } catch (err) {
      if (err instanceof ApiError && err.details?.length) setErrors(err.fieldErrors);
      else setBanner(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: t.colors.ground }}>
      <StatusBar style={t.isDark ? 'light' : 'dark'} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24, paddingHorizontal: t.spacing.screen }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={{ gap: 16, marginBottom: 36 }}>
            <Reveal>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: t.colors.hero, alignItems: 'center', justifyContent: 'center' }}>
                  <Asterisk size={24} color="#FFFFFF" strokeWidth={2.6} />
                </View>
                <Text variant="h3">Taskr</Text>
              </View>
            </Reveal>
            <Reveal delay={80}>
              <Text variant="display" style={{ marginTop: 24 }}>Welcome{'\n'}back.</Text>
            </Reveal>
            <Reveal delay={160}>
              <Text variant="body" color="inkMuted">Sign in with your work email.</Text>
            </Reveal>
          </View>

          <Reveal delay={220} style={{ flex: 1 }}>
            <View style={{ gap: 16 }}>
              <AnimatePresence>
                {invite.invited ? (
                  <MotiView key="invite" from={{ opacity: 0, translateY: -8 }} animate={{ opacity: 1, translateY: 0 }} exit={{ opacity: 0 }} transition={{ type: 'timing', duration: 280 }}>
                    <BentoCard tone="accent">
                      <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
                        <Sparkles size={22} color={t.colors.onAccent} />
                        <View style={{ flex: 1, gap: 2 }}>
                          <Text variant="bodyStrong" color="onAccent">Welcome{invite.name ? `, ${invite.name}` : ''}</Text>
                          <Text variant="small" color="onAccent" style={{ opacity: 0.85 }}>Your account is ready but has no password yet.</Text>
                        </View>
                      </View>
                      <PillButton label="Set your password" variant="white" size="sm" style={{ marginTop: 12 }} onPress={() => router.push({ pathname: '/(auth)/set-password', params: { email: email.trim().toLowerCase() } })} />
                    </BentoCard>
                  </MotiView>
                ) : null}
              </AnimatePresence>

              {banner ? (
                <View style={{ backgroundColor: t.colors.dangerSoft, borderRadius: t.radius.md, padding: 12 }}>
                  <Text variant="small" color="danger">{banner}</Text>
                </View>
              ) : null}

              <TextField
                label="Work email"
                icon={Mail}
                value={email}
                onChangeText={(v) => { setEmail(v); setErrors((e) => ({ ...e, email: '' })); }}
                error={errors.email}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                textContentType="username"
                autoComplete="email"
                placeholder="you@company.com"
                returnKeyType="next"
              />
              <TextField
                label="Password"
                icon={KeyRound}
                value={password}
                onChangeText={(v) => { setPassword(v); setErrors((e) => ({ ...e, password: '' })); }}
                error={errors.password}
                password
                textContentType="password"
                autoComplete="password"
                placeholder="Your password"
                returnKeyType="go"
                onSubmitEditing={submit}
              />
              <View style={{ alignItems: 'flex-end' }}>
                <Link href="/(auth)/forgot-password" asChild><TextButton label="Forgot password?" /></Link>
              </View>
              <PillButton label="Sign in" variant="hero" size="lg" block onPress={submit} loading={busy} haptic="medium" />
              <Text variant="small" color="inkFaint" align="center" style={{ marginTop: 8 }}>
                No account? Ask an admin to add you — you will get an invite to set your own password.
              </Text>
            </View>
          </Reveal>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
