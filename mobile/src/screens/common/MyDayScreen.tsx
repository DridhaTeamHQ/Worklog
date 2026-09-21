import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { todoApi, reportApi, projectApi, taskApi } from '../../api/endpoints';
import { PersonalTodo, DailyReport, Project, Task } from '../../types';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { Modal } from '../../components/Modal';
import { SelectPicker } from '../../components/SelectPicker';
import { EmptyState } from '../../components/EmptyState';
import { Header } from '../../components/Header';
import { colors, borderRadius, spacing, typography } from '../../theme';
import {
  Calendar,
  CheckCircle2,
  Circle,
  Plus,
  Trash2,
  FileText,
  ChevronLeft,
  ChevronRight,
  Sparkles,
} from '../../components/Icon';

export function MyDayScreen({ navigation }: any) {
  const { user } = useAuth();
  const { success: toastSuccess, error: toastError } = useToast();

  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [todos, setTodos] = useState<PersonalTodo[]>([]);
  const [todayReport, setTodayReport] = useState<DailyReport | null>(null);
  const [reportText, setReportText] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [savingReport, setSavingReport] = useState(false);

  // Add Todo Modal
  const [addTodoModal, setAddTodoModal] = useState(false);
  const [newTodoTitle, setNewTodoTitle] = useState('');
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<number | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedTaskId, setSelectedTaskId] = useState<number | null>(null);
  const [addingTodo, setAddingTodo] = useState(false);

  const isToday = selectedDate === new Date().toISOString().split('T')[0];

  const loadData = useCallback(async () => {
    try {
      const [todosRes, reportRes] = await Promise.all([
        todoApi.list(selectedDate),
        reportApi.today(),
      ]);
      setTodos(todosRes.data || []);
      setTodayReport(reportRes.data);
      if (reportRes.data && !reportText) {
        setReportText(reportRes.data.task_description);
      }
    } catch (err: any) {
      toastError('Failed to load My Day data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedDate, toastError]);

  useEffect(() => {
    setLoading(true);
    loadData();
  }, [loadData]);

  // Load projects when opening Add Todo modal
  const openAddTodoModal = async () => {
    setAddTodoModal(true);
    setNewTodoTitle('');
    setSelectedProjectId(null);
    setSelectedTaskId(null);
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

  const handleAddTodo = async () => {
    if (!newTodoTitle.trim()) {
      toastError('Please enter a note / task title');
      return;
    }
    setAddingTodo(true);
    try {
      const res = await todoApi.create(
        newTodoTitle.trim(),
        selectedDate,
        selectedProjectId ? { projectId: selectedProjectId, taskId: selectedTaskId || undefined } : undefined
      );
      setTodos((prev) => [res.data, ...prev]);
      setAddTodoModal(false);
      toastSuccess('Added to My Day');
    } catch (err: any) {
      toastError(err.message || 'Failed to add item');
    } finally {
      setAddingTodo(false);
    }
  };

  const handleToggleTodo = async (todo: PersonalTodo) => {
    try {
      const updated = !todo.is_done;
      setTodos((prev) =>
        prev.map((t) => (t.id === todo.id ? { ...t, is_done: updated } : t))
      );
      await todoApi.update(todo.id, { isDone: updated });
    } catch {
      toastError('Failed to update item');
      loadData();
    }
  };

  const handleDeleteTodo = async (id: number) => {
    try {
      setTodos((prev) => prev.filter((t) => t.id !== id));
      await todoApi.remove(id);
      toastSuccess('Item removed');
    } catch {
      toastError('Failed to delete item');
      loadData();
    }
  };

  const handleSaveReport = async () => {
    if (!reportText.trim()) {
      toastError('Please describe your work before submitting');
      return;
    }
    setSavingReport(true);
    try {
      const res = await reportApi.save(reportText.trim());
      setTodayReport(res.data.report);
      toastSuccess(res.data.message || 'Daily report saved!');
    } catch (err: any) {
      toastError(err.message || 'Failed to submit report');
    } finally {
      setSavingReport(false);
    }
  };

  const changeDate = (deltaDays: number) => {
    const current = new Date(selectedDate);
    current.setDate(current.getDate() + deltaDays);
    setSelectedDate(current.toISOString().split('T')[0]);
  };

  const formattedDate = new Date(selectedDate + 'T00:00:00').toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <SafeAreaView style={styles.container}>
      <Header
        title="My Day"
        subtitle="Daily personal plan & work report"
        onBack={navigation?.canGoBack() ? () => navigation.goBack() : undefined}
      />

      {/* Date Navigation Bar */}
      <View style={styles.dateNav}>
        <TouchableOpacity
          style={styles.dateArrow}
          onPress={() => changeDate(-1)}
          activeOpacity={0.7}
        >
          <ChevronLeft size={20} color={colors.text} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.dateDisplay}
          onPress={() => setSelectedDate(new Date().toISOString().split('T')[0])}
          activeOpacity={0.7}
        >
          <Calendar size={16} color={colors.primary} style={{ marginRight: 6 }} />
          <Text style={styles.dateText}>{isToday ? `Today (${formattedDate})` : formattedDate}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.dateArrow}
          onPress={() => changeDate(1)}
          activeOpacity={0.7}
        >
          <ChevronRight size={20} color={colors.text} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadData();
            }}
            tintColor={colors.primary}
          />
        }
      >
        {/* Daily Work Report Card */}
        {isToday && (
          <Card style={styles.reportCard}>
            <View style={styles.cardHeaderRow}>
              <View style={styles.cardHeaderLeft}>
                <FileText size={18} color={colors.primary} style={{ marginRight: 8 }} />
                <Text style={styles.sectionTitle}>Daily Work Report</Text>
              </View>
              {todayReport && (
                <View style={styles.submittedBadge}>
                  <Text style={styles.submittedBadgeText}>Submitted</Text>
                </View>
              )}
            </View>
            <Text style={styles.sectionSubtitle}>
              Summarize tasks completed, progress made, and any blockers today.
            </Text>

            <TextInput
              style={styles.reportInput}
              multiline
              numberOfLines={4}
              placeholder="What did you work on today? e.g. Finished user auth flow, reviewed PRs..."
              placeholderTextColor={colors.placeholder}
              value={reportText}
              onChangeText={setReportText}
            />

            <Button
              title={todayReport ? 'Update Today\'s Report' : 'Submit Daily Report'}
              onPress={handleSaveReport}
              loading={savingReport}
              size="md"
              style={{ marginTop: spacing.md }}
            />
          </Card>
        )}

        {/* Personal Todos Section */}
        <View style={styles.todosHeader}>
          <Text style={styles.sectionTitle}>Personal Checklist</Text>
          <Button
            title="Add Task"
            size="sm"
            icon={<Plus size={16} color={colors.white} />}
            onPress={openAddTodoModal}
          />
        </View>

        {loading && !refreshing ? (
          <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 40 }} />
        ) : todos.length === 0 ? (
          <EmptyState
            title="No items planned for this day"
            message="Add personal notes or action items to keep your day focused and organized."
            action={
              <Button
                title="Add first checklist item"
                size="sm"
                variant="outline"
                onPress={openAddTodoModal}
              />
            }
          />
        ) : (
          todos.map((item) => (
            <Card key={item.id} style={styles.todoItem}>
              <TouchableOpacity
                style={styles.todoCheckBtn}
                onPress={() => handleToggleTodo(item)}
                activeOpacity={0.7}
              >
                {item.is_done ? (
                  <CheckCircle2 size={22} color={colors.success} />
                ) : (
                  <Circle size={22} color={colors.textMuted} />
                )}
              </TouchableOpacity>

              <View style={styles.todoBody}>
                <Text
                  style={[
                    styles.todoTitle,
                    item.is_done && styles.todoTitleDone,
                  ]}
                >
                  {item.title}
                </Text>
                {(item.project_name || item.task_title) && (
                  <Text style={styles.todoMeta}>
                    {item.project_key ? `[${item.project_key}] ` : ''}
                    {item.task_title || item.project_name}
                  </Text>
                )}
              </View>

              <TouchableOpacity
                style={styles.deleteTodoBtn}
                onPress={() => handleDeleteTodo(item.id)}
                activeOpacity={0.7}
              >
                <Trash2 size={18} color={colors.textMuted} />
              </TouchableOpacity>
            </Card>
          ))
        )}
      </ScrollView>

      {/* Add Todo Modal */}
      <Modal
        visible={addTodoModal}
        onClose={() => setAddTodoModal(false)}
        title="Add to My Day"
        subtitle={`Planning for ${formattedDate}`}
      >
        <Input
          label="Item Description"
          placeholder="e.g. Test mobile responsiveness"
          value={newTodoTitle}
          onChangeText={setNewTodoTitle}
          autoFocus
        />

        <SelectPicker
          label="Link to Project (Optional)"
          placeholder="No Project (General)"
          options={[
            { label: 'None (General Note)', value: 0 },
            ...projects.map((p) => ({
              label: `${p.project_key} - ${p.name}`,
              value: p.id,
            })),
          ]}
          value={selectedProjectId || 0}
          onChange={(val) => {
            setSelectedProjectId(val === 0 ? null : (val as number));
            setSelectedTaskId(null);
          }}
          searchable
        />

        {selectedProjectId ? (
          <SelectPicker
            label="Link to Assigned Task (Optional)"
            placeholder="No specific task"
            options={[
              { label: 'None', value: 0 },
              ...tasks
                .filter((t) => t.project_id === selectedProjectId)
                .map((t) => ({
                  label: t.task_key ? `${t.task_key}: ${t.title}` : t.title,
                  value: t.id,
                })),
            ]}
            value={selectedTaskId || 0}
            onChange={(val) => setSelectedTaskId(val === 0 ? null : (val as number))}
            searchable
          />
        ) : null}

        <Button
          title="Add to List"
          onPress={handleAddTodo}
          loading={addingTodo}
          style={{ marginTop: spacing.md }}
        />
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  dateNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.cardBorder,
  },
  dateArrow: {
    padding: spacing.sm,
  },
  dateDisplay: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.cardHover,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.cardBorderHighlight,
  },
  dateText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: typography.weights.semibold,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
  },
  reportCard: {
    marginBottom: spacing.xl,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 14.5,
    fontWeight: typography.weights.bold,
  },
  sectionSubtitle: {
    color: colors.textMuted,
    fontSize: 11,
    marginBottom: 8,
  },
  submittedBadge: {
    backgroundColor: colors.successLight,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.successBorder,
  },
  submittedBadgeText: {
    color: colors.success,
    fontSize: 10.5,
    fontWeight: typography.weights.semibold,
  },
  reportInput: {
    backgroundColor: colors.inputBg,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    borderRadius: borderRadius.md,
    padding: 10,
    color: colors.text,
    fontSize: 13,
    minHeight: 70,
    textAlignVertical: 'top',
  },
  todosHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  todoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    marginBottom: 6,
  },
  todoCheckBtn: {
    paddingRight: 10,
  },
  todoBody: {
    flex: 1,
  },
  todoTitle: {
    color: colors.text,
    fontSize: 13,
    fontWeight: typography.weights.medium,
  },
  todoTitleDone: {
    color: colors.textMuted,
    textDecorationLine: 'line-through',
  },
  todoMeta: {
    color: colors.textMuted,
    fontSize: 10.5,
    marginTop: 2,
  },
  deleteTodoBtn: {
    padding: spacing.xs,
    marginLeft: spacing.sm,
  },
});

