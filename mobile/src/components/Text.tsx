import { Text as RNText, type TextProps as RNTextProps, type TextStyle } from 'react-native';
import { useTheme, type ColorName } from '@/theme';

export type TextVariant = keyof ReturnType<typeof useTheme>['type'];

export interface TextProps extends RNTextProps {
  variant?: TextVariant;
  /** A palette colour name, or any colour string. */
  color?: ColorName | (string & {});
  align?: TextStyle['textAlign'];
}

/**
 * The one text component. Every string on screen goes through here so the type scale
 * and the font stay consistent, and a colour can be named rather than hard-coded.
 */
export function Text({ variant = 'body', color = 'ink', align, style, ...rest }: TextProps) {
  const t = useTheme();
  const resolved = (t.colors as Record<string, string>)[color] ?? color;
  return (
    <RNText
      // Respect the OS text-size setting, but only so far: past ~1.15× the layouts start
      // clipping labels instead of helping anyone read them.
      maxFontSizeMultiplier={1.15}
      {...rest}
      style={[t.type[variant], { color: resolved }, align ? { textAlign: align } : null, style]}
    />
  );
}
