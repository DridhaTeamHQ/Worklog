import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { authApi } from '../../api/endpoints';
import { Input } from '../../components/Input';
import { Button } from '../../components/Button';
import { Header } from '../../components/Header';
import { colors, borderRadius, spacing, typography } from '../../theme';
import { Mail, Lock, UserCheck } from '../../components/Icon';

export function SetPasswordScreen({ navigation }: any) {
  const { acceptInvite } = useAuth();
  const { error: toastError, success: toastSuccess } = useToast();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [verifiedName, setVerifiedName] = useState<string | null>(null);
  const [checkingInvite, setCheckingInvite] = useState(false);

  const checkInviteStatus = async (inputEmail: string) => {
    if (!inputEmail.includes('@')) return;
    setCheckingInvite(true);
    try {
      const res = await authApi.inviteStatus(inputEmail.trim());
      if (res.data?.invited) {
        setVerifiedName(res.data.name || 'Team Member');
      } else {
        setVerifiedName(null);
      }
    } catch {
      setVerifiedName(null);
    } finally {
      setCheckingInvite(false);
    }
  };

  const handleSetPassword = async () => {
    if (!email.trim() || !password) {
      toastError('Please fill in all required fields');
      return;
    }
    if (password.length < 8) {
      toastError('Password must be at least 8 characters');
      return;
    }
    if (password !== confirmPassword) {
      toastError('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      await acceptInvite(email.trim(), password);
      toastSuccess('Account activated successfully!');
    } catch (err: any) {
      toastError(err.message || 'Failed to claim invitation');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Header
        title="Activate Account"
        onBack={() => navigation.goBack()}
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Claim your Invitation</Text>
            <Text style={styles.cardSubtitle}>
              If your manager added you to Taskr, enter your invited email and choose your password.
            </Text>

            {verifiedName && (
              <View style={styles.welcomeBox}>
                <UserCheck size={18} color={colors.success} style={{ marginRight: 8 }} />
                <Text style={styles.welcomeText}>
                  Welcome, <Text style={{ fontWeight: 'bold' }}>{verifiedName}</Text>! Invitation verified.
                </Text>
              </View>
            )}

            <Input
              label="Invited Email Address"
              placeholder="name@company.com"
              value={email}
              onChangeText={(t) => {
                setEmail(t);
                checkInviteStatus(t);
              }}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              leftIcon={<Mail size={18} color={colors.textMuted} />}
            />

            <Input
              label="Choose Password"
              placeholder="At least 8 characters"
              value={password}
              onChangeText={setPassword}
              isPassword
              leftIcon={<Lock size={18} color={colors.textMuted} />}
            />

            <Input
              label="Confirm Password"
              placeholder="Re-enter your password"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              isPassword
              leftIcon={<Lock size={18} color={colors.textMuted} />}
            />

            <Button
              title="Activate Account & Sign In"
              onPress={handleSetPassword}
              loading={loading}
              size="lg"
              style={styles.submitBtn}
            />

            <Button
              title="Back to Sign In"
              variant="ghost"
              onPress={() => navigation.navigate('Login')}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: spacing.xl,
    justifyContent: 'center',
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: spacing.xl,
  },
  cardTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: typography.weights.bold,
  },
  cardSubtitle: {
    color: colors.textMuted,
    fontSize: 13,
    marginTop: 4,
    marginBottom: spacing.xl,
    lineHeight: 18,
  },
  welcomeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.successLight,
    borderWidth: 1,
    borderColor: colors.successBorder,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  welcomeText: {
    color: colors.success,
    fontSize: 13,
    flex: 1,
  },
  submitBtn: {
    marginTop: spacing.md,
    marginBottom: spacing.md,
  },
});

