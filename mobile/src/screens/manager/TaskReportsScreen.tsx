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
import { reportApi, teamApi } from '../../api/endpoints';
import { useToast } from '../../context/ToastContext';
import { DailyReport, TeamMember } from '../../types';
import { Card } from '../../components/Card';
import { Header } from '../../components/Header';
import { EmptyState } from '../../components/EmptyState';
import { SelectPicker } from '../../components/SelectPicker';
import { colors, borderRadius, spacing, typography } from '../../theme';
import {
  Search,
  Calendar,
  User,
  Clock,
  FileText,
} from '../../components/Icon';

const RANGE_OPTIONS = [
  { label: 'Today', value: 'today' },
  { label: 'This Week', value: 'week' },
  { label: 'This Month', value: 'month' },
  { label: 'All Time', value: 'all' },
];

export function TaskReportsScreen() {
  const { error: toastError } = useToast();

  const [reports, setReports] = useState<DailyReport[]>([]);
  const [employees, setEmployees] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filters
  const [range, setRange] = useState<'today' | 'week' | 'month' | 'all'>('today');
  const [search, setSearch] = useState('');
  const [employeeId, setEmployeeId] = useState<number | null>(null);

  const loadReports = useCallback(async () => {
    try {
      const [reportsRes, teamRes] = await Promise.all([
        reportApi.list({
          range,
          search: search.trim() || undefined,
          employeeId: employeeId || undefined,
        }),
        teamApi.list(),
      ]);
      setReports(reportsRes.data || []);
      setEmployees(teamRes.data || []);
    } catch {
      toastError('Failed to load daily reports');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [range, search, employeeId, toastError]);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  return (
    <SafeAreaView style={styles.container}>
      <Header
        title="Team Daily Reports"
        subtitle={`${reports.length} reports filed`}
      />

      {/* Search Input */}
      <View style={styles.searchContainer}>
        <Search size={16} color={colors.textMuted} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search reports or author..."
          placeholderTextColor={colors.placeholder}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterRow}>
        {RANGE_OPTIONS.map((opt) => (
          <TouchableOpacity
            key={opt.value}
            style={[styles.rangePill, range === opt.value && styles.rangePillActive]}
            onPress={() => setRange(opt.value as any)}
          >
            <Text
              style={[
                styles.rangePillText,
                range === opt.value && styles.rangePillTextActive,
              ]}
            >
              {opt.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Reports Feed */}
      <FlatList
        data={reports}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadReports();
            }}
            tintColor={colors.primary}
          />
        }
        renderItem={({ item }) => (
          <Card style={styles.reportCard}>
            <View style={styles.reportHeader}>
              <View style={styles.authorRow}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>
                    {item.employee_name ? item.employee_name.charAt(0).toUpperCase() : 'U'}
                  </Text>
                </View>
                <View>
                  <Text style={styles.authorName}>{item.employee_name}</Text>
                  <Text style={styles.departmentName}>
                    {item.employee_department || 'General'}
                  </Text>
                </View>
              </View>

              <View style={styles.dateBadge}>
                <Calendar size={12} color={colors.primary} style={{ marginRight: 4 }} />
                <Text style={styles.dateBadgeText}>{item.report_date}</Text>
              </View>
            </View>

            <Text style={styles.reportText}>{item.task_description}</Text>

            <View style={styles.cardFooter}>
              <Clock size={12} color={colors.textMuted} style={{ marginRight: 4 }} />
              <Text style={styles.timeText}>
                Submitted {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </Text>
            </View>
          </Card>
        )}
        ListEmptyComponent={
          <EmptyState
            title="No reports found"
            message={`No daily work reports were found for ${range === 'today' ? 'today' : 'this period'}.`}
            icon={<FileText size={36} color={colors.textMuted} />}
          />
        }
      />
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
  rangePill: {
    paddingVertical: 6,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.full,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.cardBorder,
    marginRight: spacing.sm,
  },
  rangePillActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  rangePillText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: typography.weights.medium,
  },
  rangePillTextActive: {
    color: colors.white,
    fontWeight: typography.weights.bold,
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  reportCard: {
    marginBottom: spacing.md,
  },
  reportHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  avatarText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: typography.weights.bold,
  },
  authorName: {
    color: colors.text,
    fontSize: 14,
    fontWeight: typography.weights.bold,
  },
  departmentName: {
    color: colors.textMuted,
    fontSize: 11,
  },
  dateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.cardHover,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: borderRadius.full,
  },
  dateBadgeText: {
    color: colors.text,
    fontSize: 11,
    fontWeight: typography.weights.semibold,
  },
  reportText: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 4,
    marginBottom: spacing.md,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.cardBorder,
  },
  timeText: {
    color: colors.textMuted,
    fontSize: 11,
  },
});

