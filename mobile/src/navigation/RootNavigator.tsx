import React from 'react';
import { EmployeeTabBar } from './EmployeeTabBar';
import { TaskrNavigator } from '../taskr/TaskrNavigator';
import { ManagerTabBar } from './ManagerTabBar';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useAuth } from '../context/AuthContext';
import { colors, borderRadius, typography } from '../theme';
import { isManagerLevel } from '../types';

// Auth Screens
import { LoginScreen } from '../screens/auth/LoginScreen';
import { ForgotPasswordScreen } from '../screens/auth/ForgotPasswordScreen';
import { SetPasswordScreen } from '../screens/auth/SetPasswordScreen';

// Common Screens
import { MyDayScreen } from '../screens/common/MyDayScreen';
import { NotificationsScreen } from '../screens/common/NotificationsScreen';
import { ProfileScreen } from '../screens/common/ProfileScreen';

// Employee Screens
import { EmployeeDashboardScreen } from '../screens/employee/EmployeeDashboardScreen';
import { TasksAssignedScreen } from '../screens/employee/TasksAssignedScreen';
import { TasksDoneScreen } from '../screens/employee/TasksDoneScreen';
import { TicketsScreen } from '../screens/employee/TicketsScreen';
import { ChatScreen } from '../taskr/ChatScreen';

// Manager Screens
import { ManagerDashboardScreen } from '../screens/manager/ManagerDashboardScreen';
import { TeamMembersScreen } from '../screens/manager/TeamMembersScreen';
import { EmployeeDetailScreen } from '../screens/manager/EmployeeDetailScreen';
import { AllTasksScreen } from '../screens/manager/AllTasksScreen';
import { TaskReportsScreen } from '../screens/manager/TaskReportsScreen';
import { ManagerTicketsScreen } from '../screens/manager/ManagerTicketsScreen';
import { AnalyticsScreen } from '../screens/manager/AnalyticsScreen';

// Icons
import {
  LayoutDashboard,
  CheckSquare,
  Ticket,
  Users,
  User,
  FileText,
} from '../components/Icon';

const AuthStack = createNativeStackNavigator();
const EmployeeTab = createBottomTabNavigator();
const ManagerTab = createBottomTabNavigator();
const RootStack = createNativeStackNavigator();

function AuthNavigator() {
  return (
    <AuthStack.Navigator screenOptions={{ headerShown: false }}>
      <AuthStack.Screen name="Login" component={LoginScreen} />
      <AuthStack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
      <AuthStack.Screen name="SetPassword" component={SetPasswordScreen} />
    </AuthStack.Navigator>
  );
}

function EmployeeNavigator() {
  return (
    <EmployeeTab.Navigator
      tabBar={(props) => <EmployeeTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: styles.tabBarLabel,
      }}
    >
      <EmployeeTab.Screen
        name="Dashboard"
        component={EmployeeDashboardScreen}
        options={{
          tabBarLabel: 'Dashboard',
          tabBarIcon: ({ color, size }) => <LayoutDashboard size={size} color={color} />,
        }}
      />
      <EmployeeTab.Screen
        name="TasksAssigned"
        component={TasksAssignedScreen}
        options={{
          tabBarLabel: 'Tasks',
          tabBarIcon: ({ color, size }) => <CheckSquare size={size} color={color} />,
        }}
      />
      <EmployeeTab.Screen name="Chat" component={ChatScreen} options={{ tabBarLabel: 'Chat' }} />
      <EmployeeTab.Screen
        name="Tickets"
        component={TicketsScreen}
        options={{
          tabBarLabel: 'Tickets',
          tabBarIcon: ({ color, size }) => <Ticket size={size} color={color} />,
        }}
      />
      <EmployeeTab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarLabel: 'Profile',
          tabBarIcon: ({ color, size }) => <User size={size} color={color} />,
        }}
      />
      {/* Hidden nested screen */}
      <EmployeeTab.Screen
        name="TasksDone"
        component={TasksDoneScreen}
        options={{ tabBarButton: () => null }}
      />
    </EmployeeTab.Navigator>
  );
}

function ManagerNavigator() {
  return (
    <ManagerTab.Navigator tabBar={(props) => <ManagerTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: styles.tabBarLabel,
      }}
    >
      <ManagerTab.Screen
        name="Dashboard"
        component={ManagerDashboardScreen}
        options={{
          tabBarLabel: 'Overview',
          tabBarIcon: ({ color, size }) => <LayoutDashboard size={size} color={color} />,
        }}
      />
      <ManagerTab.Screen
        name="TeamMembers"
        component={TeamMembersScreen}
        options={{
          tabBarLabel: 'Team',
          tabBarIcon: ({ color, size }) => <Users size={size} color={color} />,
        }}
      />
      <ManagerTab.Screen
        name="AllTasks"
        component={AllTasksScreen}
        options={{
          tabBarLabel: 'Tasks',
          tabBarIcon: ({ color, size }) => <CheckSquare size={size} color={color} />,
        }}
      />
      <ManagerTab.Screen
        name="MyDay"
        component={MyDayScreen}
        options={{ tabBarButton: () => null }}
      />
      <ManagerTab.Screen
        name="TaskReports"
        component={TaskReportsScreen}
        options={{
          tabBarLabel: 'Reports',
          tabBarIcon: ({ color, size }) => <FileText size={size} color={color} />,
        }}
      />
      <ManagerTab.Screen
        name="Analytics"
        component={AnalyticsScreen}
        options={{ tabBarButton: () => null }}
      />
      <ManagerTab.Screen
        name="ManagerTickets"
        component={ManagerTicketsScreen}
        options={{
          tabBarLabel: 'Tickets',
          tabBarIcon: ({ color, size }) => <Ticket size={size} color={color} />,
        }}
      />
      <ManagerTab.Screen
        name="Notifications"
        component={NotificationsScreen}
        options={{ tabBarButton: () => null }}
      />
      <ManagerTab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ tabBarButton: () => null }}
      />
      {/* Hidden nested screen */}
      <ManagerTab.Screen
        name="EmployeeDetail"
        component={EmployeeDetailScreen}
        options={{ tabBarButton: () => null }}
      />
    </ManagerTab.Navigator>
  );
}

export function RootNavigator() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <RootStack.Navigator screenOptions={{ headerShown: false }}>
        {!user ? (
          <RootStack.Screen name="Auth" component={AuthNavigator} />
        ) : isManagerLevel(user.role) ? (
          <RootStack.Screen name="ManagerPortal" component={TaskrNavigator} />
        ) : (
          <RootStack.Screen name="EmployeePortal" component={TaskrNavigator} />
        )}
      </RootStack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  tabBar: {
    backgroundColor: colors.card,
    borderTopColor: colors.cardBorder,
    borderTopWidth: 1,
    paddingTop: 4,
    height: 60,
  },
  tabBarLabel: {
    fontSize: 10,
    fontWeight: typography.weights.semibold,
    marginBottom: 4,
  },
  badge: {
    backgroundColor: colors.primary,
    fontSize: 10,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
  },
});


