import React, { useCallback, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { dashboardApi } from '../../api/endpoints';
import { DashboardRange, ManagerDashboardData } from '../../types';
import { ActivityChart } from '../../components/ActivityChart';
import { colors } from '../../theme';

const periods: { label: string; value: DashboardRange }[] = [
  { label: 'Today', value: 'today' }, { label: 'This week', value: 'week' }, { label: 'Overall', value: 'all' },
];
type IconName = React.ComponentProps<typeof Ionicons>['name'];

function Metric({ label, value, icon, color, onPress }: {
  label: string; value: number; icon: IconName; color: string; onPress: () => void;
}) {
  return (
    <TouchableOpacity accessibilityRole="button" accessibilityLabel={`${label}: ${value}`} onPress={onPress} activeOpacity={0.7} style={styles.metric}>
      <View style={[styles.iconBox, { backgroundColor: `${color}17` }]}><Ionicons name={icon} size={25} color={color} /></View>
      <View style={styles.metricText}><Text style={styles.metricLabel}>{label}</Text><Text style={styles.metricValue}>{value}</Text></View>
      <Ionicons name="chevron-forward" size={18} color="#747783" />
    </TouchableOpacity>
  );
}

function Kpi({ label, value, icon, color, note, onPress }: { label: string; value: number; icon: IconName; color: string; note: string; onPress: () => void }) {
  return <TouchableOpacity accessibilityRole="button" onPress={onPress} activeOpacity={0.75} style={styles.kpi}>
    <View style={[styles.kpiRing, { borderColor: color }]}><View style={[styles.kpiIcon, { backgroundColor: `${color}16` }]}><Ionicons name={icon} size={22} color={color} /></View></View>
    <Text style={styles.kpiValue}>{value}</Text><Text style={styles.kpiLabel} numberOfLines={2}>{label}</Text><Text style={styles.kpiNote}>{note}</Text>
  </TouchableOpacity>;
}

export function ManagerDashboardScreen({ navigation }: any) {
  const { user } = useAuth();
  const [range, setRange] = useState<DashboardRange>('today');
  const [data, setData] = useState<ManagerDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [failed, setFailed] = useState(false);
  const request = useRef(0);
  const loadData = useCallback(async () => {
    const id = ++request.current;
    setFailed(false);
    try {
      const res = await dashboardApi.load({ range });
      if (id === request.current && (res.data.role === 'manager' || res.data.role === 'admin')) setData(res.data);
    } catch {
      if (id === request.current) setFailed(true);
    } finally {
      if (id === request.current) { setLoading(false); setRefreshing(false); }
    }
  }, [range]);
  useFocusEffect(useCallback(() => {
    void loadData();
    return () => { request.current += 1; };
  }, [loadData]));

  const summary = data?.summary;
  const total = summary?.total_team_members ?? 0;
  const submitted = summary?.reports_submitted_today ?? 0;
  const overdue = summary?.overdue_tasks ?? 0;
  const role = user?.role === 'admin' ? 'Admin' : 'Manager';
  const initials = user?.name?.trim().split(/\s+/).map(part => part[0]).slice(0, 2).join('').toUpperCase() || 'U';

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} tintColor={colors.primary} onRefresh={() => { setRefreshing(true); void loadData(); }} />}>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Open profile" style={styles.profileHeader} onPress={() => navigation.navigate('Profile')} activeOpacity={0.75}>
          <View style={styles.avatar}><Text style={styles.initials}>{initials}</Text></View>
          <View style={styles.profileHeaderText}><Text style={styles.headerTitle}>{user?.name || role}</Text><Text style={styles.subtitle}>{role} Dashboard · {role === 'Admin' ? 'Company-wide overview' : 'Your team’s overview'}</Text></View>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Open notifications" style={styles.headerAction} onPress={() => navigation.navigate('Notifications')}><Ionicons name="notifications-outline" color={colors.textSecondary} size={20} /></TouchableOpacity>
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Open profile settings" style={styles.headerAction} onPress={() => navigation.navigate('Profile')}><Ionicons name="settings-outline" color={colors.textSecondary} size={20} /></TouchableOpacity>
        </TouchableOpacity>
        <View style={styles.overviewHeading}><View style={styles.overviewIcon}><Ionicons name="sparkles-outline" size={19} color={colors.primary} /></View><View><Text style={styles.kicker}>OVERVIEW</Text><Text style={styles.title}>Good morning, {user?.name?.split(' ')[0] || 'Admin'}</Text></View></View>
        <Text style={styles.date}>{new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}<Text style={{ color: colors.text }}>  •  {periods.find(p => p.value === range)?.label}</Text></Text>
        <View style={styles.periods} accessibilityRole="tablist">
          {periods.map(period => <TouchableOpacity key={period.value} accessibilityRole="tab" accessibilityState={{ selected: range === period.value }}
            style={[styles.period, range === period.value && styles.activePeriod]} onPress={() => { if (range !== period.value) { setLoading(true); setData(null); setRange(period.value); } }}>
            <Text style={[styles.periodText, range === period.value && styles.activePeriodText]}>{period.label}</Text>
          </TouchableOpacity>)}
        </View>
        {failed && <TouchableOpacity accessibilityRole="button" style={styles.error} onPress={() => { setLoading(true); void loadData(); }}><Text style={styles.bannerTitle}>Couldn’t refresh the dashboard</Text><Text style={styles.subtitle}>Check your connection. Tap to retry.</Text></TouchableOpacity>}
        {loading ? <ActivityIndicator style={styles.loader} size="large" color={colors.primary} /> : summary && <>
          <View style={styles.kpiGrid}>
            <Kpi label="Total Team Members" value={total} icon="people-outline" color="#ff5861" note="+0 this week" onPress={() => navigation.navigate('TeamMembers')} />
            <Kpi label="Assigned Tasks" value={summary.tasks_assigned_today} icon="clipboard-outline" color="#4a8ff5" note="No new today" onPress={() => navigation.navigate('AllTasks', { status: '' })} />
            <Kpi label="Completed Tasks" value={summary.tasks_completed_today} icon="checkmark-circle-outline" color="#19b875" note="No changes" onPress={() => navigation.navigate('AllTasks', { status: 'completed' })} />
            <Kpi label="Pending Tasks" value={summary.pending_tasks} icon="time-outline" color="#f2b632" note="No changes" onPress={() => navigation.navigate('AllTasks', { status: 'pending' })} />
          </View>
          <TouchableOpacity accessibilityRole="button" onPress={() => navigation.navigate('AllTasks', { status: 'overdue' })} activeOpacity={0.7} style={[styles.banner, overdue > 0 && styles.overdue]}>
            <View style={[styles.iconBox, { backgroundColor: '#f7788d17' }]}><Ionicons name={overdue > 0 ? 'warning-outline' : 'checkmark-circle-outline'} size={25} color="#f7788d" /></View>
            <View style={styles.bannerText}><Text style={styles.bannerTitle}>{overdue} overdue {overdue === 1 ? 'task' : 'tasks'}</Text><Text style={styles.subtitle}>{overdue > 0 ? 'These are past their deadline and not yet complete.' : 'Your team is up to date on deadlines.'}</Text></View>
            <Ionicons name="chevron-forward" size={21} color="#f7788d" />
          </TouchableOpacity>
          <TouchableOpacity accessibilityRole="button" onPress={() => navigation.navigate('TaskReports')} activeOpacity={0.7} style={styles.banner}>
            <View style={[styles.iconBox, { backgroundColor: '#ff857517' }]}><Ionicons name="document-text-outline" size={25} color="#ff8575" /></View>
            <View style={styles.bannerText}><Text style={styles.bannerTitle}>{submitted} of {total} reports submitted today</Text><Text style={styles.subtitle}>{summary.reports_pending_today ? `${summary.reports_pending_today} still to come.` : total ? 'Everyone has checked in.' : 'Add team members to get started.'}</Text>
              <View style={styles.progress} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: total, now: submitted }}><View style={[styles.progressFill, { width: `${total ? Math.min(100, submitted / total * 100) : 0}%` }]} /></View>
            </View><Ionicons name="chevron-forward" size={21} color="#747783" />
          </TouchableOpacity>
          <ActivityChart points={data?.activity ?? []} />
        </>}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: 18, paddingTop: 14, paddingBottom: 24, maxWidth: 680, width: '100%', alignSelf: 'center' },
  profileHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 20, paddingVertical: 4 },
  profileHeaderText: { flex: 1 },
  avatar: { width: 44, height: 44, borderRadius: 16, backgroundColor: colors.primaryLight, justifyContent: 'center', alignItems: 'center' },
  initials: { color: colors.primary, fontSize: 16, fontWeight: '800' },
  headerAction: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.card, borderWidth: 1, borderColor: colors.cardBorder },
  headerTitle: { color: colors.text, fontSize: 18, fontWeight: '700', marginBottom: 3 },
  subtitle: { color: colors.textSecondary, fontSize: 12, lineHeight: 18, marginTop: 3 },
  overviewHeading: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 2 },
  overviewIcon: { width: 36, height: 36, borderRadius: 12, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  kicker: { color: colors.primary, fontSize: 10, fontWeight: '800', letterSpacing: 1.4, marginBottom: 2 },
  title: { color: colors.text, fontSize: 20, fontWeight: '800', letterSpacing: -0.4 },
  date: { color: colors.textSecondary, fontSize: 14, marginTop: 5, marginBottom: 15 },
  periods: { flexDirection: 'row', gap: 4, marginBottom: 15 },
  period: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 36, borderRadius: 10, backgroundColor: colors.cardHover },
  activePeriod: { backgroundColor: colors.primary, borderWidth: 1, borderColor: '#ff8068' },
  periodText: { color: colors.textSecondary, fontSize: 12.5, fontWeight: '600' },
  activePeriodText: { color: '#ffffff' },
  row: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  kpiGrid: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 14, paddingTop: 2 },
  kpi: { width: '24%', alignItems: 'center' },
  kpiRing: { width: 50, height: 50, borderRadius: 25, borderWidth: 3.5, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.card },
  kpiIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  kpiValue: { color: colors.text, fontSize: 17, fontWeight: '800', marginTop: 4 },
  kpiLabel: { color: colors.textSecondary, fontSize: 9.5, lineHeight: 12, textAlign: 'center', marginTop: 2, minHeight: 24 },
  kpiNote: { color: colors.textMuted, fontSize: 7.5, textAlign: 'center', marginTop: 2 },
  metric: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.cardBorder, borderRadius: 11, padding: 8, minHeight: 64 },
  iconBox: { width: 34, height: 36, borderRadius: 11, justifyContent: 'center', alignItems: 'center' },
  metricText: { flex: 1 },
  metricLabel: { color: colors.textSecondary, fontSize: 11, lineHeight: 14 },
  metricValue: { color: colors.text, fontSize: 17, lineHeight: 21, fontWeight: '600', marginTop: 2 },
  banner: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.cardBorder, padding: 10, borderRadius: 12, marginBottom: 8, minHeight: 64 },
  overdue: { backgroundColor: colors.dangerLight, borderColor: colors.dangerBorder },
  bannerText: { flex: 1 },
  bannerTitle: { color: colors.text, fontSize: 12.5, fontWeight: '600', lineHeight: 17 },
  progress: { height: 5, borderRadius: 2.5, backgroundColor: colors.cardBorder, marginTop: 6, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 2.5, backgroundColor: colors.primary },
  loader: { padding: 50 },
  error: { padding: 14, backgroundColor: colors.dangerLight, borderColor: colors.dangerBorder, borderWidth: 1, borderRadius: 12, marginBottom: 10 },
});

