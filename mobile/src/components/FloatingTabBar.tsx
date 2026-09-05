import { useEffect } from 'react';
import { Platform, Pressable, View } from 'react-native';
import { MotiView } from 'moti';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { LucideIcon } from 'lucide-react-native';
import { alpha, useReducedMotion, useTheme, TAB_BAR_HEIGHT, TAB_BAR_INSET } from '@/theme';
import { useTabBarStore } from '@/lib/tabBar';
import { Text } from './Text';

export interface TabSpec {
  name: string;
  label: string;
  icon: LucideIcon;
}

/**
 * The slice of React Navigation's tab-bar props this component reads. Declared here
 * rather than imported: expo-router ships its own copy of the navigator types, and
 * importing the package's would make the two disagree.
 */
interface TabBarProps {
  state: { index: number; routes: { key: string; name: string }[] };
  navigation: {
    emit: (event: { type: 'tabPress'; target: string; canPreventDefault: true }) => { defaultPrevented: boolean };
    navigate: (name: string) => void;
  };
  tabs: TabSpec[];
  badges?: Record<string, number>;
}

/**
 * The floating pill. Frosted like mist — a blur where the platform gives one, and a
 * near-opaque tint everywhere so content never reads through it — with a soft fade
 * rising from the bottom edge so lists dissolve into it rather than slicing under.
 * Tucks away when you scroll down and returns when you scroll up.
 */
export function FloatingTabBar({ state, navigation, tabs, badges = {} }: TabBarProps) {
  const t = useTheme();
  const reduced = useReducedMotion();
  const insets = useSafeAreaInsets();
  const hidden = useTabBarStore((s) => s.hidden);
  const setHidden = useTabBarStore((s) => s.setHidden);
  const bottom = Math.max(insets.bottom, 12) + 12;
  const Bubble = reduced ? View : MotiView;

  // Changing tab always brings the bar back.
  useEffect(() => { setHidden(false); }, [state.index, setHidden]);

  const fadeHeight = TAB_BAR_HEIGHT + bottom + 28;
  // Driven straight through Reanimated so the slide runs on the UI thread on every platform.
  const offset = useSharedValue(0);
  useEffect(() => {
    const target = hidden ? fadeHeight + 8 : 0;
    offset.value = reduced ? withTiming(target, { duration: 0 }) : withSpring(target, { damping: 20, stiffness: 190, mass: 0.9 });
  }, [hidden, fadeHeight, reduced, offset]);
  const slide = useAnimatedStyle(() => ({ transform: [{ translateY: offset.value }] }));

  // Android has no live blur without a target view; lean on the tint there.
  const canBlur = Platform.OS === 'ios' || Platform.OS === 'web';
  const mist = t.isDark
    ? (canBlur ? 'rgba(14,14,16,0.72)' : 'rgba(18,18,20,0.96)')
    : (canBlur ? 'rgba(255,255,255,0.74)' : 'rgba(250,250,251,0.97)');
  return (
    <Animated.View pointerEvents="box-none" style={[{ position: 'absolute', left: 0, right: 0, bottom: 0 }, slide]}>
      {/* The mist: the ground rising into the bar so content dissolves underneath. */}
      <LinearGradient
        pointerEvents="none"
        colors={[alpha(t.colors.ground, 0), alpha(t.colors.ground, 0.9)]}
        style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: fadeHeight }}
      />
      <View pointerEvents="box-none" style={{ marginHorizontal: TAB_BAR_INSET, marginBottom: bottom }}>
        <View style={[{ borderRadius: 28, overflow: 'hidden', borderWidth: 1, borderColor: t.colors.glassBorder }, t.shadow.float]}>
          <BlurView intensity={canBlur ? (t.isDark ? 40 : 80) : 0} tint={t.isDark ? 'dark' : 'light'} style={{ backgroundColor: mist }}>
            <View style={{ flexDirection: 'row', height: TAB_BAR_HEIGHT, paddingHorizontal: 8, alignItems: 'center' }}>
              {state.routes.map((route, index) => {
                const spec = tabs.find((tab) => tab.name === route.name);
                if (!spec) return null;
                const focused = state.index === index;
                const Icon = spec.icon;
                const badge = badges[route.name];
                return (
                  <Pressable
                    key={route.key}
                    onPress={() => {
                      const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
                      if (!focused && !event.defaultPrevented) {
                        Haptics.selectionAsync().catch(() => {});
                        navigation.navigate(route.name);
                      }
                    }}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: focused }}
                    aria-selected={focused}
                    accessibilityLabel={spec.label}
                    style={{ flex: 1, alignItems: 'center', justifyContent: 'center', height: TAB_BAR_HEIGHT }}
                  >
                    <Bubble
                      animate={reduced ? undefined : {
                        backgroundColor: focused ? t.colors.pill : 'rgba(0,0,0,0)',
                        scale: focused ? 1 : 0.92,
                      }}
                      transition={{ type: 'spring', damping: 18, stiffness: 200 }}
                      style={[
                        { width: 48, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
                        reduced ? { backgroundColor: focused ? t.colors.pill : 'transparent' } : null,
                      ]}
                    >
                      <Icon size={20} color={focused ? t.colors.onPill : t.colors.inkMuted} strokeWidth={focused ? 2 : 1.6} />
                      {badge ? (
                        <View style={{ position: 'absolute', top: 4, right: 4, minWidth: 18, height: 18, paddingHorizontal: 4, borderRadius: 9, backgroundColor: t.colors.danger, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: focused ? t.colors.pill : t.colors.card }}>
                          <Text variant="caption" color={t.isDark ? t.colors.onAccent : '#FFFFFF'} style={{ letterSpacing: 0, fontSize: 10 }}>{badge > 99 ? '99+' : badge}</Text>
                        </View>
                      ) : null}
                    </Bubble>
                    <Text variant="caption" color={focused ? 'ink' : 'inkMuted'} style={{ fontSize: 10, lineHeight: 14, marginTop: 3 }}>{spec.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          </BlurView>
        </View>
      </View>
    </Animated.View>
  );
}
