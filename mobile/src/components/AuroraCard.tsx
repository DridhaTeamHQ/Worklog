import { useId, type ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { MotiView } from 'moti';
import { useReducedMotion, useTheme } from '@/theme';

export type AuroraTone = 'sage' | 'rose' | 'iris' | 'clay';
const MATERIALS = {
  sage: { edge: ['#57766C', '#263B38', '#759082'], core: '#090F19' },
  rose: { edge: ['#423C52', '#754C62', '#AE727B'], core: '#392338' },
  iris: { edge: ['#354D84', '#1B254A', '#6176AE'], core: '#090D20' },
  clay: { edge: ['#754634', '#683E42', '#A26655'], core: '#29223F' },
} as const;

/** A native, resolution-independent material. The tint is decorative; content stays live. */
export function AuroraSurface({ tone = 'sage' }: { tone?: AuroraTone }) {
  const id = `aurora${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const material = MATERIALS[tone];
  return (
    <View pointerEvents="none" accessible={false} style={StyleSheet.absoluteFill}>
      <LinearGradient colors={material.edge} start={{ x: 0, y: 0 }} end={{ x: 0.85, y: 1 }} style={StyleSheet.absoluteFill} />
      <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
        <Defs>
          <RadialGradient id={id} cx="57%" cy="46%" rx="66%" ry="62%">
            <Stop offset="0" stopColor={material.core} stopOpacity="0.96" />
            <Stop offset="0.34" stopColor={material.core} stopOpacity="0.85" />
            <Stop offset="1" stopColor={material.core} stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Rect width="100%" height="100%" fill={`url(#${id})`} />
      </Svg>
    </View>
  );
}

export function AuroraCard({ children, tone = 'sage', onPress, accessibilityLabel, style }: {
  children: ReactNode;
  tone?: AuroraTone;
  onPress?: () => void;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const t = useTheme();
  const reduced = useReducedMotion();
  const surface = (pressed: boolean) => (
    <MotiView
      animate={{ scale: pressed && !reduced ? 0.975 : 1, opacity: pressed ? 0.9 : 1 }}
      transition={reduced ? { type: 'timing', duration: 0 } : { type: 'spring', damping: 22, stiffness: 320, mass: 0.7 }}
      style={[{ flex: 1, borderRadius: t.radius.xl, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)', padding: 20 }, style]}>
      <AuroraSurface tone={tone} />
      {children}
    </MotiView>
  );
  if (!onPress) return surface(false);
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel} onPress={() => {
      Haptics.selectionAsync().catch(() => {});
      onPress();
    }} style={{ flex: 1 }}>
      {({ pressed }) => surface(pressed)}
    </Pressable>
  );
}
