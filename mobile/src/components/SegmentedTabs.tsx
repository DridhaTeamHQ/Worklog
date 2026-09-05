import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, View, type LayoutChangeEvent } from 'react-native';
import { MotiView } from 'moti';
import * as Haptics from 'expo-haptics';
import type { LucideIcon } from 'lucide-react-native';
import { useReducedMotion, useTheme } from '@/theme';
import { Text } from './Text';

export interface SegmentItem<T extends string> {
  key: T;
  label: string;
  count?: number;
  /** A glyph for the option. With `iconic`, unselected options show only this. */
  icon?: LucideIcon;
}

interface Props<T extends string> {
  items: SegmentItem<T>[];
  value: T;
  onChange: (key: T) => void;
  /** Over the hero: white pill on translucent white. */
  onHero?: boolean;
  /** Scroll horizontally when there are many. */
  scroll?: boolean;
  /**
   * Symbols instead of words: every option shows its icon, and only the selected
   * one spells its label out. Never clips, however many options or how large the
   * phone's text setting. Defaults on when every item has an icon.
   */
  iconic?: boolean;
}

/**
 * A row of options with a pill that slides to the selected one. Equal-width by
 * default; scrollable with natural widths when `scroll` is set.
 */
export function SegmentedTabs<T extends string>({ items, value, onChange, onHero, scroll, iconic }: Props<T>) {
  const t = useTheme();
  const reduced = useReducedMotion();
  const [layouts, setLayouts] = useState<Record<string, { x: number; width: number }>>({});
  const active = layouts[value];
  const activeX = active?.x;
  const scroller = useRef<ScrollView>(null);
  useEffect(() => {
    if (scroll && activeX !== undefined) scroller.current?.scrollTo({ x: Math.max(0, activeX - 12), animated: !reduced });
  }, [activeX, scroll, reduced]);
  const symbols = iconic ?? items.every((i) => !!i.icon);

  const trackBg = onHero ? 'rgba(255,255,255,0.18)' : t.colors.neutralSoft;
  // On black the card colour would sink into the track; the pill needs to sit above it.
  const pillBg = onHero ? '#FFFFFF' : t.colors.pill;
  const activeFg = onHero ? t.colors.heroDeep : t.colors.onPill;
  const idleFg = onHero ? 'rgba(255,255,255,0.85)' : t.colors.inkMuted;

  const onLayout = (key: string) => (e: LayoutChangeEvent) => {
    const { x, width } = e.nativeEvent.layout;
    setLayouts((cur) => (cur[key]?.x === x && cur[key]?.width === width ? cur : { ...cur, [key]: { x, width } }));
  };

  const row = (
    <View style={{ flexDirection: 'row', position: 'relative', padding: 4, backgroundColor: trackBg, borderRadius: t.radius.pill, alignSelf: scroll ? 'flex-start' : 'stretch' }}>
      {active && reduced ? (
        <View style={[{ position: 'absolute', top: 4, bottom: 4, left: active.x, width: active.width, borderRadius: t.radius.pill, backgroundColor: pillBg }, onHero ? null : t.shadow.card]} />
      ) : active ? (
        <MotiView
          animate={{ translateX: active.x, width: active.width }}
          transition={{ type: 'spring', damping: 20, stiffness: 220 }}
          style={[{ position: 'absolute', top: 4, bottom: 4, left: 0, borderRadius: t.radius.pill, backgroundColor: pillBg }, onHero ? null : t.shadow.card]}
        />
      ) : null}
      {items.map((item) => {
        const selected = item.key === value;
        const Icon = item.icon;
        // In symbol mode the unselected options are just their glyph; the chosen one
        // gets the room for its name and its count.
        const showLabel = !symbols || selected;
        const showCount = typeof item.count === 'number' && showLabel;
        const fg = selected ? activeFg : idleFg;
        return (
          <Pressable
            key={item.key}
            onLayout={onLayout(item.key)}
            onPress={() => { if (!selected) { Haptics.selectionAsync().catch(() => {}); onChange(item.key); } }}
            accessibilityRole="tab"
            accessibilityLabel={item.label}
            accessibilityState={{ selected }}
            aria-selected={selected}
            style={[
              { paddingHorizontal: scroll ? 16 : 6, height: 36, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 5 },
              scroll ? null
                // Symbols with four or more options: idle ones are snug glyph slots and
                // the chosen one takes whatever is left, so its name always has room.
                : symbols && items.length >= 4 ? (selected ? { flex: 1, paddingHorizontal: 8 } : { width: 36 })
                : symbols ? { flex: selected ? 1.8 : 1 }
                : { flex: 1 },
            ]}
          >
            {Icon ? <Icon size={17} color={fg} strokeWidth={selected ? 2.4 : 2} /> : null}
            {showLabel ? (
              <Text variant="smallStrong" color={fg} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} style={{ flexShrink: 1 }}>{item.label}</Text>
            ) : null}
            {showCount ? (
              <View style={{ minWidth: 20, height: 20, paddingHorizontal: 6, borderRadius: 10, backgroundColor: selected ? (onHero ? t.colors.infoSoft : t.colors.neutralSoft) : 'rgba(127,127,127,0.18)', alignItems: 'center', justifyContent: 'center' }}>
                <Text variant="caption" color={fg} style={{ letterSpacing: 0 }}>{item.count}</Text>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );

  if (!scroll) return row;
  return <ScrollView ref={scroller} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingRight: 4 }}>{row}</ScrollView>;
}
