import React, { useState } from 'react';
import { ActivityIndicator, Image, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Task, Priority, isManagerLevel } from '../types';
import { useAuth } from '../context/AuthContext';
import { useTaskr } from './TaskrContext';
import { useToast } from '../context/ToastContext';
import { palette as p, s, teamStyle } from './theme';

export type IconName = React.ComponentProps<typeof Ionicons>['name'];
export function Icon({ name, size = 18, color = p.muted }: { name: IconName; size?: number; color?: string }) { return <Ionicons name={name} size={size} color={color} />; }
export function IconButton({ name, onPress, label, tint = p.muted, bg }: { name: IconName; onPress: () => void; label: string; tint?: string; bg?: string }) { return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => [s.iconButton, { backgroundColor: bg, opacity: pressed ? 0.6 : 1 }]}><Icon name={name} size={18} color={tint} /></Pressable>; }
export function Avatar({ uri, size = 34 }: { uri?: string | null; size?: number }) {
  const [failed, setFailed] = useState(false);
  return uri && !failed ? <Image accessibilityLabel="Profile photo" source={{ uri }} onError={() => setFailed(true)} style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: p.blueLight }} /> : <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: p.blueLight, alignItems: 'center', justifyContent: 'center' }}><Icon name="person" color={p.blue} size={size * 0.48} /></View>;
}
export function PriorityBadge({ priority, home = false }: { priority: Priority; home?: boolean }) {
  const color = priority === 'low' ? p.green : priority === 'medium' ? home ? p.blue : '#b87900' : '#ed2439';
  const backgroundColor = priority === 'low' ? p.greenLight : priority === 'medium' ? home ? p.blueLight : p.amberLight : '#ffe6eb';
  return <View style={[s.badge, { backgroundColor }]}><Text style={{ color, fontSize: 10.5, fontWeight: '600' }}>{priority.charAt(0).toUpperCase() + priority.slice(1)}</Text></View>;
}
export function dayLabel(value: string | null) {
  if (!value) return 'No due date';
  const date = new Date(value.slice(0, 10) + 'T12:00:00');
  const today = new Date();
  if (date.toDateString() === today.toDateString()) return 'Today';
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}
export function CheckButton({ checked, busy, disabled, onPress, label }: { checked: boolean; busy?: boolean; disabled?: boolean; onPress: () => void; label: string }) {
  return <Pressable accessibilityRole="checkbox" accessibilityState={{ checked, disabled: busy || disabled }} accessibilityLabel={label} disabled={busy || disabled} onPress={onPress} style={{ minWidth: 28, minHeight: 32, alignItems: 'center', justifyContent: 'center', opacity: disabled ? 0.7 : 1 }}>{busy ? <ActivityIndicator color={p.blue} size="small" /> : <Icon name={checked ? 'checkmark-circle' : 'ellipse-outline'} size={20} color={checked ? p.blue : '#64708b'} />}</Pressable>;
}
export function TaskRow({ task, home, showAssignee, onOpen }: { task: Task; home?: boolean; showAssignee?: boolean; onOpen: () => void }) {
  const { setStatus } = useTaskr();
  const { user } = useAuth();
  const { error } = useToast();
  const [busy, setBusy] = useState(false);
  const done = task.status === 'completed';
  const canChangeStatus = task.employee_id === user?.id || isManagerLevel(user?.role);
  const team = task.employee_department || task.project_name || 'My team';
  const toggle = async () => { setBusy(true); try { await setStatus(task, done ? 'pending' : 'completed'); } catch (e) { error(e instanceof Error ? e.message : 'Unable to update task'); } finally { setBusy(false); } };
  return <View style={[s.row, home ? s.card : { borderBottomWidth: 1, borderBottomColor: p.line }, { paddingVertical: home ? 6 : 8, paddingHorizontal: home ? 8 : 0, gap: 5 }]}>
    <CheckButton checked={done} busy={busy} disabled={!canChangeStatus} onPress={() => void toggle()} label={`Mark ${task.title} ${done ? 'to do' : 'complete'}`} />
    <Pressable accessibilityRole="button" accessibilityLabel={`Open ${task.title}`} onPress={onOpen} style={[s.row, s.grow, { paddingVertical: 2, gap: 8 }]}>
      <View style={[s.grow, { gap: 3 }]}><Text style={[s.body, { fontSize: 13.5, lineHeight: 18 }, done && !home && { color: p.muted, textDecorationLine: 'line-through' }]}>{task.title || task.task_key || 'Untitled task'}</Text>{home ? <View style={[s.row, { gap: 6 }]}><PriorityBadge priority={task.priority} home />{showAssignee && <Text numberOfLines={1} style={[s.muted, { flexShrink: 1, fontSize: 11 }]}>{task.employee_name}</Text>}</View> : <View style={[s.row, { gap: 5 }]}><Icon name="ellipse" size={7} color={teamStyle(team).color} /><Text numberOfLines={1} style={[s.muted, { fontSize: 11 }]}>{team}</Text></View>}</View>
      <View style={{ gap: 4, alignItems: 'center', maxWidth: 80 }}>{!home && <PriorityBadge priority={task.priority} />}<Text style={[s.muted, { fontSize: 11 }, !home && !done && task.effective_status === 'overdue' && { color: p.red }]}>{dayLabel(task.deadline)}</Text></View><Icon name="chevron-forward" size={15} />
    </Pressable>
  </View>;
}
export function Empty({ title, detail }: { title: string; detail?: string }) { return <View style={s.empty}><Icon name="checkmark-done-circle-outline" size={32} color={p.blue} /><Text style={s.heading}>{title}</Text>{detail && <Text style={[s.muted, { textAlign: 'center' }]}>{detail}</Text>}</View>; }
