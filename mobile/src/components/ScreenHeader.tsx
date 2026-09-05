import type { ReactNode } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { useTheme } from '@/theme';
import { IconPillButton } from './Buttons';
import { CircleButton } from './Headline';
import { Text } from './Text';
import { AuroraSurface, type AuroraTone } from './AuroraCard';

interface Props {
  title?: string;
  subtitle?: string;
  back?: boolean;
  right?: ReactNode;
  /** Over the hero: white type and glass buttons. */
  onHero?: boolean;
  /** Large heading below the row — the default for inner screens. */
  big?: boolean;
  tone?: AuroraTone;
  eyebrow?: string;
}

/**
 * The top of a screen: a bare back chevron, an action on the right, and the title —
 * large and on its own line for inner screens, inline for modals.
 */
export function ScreenHeader({ title, subtitle, back = true, right, onHero, big = true, tone = 'sage', eyebrow }: Props) {
  const t = useTheme();
  const router = useRouter();
  const inline = !big;
  return (
    <View style={{ gap: t.spacing.sm }}>
      {(back || right || inline) ? <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: 42, gap: 12 }}>
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
      </View> : null}
      {!inline && title ? (
        <PageIntro title={title} subtitle={subtitle} tone={tone} eyebrow={eyebrow} />
      ) : null}
    </View>
  );
}

/** Mineral header shared by lists, forms and secondary pages. */
export function PageIntro({ title, subtitle, eyebrow = 'WORKSPACE', tone = 'sage', right, compact = false }: {
  title: string; subtitle?: string; eyebrow?: string; tone?: AuroraTone; right?: ReactNode; compact?: boolean;
}) {
  return (
    <View style={{ borderRadius: 28, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)', minHeight: compact ? 108 : 156 }}>
      <AuroraSurface tone={tone} />
      <View pointerEvents="none" accessible={false} style={{ position: 'absolute', width: 136, height: 136, borderRadius: 68, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', right: -34, top: -52 }} />
      <View style={{ padding: compact ? 18 : 22, gap: compact ? 8 : 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          {compact ? <Text variant="h2" color="#F8F8F1" style={{ flex: 1 }}>{title}</Text> : <Text variant="caption" color="#D8E0D4" style={{ letterSpacing: 2, flexShrink: 1 }}>{eyebrow}</Text>}
          {right ? <View style={{ flexDirection: 'row', gap: 8 }}>{right}</View> : null}
        </View>
        <View style={{ gap: 6 }}>
          {!compact ? <Text variant="h1" color="#F8F8F1">{title}</Text> : null}
          {subtitle ? <Text variant="small" color="#E0E4DC">{subtitle}</Text> : null}
        </View>
      </View>
    </View>
  );
}

export function TitleBlock({ eyebrow, title, meta, children, tone = 'sage' }: { eyebrow?: ReactNode; title: string; meta?: ReactNode; children?: ReactNode; tone?: AuroraTone }) {
  const t = useTheme();
  return (
    <View style={{ borderRadius: 28, overflow: 'hidden', backgroundColor: t.colors.card, borderWidth: 1, borderColor: t.colors.hairline }}>
      {eyebrow ? <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, padding: 20 }}>{eyebrow}</View> : null}
      <View style={{ padding: 24, minHeight: 150, justifyContent: 'flex-end' }}>
        <AuroraSurface tone={tone} />
        <Text variant="h1" color="#F8F8F1">{title}</Text>
      </View>
      {meta ? <View style={{ padding: 20, flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>{meta}</View> : null}
      {children}
    </View>
  );
}

/** A quieter card for related form fields. */
export function FormSection({ title, detail, children }: { title: string; detail?: string; children: ReactNode }) {
  const t = useTheme();
  return <View style={{ gap: 18, backgroundColor: t.colors.card, borderWidth: 1, borderColor: t.colors.hairline, borderRadius: 24, padding: 20 }}>
    <View style={{ gap: 4 }}><Text variant="h3">{title}</Text>{detail ? <Text variant="small" color="inkMuted">{detail}</Text> : null}</View>
    {children}
  </View>;
}

/** A section heading with an optional action on the right ("Recent reports · See all"). */
export function SectionTitle({ title, right, onHero }: { title: string; right?: ReactNode; onHero?: boolean }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, justifyContent: 'space-between', paddingHorizontal: 4, marginTop: t.spacing.md, marginBottom: -t.spacing.sm }}>
      <Text variant="h3" color={onHero ? '#FFFFFF' : 'ink'}>{title}</Text>
      {right}
    </View>
  );
}
