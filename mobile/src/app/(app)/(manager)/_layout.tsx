import { Tabs } from 'expo-router';
import { Bug, House, LayoutGrid, ListChecks, Users } from 'lucide-react-native';
import { FloatingTabBar, type TabSpec } from '@/components/FloatingTabBar';
import { useUnreadCount } from '@/hooks/useNotifications';
import { useReducedMotion, useTheme } from '@/theme';

const TABS: TabSpec[] = [
  { name: 'index', label: 'Home', icon: House },
  { name: 'tasks', label: 'Tasks', icon: ListChecks },
  { name: 'team', label: 'Team', icon: Users },
  { name: 'tickets', label: 'Tickets', icon: Bug },
  { name: 'more', label: 'More', icon: LayoutGrid },
];

export default function ManagerTabs() {
  const t = useTheme();
  const reduced = useReducedMotion();
  const unread = useUnreadCount();
  return (
    <Tabs
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: t.colors.ground }, lazy: true, animation: reduced ? 'none' : 'fade', transitionSpec: { animation: 'timing', config: { duration: 180 } } }}
      tabBar={(props) => <FloatingTabBar {...props} tabs={TABS} badges={{ more: unread.data ?? 0 }} />}
    >
      {TABS.map((tab) => <Tabs.Screen key={tab.name} name={tab.name} options={{ title: tab.label }} />)}
    </Tabs>
  );
}
