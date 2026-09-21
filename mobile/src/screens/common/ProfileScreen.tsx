import React, { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { profileApi, authApi } from '../../api/endpoints';
import { roleLabel } from '../../types';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { Modal } from '../../components/Modal';
import { Header } from '../../components/Header';
import { Badge } from '../../components/Badge';
import { colors, borderRadius, spacing, typography } from '../../theme';
import {
  User as UserIcon,
  Mail,
  Building,
  Briefcase,
  Phone,
  Shield,
  KeyRound,
  LogOut,
  Edit2,
} from '../../components/Icon';
import { isManagerLevel } from '../../types';

export function ProfileScreen({ navigation }: any) {
  const { user, updateUser, logout } = useAuth();
  const { success: toastSuccess, error: toastError } = useToast();

  // Edit Profile Modal
  const [editModal, setEditModal] = useState(false);
  const [name, setName] = useState(user?.name || '');
  const [department, setDepartment] = useState(user?.department || '');
  const [jobTitle, setJobTitle] = useState(user?.job_title || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [savingProfile, setSavingProfile] = useState(false);

  // Change Password Modal
  const [passwordModal, setPasswordModal] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);


  const openEditModal = () => {
    setName(user?.name || '');
    setDepartment(user?.department || '');
    setJobTitle(user?.job_title || '');
    setPhone(user?.phone || '');
    setEditModal(true);
  };

  const handleSaveProfile = async () => {
    if (!name.trim()) {
      toastError('Name cannot be empty');
      return;
    }
    setSavingProfile(true);
    try {
      const res = await profileApi.update({
        name: name.trim(),
        department: department.trim() || undefined,
        jobTitle: jobTitle.trim() || null,
        phone: phone.trim() || null,
      });
      updateUser(res.data);
      setEditModal(false);
      toastSuccess('Profile updated successfully');
    } catch (err: any) {
      toastError(err.message || 'Failed to update profile');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword) {
      toastError('Please fill in all password fields');
      return;
    }
    if (newPassword.length < 8) {
      toastError('New password must be at least 8 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      toastError('New passwords do not match');
      return;
    }
    setSavingPassword(true);
    try {
      const res = await authApi.changePassword(currentPassword, newPassword);
      setPasswordModal(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      toastSuccess(res.data?.message || 'Password changed successfully');
    } catch (err: any) {
      toastError(err.message || 'Failed to change password');
    } finally {
      setSavingPassword(false);
    }
  };

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to log out of your account?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: () => logout(),
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <Header
        title="Profile"
        subtitle="Account settings & preferences"
      />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* User Card */}
        <Card style={styles.userCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
            </Text>
          </View>
          <View style={styles.userInfo}>
            <Text style={styles.userName}>{user?.name}</Text>
            <Text style={styles.userEmail}>{user?.email}</Text>
            <View style={styles.roleBadgeRow}>
              <Badge
                label={roleLabel(user?.role)}
                variant={user?.role === 'admin' ? 'purple' : user?.role === 'manager' ? 'primary' : 'neutral'}
                size="md"
              />
            </View>
          </View>
          <TouchableOpacity
            style={styles.editBtn}
            onPress={openEditModal}
            activeOpacity={0.7}
          >
            <Edit2 size={18} color={colors.primary} />
          </TouchableOpacity>
        </Card>

        {isManagerLevel(user?.role) && <>
          <Text style={styles.sectionHeader}>Workspace</Text>
          <Card style={styles.workspaceCard}>
            {[
              { route: 'MyDay', label: 'My Day', subtitle: 'Personal focus and daily checklist', icon: 'sunny-outline' as const, color: colors.warning },
              { route: 'Analytics', label: 'Analytics', subtitle: 'Productivity and team performance', icon: 'bar-chart-outline' as const, color: colors.info },
              { route: 'Notifications', label: 'Notifications', subtitle: 'Updates, assignments and alerts', icon: 'notifications-outline' as const, color: colors.primary },
            ].map((item, index, items) => <React.Fragment key={item.route}>
              <TouchableOpacity accessibilityRole="button" onPress={() => navigation.navigate(item.route)} style={styles.workspaceRow} activeOpacity={0.7}>
                <View style={[styles.workspaceIcon, { backgroundColor: `${item.color}18` }]}><Ionicons name={item.icon} size={20} color={item.color} /></View>
                <View style={styles.workspaceText}><Text style={styles.workspaceLabel}>{item.label}</Text><Text style={styles.workspaceSubtitle}>{item.subtitle}</Text></View>
                <Ionicons name="chevron-forward-outline" size={18} color={colors.textMuted} />
              </TouchableOpacity>
              {index < items.length - 1 && <View style={styles.divider} />}
            </React.Fragment>)}
          </Card>
        </>}

        {/* Details Section */}
        <Text style={styles.sectionHeader}>Profile Information</Text>
        <Card style={styles.detailsCard}>
          <View style={styles.detailRow}>
            <Building size={18} color={colors.textMuted} style={styles.detailIcon} />
            <Text style={styles.detailLabel}>Department</Text>
            <Text style={styles.detailValue}>{user?.department || 'Not set'}</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.detailRow}>
            <Briefcase size={18} color={colors.textMuted} style={styles.detailIcon} />
            <Text style={styles.detailLabel}>Job Title</Text>
            <Text style={styles.detailValue}>{user?.job_title || 'Not set'}</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.detailRow}>
            <Phone size={18} color={colors.textMuted} style={styles.detailIcon} />
            <Text style={styles.detailLabel}>Phone</Text>
            <Text style={styles.detailValue}>{user?.phone || 'Not set'}</Text>
          </View>
        </Card>

        {/* Settings & Security */}
        <Text style={styles.sectionHeader}>Security & Connection</Text>
        <Card style={styles.detailsCard}>
          <TouchableOpacity
            style={styles.actionRow}
            onPress={() => {
              setCurrentPassword('');
              setNewPassword('');
              setConfirmPassword('');
              setPasswordModal(true);
            }}
            activeOpacity={0.7}
          >
            <KeyRound size={18} color={colors.primary} style={styles.detailIcon} />
            <Text style={styles.actionText}>Change Password</Text>
          </TouchableOpacity>

        </Card>

        {/* Logout Button */}
        <Button
          title="Sign Out"
          variant="danger"
          icon={<LogOut size={18} color={colors.white} />}
          onPress={handleLogout}
          size="lg"
          style={styles.logoutBtn}
        />
      </ScrollView>

      {/* Edit Profile Modal */}
      <Modal
        visible={editModal}
        onClose={() => setEditModal(false)}
        title="Edit Profile"
      >
        <Input
          label="Full Name"
          value={name}
          onChangeText={setName}
          placeholder="Your full name"
        />
        <Input
          label="Department"
          value={department}
          onChangeText={setDepartment}
          placeholder="e.g. Engineering, Design"
        />
        <Input
          label="Job Title"
          value={jobTitle}
          onChangeText={setJobTitle}
          placeholder="e.g. Frontend Developer"
        />
        <Input
          label="Phone Number"
          value={phone}
          onChangeText={setPhone}
          placeholder="e.g. +1 555-0199"
          keyboardType="phone-pad"
        />
        <Button
          title="Save Changes"
          onPress={handleSaveProfile}
          loading={savingProfile}
          style={{ marginTop: spacing.md }}
        />
      </Modal>

      {/* Change Password Modal */}
      <Modal
        visible={passwordModal}
        onClose={() => setPasswordModal(false)}
        title="Change Password"
      >
        <Input
          label="Current Password"
          value={currentPassword}
          onChangeText={setCurrentPassword}
          isPassword
        />
        <Input
          label="New Password"
          value={newPassword}
          onChangeText={setNewPassword}
          isPassword
          helper="Must be at least 8 characters"
        />
        <Input
          label="Confirm New Password"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          isPassword
        />
        <Button
          title="Update Password"
          onPress={handleChangePassword}
          loading={savingPassword}
          style={{ marginTop: spacing.md }}
        />
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    padding: spacing.lg,
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.lg,
    marginBottom: spacing.xl,
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  avatarText: {
    color: colors.white,
    fontSize: 24,
    fontWeight: typography.weights.bold,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    color: colors.text,
    fontSize: 18,
    fontWeight: typography.weights.bold,
  },
  userEmail: {
    color: colors.textMuted,
    fontSize: 13,
    marginTop: 2,
  },
  roleBadgeRow: {
    marginTop: 6,
  },
  editBtn: {
    padding: spacing.sm,
    backgroundColor: colors.primaryLight,
    borderRadius: borderRadius.md,
  },
  sectionHeader: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: typography.weights.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
    marginLeft: 4,
  },
  detailsCard: {
    padding: 0,
    marginBottom: spacing.md,
    overflow: 'hidden',
  },
  workspaceCard: { padding: 0, marginBottom: spacing.md, overflow: 'hidden' },
  workspaceRow: { flexDirection: 'row', alignItems: 'center', padding: 10, minHeight: 52 },
  workspaceIcon: { width: 32, height: 32, borderRadius: 9, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  workspaceText: { flex: 1 },
  workspaceLabel: { color: colors.text, fontSize: 13, fontWeight: typography.weights.semibold },
  workspaceSubtitle: { color: colors.textMuted, fontSize: 10.5, marginTop: 2 },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
  },
  detailIcon: {
    marginRight: 10,
  },
  detailLabel: {
    color: colors.textSecondary,
    fontSize: 13,
    flex: 1,
  },
  detailValue: {
    color: colors.text,
    fontSize: 13,
    fontWeight: typography.weights.medium,
  },
  divider: {
    height: 1,
    backgroundColor: colors.cardBorder,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
  },
  actionText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: typography.weights.medium,
  },
  actionSubtext: {
    color: colors.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  logoutBtn: {
    marginTop: spacing.md,
    marginBottom: spacing.xxxl,
  },
});

