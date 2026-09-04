import { forwardRef, useState, type ReactNode } from 'react';
import { Pressable, TextInput, View, type TextInputProps, type StyleProp, type ViewStyle } from 'react-native';
import { Eye, EyeOff, ChevronDown, type LucideIcon } from 'lucide-react-native';
import { useTheme } from '@/theme';
import { Text } from './Text';

interface FieldProps {
  label?: string;
  hint?: string;
  error?: string | null;
  required?: boolean;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}

/** Label above, hint or error below — the frame every input sits in. */
export function Field({ label, hint, error, required, children, style }: FieldProps) {
  return (
    <View style={[{ gap: 6 }, style]}>
      {label ? (
        <Text variant="smallStrong" color="inkMuted">
          {label}{required ? <Text variant="smallStrong" color="danger"> *</Text> : null}
        </Text>
      ) : null}
      {children}
      {error ? <Text variant="small" color="danger">{error}</Text>
        : hint ? <Text variant="small" color="inkFaint">{hint}</Text> : null}
    </View>
  );
}

interface TextFieldProps extends TextInputProps {
  label?: string;
  hint?: string;
  error?: string | null;
  required?: boolean;
  icon?: LucideIcon;
  /** Adds the eye toggle. */
  password?: boolean;
  containerStyle?: StyleProp<ViewStyle>;
}

/**
 * A rounded input on a soft field, with a highlighted border when focused. `multiline`
 * turns it into a text area that grows with its content.
 */
export const TextField = forwardRef<TextInput, TextFieldProps>(function TextField(
  { label, hint, error, required, icon: Icon, password, multiline, style, containerStyle, ...rest }, ref,
) {
  const t = useTheme();
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(Boolean(password));
  const borderColor = error ? t.colors.danger : focused ? t.colors.hero : t.colors.border;
  return (
    <Field label={label} hint={hint} error={error} required={required} style={containerStyle}>
      <View style={{
        flexDirection: 'row', alignItems: multiline ? 'flex-start' : 'center', gap: 10,
        backgroundColor: t.colors.cardAlt, borderRadius: t.radius.md, borderWidth: 1,
        borderColor: focused || error ? borderColor : 'transparent',
        paddingHorizontal: 14, minHeight: multiline ? 112 : 50, paddingVertical: multiline ? 12 : 0,
      }}
      >
        {Icon ? <Icon size={18} color={focused ? t.colors.hero : t.colors.inkFaint} style={multiline ? { marginTop: 2 } : undefined} /> : null}
        <TextInput
          maxFontSizeMultiplier={1.15}
          ref={ref}
          {...rest}
          multiline={multiline}
          secureTextEntry={hidden}
          onFocus={(e) => { setFocused(true); rest.onFocus?.(e); }}
          onBlur={(e) => { setFocused(false); rest.onBlur?.(e); }}
          placeholderTextColor={t.colors.inkFaint}
          style={[
            { flex: 1, color: t.colors.ink, fontFamily: t.fonts.medium, fontSize: 15, paddingVertical: 0, textAlignVertical: multiline ? 'top' : 'center' },
            multiline ? { minHeight: 88, lineHeight: 22 } : { height: 48 },
            style,
          ]}
        />
        {password ? (
          <Pressable onPress={() => setHidden((h) => !h)} hitSlop={8} accessibilityLabel={hidden ? 'Show password' : 'Hide password'}>
            {hidden ? <Eye size={18} color={t.colors.inkFaint} /> : <EyeOff size={18} color={t.colors.inkFaint} />}
          </Pressable>
        ) : null}
      </View>
    </Field>
  );
});

interface PickerFieldProps {
  label?: string;
  hint?: string;
  error?: string | null;
  required?: boolean;
  value?: string | null;
  placeholder?: string;
  icon?: LucideIcon;
  onPress: () => void;
  disabled?: boolean;
  right?: ReactNode;
}

/** Looks like a TextField, opens a sheet. The phone's replacement for a <select>. */
export function PickerField({ label, hint, error, required, value, placeholder = 'Choose…', icon: Icon, onPress, disabled, right }: PickerFieldProps) {
  const t = useTheme();
  return (
    <Field label={label} hint={hint} error={error} required={required}>
      <Pressable
        onPress={onPress}
        disabled={disabled}
        accessibilityRole="button"
        style={({ pressed }) => ({
          flexDirection: 'row', alignItems: 'center', gap: 10,
          backgroundColor: pressed ? t.colors.neutralSoft : t.colors.cardAlt, borderRadius: t.radius.md,
          borderWidth: 1, borderColor: error ? t.colors.danger : 'transparent',
          paddingHorizontal: 14, height: 50, opacity: disabled ? 0.55 : 1,
        })}
      >
        {Icon ? <Icon size={18} color={t.colors.inkFaint} /> : null}
        <Text variant="body" color={value ? 'ink' : 'inkFaint'} style={{ flex: 1 }} numberOfLines={1}>{value || placeholder}</Text>
        {right ?? <ChevronDown size={18} color={t.colors.inkFaint} />}
      </Pressable>
    </Field>
  );
}
