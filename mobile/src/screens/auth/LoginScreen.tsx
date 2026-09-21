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
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { Input } from '../../components/Input';
import { Button } from '../../components/Button';
import { colors, borderRadius, spacing, typography } from '../../theme';
import { Mail, Lock, CheckSquare } from '../../components/Icon';

export function LoginScreen({ navigation }: any) {
  const { login } = useAuth();
  const { error: toastError } = useToast();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});


  const handleLogin = async () => {
    const nextErrors: { email?: string; password?: string } = {};
    if (!email.trim()) nextErrors.email = 'Email is required';
    if (!password) nextErrors.password = 'Password is required';

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    setErrors({});
    setLoading(true);
    try {
      await login(email.trim(), password);
    } catch (err: any) {
      toastError(err.message || 'Failed to sign in. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header & Logo (Website Taskr Brand) */}
          <View style={styles.brandContainer}>
            <View style={styles.logoBadge}>
              <CheckSquare size={22} color="#ffffff" />
            </View>
            <Text style={styles.brandTitle}>Taskr</Text>
            <Text style={styles.brandSubtitle}>
              Employee Task Management & Work Reporting
            </Text>
          </View>

          {/* Form Card */}
          <View style={styles.card}>
            <Text style={styles.formTitle}>Sign in to your account</Text>
            <Text style={styles.formSubtitle}>
              Enter your corporate email and password
            </Text>

            <Input
              label="Email address"
              placeholder="name@company.com"
              value={email}
              onChangeText={(t) => {
                setEmail(t);
                if (errors.email) setErrors((prev) => ({ ...prev, email: undefined }));
              }}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              leftIcon={<Mail size={18} color={colors.textMuted} />}
              error={errors.email}
            />

            <Input
              label="Password"
              placeholder="Enter your password"
              value={password}
              onChangeText={(t) => {
                setPassword(t);
                if (errors.password) setErrors((prev) => ({ ...prev, password: undefined }));
              }}
              isPassword
              leftIcon={<Lock size={18} color={colors.textMuted} />}
              error={errors.password}
            />

            <TouchableOpacity
              onPress={() => navigation.navigate('ForgotPassword')}
              style={styles.forgotPassBtn}
            >
              <Text style={styles.forgotPassText}>Forgot password?</Text>
            </TouchableOpacity>

            <Button
              title="Sign In"
              onPress={handleLogin}
              loading={loading}
              size="lg"
              style={styles.submitBtn}
            />

            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.dividerLine} />
            </View>

            <Button
              title="Have an invitation? Set Password"
              variant="outline"
              onPress={() => navigation.navigate('SetPassword')}
              size="md"
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
    justifyContent: 'center',
    padding: spacing.lg,
  },
  brandContainer: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  logoBadge: {
    width: 44,
    height: 44,
    borderRadius: 11,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  brandTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: typography.weights.extrabold,
    letterSpacing: -0.4,
  },
  brandSubtitle: {
    color: colors.textMuted,
    fontSize: 11.5,
    marginTop: 2,
    textAlign: 'center',
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    padding: spacing.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  formTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: typography.weights.bold,
  },
  formSubtitle: {
    color: colors.textMuted,
    fontSize: 11.5,
    marginTop: 2,
    marginBottom: spacing.md,
  },
  forgotPassBtn: {
    alignSelf: 'flex-end',
    marginBottom: spacing.lg,
    marginTop: -4,
  },
  forgotPassText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: typography.weights.medium,
  },
  submitBtn: {
    marginBottom: spacing.lg,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.cardBorder,
  },
  dividerText: {
    color: colors.textMuted,
    paddingHorizontal: spacing.md,
    fontSize: 12,
  },
  serverConfigBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xxl,
    paddingVertical: spacing.sm,
  },
  serverIcon: {
    marginRight: 6,
  },
  serverConfigText: {
    color: colors.textMuted,
    fontSize: 12,
  },
});

