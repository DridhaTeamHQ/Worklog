import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  TextInput,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { teamApi, adminApi } from '../../api/endpoints';
import { TeamMember, Manager, isAdmin } from '../../types';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { Modal } from '../../components/Modal';
import { SelectPicker } from '../../components/SelectPicker';
import { Badge } from '../../components/Badge';
import { Header } from '../../components/Header';
import { EmptyState } from '../../components/EmptyState';
import { colors, borderRadius, spacing, typography } from '../../theme';
import {
  Search,
  Plus,
  UserPlus,
  Users,
  Shield,
  Phone,
  Briefcase,
  Building,
  CheckCircle2,
  Clock,
  ChevronRight,
  ShieldCheck,
} from '../../components/Icon';

export function TeamMembersScreen({ navigation }: any) {
  const { user } = useAuth();
  const { success: toastSuccess, error: toastError } = useToast();

  const [activeTab, setActiveTab] = useState<'members' | 'elevated'>('members');
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [elevatedStaff, setElevatedStaff] = useState<Manager[]>([]);
  const [departments, setDepartments] = useState<string[]>([]);
  const [selectedDept, setSelectedDept] = useState<string>('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Add Member Modal
  const [addModal, setAddModal] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [department, setDepartment] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<'team_member' | 'manager' | 'admin'>('team_member');
  const [submitting, setSubmitting] = useState(false);
  const [departmentModal, setDepartmentModal] = useState(false);
  const [departmentName, setDepartmentName] = useState('');
  const [savingDepartment, setSavingDepartment] = useState(false);
  const createDepartment = async () => {
    if (!departmentName.trim() || savingDepartment) return;
    setSavingDepartment(true);
    try {
      const result = await teamApi.createDepartment(departmentName.trim());
      setDepartments(previous => [...previous, result.data.name].sort());
      setDepartmentModal(false);
      setDepartmentName('');
      toastSuccess('Department created');
    } catch (err: any) { toastError(err.message || 'Could not create department'); }
    finally { setSavingDepartment(false); }
  };

  const loadData = useCallback(async () => {
    try {
      const [membersRes, deptsRes] = await Promise.all([
        teamApi.list({
          search: search.trim() || undefined,
          department: selectedDept || undefined,
        }),
        teamApi.departments(),
      ]);
      setMembers(membersRes.data || []);
      setDepartments(deptsRes.data || []);

      if (isAdmin(user?.role)) {
        const adminsRes = await adminApi.list({ search: search.trim() || undefined });
        setElevatedStaff(adminsRes.data || []);
      }
    } catch {
      toastError('Failed to load team roster');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [search, selectedDept, user?.role, toastError]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleAddMember = async () => {
    if (!department || !name.trim() || !email.trim()) {
      toastError('Select a department and enter name and email');
      return;
    }

    setSubmitting(true);
    try {
      if (role === 'team_member') {
        const res = await teamApi.create({
          name: name.trim(),
          email: email.trim(),
          department: department.trim() || undefined,
          jobTitle: jobTitle.trim() || undefined,
          phone: phone.trim() || undefined,
        });
        toastSuccess(res.data.message || 'Invitation sent to team member');
      } else {
        const res = await adminApi.create({
          name: name.trim(),
          email: email.trim(),
          department: department.trim() || undefined,
          jobTitle: jobTitle.trim() || undefined,
          phone: phone.trim() || undefined,
          role,
        });
        toastSuccess(res.data.message || `Invitation sent to ${role}`);
      }
      setAddModal(false);
      setName('');
      setEmail('');
      setDepartment('');
      setJobTitle('');
      setPhone('');
      loadData();
    } catch (err: any) {
      toastError(err.message || 'Failed to add team member');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleAdminAccess = async (admin: Manager) => {
    try {
      await adminApi.setAccess(admin.id, !admin.is_active);
      toastSuccess(`Access ${admin.is_active ? 'disabled' : 'enabled'}`);
      loadData();
    } catch (err: any) {
      toastError(err.message || 'Failed to update access');
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right', 'bottom']}>
      <Header
        title="Team Directory"
        subtitle={`${members.length} team members registered`}
        rightAction={
          <Button
            title="Invite Member"
            size="sm"
            icon={<UserPlus size={16} color={colors.white} />}
            onPress={() => {
              setRole('team_member');
              setDepartment('');
              setAddModal(true);
            }}
          />
        }
      />

      {/* Admin Tab Switcher */}
      <View style={{ paddingHorizontal: spacing.lg, paddingVertical: spacing.sm }}>
        <Button title="Create Department" variant="outline" size="sm" onPress={() => setDepartmentModal(true)} />
      </View>
      {isAdmin(user?.role) && (
        <View style={styles.tabSwitcher}>
          <TouchableOpacity
            style={[styles.switchTab, activeTab === 'members' && styles.switchTabActive]}
            onPress={() => setActiveTab('members')}
          >
            <Text
              style={[
                styles.switchTabText,
                activeTab === 'members' && styles.switchTabTextActive,
              ]}
            >
              Team Members ({members.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.switchTab, activeTab === 'elevated' && styles.switchTabActive]}
            onPress={() => setActiveTab('elevated')}
          >
            <Text
              style={[
                styles.switchTabText,
                activeTab === 'elevated' && styles.switchTabTextActive,
              ]}
            >
              Managers & Admins ({elevatedStaff.length})
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Search & Department Filters */}
      <View style={styles.searchContainer}>
        <Search size={16} color={colors.textMuted} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by name, email, or role..."
          placeholderTextColor={colors.placeholder}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {/* Department Filter Pills */}
      {departments.length > 0 && activeTab === 'members' && (
        <View style={styles.deptScrollContainer}>
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={['', ...departments]}
            keyExtractor={(item: string) => item || 'all'}
            contentContainerStyle={styles.deptList}
            renderItem={({ item }: { item: string }) => (
              <TouchableOpacity
                style={[
                  styles.deptPill,
                  selectedDept === item && styles.deptPillActive,
                ]}
                onPress={() => setSelectedDept(item)}
              >
                <Text
                  style={[
                    styles.deptPillText,
                    selectedDept === item && styles.deptPillTextActive,
                  ]}
                >
                  {item || 'All Departments'}
                </Text>
              </TouchableOpacity>
            )}
          />
        </View>
      )}

      {/* Members List */}
      {activeTab === 'members' ? (
        <FlatList
          data={members}
          keyExtractor={(item: TeamMember) => String(item.id)}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                loadData();
              }}
              tintColor={colors.primary}
            />
          }
          renderItem={({ item }: { item: TeamMember }) => (
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => navigation.navigate('EmployeeDetail', { id: item.id, name: item.name })}
            >
              <Card style={styles.memberCard}>
                <View style={styles.cardTop}>
                  <View style={styles.avatarBox}>
                    <Text style={styles.avatarText}>
                      {item.name ? item.name.charAt(0).toUpperCase() : 'U'}
                    </Text>
                  </View>
                  <View style={styles.memberInfo}>
                    <View style={styles.nameRow}>
                      <Text style={styles.memberName}>{item.name}</Text>
                      {item.submitted_today ? (
                        <View style={styles.submittedPill}>
                          <CheckCircle2 size={12} color={colors.success} style={{ marginRight: 3 }} />
                          <Text style={styles.submittedPillText}>Report In</Text>
                        </View>
                      ) : (
                        <View style={styles.pendingPill}>
                          <Clock size={12} color={colors.warning} style={{ marginRight: 3 }} />
                          <Text style={styles.pendingPillText}>Pending</Text>
                        </View>
                      )}
                    </View>
                    <Text style={styles.memberEmail}>{item.email}</Text>
                    <Text style={styles.memberJob}>
                      {item.job_title || 'Team Member'} {item.department ? `· ${item.department}` : ''}
                    </Text>
                  </View>
                  <ChevronRight size={20} color={colors.textMuted} />
                </View>

                {/* Task Counts Summary */}
                <View style={styles.taskCountsRow}>
                  <Text style={styles.countBadgeText}>
                    Active: <Text style={{ color: colors.info, fontWeight: 'bold' }}>{item.counts?.in_progress || 0}</Text>
                  </Text>
                  <Text style={styles.countBadgeText}>
                    Pending: <Text style={{ color: colors.warning, fontWeight: 'bold' }}>{item.counts?.pending || 0}</Text>
                  </Text>
                  <Text style={styles.countBadgeText}>
                    Done: <Text style={{ color: colors.success, fontWeight: 'bold' }}>{item.counts?.completed || 0}</Text>
                  </Text>
                  {item.counts && item.counts.overdue > 0 ? (
                    <Text style={styles.countBadgeText}>
                      Overdue: <Text style={{ color: colors.danger, fontWeight: 'bold' }}>{item.counts.overdue}</Text>
                    </Text>
                  ) : null}
                </View>
              </Card>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <EmptyState
              title="No team members found"
              message="Invite employees to assign tasks and collect daily work reports."
            />
          }
        />
      ) : (
        /* Elevated Staff List (Managers & Admins) */
        <FlatList
          data={elevatedStaff}
          keyExtractor={(item: Manager) => String(item.id)}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                loadData();
              }}
              tintColor={colors.primary}
            />
          }
          renderItem={({ item }: { item: Manager }) => (
            <Card style={styles.memberCard}>
              <View style={styles.cardTop}>
                <View
                  style={[
                    styles.avatarBox,
                    item.role === 'admin' ? { backgroundColor: colors.purple } : { backgroundColor: colors.primary },
                  ]}
                >
                  <Text style={styles.avatarText}>
                    {item.name ? item.name.charAt(0).toUpperCase() : 'M'}
                  </Text>
                </View>
                <View style={styles.memberInfo}>
                  <View style={styles.nameRow}>
                    <Text style={styles.memberName}>{item.name}</Text>
                    <Badge
                      label={item.role === 'admin' ? 'ADMIN' : 'MANAGER'}
                      variant={item.role === 'admin' ? 'purple' : 'primary'}
                    />
                  </View>
                  <Text style={styles.memberEmail}>{item.email}</Text>
                  <Text style={styles.memberJob}>
                    Assigned Tasks: {item.assigned_tasks || 0} ({item.open_tasks || 0} open)
                  </Text>
                </View>
              </View>

              {user?.id !== item.id && (
                <View style={styles.adminActionRow}>
                  <Button
                    title={item.is_active ? 'Disable Access' : 'Enable Access'}
                    size="sm"
                    variant={item.is_active ? 'outline' : 'primary'}
                    onPress={() => handleToggleAdminAccess(item)}
                  />
                </View>
              )}
            </Card>
          )}
          ListEmptyComponent={
            <EmptyState
              title="No elevated managers found"
              message="Managers and administrators appear here."
            />
          }
        />
      )}

      {/* Invite Member Modal */}
      <Modal visible={departmentModal} onClose={() => setDepartmentModal(false)} title="Create Department">
        <Input label="Department name" placeholder="e.g. Tech Team, Video Editing Team" value={departmentName} onChangeText={setDepartmentName} maxLength={120} />
        <Button title="Create Department" onPress={createDepartment} loading={savingDepartment} />
      </Modal>
      <Modal
        visible={addModal}
        onClose={() => setAddModal(false)}
        title="Invite New Staff"
        subtitle="An email invitation will be prepared for them to activate their account"
      >
        <SelectPicker label="Department" placeholder="Choose a department first" options={departments.map(value => ({ label: value, value }))} value={department || null} onChange={setDepartment} />
        {!departments.length && <Text style={{ color: colors.textMuted }}>Create a department before inviting a member.</Text>}
        {!!department && <>
        {isAdmin(user?.role) && (
          <SelectPicker
            label="Role Tier"
            options={[
              { label: 'Team Member', value: 'team_member' },
              { label: 'Manager', value: 'manager' },
              { label: 'Administrator', value: 'admin' },
            ]}
            value={role}
            onChange={(val) => setRole(val as any)}
          />
        )}

        <Input
          label="Full Name"
          placeholder="e.g. Sarah Connor"
          value={name}
          onChangeText={setName}
        />

        <Input
          label="Email Address"
          placeholder="s.connor@company.com"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />


        <Input
          label="Job Title"
          placeholder="e.g. Senior QA Engineer"
          value={jobTitle}
          onChangeText={setJobTitle}
        />

        <Input
          label="Phone Number (Optional)"
          placeholder="+1 555-0100"
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
        />

        <Button
          title="Send Invitation"
          onPress={handleAddMember}
          loading={submitting}
          style={{ marginTop: spacing.md }}
        />
        </>}
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  tabSwitcher: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
  },
  switchTab: {
    paddingVertical: 6,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    marginRight: spacing.sm,
  },
  switchTabActive: {
    backgroundColor: colors.primaryLight,
  },
  switchTabText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: typography.weights.medium,
  },
  switchTabTextActive: {
    color: colors.primary,
    fontWeight: typography.weights.bold,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: borderRadius.md,
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  searchIcon: {
    marginRight: spacing.sm,
  },
  searchInput: {
    flex: 1,
    color: colors.text,
    fontSize: 14,
    paddingVertical: 10,
  },
  deptScrollContainer: {
    marginVertical: spacing.sm,
  },
  deptList: {
    paddingHorizontal: spacing.lg,
  },
  deptPill: {
    paddingVertical: 5,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.full,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    marginRight: spacing.sm,
  },
  deptPillActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  deptPillText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: typography.weights.medium,
  },
  deptPillTextActive: {
    color: colors.white,
    fontWeight: typography.weights.bold,
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
    paddingTop: spacing.xs,
  },
  memberCard: {
    marginBottom: spacing.md,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarBox: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.cardHover,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  avatarText: {
    color: colors.text,
    fontSize: 18,
    fontWeight: typography.weights.bold,
  },
  memberInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingRight: spacing.sm,
  },
  memberName: {
    color: colors.text,
    fontSize: 15,
    fontWeight: typography.weights.bold,
  },
  submittedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.successLight,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
  },
  submittedPillText: {
    color: colors.success,
    fontSize: 10,
    fontWeight: typography.weights.bold,
  },
  pendingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.warningLight,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
  },
  pendingPillText: {
    color: colors.warning,
    fontSize: 10,
    fontWeight: typography.weights.bold,
  },
  memberEmail: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  memberJob: {
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  taskCountsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.cardBorder,
  },
  countBadgeText: {
    color: colors.textMuted,
    fontSize: 12,
  },
  adminActionRow: {
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.cardBorder,
    alignItems: 'flex-end',
  },
});

