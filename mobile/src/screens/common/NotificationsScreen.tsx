import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  SafeAreaView,
} from 'react-native';
import { useNotifications } from '../../context/NotificationContext';
import { useToast } from '../../context/ToastContext';
import { AppNotification } from '../../types';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { EmptyState } from '../../components/EmptyState';
import { Header } from '../../components/Header';
import { colors, borderRadius, spacing, typography } from '../../theme';
import {
  Bell,
  CheckCheck,
  CheckCircle2,
  Clock,
  AlertTriangle,
  FileCheck,
  Tag,
} from '../../components/Icon';

export function NotificationsScreen({ navigation }: any) {
  const { notifications, unreadCount, refresh, markAsRead, markAllAsRead } = useNotifications();
  const { success: toastSuccess, error: toastError } = useToast();
  const [filterUnread, setFilterUnread] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const displayedList = filterUnread
    ? notifications.filter((n) => !n.is_read)
    : notifications;

  const handleMarkAllRead = async () => {
    try {
      await markAllAsRead();
      toastSuccess('All marked as read');
    } catch {
      toastError('Failed to mark notifications');
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'task_assigned':
      case 'task_updated':
        return <CheckCircle2 size={20} color={colors.primary} />;
      case 'ticket_raised':
      case 'ticket_updated':
        return <AlertTriangle size={20} color={colors.warning} />;
      case 'report_submitted':
        return <FileCheck size={20} color={colors.success} />;
      default:
        return <Tag size={20} color={colors.info} />;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Header
        title="Notifications"
        subtitle={unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'}
        rightAction={
          unreadCount > 0 ? (
            <TouchableOpacity
              style={styles.markAllBtn}
              onPress={handleMarkAllRead}
              activeOpacity={0.7}
            >
              <CheckCheck size={16} color={colors.primary} style={{ marginRight: 4 }} />
              <Text style={styles.markAllText}>Mark all read</Text>
            </TouchableOpacity>
          ) : null
        }
      />

      {/* Filter Tabs */}
      <View style={styles.filterRow}>
        <TouchableOpacity
          style={[styles.filterTab, !filterUnread && styles.filterTabActive]}
          onPress={() => setFilterUnread(false)}
        >
          <Text style={[styles.filterTabText, !filterUnread && styles.filterTabTextActive]}>
            All ({notifications.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterTab, filterUnread && styles.filterTabActive]}
          onPress={() => setFilterUnread(true)}
        >
          <Text style={[styles.filterTabText, filterUnread && styles.filterTabTextActive]}>
            Unread ({unreadCount})
          </Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={displayedList}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => {
              setRefreshing(true);
              await refresh();
              setRefreshing(false);
            }}
            tintColor={colors.primary}
          />
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => {
              if (!item.is_read) {
                markAsRead(item.id);
              }
            }}
          >
            <Card
              style={[
                styles.itemCard,
                !item.is_read && styles.itemCardUnread,
              ]}
            >
              <View style={styles.itemIconBox}>
                {getNotificationIcon(item.type)}
              </View>
              <View style={styles.itemContent}>
                <View style={styles.itemHeader}>
                  <Text style={styles.itemTitle}>{item.title}</Text>
                  {!item.is_read && <View style={styles.unreadDot} />}
                </View>
                <Text style={styles.itemMessage}>{item.message}</Text>
                <View style={styles.timeRow}>
                  <Clock size={12} color={colors.textMuted} style={{ marginRight: 4 }} />
                  <Text style={styles.timeText}>
                    {new Date(item.created_at).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </Text>
                </View>
              </View>
            </Card>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <EmptyState
            title={filterUnread ? 'No unread notifications' : 'No notifications yet'}
            message="We will notify you when tasks are assigned, status updates occur, or reports are submitted."
            icon={<Bell size={36} color={colors.textMuted} />}
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
  markAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    backgroundColor: colors.primaryLight,
  },
  markAllText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: typography.weights.semibold,
  },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
  },
  filterTab: {
    paddingVertical: 6,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.full,
    marginRight: spacing.sm,
  },
  filterTabActive: {
    backgroundColor: colors.primary,
  },
  filterTabText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: typography.weights.medium,
  },
  filterTabTextActive: {
    color: colors.white,
    fontWeight: typography.weights.bold,
  },
  listContent: {
    padding: spacing.lg,
  },
  itemCard: {
    flexDirection: 'row',
    padding: spacing.md,
    marginBottom: spacing.sm,
    alignItems: 'flex-start',
  },
  itemCardUnread: {
    borderColor: colors.primaryBorder,
    backgroundColor: colors.primaryLight,
  },
  itemIconBox: {
    padding: spacing.sm,
    borderRadius: borderRadius.md,
    backgroundColor: colors.cardHover,
    marginRight: spacing.md,
    marginTop: 2,
  },
  itemContent: {
    flex: 1,
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  itemTitle: {
    color: colors.text,
    fontSize: 14,
    fontWeight: typography.weights.bold,
    flex: 1,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
    marginLeft: spacing.sm,
  },
  itemMessage: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 6,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  timeText: {
    color: colors.textMuted,
    fontSize: 11,
  },
});

