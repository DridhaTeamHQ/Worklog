import React, { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useNotifications } from '../context/NotificationContext';
import { colors } from '../theme';

type IconName = React.ComponentProps<typeof Ionicons>['name'];
const tabs: { route: string; label: string; icon: IconName; activeIcon: IconName }[] = [
  { route: 'Dashboard', label: 'Home', icon: 'home-outline', activeIcon: 'home' },
  { route: 'TasksAssigned', label: 'Tasks', icon: 'checkbox-outline', activeIcon: 'checkbox' },
  { route: 'Chat', label: 'Chat', icon: 'chatbubbles-outline', activeIcon: 'chatbubbles' },
  { route: 'Tickets', label: 'Tickets', icon: 'ticket-outline', activeIcon: 'ticket' },
  { route: 'Profile', label: 'Profile', icon: 'person-outline', activeIcon: 'person' },
];

export function EmployeeTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const currentRoute = state.routes[state.index];
  const { options } = descriptors[currentRoute.key];
  if ((options?.tabBarStyle as any)?.display === 'none') {
    return null;
  }
  const insets = useSafeAreaInsets();
  const { unreadCount } = useNotifications();
  const current = state.routes[state.index].name;
  const selected = current === 'TasksDone' ? 'TasksAssigned' : current;
  const selectedIndex = tabs.findIndex(tab => tab.route === selected);

  const [containerWidth, setContainerWidth] = useState(0);
  const paddingH = 6;
  const innerWidth = Math.max(0, containerWidth - paddingH * 2);
  const tabWidth = innerWidth > 0 ? innerWidth / tabs.length : 0;
  const translateX = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (tabWidth > 0 && selectedIndex >= 0) {
      Animated.spring(translateX, {
        toValue: selectedIndex * tabWidth,
        useNativeDriver: true,
        damping: 17,
        stiffness: 190,
        mass: 0.75,
      }).start();
    }
  }, [selectedIndex, tabWidth]);

  return (
    <View
      style={[
        styles.wrapper,
        {
          paddingBottom: Math.max(insets.bottom, 16) + 6,
        },
      ]}
    >
      <View
        onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}
        style={styles.dock}
      >
        {tabWidth > 0 && selectedIndex >= 0 && (
          <Animated.View
            style={[
              styles.slidingIndicator,
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

        {tabs.map((tab) => {
          const route = state.routes.find((item) => item.name === tab.route);
          if (!route) return null;
          const active = selected === tab.route;
          const count = tab.route === 'Notifications' ? unreadCount : 0;

          return (
            <Pressable
              key={tab.route}
              accessibilityRole="tab"
              accessibilityLabel={`${tab.label}${count > 0 ? `, ${count} unread notifications` : ''}`}
              accessibilityState={{ selected: active }}
              onPress={() => {
                const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
                if (!event.defaultPrevented) navigation.navigate(tab.route);
              }}
              onLongPress={() => navigation.emit({ type: 'tabLongPress', target: route.key })}
              style={({ pressed }) => [styles.tab, pressed && styles.pressed]}
            >
              <View style={styles.icon}>
                <Ionicons
                  name={active ? tab.activeIcon : tab.icon}
                  size={18}
                  color={active ? colors.primary : colors.textMuted}
                />
                {count > 0 && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{count > 99 ? '99+' : count}</Text>
                  </View>
                )}
              </View>
              <Text numberOfLines={1} style={[styles.label, active && styles.active]}>
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: colors.background,
    paddingHorizontal: 16,
    paddingTop: 4,
  },
  dock: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 20,
    paddingVertical: 3,
    paddingHorizontal: 4,
    borderWidth: 1,
    borderColor: colors.cardBorder,
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
  tab: {
    flex: 1,
    minWidth: 0,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    zIndex: 1,
  },
  icon: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    color: colors.textMuted,
    fontSize: 9.5,
    fontWeight: '500',
    marginTop: 1,
  },
  active: {
    color: colors.primary,
    fontWeight: '700',
  },
  pressed: {
    opacity: 0.7,
  },
  badge: {
    position: 'absolute',
    top: -5,
    right: -9,
    minWidth: 17,
    borderRadius: 10,
    paddingHorizontal: 4,
    paddingVertical: 1,
    backgroundColor: colors.primary,
    borderWidth: 1,
    borderColor: colors.card,
  },
  badgeText: {
    color: colors.white,
    fontSize: 9,
    fontWeight: '700',
    textAlign: 'center',
  },
});
