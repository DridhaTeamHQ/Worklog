import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  SafeAreaView,
  ActivityIndicator,
} from 'react-native';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { dashboardApi, taskApi } from '../../api/endpoints';
import { EmployeeDashboardData, Task, TaskStatus } from '../../types';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { StatCard } from '../../components/StatCard';
import { StatusBadge } from '../../components/StatusBadge';
import { PriorityBadge } from '../../components/PriorityBadge';
import { Header } from '../../components/Header';
import { EmptyState } from '../../components/EmptyState';
import { Modal } from '../../components/Modal';
import { colors, borderRadius, spacing, typography } from '../../theme';
import {
  Clock,
  CheckCircle2,
  AlertCircle,
  FileText,
  ChevronRight,
  Sparkles,
  Ticket as TicketIcon,
  Play,
  Check,
} from '../../components/Icon';
import { Ionicons } from '@expo/vector-icons';

export function EmployeeDashboardScreen({ navigation }: any) {
  const { user } = useAuth();
  const { success: toastSuccess, error: toastError } = useToast();

  const [data, setData] = useState<EmployeeDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Quick Task Action Modal
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [statusModal, setStatusModal] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const res = await dashboardApi.load();
      if (res.data.role === 'team_member') {
        setData(res.data as EmployeeDashboardData);
      }
    } catch (err: any) {
      toastError('Failed to load dashboard data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [toastError]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleUpdateStatus = async (status: TaskStatus) => {
    if (!activeTask) return;
    setUpdatingStatus(true);
    try {
      await taskApi.updateStatus(activeTask.id, status);
      toastSuccess(`Task moved to ${status.replace('_', ' ')}`);
      setStatusModal(false);
      loadData();
    } catch (err: any) {
      toastError(err.message || 'Failed to update task status');
    } finally {
      setUpdatingStatus(false);
    }
  };

  if (loading && !refreshing) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </SafeAreaView>
    );
  }

  const summary = data?.summary;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topHeader}>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Open profile" style={styles.profileButton} onPress={() => navigation.navigate('Profile')}>
          <View style={styles.avatar}><Text style={styles.avatarText}>{user?.name?.split(/\s+/).map(part => part[0]).slice(0, 2).join('').toUpperCase() || 'U'}</Text></View>
          <View style={styles.greeting}>
            <Text style={styles.title} numberOfLines={1}>Dashboard</Text>
            <Text style={styles.subtitle} numberOfLines={1}>Overview of your tasks & progress</Text>
          </View>
          <Ionicons name="chevron-forward" size={19} color={colors.textMuted} />
        </TouchableOpacity>
      </View>

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
        {/* Today's Report Prompt Banner */}
        <Card
          style={[
            styles.reportBanner,
            summary?.submitted_today ? styles.reportBannerSubmitted : styles.reportBannerPending,
          ]}
        >
          <View style={styles.bannerRow}>
            <View style={styles.bannerIconBox}>
              <FileText
                size={22}
                color={summary?.submitted_today ? colors.success : colors.warning}
              />
            </View>
            <View style={styles.bannerTextContainer}>
              <Text style={styles.bannerTitle}>
                {summary?.submitted_today ? 'Today\'s Report Submitted' : 'Daily Report Pending'}
              </Text>
              <Text style={styles.bannerSubtitle}>
                {summary?.submitted_today
                  ? 'Great job keeping the team in sync!'
                  : 'Don\'t forget to submit your daily work summary.'}
              </Text>
            </View>
            <Button
              title={summary?.submitted_today ? 'Edit' : 'Write'}
              size="sm"
              variant={summary?.submitted_today ? 'outline' : 'primary'}
              onPress={() => navigation.navigate('MyDay')}
            />
          </View>
        </Card>

        {/* Stats Grid */}
        <Text style={styles.sectionTitle}>Overview</Text>
        <View style={styles.statsGrid}>
          <View style={styles.statsRow}>
            <StatCard
              label="Pending"
              value={summary?.pending_tasks || 0}
              accentColor={colors.statusPending}
              icon={<Clock size={16} color={colors.statusPending} />}
              onPress={() => navigation.navigate('TasksAssigned')}
            />
            <View style={{ width: spacing.md }} />
            <StatCard
              label="In Progress"
              value={summary?.in_progress_tasks || 0}
              accentColor={colors.statusInProgress}
              icon={<Play size={16} color={colors.statusInProgress} />}
              onPress={() => navigation.navigate('TasksAssigned')}
            />
          </View>

          <View style={[styles.statsRow, { marginTop: spacing.md }]}>
            <StatCard
              label="Done Today"
              value={summary?.completed_today || 0}
              accentColor={colors.statusCompleted}
              icon={<CheckCircle2 size={16} color={colors.statusCompleted} />}
              onPress={() => navigation.navigate('TasksDone')}
            />
            <View style={{ width: spacing.md }} />
            <StatCard
              label="Overdue"
              value={summary?.overdue_tasks || 0}
              accentColor={colors.statusOverdue}
              icon={<AlertCircle size={16} color={colors.statusOverdue} />}
              onPress={() => navigation.navigate('TasksAssigned')}
            />
          </View>
        </View>

        {/* Upcoming Tasks Section */}
        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Upcoming Assigned Tasks</Text>
          <TouchableOpacity
            onPress={() => navigation.navigate('TasksAssigned')}
            activeOpacity={0.7}
          >
            <Text style={styles.viewAllText}>View all</Text>
          </TouchableOpacity>
        </View>

        {(!data?.upcoming_tasks || data.upcoming_tasks.length === 0) ? (
          <EmptyState
            title="No active tasks assigned"
            message="You are all caught up! No active tasks are currently waiting on you."
          />
        ) : (
          data.upcoming_tasks.map((task) => (
            <Card key={task.id} style={styles.taskCard}>
              <View style={styles.taskHeader}>
                <View style={styles.taskKeyRow}>
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
                <Button
                  title="Update Status"
                  size="sm"
                  variant="outline"
                  onPress={() => {
                    setActiveTask(task);
                    setStatusModal(true);
                  }}
                />
              </View>
            </Card>
          ))
        )}

        {/* Recent Tickets Section */}
        <View style={[styles.sectionHeaderRow, { marginTop: spacing.xl }]}>
          <Text style={styles.sectionTitle}>Recent Tickets / Issues</Text>
          <TouchableOpacity
            onPress={() => navigation.navigate('Tickets')}
            activeOpacity={0.7}
          >
            <Text style={styles.viewAllText}>View all</Text>
          </TouchableOpacity>
        </View>

        {(!data?.recent_tickets || data.recent_tickets.length === 0) ? (
          <EmptyState
            title="No open tickets"
            message="No tickets have been raised for your assigned tasks."
            icon={<TicketIcon size={32} color={colors.textMuted} />}
          />
        ) : (
          data.recent_tickets.map((ticket) => (
            <Card key={ticket.id} style={styles.ticketCard}>
              <View style={styles.taskHeader}>
                <Text style={styles.taskKey}>{ticket.ticket_key}</Text>
                <PriorityBadge priority={ticket.severity} />
              </View>
              <Text style={styles.taskTitle}>{ticket.title}</Text>
              <View style={styles.taskFooter}>
                <Text style={styles.projectName}>{ticket.project_name}</Text>
                <StatusBadge status={ticket.status} />
              </View>
            </Card>
          ))
        )}
      </ScrollView>

      {/* Status Update Modal */}
      <Modal
        visible={statusModal}
        onClose={() => setStatusModal(false)}
        title="Update Task Status"
        subtitle={activeTask?.title}
      >
        <View style={styles.statusButtonsContainer}>
          <Button
            title="Mark as Pending"
            variant="outline"
            style={styles.statusOptionBtn}
            loading={updatingStatus}
            onPress={() => handleUpdateStatus('pending')}
          />
          <Button
            title="Mark as In Progress"
            variant="secondary"
            style={styles.statusOptionBtn}
            loading={updatingStatus}
            onPress={() => handleUpdateStatus('in_progress')}
          />
          <Button
            title="Mark as Completed"
            variant="primary"
            style={styles.statusOptionBtn}
            loading={updatingStatus}
            onPress={() => handleUpdateStatus('completed')}
          />
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  topHeader: { backgroundColor: colors.background, borderBottomWidth: 1, borderBottomColor: colors.cardBorder, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  profileButton: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.primaryLight, justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: colors.primary, fontSize: 15, fontWeight: typography.weights.bold },
  greeting: { flex: 1 },
  title: { color: colors.text, fontSize: 19, fontWeight: typography.weights.bold },
  subtitle: { color: colors.textMuted, fontSize: 12, marginTop: 3 },
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
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingBottom: 100,
  },
  reportBanner: {
    marginBottom: spacing.xl,
    padding: spacing.md,
  },
  reportBannerSubmitted: {
    borderColor: colors.successBorder,
    backgroundColor: colors.successLight,
  },
  reportBannerPending: {
    borderColor: colors.warningBorder,
    backgroundColor: colors.warningLight,
  },
  bannerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  bannerIconBox: {
    marginRight: spacing.md,
  },
  bannerTextContainer: {
    flex: 1,
    paddingRight: spacing.sm,
  },
  bannerTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: typography.weights.bold,
  },
  bannerSubtitle: {
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: typography.weights.bold,
    marginBottom: spacing.md,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.xl,
    marginBottom: spacing.md,
  },
  viewAllText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: typography.weights.semibold,
  },
  statsGrid: {
    marginBottom: spacing.md,
  },
  statsRow: {
    flexDirection: 'row',
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
  taskKeyRow: {
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
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.cardBorder,
  },
  ticketCard: {
    marginBottom: 12,
    padding: 13,
    borderRadius: 10,
  },
  statusButtonsContainer: {
    paddingVertical: spacing.sm,
  },
  statusOptionBtn: {
    marginBottom: spacing.md,
  },
});

