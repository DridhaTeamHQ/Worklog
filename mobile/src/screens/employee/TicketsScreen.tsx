import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ticketApi, projectApi, taskApi } from '../../api/endpoints';
import { ApiError } from '../../api/client';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { Ticket, TicketSeverity, TicketStatus, Project, Task } from '../../types';
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
  CheckCircle2,
} from '../../components/Icon';

const SEVERITY_OPTIONS = [
  { label: 'Low', value: 'low' as TicketSeverity },
  { label: 'Medium', value: 'medium' as TicketSeverity },
  { label: 'High', value: 'high' as TicketSeverity },
  { label: 'Critical', value: 'critical' as TicketSeverity },
];

type ScopeFilter = 'all' | 'assigned_to_me' | 'raised_by_me';

const SCOPE_TABS: { label: string; value: ScopeFilter }[] = [
  { label: 'All Dept', value: 'all' },
  { label: 'Assigned to Me', value: 'assigned_to_me' },
  { label: 'Raised by Me', value: 'raised_by_me' },
];

export function TicketsScreen() {
  const { user } = useAuth();
  const { success: toastSuccess, error: toastError } = useToast();

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [scopeFilter, setScopeFilter] = useState<ScopeFilter>('all');

  // Raise Ticket Modal
  const [raiseModal, setRaiseModal] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [severity, setSeverity] = useState<TicketSeverity>('medium');
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Ticket Detail Modal
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [detailModal, setDetailModal] = useState(false);
  const [resolutionNote, setResolutionNote] = useState('');
  const [updating, setUpdating] = useState(false);

  const loadTickets = useCallback(async () => {
    try {
      const res = await ticketApi.list({
        search: search.trim() || undefined,
        reporterId: scopeFilter === 'raised_by_me' ? user?.id : undefined,
        assigneeId: scopeFilter === 'assigned_to_me' ? user?.id : undefined,
      });
      setTickets(res.data || []);
    } catch {
      toastError('Failed to load tickets');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [search, scopeFilter, user?.id, toastError]);

  useEffect(() => {
    loadTickets();
  }, [loadTickets]);

  const openRaiseModal = async () => {
    setTitle('');
    setDescription('');
    setSelectedProjectId(null);
    setSelectedTaskId(null);
    setSeverity('medium');
    setFieldErrors({});
    setRaiseModal(true);

    try {
      const [projRes, taskRes] = await Promise.all([
        projectApi.list(),
        taskApi.list(),
      ]);
      setProjects(projRes.data || []);
      setTasks(taskRes.data || []);
    } catch {
      // ignore
    }
  };

  const handleRaiseTicket = async () => {
    if (!selectedProjectId) {
      setFieldErrors({ projectId: 'Please select the project for this issue.' });
      toastError('Please select a project');
      return;
    }
    if (!selectedTaskId) {
      setFieldErrors({ taskId: 'Please select the task related to this issue.' });
      toastError('Please select the task related to this issue');
      return;
    }
    if (!title.trim() || !description.trim()) {
      setFieldErrors({
        ...(title.trim() ? {} : { title: 'Please enter an issue title.' }),
        ...(description.trim() ? {} : { description: 'Please describe the issue.' }),
      });
      toastError('Title and description are required');
      return;
    }

    setSubmitting(true);
    setFieldErrors({});
    try {
      const res = await ticketApi.create({
        projectId: selectedProjectId,
        taskId: selectedTaskId,
        title: title.trim(),
        description: description.trim(),
        severity,
      });
      toastSuccess(res.data?.message || 'Ticket submitted successfully');
      setRaiseModal(false);
      loadTickets();
    } catch (err: any) {
      if (err instanceof ApiError) {
        setFieldErrors(err.fieldErrors);
        toastError(Object.values(err.fieldErrors)[0] || err.message);
      } else toastError(err.message || 'Failed to raise ticket');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateStatus = async (status: TicketStatus) => {
    if (!selectedTicket) return;
    setUpdating(true);
    try {
      await ticketApi.updateStatus(selectedTicket.id, status, resolutionNote.trim() || undefined);
      toastSuccess(`Ticket marked as ${status.replace('_', ' ')}`);
      setDetailModal(false);
      loadTickets();
    } catch (err: any) {
      toastError(err.message || 'Failed to update ticket status');
    } finally {
      setUpdating(false);
    }
  };

  const canUpdate = selectedTicket && (
    selectedTicket.assignee_id === user?.id ||
    selectedTicket.reporter_id === user?.id ||
    user?.role === 'manager' ||
    user?.role === 'admin'
  );

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <Header
        title="Tickets"
        subtitle={`Department issues (${tickets.length})`}
        rightAction={
          <Button
            title="New Ticket"
            size="sm"
            icon={<Plus size={16} color={colors.white} />}
            onPress={openRaiseModal}
          />
        }
      />

      <View style={styles.searchContainer}>
        <Search size={16} color={colors.textMuted} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search tickets by key, title, or reporter..."
          placeholderTextColor={colors.placeholder}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {/* Scope Filter Tabs */}
      <View style={styles.scopeTabsRow}>
        {SCOPE_TABS.map((tab) => (
          <TouchableOpacity
            key={tab.value}
            style={[styles.scopeTab, scopeFilter === tab.value && styles.scopeTabActive]}
            onPress={() => setScopeFilter(tab.value)}
          >
            <Text
              style={[
                styles.scopeTabText,
                scopeFilter === tab.value && styles.scopeTabTextActive,
              ]}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={tickets}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadTickets();
            }}
            tintColor={colors.primary}
          />
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => {
              setSelectedTicket(item);
              setResolutionNote(item.resolution_note || '');
              setDetailModal(true);
            }}
          >
            <Card style={styles.ticketCard}>
              <View style={styles.ticketHeader}>
                <View style={styles.keyRow}>
                  <Text style={styles.ticketKey}>{item.ticket_key}</Text>
                  <Text style={styles.reporterName}>👤 {item.reporter_name}</Text>
                </View>
                <PriorityBadge priority={item.severity} />
              </View>

              <Text style={styles.ticketTitle}>{item.title}</Text>
              <Text style={styles.ticketDesc} numberOfLines={2}>
                {item.description}
              </Text>

              <View style={styles.assigneeRow}>
                <Text style={styles.assigneeText}>
                  📌 Assigned to: <Text style={styles.assigneeHighlight}>{item.assignee_name || 'Unassigned'}</Text>
                </Text>
              </View>

              <View style={styles.ticketFooter}>
                <Text style={styles.projectName}>{item.project_name}</Text>
                <StatusBadge status={item.status} />
              </View>
            </Card>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <EmptyState
            title="No tickets found"
            message={
              scopeFilter === 'assigned_to_me'
                ? "No tickets currently assigned to you."
                : scopeFilter === 'raised_by_me'
                ? "You haven't raised any tickets yet."
                : "No tickets reported in your department."
            }
            action={
              <Button
                title="Raise New Ticket"
                size="sm"
                icon={<Plus size={16} color={colors.white} />}
                onPress={openRaiseModal}
              />
            }
          />
        }
      />

      {/* Raise Ticket Modal */}
      <Modal
        visible={raiseModal}
        onClose={() => setRaiseModal(false)}
        title="Raise a Ticket"
        subtitle="Submit a blocker or issue to your department"
      >
        <SelectPicker
          label="Project"
          placeholder="Select Project"
          options={projects.map((p) => ({
            label: `${p.project_key} - ${p.name}`,
            value: p.id,
          }))}
          value={selectedProjectId}
          error={fieldErrors.projectId}
          onChange={(val) => {
            setSelectedProjectId(val as number);
            setSelectedTaskId(null);
            setFieldErrors((prev) => ({ ...prev, projectId: '', taskId: '' }));
          }}
          searchable
        />

        {selectedProjectId ? (
          <SelectPicker
            label="Associated Task"
            placeholder="Select the task related to this issue"
            options={[
              ...tasks
                .filter((t) => t.project_id === selectedProjectId)
                .map((t) => ({
                  label: t.task_key ? `${t.task_key}: ${t.title}` : t.title,
                  value: t.id,
                })),
            ]}
            value={selectedTaskId}
            error={fieldErrors.taskId}
            onChange={(val) => { setSelectedTaskId(val as number); setFieldErrors((prev) => ({ ...prev, taskId: '' })); }}
            searchable
          />
        ) : null}

        <SelectPicker
          label="Severity Level"
          options={SEVERITY_OPTIONS}
          value={severity}
          onChange={(val) => setSeverity(val as TicketSeverity)}
        />

        <Input
          label="Issue Title"
          placeholder="Brief summary of the issue"
          value={title}
          onChangeText={setTitle}
          error={fieldErrors.title}
        />

        <Input
          label="Detailed Description"
          placeholder="Explain what is blocking progress or the unexpected behavior..."
          value={description}
          onChangeText={setDescription}
          error={fieldErrors.description}
          multiline
          numberOfLines={4}
          style={{ minHeight: 90, textAlignVertical: 'top' }}
        />

        <Button
          title="Submit Ticket"
          onPress={handleRaiseTicket}
          loading={submitting}
          style={{ marginTop: spacing.md }}
        />
      </Modal>

      {/* Ticket Details Modal */}
      <Modal
        visible={detailModal}
        onClose={() => setDetailModal(false)}
        title={selectedTicket?.ticket_key || 'Ticket Details'}
        subtitle={selectedTicket?.project_name}
      >
        {selectedTicket && (
          <View style={styles.modalBody}>
            <View style={styles.modalMetaRow}>
              <StatusBadge status={selectedTicket.status} />
              <View style={{ width: spacing.sm }} />
              <PriorityBadge priority={selectedTicket.severity} />
            </View>

            <Text style={styles.modalTitleText}>{selectedTicket.title}</Text>

            <View style={styles.infoBox}>
              <Text style={styles.infoText}>
                <Text style={{ fontWeight: 'bold' }}>Reported by: </Text>
                {selectedTicket.reporter_name} ({selectedTicket.reporter_department || 'General'})
              </Text>
              <Text style={[styles.infoText, { marginTop: 4 }]}>
                <Text style={{ fontWeight: 'bold' }}>Assigned to: </Text>
                {selectedTicket.assignee_name ? (
                  <Text style={{ color: colors.primary, fontWeight: 'bold' }}>{selectedTicket.assignee_name}</Text>
                ) : (
                  <Text style={{ fontStyle: 'italic', color: colors.textMuted }}>Unassigned</Text>
                )}
              </Text>
              {selectedTicket.task_title && (
                <Text style={[styles.infoText, { marginTop: 4 }]}>
                  <Text style={{ fontWeight: 'bold' }}>Linked Task: </Text>
                  {selectedTicket.task_key ? `[${selectedTicket.task_key}] ` : ''}
                  {selectedTicket.task_title}
                </Text>
              )}
            </View>

            <Text style={styles.modalSectionLabel}>Description</Text>
            <Text style={styles.modalDescText}>{selectedTicket.description}</Text>

            {selectedTicket.resolution_note && (
              <View style={styles.resolutionBox}>
                <View style={styles.resolutionHeader}>
                  <CheckCircle2 size={16} color={colors.success} style={{ marginRight: 6 }} />
                  <Text style={styles.resolutionTitle}>Resolution Note</Text>
                </View>
                <Text style={styles.resolutionText}>
                  {selectedTicket.resolution_note}
                </Text>
                {selectedTicket.resolved_at && (
                  <Text style={styles.resolvedDateText}>
                    Resolved on {new Date(selectedTicket.resolved_at).toLocaleDateString()}
                  </Text>
                )}
              </View>
            )}

            {/* If user can update status (assignee, reporter, or manager) */}
            {canUpdate && selectedTicket.status !== 'closed' && (
              <View style={styles.updateStatusSection}>
                <Text style={styles.modalSectionLabel}>Update Status</Text>
                <Input
                  placeholder="Resolution or status note (optional)..."
                  value={resolutionNote}
                  onChangeText={setResolutionNote}
                  multiline
                  numberOfLines={2}
                  style={{ minHeight: 60, textAlignVertical: 'top', marginBottom: spacing.sm }}
                />
                <View style={styles.actionRow}>
                  {selectedTicket.status !== 'in_progress' && (
                    <Button
                      title="In Progress"
                      size="sm"
                      variant="secondary"
                      onPress={() => handleUpdateStatus('in_progress')}
                      loading={updating}
                      style={styles.actionBtn}
                    />
                  )}
                  {selectedTicket.status !== 'resolved' && (
                    <Button
                      title="Resolve"
                      size="sm"
                      variant="primary"
                      onPress={() => handleUpdateStatus('resolved')}
                      loading={updating}
                      style={styles.actionBtn}
                    />
                  )}
                  <Button
                    title="Close"
                    size="sm"
                    variant="outline"
                    onPress={() => handleUpdateStatus('closed')}
                    loading={updating}
                    style={styles.actionBtn}
                  />
                </View>
              </View>
            )}
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
    marginTop: spacing.xs,
    marginBottom: 12,
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
    fontSize: 13.5,
    paddingVertical: 7,
  },
  scopeTabsRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    marginBottom: 12,
    gap: 8,
  },
  scopeTab: {
    paddingVertical: 5.5,
    paddingHorizontal: 13,
    borderRadius: borderRadius.full,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  scopeTabActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  scopeTabText: {
    fontSize: 12.5,
    fontWeight: typography.weights.medium,
    color: colors.textSecondary,
  },
  scopeTabTextActive: {
    color: colors.white,
    fontWeight: typography.weights.bold,
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: 100,
  },
  ticketCard: {
    marginBottom: 12,
    padding: 13,
    borderRadius: 10,
  },
  ticketHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  keyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    flex: 1,
  },
  ticketKey: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: typography.weights.bold,
    marginRight: 8,
  },
  reporterName: {
    color: colors.textMuted,
    fontSize: 11.5,
  },
  projectName: {
    color: colors.textMuted,
    fontSize: 11.5,
  },
  ticketTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: typography.weights.bold,
    marginBottom: 5,
  },
  ticketDesc: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 7,
  },
  assigneeRow: {
    backgroundColor: colors.inputBg,
    borderRadius: borderRadius.sm,
    paddingVertical: 3,
    paddingHorizontal: 8,
    marginBottom: 7,
    alignSelf: 'flex-start',
  },
  assigneeText: {
    fontSize: 11,
    color: colors.textSecondary,
  },
  assigneeHighlight: {
    color: colors.primary,
    fontWeight: typography.weights.bold,
  },
  ticketFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.cardBorder,
  },
  dateText: {
    color: colors.textMuted,
    fontSize: 11,
  },
  modalBody: {
    paddingBottom: spacing.lg,
  },
  modalMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  modalTitleText: {
    color: colors.text,
    fontSize: 18,
    fontWeight: typography.weights.bold,
    marginBottom: spacing.md,
  },
  infoBox: {
    backgroundColor: colors.cardHover,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  infoText: {
    fontSize: 14.5,
    color: colors.text,
    lineHeight: 21,
  },
  modalSectionLabel: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: typography.weights.bold,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  modalDescText: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 22,
    backgroundColor: colors.cardHover,
    padding: spacing.md,
    borderRadius: borderRadius.md,
    marginBottom: spacing.md,
  },
  resolutionBox: {
    backgroundColor: colors.successLight,
    borderWidth: 1,
    borderColor: colors.successBorder,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  resolutionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  resolutionTitle: {
    color: colors.success,
    fontSize: 14.5,
    fontWeight: typography.weights.bold,
  },
  resolutionText: {
    color: colors.text,
    fontSize: 14.5,
    lineHeight: 21,
  },
  resolvedDateText: {
    color: colors.textMuted,
    fontSize: 12.5,
    marginTop: 6,
  },
  updateStatusSection: {
    marginTop: spacing.sm,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.cardBorder,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
  },
  actionBtn: {
    flex: 1,
  },
});
