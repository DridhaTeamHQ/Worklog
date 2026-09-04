import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { ChevronRight } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/theme';
import { BentoCard } from './BentoCard';
import { Text } from './Text';

interface RowProps {
  icon?: LucideIcon;
  label: string;
  hint?: string;
  badge?: number;
  onPress?: () => void;
  danger?: boolean;
  right?: ReactNode;
  /** Draw the hairline above this row (all but the first in a group). */
  divider?: boolean;
}

/**
 * A settings-style row: quiet icon, label, an optional hint, a chevron. Rows are
 * grouped inside one card with hairlines between them — not a card per row.
 */
export function ListRow({ icon: Icon, label, hint, badge, onPress, danger, right, divider }: RowProps) {
  const t = useTheme();
  const fg = danger ? t.colors.danger : t.colors.ink;
  return (
    <Pressable
      onPress={onPress ? () => { Haptics.selectionAsync().catch(() => {}); onPress(); } : undefined}
      disabled={!onPress}
      accessibilityRole="button"
      style={({ pressed }) => ({
        flexDirection: 'row', alignItems: 'center', gap: 14,
        paddingVertical: 14, paddingHorizontal: t.spacing.xl,
        borderTopWidth: divider ? 1 : 0, borderTopColor: t.colors.hairline,
        backgroundColor: pressed ? t.colors.cardAlt : 'transparent',
      })}
    >
      {Icon ? <Icon size={20} color={danger ? t.colors.danger : t.colors.inkMuted} strokeWidth={1.9} /> : null}
      <View style={{ flex: 1 }}>
        <Text variant="body" color={fg}>{label}</Text>
        {hint ? <Text variant="small" color="inkMuted">{hint}</Text> : null}
      </View>
      {badge ? (
        <View style={{ minWidth: 22, height: 22, paddingHorizontal: 7, borderRadius: 11, backgroundColor: t.colors.danger, alignItems: 'center', justifyContent: 'center' }}>
          <Text variant="caption" color="#FFFFFF" style={{ fontFamily: t.fonts.semibold }}>{badge > 99 ? '99+' : badge}</Text>
        </View>
      ) : null}
      {right}
      {onPress && !right ? <ChevronRight size={18} color={t.colors.inkFaint} /> : null}
    </Pressable>
  );
}

/** A group of rows on one card. */
export function ListGroup({ children }: { children: ReactNode }) {
  const t = useTheme();
  return <BentoCard padding={0}><View style={{ overflow: 'hidden', borderRadius: t.radius.lg }}>{children}</View></BentoCard>;
}

/**
 * A fact as a row: muted label on the left, value on the right. Tappable rows get
 * a chevron. Used for the "Deadline · 14 Sep" block on details, in a ListGroup.
 */
export function ValueRow({ label, value, color, onPress, divider }: { label: string; value: string; color?: string; onPress?: () => void; divider?: boolean }) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress ? () => { Haptics.selectionAsync().catch(() => {}); onPress(); } : undefined}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      style={({ pressed }) => ({
        flexDirection: 'row', alignItems: 'center', gap: 16,
        paddingVertical: 13, paddingHorizontal: t.spacing.xl,
        borderTopWidth: divider ? 1 : 0, borderTopColor: t.colors.hairline,
        backgroundColor: pressed ? t.colors.cardAlt : 'transparent',
      })}
    >
      <Text variant="body" color="inkMuted">{label}</Text>
      <View style={{ flex: 1, alignItems: 'flex-end' }}>
        <Text variant="body" color={color ?? 'ink'} numberOfLines={2} style={{ flexShrink: 1, textAlign: 'right' }}>{value}</Text>
      </View>
      {onPress ? <ChevronRight size={16} color={t.colors.inkFaint} style={{ marginRight: -4 }} /> : null}
    </Pressable>
  );
}

/** Kept for the odd place that still wants a square tile; same quiet treatment. */
export function Tile({ icon: Icon, label, hint, badge, onPress, danger }: RowProps) {
  const t = useTheme();
  return (
    <BentoCard onPress={onPress} padding={t.spacing.lg} style={{ flex: 1, minHeight: 100, justifyContent: 'space-between' }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        {Icon ? <Icon size={20} color={danger ? t.colors.danger : t.colors.inkMuted} strokeWidth={1.9} /> : <View />}
        {badge ? (
          <View style={{ minWidth: 20, height: 20, paddingHorizontal: 6, borderRadius: 10, backgroundColor: t.colors.danger, alignItems: 'center', justifyContent: 'center' }}>
            <Text variant="caption" color="#FFFFFF" style={{ fontFamily: t.fonts.semibold }}>{badge > 99 ? '99+' : badge}</Text>
          </View>
        ) : null}
      </View>
      <View style={{ marginTop: 14 }}>
        <Text variant="bodyStrong" color={danger ? 'danger' : 'ink'} numberOfLines={1}>{label}</Text>
        {hint ? <Text variant="small" color="inkMuted" numberOfLines={1}>{hint}</Text> : null}
      </View>
    </BentoCard>
  );
}

/** Same API as before, now a row on its own card; prefer ListGroup + ListRow. */
export function RowTile(props: RowProps) {
  return <ListGroup><ListRow {...props} /></ListGroup>;
}
