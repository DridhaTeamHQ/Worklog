import { useEffect, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { Spinner } from './Loaders';
import { Search, X } from 'lucide-react-native';
import { useTheme } from '@/theme';
import { useDebounce } from '@/hooks/useDebounce';

interface Props {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  loading?: boolean;
  /** Debounce before `onChange` fires; 0 to fire on every keystroke. */
  delay?: number;
  autoFocus?: boolean;
}

/** A rounded search field that debounces its value and clears with one tap. */
export function SearchField({ value, onChange, placeholder = 'Search', loading, delay = 300, autoFocus }: Props) {
  const t = useTheme();
  const [text, setText] = useState(value);
  const debounced = useDebounce(text, delay);
  useEffect(() => { if (debounced !== value) onChange(debounced); }, [debounced]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setText(value); }, [value]);

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: t.isDark ? t.colors.card : t.colors.card, borderRadius: t.radius.md, paddingHorizontal: 14, height: 46, borderWidth: t.isDark ? 1 : 0, borderColor: t.colors.hairline }}>
      <Search size={18} color={t.colors.inkFaint} />
      <TextInput
        maxFontSizeMultiplier={1.15}
        value={text}
        onChangeText={setText}
        placeholder={placeholder}
        placeholderTextColor={t.colors.inkFaint}
        autoFocus={autoFocus}
        autoCorrect={false}
        returnKeyType="search"
        clearButtonMode="never"
        style={{ flex: 1, color: t.colors.ink, fontFamily: t.fonts.medium, fontSize: 15, paddingVertical: 0, height: 46 }}
      />
      {loading ? <Spinner size={18} color={t.colors.inkFaint} /> : text ? (
        <Pressable onPress={() => { setText(''); onChange(''); }} hitSlop={8} accessibilityLabel="Clear search">
          <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: t.colors.neutralSoft, alignItems: 'center', justifyContent: 'center' }}>
            <X size={13} color={t.colors.inkMuted} strokeWidth={2.6} />
          </View>
        </Pressable>
      ) : null}
    </View>
  );
}
