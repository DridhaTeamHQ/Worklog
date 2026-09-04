import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Ellipse, G, Path } from 'react-native-svg';
import { MotiView } from 'moti';
import { useReducedMotion, useTheme } from '@/theme';

interface Props {
  variant?: 'orbits' | 'rings' | 'wave';
  /** Stroke opacity of the line-art. */
  opacity?: number;
  /** Gentle drift, on by default; off for static places. */
  animated?: boolean;
}

/**
 * The thin white line-art from the reference: rotated ellipses with node dots,
 * drifting very slowly. Absolutely positioned; the parent sets the size.
 */
export function OrbitArt({ variant = 'orbits', opacity = 1, animated: wantAnimated = true }: Props) {
  const t = useTheme();
  const animated = wantAnimated && !useReducedMotion();
  const stroke = t.colors.heroLine;
  const dot = t.colors.onHero;

  // "meet", not "slice": the drawing scales to the panel's width and sits at the top,
  // so a tall screen gets the same orbits as a short hero rather than a blown-up crop.
  const art = variant === 'rings' ? (
    <Svg width="100%" height="100%" viewBox="0 0 400 400" preserveAspectRatio="xMidYMin meet">
      <G opacity={opacity}>
        <Circle cx="300" cy="120" r="150" stroke={stroke} strokeWidth="1.4" fill="none" />
        <Circle cx="300" cy="120" r="105" stroke={stroke} strokeWidth="1.4" fill="none" />
        <Circle cx="300" cy="120" r="60" stroke={stroke} strokeWidth="1.4" fill="none" />
        <Circle cx="195" cy="120" r="5" fill={dot} />
        <Circle cx="405" cy="120" r="4" fill={dot} />
        <Circle cx="300" cy="15" r="3.5" fill={dot} />
      </G>
    </Svg>
  ) : variant === 'wave' ? (
    <Svg width="100%" height="100%" viewBox="0 0 400 200" preserveAspectRatio="none">
      <G opacity={opacity}>
        <Path d="M-20 140 C 60 60, 140 220, 220 120 S 380 40, 440 120" stroke={stroke} strokeWidth="1.4" fill="none" />
        <Path d="M-20 170 C 60 90, 140 250, 220 150 S 380 70, 440 150" stroke={stroke} strokeWidth="1.4" fill="none" />
        <Circle cx="220" cy="120" r="4.5" fill={dot} />
        <Circle cx="80" cy="118" r="3.5" fill={dot} />
      </G>
    </Svg>
  ) : (
    <Svg width="100%" height="100%" viewBox="0 0 400 400" preserveAspectRatio="xMidYMin meet">
      <G opacity={opacity}>
        <Ellipse cx="220" cy="180" rx="230" ry="95" transform="rotate(-24 220 180)" stroke={stroke} strokeWidth="1.4" fill="none" />
        <Ellipse cx="220" cy="180" rx="175" ry="70" transform="rotate(-24 220 180)" stroke={stroke} strokeWidth="1.4" fill="none" />
        <Ellipse cx="220" cy="180" rx="290" ry="120" transform="rotate(-24 220 180)" stroke={stroke} strokeWidth="1.2" fill="none" />
        <Circle cx="62" cy="262" r="5.5" fill={dot} />
        <Circle cx="372" cy="98" r="4.5" fill={dot} />
        <Circle cx="290" cy="290" r="3.5" fill={dot} />
        <Circle cx="120" cy="100" r="3" fill={dot} />
      </G>
    </Svg>
  );

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {animated ? (
        <MotiView
          style={StyleSheet.absoluteFill}
          from={{ translateX: -6, translateY: 4, scale: 1 }}
          animate={{ translateX: 6, translateY: -4, scale: 1.02 }}
          transition={{ type: 'timing', duration: 9000, loop: true, repeatReverse: true }}
        >
          {art}
        </MotiView>
      ) : art}
    </View>
  );
}
