import React, { useEffect, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { taskApi, todoApi } from '../api/endpoints';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { PersonalTodo, Priority, isManagerLevel } from '../types';
import { SelectPicker } from '../components/SelectPicker';
import { AttachmentPicker, AttachmentList } from '../components/AttachmentPicker';
import { AttachedFile, serializeAttachments, extractAttachments } from '../utils/fileUpload';
import { useTaskr } from './TaskrContext';
import { Avatar, CheckButton, Empty, Icon, IconButton, PriorityBadge } from './components';
import { palette as p, s, teamStyle } from './theme';

type Nav = { goBack: () => void; navigate: (name: string, params?: object) => void; replace: (name: string, params?: object) => void };
const message = (e: unknown) => e instanceof Error ? e.message : 'Something went wrong. Please try again.';
function localDate(date: Date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; }
function DatePicker({ value, onChange }: { value: string; onChange: (date: string) => void }) {
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(new Date());
  const first = new Date(month.getFullYear(), month.getMonth(), 1).getDay();
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  return <><Pressable accessibilityRole="button" accessibilityLabel="Select due date" style={[s.input, s.row]} onPress={() => setOpen(true)}><Icon name="calendar-outline" size={17} /><Text style={[s.muted, s.grow]}>{value ? new Date(value + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Select Date'}</Text></Pressable><Modal transparent animationType="fade" visible={open} onRequestClose={() => setOpen(false)}><View style={{ flex: 1, backgroundColor: 'rgba(8,13,39,0.5)', alignItems: 'center', justifyContent: 'center', padding: 20 }}><View style={[s.card, { padding: 14, width: '100%', maxWidth: 320, gap: 10 }]}><View style={s.between}><IconButton name="chevron-back" label="Previous month" onPress={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} /><Text style={[s.body, { fontWeight: '600' }]}>{month.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}</Text><IconButton name="chevron-forward" label="Next month" onPress={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} /></View><View style={{ flexDirection: 'row' }}>{['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => <Text key={i} style={[s.muted, { width: '14.285%', textAlign: 'center', fontSize: 11 }]}>{day}</Text>)}</View><View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>{Array.from({ length: first + days }, (_, index) => { const day = index - first + 1; const date = localDate(new Date(month.getFullYear(), month.getMonth(), day)); return <Pressable key={index} disabled={day < 1} accessibilityRole="button" accessibilityLabel={day > 0 ? date : undefined} onPress={() => { onChange(date); setOpen(false); }} style={{ width: '14.285%', height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 17, backgroundColor: day > 0 && value === date ? p.blue : 'transparent' }}><Text style={{ color: value === date ? '#fff' : p.ink, fontSize: 12 }}>{day > 0 ? day : ''}</Text></Pressable>; })}</View><View style={s.between}><Pressable onPress={() => { onChange(''); setOpen(false); }}><Text style={s.link}>Clear date</Text></Pressable><Pressable onPress={() => setOpen(false)}><Text style={s.link}>Cancel</Text></Pressable></View></View></View></Modal></>;
}
export function CreateTaskScreen({ navigation }: { navigation: Nav }) {
  const { user } = useAuth();
  const { members, projects, putTask, directoryError, refresh } = useTaskr();
  const { success, error } = useToast();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [employee, setEmployee] = useState<number | null>(null);
  const [department, setDepartment] = useState<string | null>(null);
  const [project, setProject] = useState<number | null>(null);
  const [deadline, setDeadline] = useState('');
  const [priority, setPriority] = useState<Priority>('medium');
  const [attachments, setAttachments] = useState<AttachedFile[]>([]);
  const [saving, setSaving] = useState(false);
  const [validation, setValidation] = useState('');
  const departments = Array.from(new Set(members.map(m => m.department).filter((v): v is string => !!v)));
  const create = async () => {
    if (saving) return;
    if (!title.trim() || !employee || !project) { setValidation('Enter a title, select a member, and choose a project.'); return; }
    setSaving(true); setValidation('');
    try { const result = await taskApi.assign({ title: title.trim(), description: serializeAttachments(description.trim(), attachments), employeeId: employee, projectId: project, priority, deadline: deadline || null }); putTask(result.data.task); success('Task created'); navigation.replace('TaskDetails', { id: result.data.task.id }); } catch (e) { error(message(e)); } finally { setSaving(false); }
  };
  if (!isManagerLevel(user?.role)) return <SafeAreaView style={s.screen}><Empty title="Manager access required" detail="Your manager can assign team tasks. Use My Day for your personal work." /></SafeAreaView>;
  return <SafeAreaView style={s.screen} edges={['top', 'bottom', 'left', 'right']}><KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}><View style={[s.between, { padding: 12, gap: 6 }]}><IconButton name="chevron-back" label="Back" bg={p.line} tint={p.ink} onPress={() => navigation.goBack()} /><Text style={[s.heading, s.grow, { fontSize: 16 }]}>Create New Task</Text><Pressable accessibilityRole="button" disabled={saving} onPress={() => void create()} style={[s.primary, { minHeight: 34, paddingHorizontal: 12, opacity: saving ? 0.6 : 1 }]}>{saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.primaryText}>Create</Text>}</Pressable></View>
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={[s.content, { paddingTop: 8, gap: 14 }]}>{validation && <Text accessibilityRole="alert" style={{ color: p.red, fontSize: 12 }}>{validation}</Text>}{directoryError && <Pressable onPress={() => void refresh()}><Text style={{ color: p.red, fontSize: 12 }}>{directoryError} Tap to retry.</Text></Pressable>}
      <View><Text style={s.label}>Task Title</Text><TextInput accessibilityLabel="Task title" style={s.input} placeholder="e.g. Design home screen UI" placeholderTextColor={p.muted} value={title} onChangeText={setTitle} maxLength={200} /></View>
      <View><Text style={s.label}>Description (Optional)</Text><TextInput accessibilityLabel="Description" style={[s.input, { minHeight: 75, textAlignVertical: 'top' }]} multiline placeholder="Add some details about the task..." placeholderTextColor={p.muted} value={description} onChangeText={setDescription} /></View>
      <SelectPicker<string> label="Department" placeholder="Choose a department first" value={department} options={departments.map(d => ({ value: d, label: d }))} onChange={value => { setDepartment(value); setEmployee(null); }} />
      {department && <SelectPicker<number> label="Assign To" placeholder="Select a member" value={employee} options={members.filter(m => m.department === department).map(m => ({ value: m.id, label: m.name }))} onChange={setEmployee} searchable />}
      <SelectPicker<number> label="Project" placeholder="Select Project" value={project} options={projects.filter(proj => !proj.is_archived).map(proj => ({ value: proj.id, label: proj.name }))} onChange={setProject} />
      <View><Text style={s.label}>Due Date</Text><DatePicker value={deadline} onChange={setDeadline} /></View>
      <View><Text style={s.label}>Priority</Text><View style={[s.row, { gap: 8 }]}>{(['low', 'medium', 'high', 'urgent'] as Priority[]).map(value => <Pressable accessibilityRole="radio" accessibilityState={{ checked: value === priority }} key={value} onPress={() => setPriority(value)} style={{ padding: 2, borderWidth: 1.5, borderColor: priority === value ? p.blue : 'transparent', borderRadius: 8 }}><PriorityBadge priority={value} /></Pressable>)}</View></View>
      <AttachmentPicker attachments={attachments} onChange={setAttachments} />
    </ScrollView></KeyboardAvoidingView></SafeAreaView>;
}
export function TaskDetailsScreen({ navigation, route }: { navigation: Nav; route: { params: { id: number } } }) {
  const { tasks, putTask, setStatus } = useTaskr();
  const { user } = useAuth();
  const { error, success } = useToast();
  const task = tasks.find(t => t.id === route.params.id);
  const [loading, setLoading] = useState(!task);
  const [loadError, setLoadError] = useState('');
  const [items, setItems] = useState<PersonalTodo[]>([]);
  const [checkError, setCheckError] = useState('');
  const [adding, setAdding] = useState(false);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [itemBusy, setItemBusy] = useState<number | null>(null);
  const ownTask = task?.employee_id === user?.id;
  useEffect(() => { let live = true; taskApi.get(route.params.id).then(result => { if (live) putTask(result.data); }).catch(e => { if (live) setLoadError(message(e)); }).finally(() => { if (live) setLoading(false); }); return () => { live = false; }; }, [route.params.id]);
  useEffect(() => { if (!ownTask) return; let live = true; todoApi.list().then(result => { if (live) setItems(result.data.filter(todo => todo.task_id === route.params.id)); }).catch(e => { if (live) setCheckError(message(e)); }); return () => { live = false; }; }, [route.params.id, ownTask]);
  const update = async () => { if (!task || busy) return; setBusy(true); try { await setStatus(task, task.status === 'completed' ? 'pending' : 'completed'); success(task.status === 'completed' ? 'Task reopened' : 'Task completed'); } catch (e) { error(message(e)); } finally { setBusy(false); } };
  const addItem = async () => { if (!text.trim() || busy) return; setBusy(true); try { const result = await todoApi.create(text.trim(), undefined, { taskId: route.params.id }); setItems(prev => [...prev, result.data]); setText(''); setAdding(false); } catch (e) { error(message(e)); } finally { setBusy(false); } };
  const toggleItem = async (item: PersonalTodo) => { if (itemBusy !== null) return; setItemBusy(item.id); try { const result = await todoApi.update(item.id, { isDone: !item.is_done }); setItems(prev => prev.map(todo => todo.id === item.id ? result.data : todo)); } catch (e) { error(message(e)); } finally { setItemBusy(null); } };
  if (loading && !task) return <View style={[s.screen, s.empty]}><ActivityIndicator color={p.blue} /></View>;
  if (!task) return <View style={s.screen}><IconButton name="chevron-back" label="Back" onPress={() => navigation.goBack()} /><Empty title="Task unavailable" detail={loadError || 'This task is no longer available.'} /></View>;
  const team = task.employee_department || task.project_name || 'My team';
  return <SafeAreaView style={s.screen} edges={['top', 'bottom', 'left', 'right']}><View style={[s.row, { paddingHorizontal: 18, paddingVertical: 12 }]}><IconButton name="chevron-back" label="Back" bg={p.line} tint={p.ink} onPress={() => navigation.goBack()} /><Text style={[s.heading, s.grow]}>Task Details</Text></View><ScrollView contentContainerStyle={[s.content, { gap: 27, paddingTop: 15 }]} keyboardShouldPersistTaps="handled">
    {loadError && <Text style={{ color: p.red }}>{loadError}</Text>}
    {ownTask && <View style={{ gap: 10 }}>
      <View style={s.between}><Text style={s.heading}>Task Status</Text>{busy && <ActivityIndicator color={p.blue} accessibilityLabel="Saving task status" />}</View>
      <View style={[s.row, { gap: 8 }]}>
        {([{ value: 'pending', label: 'To Do' }, { value: 'in_progress', label: 'In Progress' }, { value: 'completed', label: 'Completed' }] as const).map(option => {
          const selected = task.status === option.value;
          return <Pressable key={option.value} accessibilityRole="radio" accessibilityLabel={option.label} accessibilityState={{ checked: selected, disabled: busy }} disabled={busy || selected} onPress={async () => {
            if (busy) return;
            setBusy(true);
            try { await setStatus(task, option.value); success('Status updated to ' + option.label); }
            catch (e) { error(message(e)); }
            finally { setBusy(false); }
          }} style={{ flex: 1, minHeight: 44, padding: 8, borderRadius: 10, borderWidth: 1, borderColor: selected ? p.blue : p.line, backgroundColor: selected ? p.blueLight : p.canvas, alignItems: 'center', justifyContent: 'center', opacity: busy ? 0.6 : 1 }}>
            <Text style={{ color: selected ? p.blue : p.muted, fontSize: 12, fontWeight: selected ? '700' : '400', textAlign: 'center' }}>{option.label}</Text>
          </Pressable>;
        })}
      </View>
    </View>}
    <View style={[s.row, { alignItems: 'flex-start' }]}><View style={s.grow}><Text style={[s.title, { fontSize: 21 }]}>{task.title || task.task_key || 'Untitled task'}</Text><View style={[s.row, { marginTop: 7, gap: 8 }]}><Icon name="ellipse" color={teamStyle(team).color} size={11} /><Text style={s.subtitle}>{team}</Text></View></View><View style={{ paddingTop: 5 }}><PriorityBadge priority={task.priority} /></View></View>
    <View style={[s.row, { alignItems: 'flex-start', gap: 16 }]}><View style={[s.row, s.grow, { alignItems: 'flex-start' }]}><Icon name="calendar-outline" color={p.muted} size={25} /><View style={s.grow}><Text style={[s.muted, { fontSize: 12 }]}>Due Date</Text><Text style={[s.body, { marginTop: 4, fontSize: 14 }]}>{task.deadline ? new Date(task.deadline.slice(0, 10) + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'No due date'}</Text></View></View><View style={[s.row, s.grow, { borderLeftWidth: 1, borderLeftColor: p.line, paddingLeft: 18, alignItems: 'flex-start' }]}><Icon name="person-outline" color={p.muted} /><View style={s.grow}><Text style={[s.muted, { fontSize: 12 }]}>Assigned to</Text><View style={[s.row, { gap: 6, marginTop: 4 }]}><Avatar uri={task.employee_profile_image} size={25} /><Text style={[s.body, s.grow, { fontSize: 14 }]}>{task.employee_name}</Text></View></View></View></View>
    {(() => {
      const { cleanDescription, attachments } = extractAttachments(task.description);
      return (
        <>
          <View style={[s.card, s.row, { borderRadius: 12, padding: 16, alignItems: 'flex-start' }]}>
            <Icon name="document-text-outline" color={p.muted} size={23} />
            <View style={s.grow}>
              <Text style={s.muted}>Description</Text>
              <Text style={[s.body, { color: p.ink, marginTop: 7, fontSize: 15, lineHeight: 23 }]}>{cleanDescription || 'No description added.'}</Text>
              {task.notes && <Text style={[s.muted, { marginTop: 10 }]}>{task.notes}</Text>}
            </View>
          </View>
          {attachments.length > 0 && (
            <View style={s.section}>
              <AttachmentList attachments={attachments} />
            </View>
          )}
        </>
      );
    })()}
    <View style={s.section}><View style={s.between}><Text style={s.heading}>Checklist ({items.filter(i => i.is_done).length}/{items.length})</Text>{ownTask && <Pressable accessibilityRole="button" onPress={() => setAdding(!adding)} style={[s.row, { gap: 4, minHeight: 44 }]}><Icon name="add" color={p.blue} /><Text style={s.link}>Add</Text></Pressable>}</View><Text style={[s.muted, { fontSize: 12 }]}>{ownTask ? 'Your personal checklist for today' : 'Personal checklists are available to the task’s assignee.'}</Text>{checkError && <Text style={{ color: p.red }}>{checkError}</Text>}{items.map(item => <View key={item.id} style={s.row}><CheckButton checked={item.is_done} busy={itemBusy === item.id} label={item.title} onPress={() => void toggleItem(item)} /><Text style={[s.body, s.grow, item.is_done && { textDecorationLine: 'line-through', color: p.muted }]}>{item.title}</Text></View>)}{adding && <View style={s.row}><TextInput accessibilityLabel="Checklist item" style={[s.input, s.grow]} placeholder="Add a checklist item" placeholderTextColor={p.muted} value={text} onChangeText={setText} onSubmitEditing={() => void addItem()} maxLength={200} autoFocus /><IconButton name="add-circle" label="Save checklist item" tint={p.blue} onPress={() => void addItem()} /></View>}</View>
    {ownTask && <Pressable accessibilityRole="button" disabled={busy} onPress={() => void update()} style={[s.primary, { marginTop: 15, opacity: busy ? 0.6 : 1 }]}>{busy ? <ActivityIndicator color="#fff" /> : <Text style={s.primaryText}>{task.status === 'completed' ? 'Reopen Task' : 'Mark as Complete'}</Text>}</Pressable>}
  </ScrollView></SafeAreaView>;
}
