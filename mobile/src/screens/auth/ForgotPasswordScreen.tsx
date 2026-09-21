import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  SafeAreaView,
} from 'react-native';
import { authApi } from '../../api/endpoints';
import { useToast } from '../../context/ToastContext';
import { Input } from '../../components/Input';
import { Button } from '../../components/Button';
import { Header } from '../../components/Header';
import { colors, borderRadius, spacing, typography } from '../../theme';
import { Mail, KeyRound, CheckCircle } from '../../components/Icon';

export function ForgotPasswordScreen({ navigation }: any) {
  const { error: toastError, success: toastSuccess } = useToast();

  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'request' | 'reset'>('request');
  const [devToken, setDevToken] = useState<string | null>(null);

  const handleRequestToken = async () => {
    if (!email.trim()) {
      toastError('Please enter your email address');
      return;
    }
    setLoading(true);
    try {
      const res = await authApi.forgotPassword(email.trim());
      toastSuccess(res.data?.message || 'Password reset requested.');
      if (res.data?.devResetToken) {
        setDevToken(res.data.devResetToken);
        setToken(res.data.devResetToken);
      }
      setStep('reset');
    } catch (err: any) {
      toastError(err.message || 'Failed to request reset token');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!token.trim() || !newPassword) {
      toastError('Token and new password are required');
      return;
    }
    if (newPassword.length < 8) {
      toastError('Password must be at least 8 characters long');
      return;
    }
    setLoading(true);
    try {
      const res = await authApi.resetPassword(token.trim(), newPassword);
      toastSuccess(res.data?.message || 'Password updated successfully. You can now sign in.');
      navigation.navigate('Login');
    } catch (err: any) {
      toastError(err.message || 'Failed to reset password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Header
        title="Reset Password"
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
            {step === 'request' ? (
              <>
                <Text style={styles.cardTitle}>Forgot your password?</Text>
                <Text style={styles.cardSubtitle}>
                  Enter the email address tied to your account and we will generate a reset instructions.
                </Text>

                <Input
                  label="Email address"
                  placeholder="name@company.com"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  leftIcon={<Mail size={18} color={colors.textMuted} />}
                />

                <Button
                  title="Send Reset Code"
                  onPress={handleRequestToken}
                  loading={loading}
                  size="lg"
                  style={styles.submitBtn}
                />

                <Button
                  title="Already have a reset token?"
                  variant="ghost"
                  onPress={() => setStep('reset')}
                />
              </>
            ) : (
              <>
                <Text style={styles.cardTitle}>Set New Password</Text>
                <Text style={styles.cardSubtitle}>
                  Enter the reset token sent to your email and your new password.
                </Text>

                {devToken && (
                  <View style={styles.devTokenBox}>
                    <Text style={styles.devTokenLabel}>Dev Reset Token (local dev mode):</Text>
                    <Text style={styles.devTokenValue} selectable>
                      {devToken}
                    </Text>
                  </View>
                )}

                <Input
                  label="Reset Token"
                  placeholder="Paste reset token here"
                  value={token}
                  onChangeText={setToken}
                  autoCapitalize="none"
                  autoCorrect={false}
                  leftIcon={<KeyRound size={18} color={colors.textMuted} />}
                />

                <Input
                  label="New Password"
                  placeholder="At least 8 characters"
                  value={newPassword}
                  onChangeText={setNewPassword}
                  isPassword
                  helper="Must contain at least 8 characters"
                />

                <Button
                  title="Update Password"
                  onPress={handleResetPassword}
                  loading={loading}
                  size="lg"
                  style={styles.submitBtn}
                />

                <Button
                  title="Back to Request Token"
                  variant="ghost"
                  onPress={() => setStep('request')}
                />
              </>
            )}
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
  submitBtn: {
    marginTop: spacing.md,
    marginBottom: spacing.md,
  },
  devTokenBox: {
    backgroundColor: colors.primaryLight,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  devTokenLabel: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: typography.weights.semibold,
  },
  devTokenValue: {
    color: colors.text,
    fontSize: 12,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    marginTop: 4,
  },
});

