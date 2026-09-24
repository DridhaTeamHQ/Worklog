import React, { useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import { useTaskr } from './TaskrContext';
import { canAccessTickets, isManagerLevel } from '../types';
import { Avatar, Empty, Icon, IconButton, IconName, TaskRow } from './components';
import { palette as p, s, teamStyle } from './theme';

type Nav = { navigate: (name: string, params?: object) => void; goBack: () => void };

export function Page({ children }: { children: React.ReactNode }) {
  const { refresh, loading, error, tasks } = useTaskr();
  return (
    <SafeAreaView style={s.screen} edges={['top', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={s.content}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => void refresh()} tintColor={p.blue} />}
        keyboardShouldPersistTaps="handled"
      >
        {error ? (
          <Pressable onPress={() => void refresh()} style={[s.card, { padding: 12 }]}>
            <Text style={{ color: p.red, fontSize: 12.5 }}>{error}</Text>
            <Text style={s.link}>Tap to retry</Text>
          </Pressable>
        ) : null}
        {loading && !tasks.length ? <ActivityIndicator color={p.blue} size="small" /> : null}
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

function SectionTitle({ title, onPress }: { title: string; onPress: () => void }) {
  return (
    <View style={s.between}>
      <Text style={s.heading}>{title}</Text>
      <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`View all ${title}`} style={[s.row, { gap: 2, minHeight: 30 }]}>
        <Text style={[s.link, { fontSize: 11.5 }]}>View All</Text>
        <Icon name="chevron-forward" size={14} color={p.blue} />
      </Pressable>
    </View>
  );
}

export function useTeams() {
  const { members, tasks } = useTaskr();
  const { user } = useAuth();
  const names = Array.from(new Set([...(user?.department ? [user.department] : []), ...members.map(m => m.department), ...tasks.map(t => t.employee_department)].filter((n): n is string => !!n)));
  return names.map(name => ({
    name,
    members: members.filter(m => m.department === name),
    tasks: tasks.filter(t => t.employee_department === name),
  }));
}

type TeamGroup = ReturnType<typeof useTeams>[number];

function DepartmentSection({ navigation, teams, title }: { navigation: Nav; teams: TeamGroup[]; title: string }) {
  return (
    <View style={s.section}>
      <SectionTitle title={title} onPress={() => navigation.navigate('Teams')} />
      {teams.map(team => {
        const style = teamStyle(team.name);
        return (
          <Pressable accessibilityRole="button" key={team.name} onPress={() => navigation.navigate('TeamDetails', { name: team.name })} style={[s.card, s.row, { padding: 10, minHeight: 56, gap: 10 }]}>
            <View style={{ width: 38, height: 38, backgroundColor: style.bg, borderRadius: 9, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name={style.icon} size={20} color={style.color} />
            </View>
            <View style={s.grow}>
              <Text style={s.body}>{team.name}</Text>
              <Text style={[s.muted, { marginTop: 2, fontSize: 11 }]}>{team.members.length} members · {team.tasks.length} tasks</Text>
            </View>
            <Icon name="chevron-forward" size={16} />
          </Pressable>
        );
      })}
      {!teams.length && <Text style={s.muted}>Departments will appear when team members are added.</Text>}
    </View>
  );
}

export function HomeScreen({ navigation }: { navigation: Nav }) {
  const { user } = useAuth();
  const { tasks } = useTaskr();
  const { unreadCount } = useNotifications();
  const teams = useTeams();
  const manager = isManagerLevel(user?.role);
  const completedTasks = tasks.filter(task => task.status === 'completed');
  const latestTasks = tasks.slice(0, 4);

  const stats: { label: string; count: number; icon: IconName; bg: string; color: string; filter: string }[] = manager ? [
    { label: 'Total Tasks', count: tasks.length, icon: 'clipboard-outline', bg: p.blueLight, color: p.blue, filter: 'All' },
    { label: 'Completed', count: tasks.filter(t => t.status === 'completed').length, icon: 'checkmark', bg: p.greenLight, color: p.green, filter: 'Done' },
    { label: 'In Progress', count: tasks.filter(t => t.status === 'in_progress').length, icon: 'time-outline', bg: p.amberLight, color: p.amber, filter: 'In Progress' },
    { label: 'Overdue', count: tasks.filter(t => t.effective_status === 'overdue').length, icon: 'alert-circle', bg: p.redLight, color: p.red, filter: 'Overdue' },
  ] : [
    { label: 'My Tasks', count: tasks.length, icon: 'clipboard-outline', bg: p.blueLight, color: p.blue, filter: 'All' },
    { label: 'Completed', count: tasks.filter(t => t.status === 'completed').length, icon: 'checkmark', bg: p.greenLight, color: p.green, filter: 'Done' },
    { label: 'In Progress', count: tasks.filter(t => t.status === 'in_progress').length, icon: 'time-outline', bg: p.amberLight, color: p.amber, filter: 'In Progress' },
    { label: 'Overdue', count: tasks.filter(t => t.effective_status === 'overdue').length, icon: 'alert-circle', bg: p.redLight, color: p.red, filter: 'Overdue' },
  ];

  return (
    <Page>
      <View style={[s.between, { alignItems: 'center', marginBottom: 10 }]}>
        <View>
          <Text style={s.title}>Dashboard</Text>
          <Text style={s.subtitle}>
            {manager ? 'All department tasks & work activity' : 'Overview of your tasks & progress'}
          </Text>
        </View>
        <View style={[s.row, { gap: 8, alignItems: 'center' }]}>
          <View style={{ position: 'relative' }}>
            <IconButton name="notifications-outline" label="Notifications" onPress={() => navigation.navigate('Notifications')} tint={p.ink} bg="#18181b" />
            {unreadCount > 0 && (
              <View style={{ position: 'absolute', right: -1, top: -1, minWidth: 15, height: 15, borderRadius: 8, backgroundColor: p.red, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 2 }}>
                <Text style={{ color: '#fff', fontSize: 9, fontWeight: '700' }}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
              </View>
            )}
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="Open profile" onPress={() => navigation.navigate('Profile')}>
            <Avatar uri={user?.profile_image} size={32} />
          </Pressable>
        </View>
      </View>

      <View style={{ gap: 8, marginBottom: 8 }}>
        {[stats.slice(0, 2), stats.slice(2)].map((row, rowIndex) => (
          <View key={rowIndex} style={{ flexDirection: 'row', gap: 8 }}>
            {row.map(stat => {
              const filled = stat.filter !== 'All';
              return (
                <Pressable
                  key={stat.label}
                  accessibilityRole="button"
                  onPress={() => {
                    if (stat.label.includes('Team')) {
                      navigation.navigate('TeamMembers');
                    } else {
                      navigation.navigate('Tasks', { filter: stat.filter });
                    }
                  }}
                  style={({ pressed }) => ({
                    flex: 1,
                    minWidth: 0,
                    minHeight: 50,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 8,
                    paddingHorizontal: 8,
                    paddingVertical: 7,
                    borderRadius: 9,
                    borderWidth: 1,
                    borderColor: stat.color + '26',
                    backgroundColor: stat.bg,
                    opacity: pressed ? 0.7 : 1,
                  })}
                >
                  <View style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: '#18181b', alignItems: 'center', justifyContent: 'center' }}>
                    <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: filled ? stat.color : '#18181b', alignItems: 'center', justifyContent: 'center' }}>
                      <Icon name={stat.filter === 'Overdue' ? 'alert' : stat.icon} size={14} color={filled ? '#fff' : stat.color} />
                    </View>
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={{ color: p.ink, fontSize: 16, lineHeight: 20, fontWeight: '700' }}>{stat.count}</Text>
                    <Text numberOfLines={1} style={{ color: p.muted, fontSize: 10, lineHeight: 13, fontWeight: '500' }}>{stat.label}</Text>
                  </View>
                  <Icon name="chevron-forward" size={14} color={stat.color} />
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>

      {manager && <DepartmentSection navigation={navigation} teams={teams} title="Departments" />}
      <View style={s.section}>
        <SectionTitle title={manager ? 'All Department Tasks' : 'Latest Tasks'} onPress={() => navigation.navigate('Tasks', { filter: 'All' })} />
        {latestTasks.map(task => <TaskRow key={task.id} task={task} home showAssignee={manager} onOpen={() => navigation.navigate('TaskDetails', { id: task.id })} />)}
        {!latestTasks.length && <Empty title="A fresh start" detail="Your assigned tasks will appear here." />}
        <Pressable accessibilityRole="button" onPress={() => navigation.navigate(isManagerLevel(user?.role) ? 'CreateTask' : 'MyDay')} style={[s.primary, { marginTop: 4 }]}>
          <Icon name="add" color="#fff" size={18} />
          <Text style={s.primaryText}>{isManagerLevel(user?.role) ? 'Create New Task' : 'Plan My Day'}</Text>
        </Pressable>
      </View>
      {!manager && (
        <View style={s.section}>
          <SectionTitle title="Completed Tasks" onPress={() => navigation.navigate('Tasks', { filter: 'Done' })} />
          {completedTasks.slice(0, 5).map(task => <TaskRow key={`completed-${task.id}`} task={task} home onOpen={() => navigation.navigate('TaskDetails', { id: task.id })} />)}
          {!completedTasks.length && <Empty title="No completed tasks yet" detail="Completed work will appear here." />}
        </View>
      )}
    </Page>
  );
}

export function TasksScreen({ navigation, route }: { navigation: Nav; route: { params?: { filter?: string } } }) {
  const { tasks } = useTaskr();
  const { user } = useAuth();
  const [filter, setFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);

  React.useEffect(() => {
    if (route.params?.filter) setFilter(route.params.filter);
  }, [route.params]);

  const visible = tasks.filter(t => (filter === 'All' || (filter === 'To Do' && t.status === 'pending') || (filter === 'In Progress' && t.status === 'in_progress') || (filter === 'Done' && t.status === 'completed') || (filter === 'Overdue' && t.effective_status === 'overdue')) && `${t.title} ${t.project_name} ${t.employee_department}`.toLowerCase().includes(search.toLowerCase()));

  return (
    <View style={s.screen}>
      <Page>
        <View style={s.between}>
          <View>
            <Text style={s.title}>{isManagerLevel(user?.role) ? 'Team Tasks' : 'My Tasks'}</Text>
            <Text style={s.subtitle}>Manage and track your work</Text>
          </View>
          <IconButton name="search-outline" label="Search tasks" onPress={() => setSearchOpen(!searchOpen)} tint={p.ink} />
        </View>
        {searchOpen && (
          <TextInput accessibilityLabel="Search tasks" placeholder="Search tasks or teams" placeholderTextColor={p.muted} value={search} onChangeText={setSearch} autoFocus style={s.input} />
        )}
        <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: p.line, marginTop: 6 }}>
          {['All', 'To Do', 'In Progress', 'Done'].map(tab => (
            <Pressable key={tab} accessibilityRole="tab" accessibilityState={{ selected: filter === tab }} onPress={() => setFilter(tab)} style={{ flex: tab === 'In Progress' ? 1.4 : 1, alignItems: 'center', paddingVertical: 10, borderBottomWidth: 2, borderBottomColor: filter === tab ? p.blue : 'transparent' }}>
              <Text style={{ color: filter === tab ? p.blue : p.muted, fontSize: 12.5, fontWeight: filter === tab ? '600' : '400' }}>{tab}</Text>
            </Pressable>
          ))}
        </View>
        {filter === 'Overdue' && (
          <Pressable onPress={() => setFilter('All')}>
            <Text style={[s.link, { fontSize: 11.5 }]}>Overdue tasks · Clear filter</Text>
          </Pressable>
        )}
        <View style={{ marginTop: -8, paddingBottom: 55 }}>
          {visible.map(task => <TaskRow task={task} key={task.id} onOpen={() => navigation.navigate('TaskDetails', { id: task.id })} />)}
          {!visible.length && <Empty title="No tasks here" detail={search ? 'Try another search.' : 'You’re all caught up in this view.'} />}
        </View>
      </Page>
      {isManagerLevel(user?.role) && (
        <Pressable accessibilityRole="button" accessibilityLabel="Create new task" onPress={() => navigation.navigate('CreateTask')} style={{ position: 'absolute', bottom: 20, right: 18, width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', backgroundColor: p.blue, elevation: 4, shadowColor: p.blue, shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } }}>
          <Icon name="add" color="#fff" size={24} />
        </Pressable>
      )}
    </View>
  );
}

export function TeamsScreen({ navigation }: { navigation: Nav }) {
  const teams = useTeams();
  const { user } = useAuth();
  const { directoryError } = useTaskr();

  return (
    <Page>
      <View style={s.between}>
        <View style={s.grow}>
          <Text style={s.title}>Teams</Text>
          <Text style={s.subtitle}>Work together, get things done.</Text>
        </View>
        {isManagerLevel(user?.role) && (
          <IconButton name="add" label="Manage team members" tint={p.blue} bg={p.blueLight} onPress={() => navigation.navigate('TeamMembers')} />
        )}
      </View>
      {directoryError && <Text style={{ color: p.red, fontSize: 12 }}>{directoryError}</Text>}
      <View style={[s.section, { marginTop: 4 }]}>
        {teams.map(team => {
          const style = teamStyle(team.name);
          return (
            <Pressable accessibilityRole="button" key={team.name} onPress={() => navigation.navigate('TeamDetails', { name: team.name })} style={[s.card, s.row, { padding: 10, minHeight: 56, gap: 10 }]}>
              <View style={{ width: 38, height: 38, backgroundColor: style.bg, borderRadius: 9, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name={style.icon} size={20} color={style.color} />
              </View>
              <View style={s.grow}>
                <Text style={s.body}>{team.name}</Text>
                <Text style={[s.muted, { marginTop: 2, fontSize: 11 }]}>{isManagerLevel(user?.role) ? `${team.members.length} members` : `${team.tasks.length} assigned tasks`}</Text>
              </View>
              <View style={{ flexDirection: 'row', paddingLeft: 4 }}>
                {team.members.slice(0, 3).map(member => (
                  <View key={member.id} style={{ marginLeft: -6, borderWidth: 1.5, borderColor: '#18181b', borderRadius: 16 }}>
                    <Avatar uri={member.profile_image} size={24} />
                  </View>
                ))}
              </View>
              <Icon name="chevron-forward" size={16} />
            </Pressable>
          );
        })}
      </View>
      {!teams.length && <Empty title="Your team starts here" detail="Add a department to your profile to see your team." />}
    </Page>
  );
}

export function TeamDetailsScreen({ navigation, route }: { navigation: Nav; route: { params: { name: string } } }) {
  const team = useTeams().find(t => t.name === route.params.name);
  return (
    <Page>
      <View style={[s.row, { gap: 8, marginBottom: 2 }]}>
        <IconButton name="chevron-back" label="Back to departments" bg={p.line} tint={p.ink} onPress={() => navigation.goBack()} />
        <View style={s.grow}>
          <Text style={[s.title, { fontSize: 18 }]}>{route.params.name}</Text>
          <Text style={s.subtitle}>Department overview</Text>
        </View>
      </View>
      <View style={[s.card, { padding: 12, marginTop: 6 }]}>
        <View style={[s.row, { gap: 10 }]}>
          <View style={{ width: 38, height: 38, borderRadius: 9, backgroundColor: teamStyle(route.params.name).bg, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name={teamStyle(route.params.name).icon} size={20} color={teamStyle(route.params.name).color} />
          </View>
          <View style={s.grow}>
            <Text style={s.body}>{team?.members.length || 0} members</Text>
            <Text style={[s.muted, { fontSize: 11 }]}>{team?.tasks.length || 0} assigned tasks</Text>
          </View>
        </View>
      </View>
      <View style={s.section}>
        <Text style={s.heading}>Members</Text>
        {team?.members.map(member => (
          <Pressable key={member.id} onPress={() => navigation.navigate('EmployeeDetail', { id: member.id, name: member.name })} style={[s.card, s.row, { padding: 10, marginTop: 6, gap: 10 }]}>
            <Avatar uri={member.profile_image} size={30} />
            <View style={s.grow}>
              <Text style={s.body}>{member.name}</Text>
              <Text style={[s.muted, { fontSize: 11 }]}>{member.job_title || 'Team member'}</Text>
            </View>
            <Icon name="chevron-forward" size={15} />
          </Pressable>
        ))}
        {!team?.members.length && <Text style={s.muted}>No members found in this department.</Text>}
      </View>
      <View style={s.section}>
        <Text style={s.heading}>Department Tasks</Text>
        {team?.tasks.map(task => <TaskRow key={task.id} task={task} home showAssignee onOpen={() => navigation.navigate('TaskDetails', { id: task.id })} />)}
        {!team?.tasks.length && <Empty title="No assigned tasks" detail="Tasks assigned to this department will appear here." />}
      </View>
    </Page>
  );
}

export function ProfileScreen({ navigation }: { navigation: Nav }) {
  const { user, logout } = useAuth();
  const { tasks } = useTaskr();
  const manager = isManagerLevel(user?.role);

  const items: { label: string; icon: IconName; color: string; bg: string; route?: string; action?: () => void }[] = [
    { label: 'My Tasks', icon: 'person-outline', color: p.blue, bg: p.blueLight, route: 'Tasks' },
    { label: 'My Team', icon: 'people', color: p.purple, bg: p.purpleLight, route: 'Teams' },
    { label: 'Notifications', icon: 'notifications-outline', color: p.red, bg: p.redLight, route: 'Notifications' },
    { label: 'Activity', icon: 'bar-chart', color: p.green, bg: p.greenLight, route: manager ? 'Analytics' : 'MyDay' },
    { label: 'Settings', icon: 'settings-outline', color: p.muted, bg: p.line, route: 'Settings' },
    { label: 'Logout', icon: 'log-out-outline', color: p.red, bg: p.redLight, action: () => void logout() },
  ];

  return (
    <Page>
      <View style={s.between}>
        <Text style={s.title}>Profile</Text>
        <IconButton name="settings-outline" label="Settings" onPress={() => navigation.navigate('Settings')} />
      </View>
      <View style={[s.row, { gap: 16, marginVertical: 3 }]}>
        <Pressable accessibilityRole="button" accessibilityLabel="Edit profile" onPress={() => navigation.navigate('Settings')}>
          <Avatar uri={user?.profile_image} size={60} />
          <View style={{ position: 'absolute', bottom: 0, right: -2, padding: 4, backgroundColor: p.blue, borderRadius: 12, borderWidth: 1.5, borderColor: '#18181b' }}>
            <Icon name="pencil" color="#fff" size={12} />
          </View>
        </Pressable>
        <View style={s.grow}>
          <Text style={[s.heading, { marginBottom: 3, fontSize: 16 }]}>{user?.name}</Text>
          <Text style={s.subtitle}>{user?.job_title || 'Team member'}</Text>
          <Text style={[s.subtitle, { marginTop: 1 }]}>{user?.department || 'Your team'}</Text>
        </View>
      </View>
      <View style={{ flexDirection: 'row', backgroundColor: p.blueLight, paddingVertical: 12, borderRadius: 9, borderWidth: 1, borderColor: p.line }}>
        {[
          { label: 'Assigned', count: tasks.length },
          { label: 'Completed', count: tasks.filter(t => t.status === 'completed').length },
          { label: 'In Progress', count: tasks.filter(t => t.status === 'in_progress').length },
        ].map((stat, index) => (
          <View key={stat.label} style={{ flex: 1, alignItems: 'center', gap: 2, borderLeftWidth: index ? 1 : 0, borderColor: p.line }}>
            <Text style={[s.heading, { fontSize: 16 }]}>{stat.count}</Text>
            <Text style={{ color: p.muted, fontSize: 11 }}>{stat.label}</Text>
          </View>
        ))}
      </View>
      <View style={s.section}>
        {items.map(item => (
          <Pressable key={item.label} accessibilityRole="button" onPress={item.action || (() => navigation.navigate(item.route!))} style={[s.card, s.row, { padding: 9, gap: 12, minHeight: 46 }]}>
            <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: item.bg, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name={item.icon} size={17} color={item.color} />
            </View>
            <Text style={[s.body, s.grow, { fontSize: 13 }]}>{item.label}</Text>
            <Icon name="chevron-forward" size={15} />
          </Pressable>
        ))}
      </View>
      <View style={[s.row, { flexWrap: 'wrap', justifyContent: 'center', gap: 16, marginTop: 4 }]}>
        <Pressable onPress={() => navigation.navigate('MyDay')}><Text style={[s.link, { fontSize: 12 }]}>My Day</Text></Pressable>
        {canAccessTickets(user) && <Pressable onPress={() => navigation.navigate(manager ? 'ManagerTickets' : 'Tickets')}><Text style={[s.link, { fontSize: 12 }]}>Tickets</Text></Pressable>}
        {manager && <Pressable onPress={() => navigation.navigate('TaskReports')}><Text style={[s.link, { fontSize: 12 }]}>Reports</Text></Pressable>}
      </View>
    </Page>
  );
}
