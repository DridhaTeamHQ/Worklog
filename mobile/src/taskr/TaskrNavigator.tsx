import React, { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { createBottomTabNavigator, BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { TaskrProvider } from './TaskrContext';
import { HomeScreen, TasksScreen, TeamDetailsScreen } from './Screens';
import { ChatScreen } from './ChatScreen';
import { ChatThreadScreen } from './ChatThreadScreen';
import { CreateTaskScreen, TaskDetailsScreen } from './TaskScreens';
import { Icon, IconName } from './components';
import { palette as p } from './theme';
import { ProfileScreen as AccountProfileScreen } from '../screens/common/ProfileScreen';
import { MyDayScreen } from '../screens/common/MyDayScreen';
import { NotificationsScreen } from '../screens/common/NotificationsScreen';
import { TicketsScreen } from '../screens/employee/TicketsScreen';
import { TasksDoneScreen } from '../screens/employee/TasksDoneScreen';
import { TeamMembersScreen } from '../screens/manager/TeamMembersScreen';
import { EmployeeDetailScreen } from '../screens/manager/EmployeeDetailScreen';
import { TaskReportsScreen } from '../screens/manager/TaskReportsScreen';
import { ManagerTicketsScreen } from '../screens/manager/ManagerTicketsScreen';
import { AnalyticsScreen } from '../screens/manager/AnalyticsScreen';
import { useAuth } from '../context/AuthContext';
import { isManagerLevel } from '../types';

type TabParams = { Home: undefined; Tasks: { filter?: string } | undefined; Chat: undefined; Tickets: undefined; Profile: undefined };
type StackParams = { Main: undefined; TaskDetails: { id: number }; CreateTask: undefined; TeamDetails: { name: string }; Profile: undefined; MyDay: undefined; Notifications: undefined; Tickets: undefined; TasksDone: undefined; TeamMembers: undefined; EmployeeDetail: { id: number; name?: string }; TaskReports: undefined; ManagerTickets: undefined; Analytics: undefined; ChatThread: { contact?: any; group?: any; teamRoom?: boolean } };
const Tabs = createBottomTabNavigator<TabParams>();
const Stack = createNativeStackNavigator<StackParams>();
const tabIcons: Record<string, [IconName, IconName]> = { Home: ['home-outline', 'home'], Tasks: ['clipboard-outline', 'clipboard'], Chat: ['chatbubbles-outline', 'chatbubbles'], Tickets: ['help-circle-outline', 'help-circle'], Profile: ['person-outline', 'person'] };
function TaskrTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const [containerWidth, setContainerWidth] = useState(0);
  const paddingH = 6;
  const innerWidth = Math.max(0, containerWidth - paddingH * 2);
  const tabWidth = innerWidth > 0 ? innerWidth / state.routes.length : 0;
  const translateX = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (tabWidth > 0) {
      Animated.spring(translateX, {
        toValue: state.index * tabWidth,
        useNativeDriver: true,
        damping: 17,
        stiffness: 190,
        mass: 0.75,
      }).start();
    }
  }, [state.index, tabWidth]);

  return (
    <View
      style={[
        tabStyles.wrapper,
        {
          paddingBottom: Math.max(insets.bottom, 16) + 6,
        },
      ]}
    >
      <View
        onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}
        style={tabStyles.dock}
      >
        {tabWidth > 0 && (
          <Animated.View
            style={[
              tabStyles.slidingIndicator,
              {
                width: tabWidth - 6,
                transform: [
                  {
                    translateX: Animated.add(translateX, new Animated.Value(paddingH + 3)),
                  },
                ],
              },
            ]}
          />
        )}
        {state.routes.map((route, index) => {
          const active = state.index === index;
          return (
            <Pressable
              key={route.key}
              accessibilityRole="tab"
              accessibilityLabel={route.name}
              accessibilityState={{ selected: active }}
              onPress={() => {
                const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
                if (!event.defaultPrevented) navigation.navigate(route.name);
              }}
              onLongPress={() => navigation.emit({ type: 'tabLongPress', target: route.key })}
              style={({ pressed }) => [
                tabStyles.tabItem,
                pressed && tabStyles.tabPressed,
              ]}
            >
              <Icon
                name={tabIcons[route.name][active ? 1 : 0]}
                size={18}
                color={active ? p.coral : p.muted}
              />
              <Text
                style={{
                  color: active ? p.coral : p.muted,
                  fontSize: 9.5,
                  fontWeight: active ? '700' : '500',
                  marginTop: 2,
                }}
              >
                {route.name}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const tabStyles = StyleSheet.create({
  wrapper: {
    backgroundColor: p.canvas,
    paddingHorizontal: 16,
    paddingTop: 4,
  },
  dock: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#18181b',
    borderRadius: 20,
    paddingVertical: 3,
    paddingHorizontal: 4,
    borderWidth: 1,
    borderColor: p.line,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 6,
  },
  slidingIndicator: {
    position: 'absolute',
    top: 3,
    bottom: 3,
    borderRadius: 16,
    backgroundColor: 'rgba(244, 85, 60, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(244, 85, 60, 0.40)',
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 40,
    zIndex: 1,
  },
  tabPressed: {
    opacity: 0.7,
  },
});
function TicketsTab(props: any) { const { user } = useAuth(); return isManagerLevel(user?.role) ? <ManagerTicketsScreen {...props} /> : <TicketsScreen {...props} />; }
function MainTabs() { return <Tabs.Navigator tabBar={props => <TaskrTabBar {...props} />} screenOptions={{ headerShown: false }}><Tabs.Screen name="Home" component={HomeScreen} /><Tabs.Screen name="Tasks" component={TasksScreen} /><Tabs.Screen name="Chat" component={ChatScreen} /><Tabs.Screen name="Tickets" component={TicketsTab} /><Tabs.Screen name="Profile" component={AccountProfileScreen} /></Tabs.Navigator>; }
export function TaskrNavigator() {
  const { user } = useAuth();
  return <TaskrProvider><Stack.Navigator screenOptions={{ headerStyle: { backgroundColor: '#18181b' }, headerTintColor: p.ink, headerShadowVisible: false, contentStyle: { backgroundColor: p.canvas } }}>
    <Stack.Screen name="Main" component={MainTabs} options={{ headerShown: false }} />
    <Stack.Screen name="TaskDetails" component={TaskDetailsScreen} options={{ headerShown: false }} />
    <Stack.Screen name="CreateTask" component={CreateTaskScreen} options={{ headerShown: false }} />
    <Stack.Screen name="TeamDetails" component={TeamDetailsScreen} options={{ headerShown: false }} />
    <Stack.Screen name="Profile" component={AccountProfileScreen} options={{ headerShown: false }} />
    <Stack.Screen name="MyDay" component={MyDayScreen} options={{ headerShown: false }} />
    <Stack.Screen name="ChatThread" component={ChatThreadScreen} options={{ headerShown: false }} />
    <Stack.Screen name="Notifications" component={NotificationsScreen} />
    <Stack.Screen name="EmployeeDetail" component={EmployeeDetailScreen} options={{ headerShown: false }} />
    <Stack.Screen name="TasksDone" component={TasksDoneScreen} options={{ title: 'Completed Tasks' }} />
    {isManagerLevel(user?.role) ? <>
      <Stack.Screen name="TeamMembers" component={TeamMembersScreen} options={{ title: 'Team Members' }} />
      <Stack.Screen name="TaskReports" component={TaskReportsScreen} options={{ title: 'Reports' }} />
      <Stack.Screen name="ManagerTickets" component={ManagerTicketsScreen} options={{ title: 'Tickets' }} />
      <Stack.Screen name="Analytics" component={AnalyticsScreen} options={{ headerShown: false }} />
    </> : <Stack.Screen name="Tickets" component={TicketsScreen} />}
  </Stack.Navigator></TaskrProvider>;
}
