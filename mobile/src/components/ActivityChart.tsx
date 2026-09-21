import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ActivityPoint } from '../types';
import { colors } from '../theme';

const series = [{ key: 'assigned', label: 'Assigned', color: '#55a6ff' }, { key: 'completed', label: 'Completed', color: '#3dd181' }, { key: 'reports', label: 'Reports', color: '#ffcf18' }] as const;
const height = 104;
export function ActivityChart({ points }: { points: ActivityPoint[] }) {
  const [width, setWidth] = useState(0);
  const ceiling = Math.max(4, Math.ceil(Math.max(0, ...points.flatMap(p => [p.assigned, p.completed, p.reports])) / 4) * 4);
  const x = (i: number) => 5 + i / Math.max(1, points.length - 1) * Math.max(0, width - 10);
  const y = (v: number) => height - v / ceiling * height;
  const dateLabel = (day: string) => new Date(`${day}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: '2-digit' });
  const ticks = [...new Set([0, Math.floor((points.length - 1) / 3), Math.floor((points.length - 1) * 2 / 3), points.length - 1])].filter(i => i >= 0);
  return <View style={styles.card}>
    <View style={styles.heading}><Ionicons name="bar-chart-outline" size={22} color={colors.text} /><View style={{ flex: 1 }}><Text style={styles.title}>Activity — last 14 days</Text><Text style={styles.subtitle}>Tasks assigned and completed, plus daily reports submitted.</Text></View></View>
    {points.length === 0 ? <Text style={styles.empty}>Activity will appear as your team starts working.</Text> : <>
      <View style={styles.chart}><View style={styles.axis}>{[4, 3, 2, 1, 0].map(t => <Text key={t} style={[styles.tick, { top: (4 - t) / 4 * height - 7 }]}>{ceiling * t / 4}</Text>)}</View><View style={styles.plot} onLayout={e => setWidth(e.nativeEvent.layout.width)}>
        {[0, 1, 2, 3, 4].map(t => <View key={t} style={[styles.gridline, { top: t / 4 * height }]} />)}
        {width > 0 && series.map(s => <React.Fragment key={s.key}>{points.slice(0, -1).map((p, i) => { const dx = x(i + 1) - x(i), dy = y(points[i + 1][s.key]) - y(p[s.key]), length = Math.sqrt(dx * dx + dy * dy); return <View key={i} style={{ position: 'absolute', height: 2, width: length, left: (x(i) + x(i + 1)) / 2 - length / 2, top: (y(p[s.key]) + y(points[i + 1][s.key])) / 2 - 1, backgroundColor: s.color, transform: [{ rotate: `${Math.atan2(dy, dx)}rad` }] }} />; })}{points.map((p, i) => <View key={p.day} style={{ position: 'absolute', left: x(i) - 3, top: y(p[s.key]) - 3, width: 6, height: 6, borderRadius: 3, backgroundColor: s.color }} />)}</React.Fragment>)}
        <View style={styles.dates}>{ticks.map(i => <Text key={i} style={styles.date}>{dateLabel(points[i].day)}</Text>)}</View>
      </View></View><View style={styles.legend}>{series.map(s => <View key={s.key} style={styles.legendItem}><View style={[styles.dot, { backgroundColor: s.color }]} /><Text style={styles.legendText}>{s.label}</Text></View>)}</View>
    </>}
  </View>;
}
const styles = StyleSheet.create({ card: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.cardBorder, borderRadius: 19, padding: 18, marginTop: 2 }, heading: { flexDirection: 'row', alignItems: 'flex-start', gap: 14, marginBottom: 24 }, title: { color: colors.text, fontSize: 15, fontWeight: '700' }, subtitle: { color: colors.textMuted, fontSize: 11, lineHeight: 17, marginTop: 5 }, chart: { flexDirection: 'row', height: height + 30 }, axis: { width: 24 }, tick: { position: 'absolute', color: colors.textSecondary, fontSize: 11 }, plot: { flex: 1, height }, gridline: { position: 'absolute', width: '100%', borderTopWidth: 1, borderStyle: 'dashed', borderColor: '#dfe3ec' }, dates: { position: 'absolute', top: height + 12, left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-between' }, date: { color: colors.textMuted, fontSize: 10 }, legend: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 15, marginTop: 14 }, legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 }, dot: { height: 8, width: 8, borderRadius: 4 }, legendText: { color: colors.textSecondary, fontSize: 11 }, empty: { color: colors.textMuted, fontSize: 13, paddingVertical: 24 } });
