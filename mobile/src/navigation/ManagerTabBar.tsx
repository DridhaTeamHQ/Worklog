import React, { createContext, useContext, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useNotifications } from '../context/NotificationContext';
import { useAuth } from '../context/AuthContext';
import { colors } from '../theme';

type Icon = React.ComponentProps<typeof Ionicons>['name'];
const primary: { route: string; label: string; icon: Icon; active: Icon }[] = [
  { route: 'Dashboard', label: 'Dashboard', icon: 'home-outline', active: 'home' },
  { route: 'TeamMembers', label: 'Team', icon: 'people-outline', active: 'people' },
  { route: 'AllTasks', label: 'Tasks', icon: 'checkbox-outline', active: 'checkbox' },
  { route: 'TaskReports', label: 'Reports', icon: 'document-text-outline', active: 'document-text' },
  { route: 'ManagerTickets', label: 'Tickets', icon: 'ticket-outline', active: 'ticket' },
];
const extra: { route: string; label: string; icon: Icon }[] = [
  { route: 'MyDay', label: 'My Day', icon: 'sunny-outline' },
  { route: 'Analytics', label: 'Analytics', icon: 'bar-chart-outline' },
  { route: 'Notifications', label: 'Notifications', icon: 'notifications-outline' },
  { route: 'Profile', label: 'Profile & settings', icon: 'person-circle-outline' },
];
const MenuContext = createContext({ openMenu: () => {}, closeMenu: () => {}, visible: false });
export const useManagerMenu = () => useContext(MenuContext);
export function ManagerMenuProvider({ children }: { children: React.ReactNode }) {
  const [visible, setVisible] = useState(false);
  return <MenuContext.Provider value={{ visible, openMenu: () => setVisible(true), closeMenu: () => setVisible(false) }}>{children}</MenuContext.Provider>;
}

export function ManagerTabBar({ state, navigation }: BottomTabBarProps) {
  const { visible, closeMenu } = useManagerMenu();
  const insets = useSafeAreaInsets();
  const { unreadCount } = useNotifications();
  const { user } = useAuth();
  const current = state.routes[state.index].name;
  const selected = current === 'EmployeeDetail' ? 'TeamMembers' : current;
  const go = (name: string) => {
    const route = state.routes.find(item => item.name === name);
    if (!route) return;
    const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
    if (!event.defaultPrevented) { closeMenu(); navigation.navigate(name); }
  };
  return <>
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 10), paddingLeft: insets.left, paddingRight: insets.right }]}>
      {primary.map(item => {
        const active = selected === item.route;
        return <Pressable key={item.route} accessibilityRole="tab" accessibilityLabel={item.label} accessibilityState={{ selected: active }}
          onPress={() => go(item.route)} onLongPress={() => { const route = state.routes.find(r => r.name === item.route); if (route) navigation.emit({ type: 'tabLongPress', target: route.key }); }}
          style={({ pressed }) => [styles.tab, active && styles.activeTab, pressed && styles.pressed]}>
          <View style={[styles.iconWrap, active && styles.activeIconWrap]}><Ionicons name={active ? item.active : item.icon} size={21} color={active ? colors.primary : colors.textMuted} /></View>
          <Text numberOfLines={1} style={[styles.label, active && styles.active]}>{item.label}</Text>
        </Pressable>;
      })}
    </View>
    <Modal transparent visible={visible} animationType="fade" onRequestClose={closeMenu}>
      <View style={styles.overlay}>
        <Pressable accessibilityRole="button" accessibilityLabel="Close navigation menu" onPress={closeMenu} style={StyleSheet.absoluteFill} />
        <View accessibilityViewIsModal style={[styles.drawer, { paddingTop: Math.max(insets.top, 20), paddingBottom: Math.max(insets.bottom, 20) }]}>
          <View style={styles.menuHeader}><Text style={styles.menuTitle}>Workspace</Text><Pressable accessibilityRole="button" accessibilityLabel="Close menu" onPress={closeMenu} style={styles.close}><Ionicons name="close-outline" size={28} color={colors.text} /></Pressable></View>
          <Pressable accessibilityRole="button" accessibilityLabel="Open profile and settings" onPress={() => go('Profile')} style={({ pressed }) => [styles.identityCard, pressed && styles.pressed]}>
            <View style={styles.identityAvatar}><Text style={styles.identityInitials}>{user?.name?.trim().split(/\s+/).map(part => part[0]).slice(0, 2).join('').toUpperCase() || 'U'}</Text><View style={styles.onlineDot} /></View>
            <View style={styles.identityText}><Text style={styles.identityName} numberOfLines={1}>{user?.name || 'Admin user'}</Text><Text style={styles.identityEmail} numberOfLines={1}>{user?.email || 'Account settings'}</Text><View style={styles.rolePill}><Text style={styles.roleText}>{user?.role === 'admin' ? 'ADMIN' : 'MANAGER'}</Text></View></View>
            <Ionicons name="chevron-forward-outline" size={18} color={colors.textMuted} />
          </Pressable>
          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={styles.section}>MANAGE</Text>
            {extra.map((item) => <React.Fragment key={item.route}>
              <Pressable accessibilityRole="button" accessibilityState={{ selected: selected === item.route }} onPress={() => go(item.route)} style={({ pressed }) => [styles.menuItem, selected === item.route && styles.selectedItem, pressed && styles.pressed]}>
                <Ionicons name={item.icon} size={23} color={selected === item.route ? colors.primary : colors.textSecondary} />
                <Text style={[styles.menuLabel, selected === item.route && styles.active]}>{item.label}</Text>
                {item.route === 'Notifications' && unreadCount > 0 ? <Text style={styles.badge}>{unreadCount > 99 ? '99+' : unreadCount}</Text> : <Ionicons name="chevron-forward-outline" size={17} color={colors.textMuted} />}
              </Pressable>
            </React.Fragment>)}
          </ScrollView>
        </View>
      </View>
    </Modal>
  </>;
}
const styles = StyleSheet.create({
  bar: { flexDirection: 'row', backgroundColor: colors.card, borderTopWidth: 1, borderTopColor: colors.cardBorder, paddingTop: 8, paddingHorizontal: 6 },
  tab: { flex: 1, minWidth: 0, height: 56, marginHorizontal: 2, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  activeTab: { backgroundColor: colors.primaryLight },
  iconWrap: { width: 30, height: 27, alignItems: 'center', justifyContent: 'center', marginBottom: 3 },
  activeIconWrap: {},
  label: { color: colors.textMuted, fontSize: 10, lineHeight: 13, height: 13, fontWeight: '600', textAlign: 'center' },
  active: { color: colors.primary },
  pressed: { opacity: 0.6 },
  notificationDot: { position: 'absolute', right: -3, top: 0, width: 6, height: 6, borderRadius: 3, backgroundColor: colors.primary },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)' },
  drawer: { width: '86%', maxWidth: 360, height: '100%', backgroundColor: colors.background, paddingHorizontal: 18, borderRightWidth: 1, borderRightColor: colors.cardBorder },
  menuHeader: { flexDirection: 'row', alignItems: 'center', paddingBottom: 16 },
  menuTitle: { color: colors.text, fontWeight: '700', fontSize: 26, letterSpacing: -0.5 },
  name: { color: colors.textSecondary, fontSize: 13, marginTop: 6 },
  close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  identityCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 13, marginBottom: 24, borderRadius: 14, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.cardBorder },
  identityAvatar: { width: 48, height: 48, borderRadius: 14, backgroundColor: colors.primaryLight, alignItems: 'center', justifyContent: 'center' },
  identityInitials: { color: colors.primary, fontSize: 17, fontWeight: '800' },
  onlineDot: { position: 'absolute', right: -1, bottom: -1, width: 12, height: 12, borderRadius: 6, backgroundColor: '#45d483', borderWidth: 2, borderColor: colors.card },
  identityText: { flex: 1, gap: 2 },
  identityName: { color: colors.text, fontSize: 14, fontWeight: '700' },
  identityEmail: { color: colors.textMuted, fontSize: 11 },
  rolePill: { alignSelf: 'flex-start', marginTop: 3, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5, backgroundColor: colors.primaryLight },
  roleText: { color: colors.primary, fontSize: 9, fontWeight: '800', letterSpacing: 1 },
  section: { color: colors.textMuted, fontSize: 10, fontWeight: '800', letterSpacing: 1.5, marginBottom: 10 },
  extraSection: { borderTopWidth: 1, borderTopColor: colors.cardBorder, paddingTop: 22, marginTop: 18 },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 13, padding: 13, minHeight: 52, borderRadius: 12, marginBottom: 4 },
  selectedItem: { backgroundColor: colors.primaryLight },
  menuLabel: { flex: 1, color: colors.textSecondary, fontSize: 15, fontWeight: '500' },
  badge: { backgroundColor: colors.primary, color: colors.white, fontSize: 11, fontWeight: '700', borderRadius: 10, paddingHorizontal: 6, paddingVertical: 3 },
});

