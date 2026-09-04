import type { ReactNode } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { useTheme } from '@/theme';
import { IconPillButton } from './Buttons';
import { CircleButton } from './Headline';
import { Text } from './Text';

interface Props {
  title?: string;
  subtitle?: string;
  back?: boolean;
  right?: ReactNode;
  /** Over the hero: white type and glass buttons. */
  onHero?: boolean;
  /** Large heading below the row — the default for inner screens. */
  big?: boolean;
}

/**
 * The top of a screen: a bare back chevron, an action on the right, and the title —
 * large and on its own line for inner screens, inline for modals.
 */
export function ScreenHeader({ title, subtitle, back = true, right, onHero, big = true }: Props) {
  const t = useTheme();
  const router = useRouter();
  const inline = !big;
  return (
    <View style={{ gap: t.spacing.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: 42, gap: 12 }}>
        {back ? (
          onHero
            ? <IconPillButton icon={ChevronLeft} size={42} tone="glass" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} accessibilityLabel="Go back" />
            : <CircleButton icon={ChevronLeft} onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} accessibilityLabel="Go back" />
        ) : null}
        {inline && title ? (
          <View style={{ flex: 1 }}>
            <Text variant="h3" color={onHero ? '#FFFFFF' : 'ink'} numberOfLines={1}>{title}</Text>
            {subtitle ? <Text variant="small" color={onHero ? 'onHeroMuted' : 'inkMuted'} numberOfLines={1}>{subtitle}</Text> : null}
          </View>
        ) : <View style={{ flex: 1 }} />}
        {right}
      </View>
      {!inline && title ? (
        <View style={{ gap: 4, marginTop: back ? 4 : 0 }}>
          <Text variant="h1" color={onHero ? '#FFFFFF' : 'ink'}>{title}</Text>
          {subtitle ? <Text variant="body" color={onHero ? 'onHeroMuted' : 'inkMuted'}>{subtitle}</Text> : null}
        </View>
      ) : null}
    </View>
  );
}

/**
 * The title block of a detail screen: an eyebrow (the key, the project), the title,
 * and a row of meta underneath — on the ground, not on a hero.
 */
export function TitleBlock({ eyebrow, title, meta, children }: { eyebrow?: ReactNode; title: string; meta?: ReactNode; children?: ReactNode }) {
  const t = useTheme();
  return (
    <View style={{ gap: t.spacing.md }}>
      {eyebrow ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>{eyebrow}</View> : null}
      <Text variant="h1">{title}</Text>
      {meta ? <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>{meta}</View> : null}
      {children}
    </View>
  );
}

/** A section heading with an optional action on the right ("Recent reports · See all"). */
export function SectionTitle({ title, right, onHero }: { title: string; right?: ReactNode; onHero?: boolean }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', paddingHorizontal: 4, marginTop: t.spacing.md, marginBottom: -t.spacing.sm }}>
      <Text variant="h3" color={onHero ? '#FFFFFF' : 'ink'}>{title}</Text>
      {right}
    </View>
  );
}
