import type { ReactNode } from 'react';
import { View, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/theme';
import { OrbitArt } from './OrbitArt';

interface Props {
  children: ReactNode;
  art?: 'orbits' | 'rings' | 'wave' | 'none';
  /** Bleed under the status bar (true for the first thing on a screen). */
  safeTop?: boolean;
  /** Rounded bottom corners, like a card sitting on the ground. */
  curved?: boolean;
  minHeight?: number;
  style?: ViewStyle;
}

/**
 * The blue hero from the reference: a periwinkle gradient with line-art orbits, big
 * white type on top. Used as the top of a tab screen and as the auth backdrop.
 */
export function HeroPanel({ children, art = 'orbits', safeTop = true, curved = true, minHeight, style }: Props) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[
        {
          overflow: 'hidden',
          minHeight,
          borderBottomLeftRadius: curved ? t.radius.xxl : 0,
          borderBottomRightRadius: curved ? t.radius.xxl : 0,
          paddingTop: (safeTop ? insets.top : 0) + t.spacing.lg,
          paddingHorizontal: t.spacing.screen,
          paddingBottom: t.spacing.xxl,
        },
        t.isDark ? null : t.shadow.hero,
        style,
      ]}
    >
      <LinearGradient
        colors={[t.colors.heroSoft, t.colors.hero, t.colors.heroDeep]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      />
      {art !== 'none' ? <OrbitArt variant={art} /> : null}
      <View style={{ gap: t.spacing.md }}>{children}</View>
    </View>
  );
}
