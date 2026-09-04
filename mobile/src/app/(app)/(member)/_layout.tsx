import { Tabs } from 'expo-router';
import { Bug, ClipboardCheck, House, LayoutGrid, ListChecks } from 'lucide-react-native';
import { FloatingTabBar, type TabSpec } from '@/components/FloatingTabBar';
import { useUnreadCount } from '@/hooks/useNotifications';
import { useTheme } from '@/theme';

const TABS: TabSpec[] = [
  { name: 'index', label: 'Home', icon: House },
  { name: 'tasks', label: 'Tasks', icon: ListChecks },
  { name: 'report', label: 'Report', icon: ClipboardCheck },
  { name: 'tickets', label: 'Tickets', icon: Bug },
  { name: 'more', label: 'More', icon: LayoutGrid },
];

export default function MemberTabs() {
  const t = useTheme();
  const unread = useUnreadCount();
  return (
    <Tabs
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: t.colors.ground }, lazy: true }}
      tabBar={(props) => <FloatingTabBar {...props} tabs={TABS} badges={{ more: unread.data ?? 0 }} />}
    >
      {TABS.map((tab) => <Tabs.Screen key={tab.name} name={tab.name} options={{ title: tab.label }} />)}
    </Tabs>
  );
}
