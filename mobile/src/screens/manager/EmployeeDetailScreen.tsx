import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { teamApi } from '../../api/endpoints';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { TeamMemberDetail, Task, DailyReport, isAdmin } from '../../types';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { Modal } from '../../components/Modal';
import { StatusBadge } from '../../components/StatusBadge';
import { PriorityBadge } from '../../components/PriorityBadge';
import { Header } from '../../components/Header';
import { EmptyState } from '../../components/EmptyState';
import { colors, borderRadius, spacing, typography } from '../../theme';
import {
  User,
  Mail,
  Building,
  Briefcase,
  Phone,
  Calendar,
  CheckCircle2,
  Trash2,
  Edit2,
  Clock,
  FileText,
} from '../../components/Icon';

export function EmployeeDetailScreen({ route, navigation }: any) {
  const { id, name: initialName } = route.params;
  const { user } = useAuth();
  const { success: toastSuccess, error: toastError } = useToast();

  const [activeTab, setActiveTab] = useState<'tasks' | 'reports'>('tasks');
  const [employee, setEmployee] = useState<TeamMemberDetail | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [reports, setReports] = useState<DailyReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Edit Employee Modal (Admin)
  const [editModal, setEditModal] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [department, setDepartment] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [phone, setPhone] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const res = await teamApi.detail(id);
      setEmployee(res.data.employee);
      setTasks(res.data.tasks || []);
      setReports(res.data.reports || []);

      setName(res.data.employee.name);
      setEmail(res.data.employee.email);
      setDepartment(res.data.employee.department || '');
      setJobTitle(res.data.employee.job_title || '');
      setPhone(res.data.employee.phone || '');
    } catch {
      toastError('Failed to load employee details');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id, toastError]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSaveEdit = async () => {
    if (!name.trim() || !email.trim()) {
      toastError('Name and email are required');
      return;
    }
    setSavingEdit(true);
    try {
      await teamApi.update(id, {
        name: name.trim(),
        email: email.trim(),
        department: department.trim() || undefined,
        jobTitle: jobTitle.trim() || undefined,
        phone: phone.trim() || null,
      });
      toastSuccess('Employee updated');
      setEditModal(false);
      loadData();
    } catch (err: any) {
      toastError(err.message || 'Failed to update employee');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDeleteEmployee = () => {
    Alert.alert(
      'Remove Team Member',
      `Are you sure you want to permanently remove ${employee?.name}? All associated reports and tasks will be affected.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              const res = await teamApi.remove(id);
              toastSuccess(res.data.message || 'Team member removed');
              navigation.goBack();
            } catch (err: any) {
              toastError(err.message || 'Failed to remove member');
            }
          },
        },
      ]
    );
  };

  if (loading && !refreshing) {
    return (
    <SafeAreaView style={styles.loadingContainer} edges={['top', 'left', 'right']}>
        <ActivityIndicator size="large" color={colors.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
      <Header
        title={employee?.name || initialName || 'Employee Profile'}
        onBack={() => navigation.goBack()}
        rightAction={
          isAdmin(user?.role) ? (
            <View style={{ flexDirection: 'row' }}>
              <TouchableOpacity
                onPress={() => setEditModal(true)}
                style={styles.headerIconBtn}
              >
                <Edit2 size={18} color={colors.primary} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleDeleteEmployee}
                style={[styles.headerIconBtn, { marginLeft: 8 }]}
              >
                <Trash2 size={18} color={colors.danger} />
              </TouchableOpacity>
            </View>
          ) : null
        }
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
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
      >
        {/* Profile Card */}
        <Card style={styles.profileCard}>
          <View style={styles.profileTop}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {employee?.name ? employee.name.charAt(0).toUpperCase() : 'U'}
              </Text>
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>{employee?.name}</Text>
              <Text style={styles.profileEmail}>{employee?.email}</Text>
              <Text style={styles.profileJob}>
                {employee?.job_title || 'Team Member'} {employee?.department ? `· ${employee.department}` : ''}
              </Text>
            </View>
          </View>

          {/* Counts */}
          <View style={styles.statsRow}>
            <View style={styles.statBox}>
              <Text style={[styles.statValue, { color: colors.statusPending }]}>
                {employee?.counts?.pending || 0}
              </Text>
              <Text style={styles.statLabel}>Pending</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={[styles.statValue, { color: colors.statusInProgress }]}>
                {employee?.counts?.in_progress || 0}
              </Text>
              <Text style={styles.statLabel}>In Progress</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={[styles.statValue, { color: colors.statusCompleted }]}>
                {employee?.counts?.completed || 0}
              </Text>
              <Text style={styles.statLabel}>Completed</Text>
            </View>
            <View style={styles.statBox}>
              <Text style={[styles.statValue, { color: colors.statusOverdue }]}>
                {employee?.counts?.overdue || 0}
              </Text>
              <Text style={styles.statLabel}>Overdue</Text>
            </View>
          </View>
        </Card>

        {/* Tab Selector */}
        <View style={styles.tabRow}>
          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'tasks' && styles.tabBtnActive]}
            onPress={() => setActiveTab('tasks')}
          >
            <Text style={[styles.tabBtnText, activeTab === 'tasks' && styles.tabBtnTextActive]}>
              Assigned Tasks ({tasks.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabBtn, activeTab === 'reports' && styles.tabBtnActive]}
            onPress={() => setActiveTab('reports')}
          >
            <Text style={[styles.tabBtnText, activeTab === 'reports' && styles.tabBtnTextActive]}>
              Daily Reports ({reports.length})
            </Text>
          </TouchableOpacity>
        </View>

        {/* Tab Content */}
        {activeTab === 'tasks' ? (
          tasks.length === 0 ? (
            <EmptyState
              title="No tasks assigned"
              message="This team member currently has no tasks assigned."
            />
          ) : (
            tasks.map((task: Task) => (
              <Card key={task.id} style={styles.taskCard}>
                <View style={styles.taskHeader}>
                  <View style={styles.keyRow}>
                    {task.task_key && <Text style={styles.taskKey}>{task.task_key}</Text>}
                    <Text style={styles.projectName}>{task.project_name || 'General'}</Text>
                  </View>
                  <PriorityBadge priority={task.priority} />
                </View>

                <Text style={styles.taskTitle}>{task.title}</Text>
                {task.description ? (
                  <Text style={styles.taskDesc} numberOfLines={2}>
                    {task.description}
                  </Text>
                ) : null}

                <View style={styles.taskFooter}>
                  <StatusBadge status={task.effective_status} />
                  {task.deadline && (
                    <Text style={styles.deadlineText}>
                      Deadline: {new Date(task.deadline).toLocaleDateString()}
                    </Text>
                  )}
                </View>
              </Card>
            ))
          )
        ) : (
          reports.length === 0 ? (
            <EmptyState
              title="No reports submitted"
              message="No daily work reports have been submitted by this employee yet."
              icon={<FileText size={32} color={colors.textMuted} />}
            />
          ) : (
            reports.map((report: DailyReport) => (
              <Card key={report.id} style={styles.reportCard}>
                <View style={styles.reportHeader}>
                  <Text style={styles.reportDate}>{report.report_date}</Text>
                  <Text style={styles.reportTime}>
                    {new Date(report.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </Text>
                </View>
                <Text style={styles.reportDesc}>{report.task_description}</Text>
              </Card>
            ))
          )
        )}
      </ScrollView>

      {/* Edit Employee Modal */}
      <Modal
        visible={editModal}
        onClose={() => setEditModal(false)}
        title="Edit Team Member"
      >
        <Input label="Name" value={name} onChangeText={setName} />
        <Input label="Email" value={email} onChangeText={setEmail} keyboardType="email-address" />
        <Input label="Department" value={department} onChangeText={setDepartment} />
        <Input label="Job Title" value={jobTitle} onChangeText={setJobTitle} />
        <Input label="Phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
        <Button
          title="Save Changes"
          onPress={handleSaveEdit}
          loading={savingEdit}
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  headerIconBtn: {
    padding: spacing.sm,
    backgroundColor: colors.cardHover,
    borderRadius: borderRadius.md,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
  },
  profileCard: {
    marginBottom: spacing.lg,
  },
  profileTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  avatar: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  avatarText: {
    color: colors.white,
    fontSize: 22,
    fontWeight: typography.weights.bold,
  },
  profileInfo: {
    flex: 1,
  },
  profileName: {
    color: colors.text,
    fontSize: 17,
    fontWeight: typography.weights.bold,
  },
  profileEmail: {
    color: colors.textMuted,
    fontSize: 13,
    marginTop: 2,
  },
  profileJob: {
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.cardBorder,
  },
  statBox: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 18,
    fontWeight: typography.weights.bold,
  },
  statLabel: {
    color: colors.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  tabRow: {
    flexDirection: 'row',
    backgroundColor: colors.card,
    borderRadius: borderRadius.lg,
    padding: 4,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: borderRadius.md,
  },
  tabBtnActive: {
    backgroundColor: colors.primary,
  },
  tabBtnText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: typography.weights.medium,
  },
  tabBtnTextActive: {
    color: colors.white,
    fontWeight: typography.weights.bold,
  },
  taskCard: {
    marginBottom: spacing.md,
  },
  taskHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  keyRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  taskKey: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: typography.weights.bold,
    marginRight: 6,
  },
  projectName: {
    color: colors.textMuted,
    fontSize: 12,
  },
  taskTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: typography.weights.bold,
    marginBottom: 4,
  },
  taskDesc: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: spacing.md,
  },
  taskFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.cardBorder,
  },
  deadlineText: {
    color: colors.textMuted,
    fontSize: 12,
  },
  reportCard: {
    marginBottom: spacing.md,
  },
  reportHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  reportDate: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: typography.weights.bold,
  },
  reportTime: {
    color: colors.textMuted,
    fontSize: 11,
  },
  reportDesc: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 20,
  },
});

