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
  Alert,
} from 'react-native';
import { taskApi, teamApi, projectApi } from '../../api/endpoints';
import { useToast } from '../../context/ToastContext';
import { Task, TeamMember, Project, Priority, TaskStatus } from '../../types';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { Modal } from '../../components/Modal';
import { SelectPicker } from '../../components/SelectPicker';
import { StatusBadge } from '../../components/StatusBadge';
import { PriorityBadge } from '../../components/PriorityBadge';
import { Header } from '../../components/Header';
import { EmptyState } from '../../components/EmptyState';
import { colors, borderRadius, spacing, typography } from '../../theme';
import {
  Search,
  Plus,
  Filter,
  User,
  Folder,
  Calendar,
  Trash2,
  FileText,
} from '../../components/Icon';
import { AttachmentPicker, AttachmentList } from '../../components/AttachmentPicker';
import { AttachedFile, serializeAttachments, extractAttachments } from '../../utils/fileUpload';

const PRIORITY_OPTIONS = [
  { label: 'Low', value: 'low' as Priority },
  { label: 'Medium', value: 'medium' as Priority },
  { label: 'High', value: 'high' as Priority },
  { label: 'Urgent', value: 'urgent' as Priority },
];

export function AllTasksScreen({ route }: any) {
  const { success: toastSuccess, error: toastError } = useToast();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [employees, setEmployees] = useState<TeamMember[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [employeeFilter, setEmployeeFilter] = useState<number | null>(null);
  const [projectFilter, setProjectFilter] = useState<number | null>(null);

  // Assign Task Modal
  const [assignModal, setAssignModal] = useState(Boolean(route?.params?.openAssign));
  const [assignEmployeeId, setAssignEmployeeId] = useState<number | null>(null);
  const [assignProjectId, setAssignProjectId] = useState<number | null>(null);
  const [assignTitle, setAssignTitle] = useState('');
  const [assignDescription, setAssignDescription] = useState('');
  const [assignNotes, setAssignNotes] = useState('');
  const [assignPriority, setAssignPriority] = useState<Priority>('medium');
  const [assignDeadline, setAssignDeadline] = useState('');
  const [assignAttachments, setAssignAttachments] = useState<AttachedFile[]>([]);
  const [submittingAssign, setSubmittingAssign] = useState(false);

  // Task Details / Edit Modal
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [detailModal, setDetailModal] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [tasksRes, teamRes, projRes] = await Promise.all([
        taskApi.list({
          search: search.trim() || undefined,
          status: statusFilter || undefined,
          employeeId: employeeFilter || undefined,
          projectId: projectFilter || undefined,
        }),
        teamApi.list(),
        projectApi.list(),
      ]);
      setTasks(tasksRes.data || []);
      setEmployees(teamRes.data || []);
      setProjects(projRes.data || []);
    } catch {
      toastError('Failed to load tasks');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [search, statusFilter, employeeFilter, projectFilter, toastError]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleAssignTask = async () => {
    if (!assignEmployeeId || !assignProjectId || !assignTitle.trim()) {
      toastError('Please select an assignee, project, and enter a title');
      return;
    }

    setSubmittingAssign(true);
    try {
      const res = await taskApi.assign({
        employeeId: assignEmployeeId,
        projectId: assignProjectId,
        title: assignTitle.trim(),
        description: serializeAttachments(assignDescription.trim(), assignAttachments),
        notes: assignNotes.trim() || undefined,
        priority: assignPriority,
        deadline: assignDeadline.trim() || null,
      });
      toastSuccess(res.data?.message || 'Task assigned successfully');
      setAssignModal(false);
      setAssignTitle('');
      setAssignDescription('');
      setAssignNotes('');
      setAssignDeadline('');
      setAssignAttachments([]);
      loadData();
    } catch (err: any) {
      toastError(err.message || 'Failed to assign task');
    } finally {
      setSubmittingAssign(false);
    }
  };

  const handleUpdateStatus = async (status: TaskStatus) => {
    if (!selectedTask) return;
    setUpdatingStatus(true);
    try {
      await taskApi.updateStatus(selectedTask.id, status);
      toastSuccess(`Task moved to ${status}`);
      setDetailModal(false);
      loadData();
    } catch (err: any) {
      toastError(err.message || 'Failed to update status');
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleDeleteTask = (task: Task) => {
    Alert.alert('Delete Task', `Are you sure you want to delete "${task.title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await taskApi.remove(task.id);
            toastSuccess('Task deleted');
            setDetailModal(false);
            loadData();
          } catch (err: any) {
            toastError(err.message || 'Failed to delete task');
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <Header
        title="All Tasks"
        subtitle={`${tasks.length} total tasks`}
        rightAction={
          <Button
            title="Assign Task"
            size="sm"
            icon={<Plus size={16} color={colors.white} />}
            onPress={() => setAssignModal(true)}
          />
        }
      />

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Search size={16} color={colors.textMuted} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by title, key, or notes..."
          placeholderTextColor={colors.placeholder}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {/* Filter Row */}
      <View style={styles.filterBar}>
        <SelectPicker
          placeholder="All Assignees"
          options={[
            { label: 'All Assignees', value: 0 },
            ...employees.map((e) => ({ label: e.name, value: e.id })),
          ]}
          value={employeeFilter || 0}
          onChange={(val) => setEmployeeFilter(val === 0 ? null : (val as number))}
          searchable
        />
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
              loadData();
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
                  <Text style={styles.assigneeText}>👤 {item.employee_name}</Text>
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
                <View style={styles.footerLeft}>
                  <StatusBadge status={item.effective_status} />
                  <Text style={styles.projectName}>{item.project_name || 'General'}</Text>
                </View>
                {item.deadline && (
                  <Text style={styles.deadlineText}>
                    {new Date(item.deadline).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                  </Text>
                )}
              </View>
            </Card>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <EmptyState
            title="No tasks match the filter"
            message="Try clearing your search query or assigning a new task."
            action={
              <Button
                title="Assign New Task"
                size="sm"
                icon={<Plus size={16} color={colors.white} />}
                onPress={() => setAssignModal(true)}
              />
            }
          />
        }
      />

      {/* Assign Task Modal */}
      <Modal
        visible={assignModal}
        onClose={() => setAssignModal(false)}
        title="Assign New Task"
        subtitle="Delegate work to a team member"
        footer={<Button title="Create & Assign Task" onPress={handleAssignTask} loading={submittingAssign} />}
      >
        <SelectPicker
          label="Assign To"
          placeholder="Select Employee"
          options={employees.map((e) => ({
            label: `${e.name} (${e.department || 'Team'})`,
            value: e.id,
          }))}
          value={assignEmployeeId}
          onChange={(val) => setAssignEmployeeId(val as number)}
          searchable
        />

        <SelectPicker
          label="Project"
          placeholder="Select Project"
          options={projects.map((p) => ({
            label: `${p.project_key} - ${p.name}`,
            value: p.id,
          }))}
          value={assignProjectId}
          onChange={(val) => setAssignProjectId(val as number)}
          searchable
        />

        <SelectPicker
          label="Priority"
          options={PRIORITY_OPTIONS}
          value={assignPriority}
          onChange={(val) => setAssignPriority(val as Priority)}
        />

        <Input
          label="Task Title"
          placeholder="e.g. Implement authentication screens"
          value={assignTitle}
          onChangeText={setAssignTitle}
        />

        <Input
          label="Task Description"
          placeholder="Detailed task description..."
          value={assignDescription}
          onChangeText={setAssignDescription}
          multiline
          numberOfLines={3}
          style={{ minHeight: 70, textAlignVertical: 'top' }}
        />

        <AttachmentPicker
          attachments={assignAttachments}
          onChange={setAssignAttachments}
        />

        <Input
          label="Deadline (YYYY-MM-DD)"
          placeholder="e.g. 2026-10-15"
          value={assignDeadline}
          onChangeText={setAssignDeadline}
        />

        <Input
          label="Manager Notes (Optional)"
          placeholder="Special notes or links for the assignee..."
          value={assignNotes}
          onChangeText={setAssignNotes}
        />

      </Modal>

      {/* Task Details & Management Modal */}
      <Modal
        visible={detailModal}
        onClose={() => setDetailModal(false)}
        title={selectedTask?.task_key ? `${selectedTask.task_key}: ${selectedTask.title}` : selectedTask?.title || 'Task Details'}
      >
        {selectedTask && (
          <View style={styles.modalBody}>
            <View style={styles.modalMetaRow}>
              <StatusBadge status={selectedTask.effective_status} />
              <View style={{ width: spacing.sm }} />
              <PriorityBadge priority={selectedTask.priority} />
            </View>

            <View style={styles.infoBox}>
              <View style={styles.infoRow}>
                <User size={16} color={colors.info} style={{ marginRight: 8 }} />
                <Text style={styles.infoLabel}>Assignee:</Text>
                <Text style={styles.infoValue}>{selectedTask.employee_name}</Text>
              </View>
              <View style={styles.infoRow}>
                <Folder size={16} color={colors.primary} style={{ marginRight: 8 }} />
                <Text style={styles.infoLabel}>Project:</Text>
                <Text style={styles.infoValue}>{selectedTask.project_name || 'General'}</Text>
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

            {(() => {
              const { cleanDescription, attachments } = extractAttachments(selectedTask.description);
              return (
                <>
                  <Text style={styles.modalSectionLabel}>Description</Text>
                  <Text style={styles.modalDescription}>
                    {cleanDescription || 'No description provided.'}
                  </Text>
                  <AttachmentList attachments={attachments} />
                </>
              );
            })()}

            {selectedTask.notes && (
              <>
                <Text style={styles.modalSectionLabel}>Notes</Text>
                <Text style={styles.modalNotes}>{selectedTask.notes}</Text>
              </>
            )}

            <Text style={styles.modalSectionLabel}>Update Status</Text>
            <View style={styles.statusActionRow}>
              <Button
                title="Pending"
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

            <Button
              title="Delete Task"
              variant="danger"
              size="sm"
              icon={<Trash2 size={16} color={colors.white} />}
              onPress={() => handleDeleteTask(selectedTask)}
              style={{ marginTop: spacing.xl }}
            />
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
  filterBar: {
    paddingHorizontal: spacing.lg,
    marginTop: spacing.sm,
    marginBottom: -8,
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
    paddingTop: spacing.md,
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
    marginRight: 8,
  },
  assigneeText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: typography.weights.medium,
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
  footerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  projectName: {
    color: colors.textMuted,
    fontSize: 12,
    marginLeft: spacing.sm,
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
    width: 80,
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

