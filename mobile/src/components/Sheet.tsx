import { forwardRef, useCallback, useImperativeHandle, useMemo, useRef, useState, type ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import {
  BottomSheetBackdrop, BottomSheetModal, BottomSheetScrollView, BottomSheetView,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';
import { Check, Search, X } from 'lucide-react-native';
import { BottomSheetTextInput } from '@gorhom/bottom-sheet';
import * as Haptics from 'expo-haptics';
import { useReducedMotion, useTheme } from '@/theme';
import { ReduceMotion } from 'react-native-reanimated';
import { Text } from './Text';

export interface SheetHandle {
  open: () => void;
  close: () => void;
}

interface SheetProps {
  title?: string;
  children: ReactNode;
  /** Fixed-height content ('auto') or a tall scrolling sheet. */
  size?: 'auto' | 'tall';
  scroll?: boolean;
  onDismiss?: () => void;
}

/**
 * A bottom sheet with a frosted backdrop, rounded top and the drag handle. Imperative
 * open/close so a screen can hold one and open it from anywhere.
 */
export const Sheet = forwardRef<SheetHandle, SheetProps>(function Sheet({ title, children, size = 'auto', scroll, onDismiss }, ref) {
  const t = useTheme();
  const reduced = useReducedMotion();
  const modal = useRef<BottomSheetModal>(null);
  const snapPoints = useMemo(() => (size === 'tall' ? ['70%', '92%'] : undefined), [size]);

  useImperativeHandle(ref, () => ({
    open: () => modal.current?.present(),
    close: () => modal.current?.dismiss(),
  }), []);

  const backdrop = useCallback((props: BottomSheetBackdropProps) => (
    <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} opacity={0.45} pressBehavior="close" />
  ), []);

  const Body = scroll ? BottomSheetScrollView : BottomSheetView;
  return (
    <BottomSheetModal
      ref={modal}
      overrideReduceMotion={reduced ? ReduceMotion.Always : ReduceMotion.Never}
      snapPoints={snapPoints}
      enableDynamicSizing={size === 'auto'}
      backdropComponent={backdrop}
      onDismiss={onDismiss}
      backgroundStyle={{ backgroundColor: t.colors.card, borderRadius: t.radius.xl }}
      handleIndicatorStyle={{ backgroundColor: t.colors.border, width: 44 }}
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
      android_keyboardInputMode="adjustResize"
    >
      <Body contentContainerStyle={scroll ? { paddingHorizontal: t.spacing.xl, paddingBottom: t.spacing.huge } : undefined} style={scroll ? undefined : { paddingHorizontal: t.spacing.xl, paddingBottom: t.spacing.huge }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: t.spacing.md, marginTop: 4 }}>
          <Text variant="h2" style={{ flex: 1 }}>{title}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Close sheet" onPress={() => modal.current?.dismiss()} style={({ pressed }) => ({ width: 36, height: 36, borderRadius: 18, backgroundColor: pressed ? t.colors.cardAlt : t.colors.neutralSoft, alignItems: 'center', justifyContent: 'center' })}><X size={16} color={t.colors.inkMuted} /></Pressable>
        </View>
        {children}
      </Body>
    </BottomSheetModal>
  );
});

export interface PickerOption<V extends string | number> {
  value: V;
  label: string;
  hint?: string;
  leading?: ReactNode;
  color?: string;
}

interface PickerSheetProps<V extends string | number> {
  title: string;
  options: PickerOption<V>[];
  value?: V | null;
  onSelect: (value: V) => void;
  searchable?: boolean;
  /** Something to show when the list is empty. */
  empty?: string;
  /** An extra row at the top, e.g. "No project". */
  clearLabel?: string;
  onClear?: () => void;
}

/** A sheet of choices with a tick on the current one. Replaces the web's custom Select. */
export const PickerSheet = forwardRef(function PickerSheet<V extends string | number>(
  { title, options, value, onSelect, searchable, empty = 'Nothing to choose from', clearLabel, onClear }: PickerSheetProps<V>,
  ref: React.ForwardedRef<SheetHandle>,
) {
  const t = useTheme();
  const inner = useRef<SheetHandle>(null);
  const [query, setQuery] = useState('');
  useImperativeHandle(ref, () => ({ open: () => { setQuery(''); inner.current?.open(); }, close: () => inner.current?.close() }), []);

  const shown = query
    ? options.filter((o) => `${o.label} ${o.hint ?? ''}`.toLowerCase().includes(query.toLowerCase()))
    : options;

  const pick = (v: V) => {
    Haptics.selectionAsync().catch(() => {});
    onSelect(v);
    inner.current?.close();
  };

  return (
    <Sheet ref={inner} title={title} size={options.length > 6 || searchable ? 'tall' : 'auto'} scroll={options.length > 6 || searchable}>
      {searchable ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: t.colors.cardAlt, borderRadius: t.radius.pill, paddingHorizontal: 14, height: 44, marginBottom: t.spacing.md, borderWidth: 1, borderColor: t.colors.border }}>
          <Search size={16} color={t.colors.inkFaint} />
          <BottomSheetTextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search"
            placeholderTextColor={t.colors.inkFaint}
            style={{ flex: 1, color: t.colors.ink, fontFamily: t.fonts.medium, fontSize: 15, paddingVertical: 0 }}
          />
        </View>
      ) : null}
      {clearLabel ? (
        <Pressable onPress={() => { onClear?.(); inner.current?.close(); }} style={{ paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Text variant="body" color="inkMuted" style={{ flex: 1 }}>{clearLabel}</Text>
          {value == null ? <Check size={18} color={t.colors.hero} strokeWidth={2.6} /> : null}
        </Pressable>
      ) : null}
      {shown.length === 0 ? <Text variant="small" color="inkMuted" style={{ paddingVertical: 16 }}>{empty}</Text> : null}
      {shown.map((o) => {
        const selected = o.value === value;
        return (
          <Pressable
            key={String(o.value)}
            onPress={() => pick(o.value)}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 8, marginHorizontal: -8, borderRadius: t.radius.md, backgroundColor: pressed ? t.colors.cardAlt : 'transparent' })}
          >
            {o.leading ?? (o.color ? <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: o.color }} /> : null)}
            <View style={{ flex: 1 }}>
              <Text variant={selected ? 'bodyStrong' : 'body'}>{o.label}</Text>
              {o.hint ? <Text variant="small" color="inkMuted">{o.hint}</Text> : null}
            </View>
            {selected ? <Check size={18} color={t.colors.hero} strokeWidth={2.6} /> : null}
          </Pressable>
        );
      })}
    </Sheet>
  );
}) as <V extends string | number>(props: PickerSheetProps<V> & { ref?: React.Ref<SheetHandle> }) => React.ReactElement;

/** The hook a screen uses: `const sheet = useSheet(); <Sheet ref={sheet.ref}>…; sheet.open()`. */
export function useSheet() {
  const ref = useRef<SheetHandle>(null);
  return { ref, open: () => ref.current?.open(), close: () => ref.current?.close() };
}
