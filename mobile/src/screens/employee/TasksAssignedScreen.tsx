import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  SafeAreaView,
  TextInput,
} from 'react-native';
import { taskApi } from '../../api/endpoints';
import { useToast } from '../../context/ToastContext';
import { Task, TaskStatus } from '../../types';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { StatusBadge } from '../../components/StatusBadge';
import { PriorityBadge } from '../../components/PriorityBadge';
import { Header } from '../../components/Header';
import { EmptyState } from '../../components/EmptyState';
import { Modal } from '../../components/Modal';
import { colors, borderRadius, spacing, typography } from '../../theme';
import {
  Search,
  Calendar,
  User,
  Folder,
  FileText,
  CheckCircle2,
  Play,
  Clock,
} from '../../components/Icon';

const STATUS_FILTERS = [
  { label: 'Active', value: '' },
  { label: 'Pending', value: 'pending' },
  { label: 'In Progress', value: 'in_progress' },
  { label: 'Overdue', value: 'overdue' },
];

export function TasksAssignedScreen() {
  const { success: toastSuccess, error: toastError } = useToast();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Selected Task Detail & Update Modal
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [detailModal, setDetailModal] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const loadTasks = useCallback(async () => {
    try {
      const res = await taskApi.list({
        search: search.trim() || undefined,
        status: statusFilter || undefined,
      });
      // Filter out completed by default unless explicitly searching
      const activeTasks = (res.data || []).filter((t) => t.status !== 'completed');
      setTasks(activeTasks);
    } catch {
      toastError('Failed to load assigned tasks');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [search, statusFilter, toastError]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  const handleUpdateStatus = async (status: TaskStatus) => {
    if (!selectedTask) return;
    setUpdatingStatus(true);
    try {
      await taskApi.updateStatus(selectedTask.id, status);
      toastSuccess(`Task marked as ${status.replace('_', ' ')}`);
      setDetailModal(false);
      loadTasks();
    } catch (err: any) {
      toastError(err.message || 'Failed to update task');
    } finally {
      setUpdatingStatus(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Header
        title="My Assigned Tasks"
        subtitle={`${tasks.length} active tasks`}
      />

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Search size={16} color={colors.textMuted} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search tasks or project keys..."
          placeholderTextColor={colors.placeholder}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {/* Status Filter Tabs */}
      <View style={styles.filterRow}>
        {STATUS_FILTERS.map((f) => (
          <TouchableOpacity
            key={f.label}
            style={[styles.filterPill, statusFilter === f.value && styles.filterPillActive]}
            onPress={() => setStatusFilter(f.value)}
          >
            <Text
              style={[styles.filterPillText, statusFilter === f.value && styles.filterPillTextActive]}
            >
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Task List */}
      <FlatList
        data={tasks}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadTasks();
            }}
            tintColor={colors.primary}
          />
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => {
              setSelectedTask(item);
              setDetailModal(true);
            }}
          >
            <Card style={styles.taskCard}>
              <View style={styles.taskHeader}>
                <View style={styles.keyRow}>
                  {item.task_key && <Text style={styles.taskKey}>{item.task_key}</Text>}
                  <Text style={styles.projectName}>{item.project_name || 'General'}</Text>
                </View>
                <PriorityBadge priority={item.priority} />
              </View>

              <Text style={styles.taskTitle}>{item.title}</Text>
              {item.description ? (
                <Text style={styles.taskDesc} numberOfLines={2}>
                  {item.description}
                </Text>
              ) : null}

              <View style={styles.taskFooter}>
                <View style={styles.metaRow}>
                  <StatusBadge status={item.effective_status} />
                  {item.deadline && (
                    <View style={styles.deadlineBadge}>
                      <Calendar size={12} color={colors.textMuted} style={{ marginRight: 4 }} />
                      <Text style={styles.deadlineText}>
                        {new Date(item.deadline).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </Text>
                    </View>
                  )}
                </View>
                <Button
                  title="View / Update"
                  size="sm"
                  variant="outline"
                  onPress={() => {
                    setSelectedTask(item);
                    setDetailModal(true);
                  }}
                />
              </View>
            </Card>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <EmptyState
            title="No assigned tasks found"
            message="You don't have any active tasks matching your filter."
          />
        }
      />

      {/* Task Detail & Action Modal */}
      <Modal
        visible={detailModal}
        onClose={() => setDetailModal(false)}
        title={selectedTask?.task_key ? `${selectedTask.task_key}: ${selectedTask.title}` : selectedTask?.title || 'Task Details'}
      >
        {selectedTask && (
          <View style={styles.modalBody}>
            {/* Meta Tags */}
            <View style={styles.modalMetaRow}>
              <StatusBadge status={selectedTask.effective_status} />
              <View style={{ width: spacing.sm }} />
              <PriorityBadge priority={selectedTask.priority} />
            </View>

            {/* Project & Assignee */}
            <View style={styles.infoBox}>
              <View style={styles.infoRow}>
                <Folder size={16} color={colors.primary} style={{ marginRight: 8 }} />
                <Text style={styles.infoLabel}>Project:</Text>
                <Text style={styles.infoValue}>{selectedTask.project_name || 'None'}</Text>
              </View>
              <View style={styles.infoRow}>
                <User size={16} color={colors.info} style={{ marginRight: 8 }} />
                <Text style={styles.infoLabel}>Assigned By:</Text>
                <Text style={styles.infoValue}>{selectedTask.manager_name || 'Manager'}</Text>
              </View>
              {selectedTask.deadline && (
                <View style={styles.infoRow}>
                  <Calendar size={16} color={colors.warning} style={{ marginRight: 8 }} />
                  <Text style={styles.infoLabel}>Deadline:</Text>
                  <Text style={styles.infoValue}>
                    {new Date(selectedTask.deadline).toLocaleDateString()}
                  </Text>
                </View>
              )}
            </View>

            {/* Description */}
            <Text style={styles.modalSectionLabel}>Description</Text>
            <Text style={styles.modalDescription}>
              {selectedTask.description || 'No description provided.'}
            </Text>

            {/* Notes if any */}
            {selectedTask.notes && (
              <>
                <Text style={styles.modalSectionLabel}>Manager Notes</Text>
                <Text style={styles.modalNotes}>{selectedTask.notes}</Text>
              </>
            )}

            {/* Status Change Buttons */}
            <Text style={styles.modalSectionLabel}>Change Status</Text>
            <View style={styles.statusActionRow}>
              <Button
                title="Mark Pending"
                size="sm"
                variant={selectedTask.status === 'pending' ? 'primary' : 'outline'}
                onPress={() => handleUpdateStatus('pending')}
                loading={updatingStatus}
                style={styles.actionBtn}
              />
              <Button
                title="In Progress"
                size="sm"
                variant={selectedTask.status === 'in_progress' ? 'primary' : 'secondary'}
                onPress={() => handleUpdateStatus('in_progress')}
                loading={updatingStatus}
                style={styles.actionBtn}
              />
              <Button
                title="Completed"
                size="sm"
                variant={selectedTask.status === 'completed' ? 'primary' : 'danger'}
                onPress={() => handleUpdateStatus('completed')}
                loading={updatingStatus}
                style={styles.actionBtn}
              />
            </View>
          </View>
        )}
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
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
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  filterPill: {
    paddingVertical: 6,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.full,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    marginRight: spacing.sm,
  },
  filterPillActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterPillText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: typography.weights.medium,
  },
  filterPillTextActive: {
    color: colors.white,
    fontWeight: typography.weights.bold,
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
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
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  deadlineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: spacing.md,
  },
  deadlineText: {
    color: colors.textMuted,
    fontSize: 12,
  },
  modalBody: {
    paddingBottom: spacing.lg,
  },
  modalMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  infoBox: {
    backgroundColor: colors.inputBg,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  infoLabel: {
    color: colors.textMuted,
    fontSize: 13,
    width: 90,
  },
  infoValue: {
    color: colors.text,
    fontSize: 13,
    fontWeight: typography.weights.medium,
    flex: 1,
  },
  modalSectionLabel: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: typography.weights.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: spacing.md,
    marginBottom: 6,
  },
  modalDescription: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 20,
    backgroundColor: colors.cardHover,
    padding: spacing.md,
    borderRadius: borderRadius.md,
  },
  modalNotes: {
    color: colors.warning,
    fontSize: 13,
    lineHeight: 18,
    backgroundColor: colors.warningLight,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.warningBorder,
  },
  statusActionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
  },
  actionBtn: {
    flex: 1,
    marginHorizontal: 4,
  },
});

