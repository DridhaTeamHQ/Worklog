import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  SafeAreaView,
  TextInput,
} from 'react-native';
import { taskApi } from '../../api/endpoints';
import { useToast } from '../../context/ToastContext';
import { Task } from '../../types';
import { Card } from '../../components/Card';
import { StatusBadge } from '../../components/StatusBadge';
import { PriorityBadge } from '../../components/PriorityBadge';
import { Header } from '../../components/Header';
import { EmptyState } from '../../components/EmptyState';
import { colors, borderRadius, spacing, typography } from '../../theme';
import { Search, CheckCircle2, Calendar, Folder } from '../../components/Icon';

export function TasksDoneScreen() {
  const { error: toastError } = useToast();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');

  const loadCompletedTasks = useCallback(async () => {
    try {
      const res = await taskApi.list({
        status: 'completed',
        search: search.trim() || undefined,
      });
      setTasks(res.data || []);
    } catch {
      toastError('Failed to load completed tasks');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [search, toastError]);

  useEffect(() => {
    loadCompletedTasks();
  }, [loadCompletedTasks]);

  return (
    <SafeAreaView style={styles.container}>
      <Header
        title="Tasks Completed"
        subtitle={`${tasks.length} total tasks delivered`}
      />

      <View style={styles.searchContainer}>
        <Search size={16} color={colors.textMuted} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search delivered tasks..."
          placeholderTextColor={colors.placeholder}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      <FlatList
        data={tasks}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadCompletedTasks();
            }}
            tintColor={colors.primary}
          />
        }
        renderItem={({ item }) => (
          <Card style={styles.taskCard}>
            <View style={styles.taskHeader}>
              <View style={styles.keyRow}>
                {item.task_key && <Text style={styles.taskKey}>{item.task_key}</Text>}
                <Text style={styles.projectName}>{item.project_name || 'General'}</Text>
              </View>
              <StatusBadge status="completed" />
            </View>

            <Text style={styles.taskTitle}>{item.title}</Text>
            {item.description ? (
              <Text style={styles.taskDesc} numberOfLines={2}>
                {item.description}
              </Text>
            ) : null}

            <View style={styles.taskFooter}>
              <View style={styles.completedRow}>
                <CheckCircle2 size={14} color={colors.success} style={{ marginRight: 6 }} />
                <Text style={styles.completedText}>
                  Completed on {item.completed_at ? new Date(item.completed_at).toLocaleDateString() : 'N/A'}
                </Text>
              </View>
              <PriorityBadge priority={item.priority} />
            </View>
          </Card>
        )}
        ListEmptyComponent={
          <EmptyState
            title="No completed tasks found"
            message="Tasks you mark as completed will appear here in your delivery archive."
            icon={<CheckCircle2 size={36} color={colors.textMuted} />}
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
    margin: spacing.lg,
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
  completedRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  completedText: {
    color: colors.success,
    fontSize: 12,
    fontWeight: typography.weights.medium,
  },
});

