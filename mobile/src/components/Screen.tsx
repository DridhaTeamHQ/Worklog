import type { ReactNode } from 'react';
import { RefreshControl, ScrollView, View, type ScrollViewProps, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useTheme, TAB_BAR_HEIGHT, TAB_BAR_INSET } from '@/theme';
import { useAutoHideTabBar } from '@/lib/tabBar';

interface Props extends Omit<ScrollViewProps, 'children'> {
  children: ReactNode;
  /** Rendered flush under the status bar, before the padded content. */
  hero?: ReactNode;
  /** Plain View instead of a ScrollView — for screens that own a FlatList. */
  scroll?: boolean;
  padded?: boolean;
  /** Leave room for the floating tab bar (tab screens) or not (stack screens). */
  tabBar?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  /** Light status-bar icons over a hero, dark over the ground. */
  statusBar?: 'light' | 'dark' | 'auto';
  contentStyle?: ViewStyle;
}

/** Bottom padding that keeps content clear of the floating tab bar. */
export function useTabBarInset() {
  const insets = useSafeAreaInsets();
  return TAB_BAR_HEIGHT + TAB_BAR_INSET + Math.max(insets.bottom, 12) + 12;
}

/**
 * The page. Lavender ground, safe-area aware, an optional hero that bleeds under the
 * status bar, and the padding the floating tab bar needs. Every route uses it.
 */
export function Screen({
  children, hero, scroll = true, padded = true, tabBar = false, refreshing = false, onRefresh,
  statusBar = 'auto', contentStyle, ...rest
}: Props) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const tabInset = useTabBarInset();
  const bottom = tabBar ? tabInset : insets.bottom + t.spacing.xl;
  const bar = statusBar === 'auto' ? (hero ? 'light' : (t.isDark ? 'light' : 'dark')) : statusBar;
  const autoHide = useAutoHideTabBar();

  const body = (
    <>
      {hero}
      <View style={[
        padded ? { paddingHorizontal: t.spacing.screen } : null,
        { paddingTop: hero ? t.spacing.xxl : insets.top + t.spacing.sm, paddingBottom: bottom, gap: t.spacing.stack },
        contentStyle,
      ]}
      >
        {children}
      </View>
    </>
  );

  return (
    <View style={{ flex: 1, backgroundColor: t.colors.ground }}>
      <StatusBar style={bar} />
      {scroll ? (
        <ScrollView
          {...rest}
          onScroll={tabBar ? autoHide.onScroll : rest.onScroll}
          scrollEventThrottle={16}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentInsetAdjustmentBehavior="never"
          refreshControl={onRefresh ? (
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={hero ? t.colors.onHero : t.colors.hero}
              colors={[t.colors.hero]}
              progressViewOffset={hero ? insets.top : 0}
            />
          ) : undefined}
        >
          {body}
        </ScrollView>
      ) : (
        <View style={{ flex: 1 }}>{body}</View>
      )}
    </View>
  );
}
