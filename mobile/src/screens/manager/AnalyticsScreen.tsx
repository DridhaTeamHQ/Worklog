import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { dashboardApi } from '../../api/endpoints';
import { useToast } from '../../context/ToastContext';
import { AnalyticsPayload, ProductivityRow } from '../../types';
import { Card } from '../../components/Card';
import { Header } from '../../components/Header';
import { StatCard } from '../../components/StatCard';
import { EmptyState } from '../../components/EmptyState';
import { colors, borderRadius, spacing, typography } from '../../theme';
import {
  TrendingUp,
  Award,
  CheckCircle2,
  Clock,
  AlertCircle,
  BarChart3,
  Calendar,
} from '../../components/Icon';

const DAYS_OPTIONS = [
  { label: '7 Days', value: 7 },
  { label: '30 Days', value: 30 },
  { label: '90 Days', value: 90 },
];

export function AnalyticsScreen() {
  const insets = useSafeAreaInsets();
  const { error: toastError } = useToast();

  const [data, setData] = useState<AnalyticsPayload | null>(null);
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadAnalytics = useCallback(async () => {
    try {
      const res = await dashboardApi.analytics({ days });
      setData(res.data);
    } catch {
      toastError('Failed to load analytics data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [days, toastError]);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  if (loading && !refreshing) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </SafeAreaView>
    );
  }

  const productivity = data?.productivity || [];
  const summary = data?.summary;
  const breakdown = data?.breakdown;

  // Calculate average team completion rate
  const avgRate = productivity.length > 0
    ? Math.round(
        productivity.reduce((acc, row) => acc + (row.completion_rate || 0), 0) / productivity.length
      )
    : 0;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <Header
        title="Analytics & Productivity"
        subtitle="Team delivery benchmarks and activity metrics"
      />

      {/* Days Filter Pills */}
      <View style={styles.filterRow}>
        {DAYS_OPTIONS.map((opt) => (
          <TouchableOpacity
            key={opt.value}
            style={[styles.filterPill, days === opt.value && styles.filterPillActive]}
            onPress={() => setDays(opt.value)}
          >
            <Text
              style={[
                styles.filterPillText,
                days === opt.value && styles.filterPillTextActive,
              ]}
            >
              Past {opt.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 28 }]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadAnalytics();
            }}
            tintColor={colors.primary}
          />
        }
      >
        {/* Benchmark Highlights */}
        <View style={styles.statsRow}>
          <StatCard
            label="Avg Completion Rate"
            value={`${avgRate}%`}
            accentColor={colors.primary}
            icon={<Award size={18} color={colors.primary} />}
          />
          <View style={{ width: spacing.md }} />
          <StatCard
            label="Total Delivered"
            value={breakdown?.completed || 0}
            accentColor={colors.success}
            icon={<CheckCircle2 size={18} color={colors.success} />}
          />
        </View>

        {/* Member Productivity Roster */}
        <Text style={styles.sectionTitle}>Employee Delivery Performance</Text>

        {productivity.length === 0 ? (
          <EmptyState
            title="No activity recorded"
            message="Productivity metrics will appear once team tasks are active and delivered."
          />
        ) : (
          productivity.map((row) => (
            <Card key={row.employee_id} style={styles.productivityCard}>
              <View style={styles.memberHeader}>
                <View style={styles.memberLeft}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>
                      {row.employee_name ? row.employee_name.charAt(0).toUpperCase() : 'U'}
                    </Text>
                  </View>
                  <View>
                    <Text style={styles.memberName}>{row.employee_name}</Text>
                    <Text style={styles.memberDept}>{row.department || 'General Team'}</Text>
                  </View>
                </View>

                <View style={styles.rateBadge}>
                  <Text style={styles.rateText}>{row.completion_rate || 0}%</Text>
                </View>
              </View>

              {/* Progress Bar */}
              <View style={styles.progressBarBg}>
                <View
                  style={[
                    styles.progressBarFill,
                    {
                      width: `${Math.min(100, Math.max(0, row.completion_rate || 0))}%`,
                    },
                  ]}
                />
              </View>

              {/* Detailed Breakdown */}
              <View style={styles.countsRow}>
                <Text style={styles.countText}>
                  Assigned: <Text style={styles.boldWhite}>{row.assigned}</Text>
                </Text>
                <Text style={styles.countText}>
                  Done: <Text style={{ color: colors.success, fontWeight: 'bold' }}>{row.completed}</Text>
                </Text>
                <Text style={styles.countText}>
                  Active: <Text style={{ color: colors.info, fontWeight: 'bold' }}>{row.in_progress}</Text>
                </Text>
                {row.overdue > 0 && (
                  <Text style={styles.countText}>
                    Overdue: <Text style={{ color: colors.danger, fontWeight: 'bold' }}>{row.overdue}</Text>
                  </Text>
                )}
              </View>
            </Card>
          ))
        )}
      </ScrollView>
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
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
  },
  filterPill: {
    paddingVertical: 6,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.full,
    backgroundColor: colors.cardHover,
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
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
  },
  statsRow: {
    flexDirection: 'row',
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: typography.weights.bold,
    marginBottom: spacing.md,
  },
  productivityCard: {
    marginBottom: spacing.md,
  },
  memberHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  memberLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  avatarText: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: typography.weights.bold,
  },
  memberName: {
    color: colors.text,
    fontSize: 14,
    fontWeight: typography.weights.bold,
  },
  memberDept: {
    color: colors.textMuted,
    fontSize: 12,
  },
  rateBadge: {
    backgroundColor: colors.primaryLight,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.primaryBorder,
  },
  rateText: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: typography.weights.bold,
  },
  progressBarBg: {
    height: 6,
    backgroundColor: colors.cardHover,
    borderRadius: borderRadius.full,
    overflow: 'hidden',
    marginBottom: spacing.md,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: borderRadius.full,
  },
  countsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: spacing.xs,
  },
  countText: {
    color: colors.textMuted,
    fontSize: 12,
  },
  boldWhite: {
    color: colors.text,
    fontWeight: typography.weights.bold,
  },
});

