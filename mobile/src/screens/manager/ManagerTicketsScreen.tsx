import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  TextInput,
  Alert,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ticketApi, teamApi } from '../../api/endpoints';
import { useToast } from '../../context/ToastContext';
import { Ticket, TicketStatus, TicketSeverity, TeamMember } from '../../types';
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
  Trash2,
} from '../../components/Icon';

const STATUS_OPTIONS = [
  { label: 'All', value: '' },
  { label: 'Open', value: 'open' },
  { label: 'In Progress', value: 'in_progress' },
  { label: 'Resolved', value: 'resolved' },
  { label: 'Closed', value: 'closed' },
];

export function ManagerTicketsScreen() {
  const { success: toastSuccess, error: toastError } = useToast();

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Selected Ticket Detail & Action Modal
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [detailModal, setDetailModal] = useState(false);
  const [selectedAssigneeId, setSelectedAssigneeId] = useState<number | null>(null);
  const [resolutionNote, setResolutionNote] = useState('');
  const [updating, setUpdating] = useState(false);
  const [assigning, setAssigning] = useState(false);

  useEffect(() => {
    teamApi.list()
      .then((res) => setMembers(res.data || []))
      .catch(() => setMembers([]));
  }, []);

  const loadTickets = useCallback(async () => {
    try {
      const res = await ticketApi.list({
        search: search.trim() || undefined,
        status: statusFilter || undefined,
      });
      setTickets(res.data || []);
    } catch {
      toastError('Failed to load tickets');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [search, statusFilter, toastError]);

  useEffect(() => {
    loadTickets();
  }, [loadTickets]);

  const departmentMembers = useMemo(() => {
    if (!selectedTicket) return members;
    let repDept = selectedTicket.reporter_department?.trim().toLowerCase();
    if (!repDept) {
      const reporterMember = members.find((m) => m.id === selectedTicket.reporter_id);
      repDept = reporterMember?.department?.trim().toLowerCase();
    }
    if (!repDept) return members;

    const filtered = members.filter(
      (m) => m.department && m.department.trim().toLowerCase() === repDept
    );

    // If current assignee is already set and not in filtered, keep them available
    if (selectedTicket.assignee_id && !filtered.some((m) => m.id === selectedTicket.assignee_id)) {
      const currentAssignee = members.find((m) => m.id === selectedTicket.assignee_id);
      if (currentAssignee) {
        filtered.push(currentAssignee);
      }
    }

    return filtered;
  }, [selectedTicket, members]);

  const handleAssign = async (assigneeId: number | null) => {
    if (!selectedTicket) return;
    setAssigning(true);
    try {
      const res = await ticketApi.assign(selectedTicket.id, assigneeId);
      const updated = res.data;
      setSelectedTicket(updated);
      setSelectedAssigneeId(updated.assignee_id || null);
      const assignedUser = members.find((m) => m.id === assigneeId);
      toastSuccess(assigneeId ? `Assigned to ${assignedUser?.name || 'team member'}` : 'Ticket unassigned');
      loadTickets();
    } catch (err: any) {
      toastError(err.message || 'Failed to assign ticket');
    } finally {
      setAssigning(false);
    }
  };

  const handleUpdateTicketStatus = async (status: TicketStatus) => {
    if (!selectedTicket) return;
    setUpdating(true);
    try {
      await ticketApi.updateStatus(selectedTicket.id, status, resolutionNote.trim() || undefined);
      toastSuccess(`Ticket updated to ${status}`);
      setDetailModal(false);
      loadTickets();
    } catch (err: any) {
      toastError(err.message || 'Failed to update ticket');
    } finally {
      setUpdating(false);
    }
  };

  const handleDeleteTicket = (ticket: Ticket) => {
    Alert.alert('Delete Ticket', `Are you sure you want to remove ticket "${ticket.ticket_key}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await ticketApi.remove(ticket.id);
            toastSuccess('Ticket removed');
            setDetailModal(false);
            loadTickets();
          } catch (err: any) {
            toastError(err.message || 'Failed to delete ticket');
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <Header
        title="Tickets"
        subtitle={`Track & assign department issues (${tickets.length})`}
      />

      <View style={styles.searchContainer}>
        <Search size={16} color={colors.textMuted} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by ticket key, title, reporter, or assignee..."
          placeholderTextColor={colors.placeholder}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      <View style={styles.filterWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
        >
          {STATUS_OPTIONS.map((opt) => (
            <TouchableOpacity
              key={opt.label}
              style={[styles.filterPill, statusFilter === opt.value && styles.filterPillActive]}
              onPress={() => setStatusFilter(opt.value)}
            >
              <Text
                style={[
                  styles.filterPillText,
                  statusFilter === opt.value && styles.filterPillTextActive,
                ]}
              >
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
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
              setSelectedAssigneeId(item.assignee_id || null);
              setResolutionNote(item.resolution_note || '');
              setDetailModal(true);
            }}
          >
            <Card style={styles.ticketCard}>
              <View style={styles.cardHeader}>
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

              <View style={styles.cardFooter}>
                <Text style={styles.projectName}>{item.project_name}</Text>
                <StatusBadge status={item.status} />
              </View>
            </Card>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <EmptyState
            title="No tickets found"
            message="No tickets matching the selected status or query."
          />
        }
      />

      {/* Ticket Management Modal */}
      <Modal
        visible={detailModal}
        onClose={() => setDetailModal(false)}
        title={selectedTicket?.ticket_key || 'Ticket Management'}
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
                <Text style={{ fontWeight: 'bold' }}>Reported by:</Text> {selectedTicket.reporter_name} (
                {selectedTicket.reporter_department || 'General'})
              </Text>
              {selectedTicket.task_title && (
                <Text style={[styles.infoText, { marginTop: 4 }]}>
                  <Text style={{ fontWeight: 'bold' }}>Linked Task:</Text> {selectedTicket.task_title}
                </Text>
              )}
            </View>

            <Text style={styles.modalSectionLabel}>Description</Text>
            <Text style={styles.modalDescText}>{selectedTicket.description}</Text>

            <Text style={styles.modalSectionLabel}>
              Assign Department Member{selectedTicket.reporter_department ? ` (${selectedTicket.reporter_department})` : ''}
            </Text>
            <SelectPicker
              searchable
              placeholder={departmentMembers.length === 0 ? `No members in ${selectedTicket.reporter_department || 'department'}` : 'Assign team member...'}
              options={[
                { label: 'Unassigned', value: 0 },
                ...departmentMembers.map((m) => ({ label: `${m.name} (${m.job_title || m.role})`, value: m.id })),
              ]}
              value={selectedAssigneeId ?? 0}
              onChange={(val) => {
                const nextId = Number(val) === 0 ? null : Number(val);
                setSelectedAssigneeId(nextId);
                handleAssign(nextId);
              }}
            />

            <Text style={styles.modalSectionLabel}>Resolution Note</Text>
            <Input
              placeholder="Add details about how this issue was resolved..."
              value={resolutionNote}
              onChangeText={setResolutionNote}
              multiline
              numberOfLines={3}
              style={{ minHeight: 70, textAlignVertical: 'top' }}
            />

            <Text style={styles.modalSectionLabel}>Set Status</Text>
            <View style={styles.actionRow}>
              <Button
                title="In Progress"
                size="sm"
                variant={selectedTicket.status === 'in_progress' ? 'primary' : 'secondary'}
                onPress={() => handleUpdateTicketStatus('in_progress')}
                loading={updating}
                style={styles.actionBtn}
              />
              <Button
                title="Resolve"
                size="sm"
                variant={selectedTicket.status === 'resolved' ? 'primary' : 'outline'}
                onPress={() => handleUpdateTicketStatus('resolved')}
                loading={updating}
                style={styles.actionBtn}
              />
              <Button
                title="Close"
                size="sm"
                variant={selectedTicket.status === 'closed' ? 'primary' : 'outline'}
                onPress={() => handleUpdateTicketStatus('closed')}
                loading={updating}
                style={styles.actionBtn}
              />
            </View>

            <Button
              title="Delete Ticket"
              variant="danger"
              size="sm"
              icon={<Trash2 size={16} color={colors.white} />}
              onPress={() => handleDeleteTicket(selectedTicket)}
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
  filterWrapper: {
    marginBottom: 12,
  },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    paddingVertical: 2,
    gap: 8,
  },
  filterPill: {
    paddingVertical: 5.5,
    paddingHorizontal: 13,
    borderRadius: borderRadius.full,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
  },
  filterPillActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterPillText: {
    color: colors.textSecondary,
    fontSize: 12.5,
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
  ticketCard: {
    marginBottom: 12,
    padding: 13,
    borderRadius: 10,
  },
  cardHeader: {
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
    color: colors.textMuted,
  },
  assigneeHighlight: {
    fontWeight: typography.weights.bold,
    color: colors.primary,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.cardBorder,
  },
  projectName: {
    color: colors.textMuted,
    fontSize: 11.5,
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
    padding: spacing.md,
    borderRadius: borderRadius.md,
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
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  modalDescText: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 22,
    backgroundColor: colors.cardHover,
    padding: spacing.md,
    borderRadius: borderRadius.md,
  },
  actionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  actionBtn: {
    flex: 1,
  },
});
