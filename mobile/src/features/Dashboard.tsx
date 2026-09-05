import { QuickActions } from './QuickActions';
import { DotNumber } from '@/components/DotNumber';
import { useEffect } from 'react';
import { Pressable, View } from 'react-native';
import { ArrowUpRight, Bell, Search, type LucideIcon } from 'lucide-react-native';
import Svg, { Circle } from 'react-native-svg';
import { useIsFocused, useRouter } from 'expo-router';
import Animated, { cancelAnimation, Easing, useAnimatedProps, useSharedValue, withTiming } from 'react-native-reanimated';
import { useReducedMotion, useTheme } from '@/theme';
import { useAnimatedNumber } from '@/hooks/useAnimatedNumber';
import { firstName, greeting, todayIso } from '@/lib/format';
import { Avatar, IconPillButton, Text } from '@/components';
import { AuroraCard, type AuroraTone } from '@/components/AuroraCard';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const CIRCUMFERENCE = 2 * Math.PI * 44;

function CompletionRing({ value }: { value: number }) {
  const reduced = useReducedMotion();
  const focused = useIsFocused();
  const progress = useSharedValue(reduced ? value : 0);
  useEffect(() => {
    progress.value = reduced || !focused ? value : withTiming(value, { duration: 850, easing: Easing.out(Easing.cubic) });
    return () => cancelAnimation(progress);
  }, [value, reduced, focused, progress]);
  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: CIRCUMFERENCE * (1 - progress.value),
    opacity: progress.value > 0 ? 1 : 0,
  }));
  return <AnimatedCircle cx={52} cy={52} r={44} fill="none" stroke="#E5F2B3" strokeWidth={2.5} strokeLinecap="round" strokeDasharray={[CIRCUMFERENCE, CIRCUMFERENCE]} transform="rotate(-90 52 52)" animatedProps={animatedProps} />;
}

export function DashboardHeader({ name, image, unread, manager = false }: {
  name: string; image?: string | null; unread: number; manager?: boolean;
}) {
  const t = useTheme();
  const router = useRouter();
  const date = new Date(`${todayIso()}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  return (
    <View style={{ gap: 22, paddingTop: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Pressable onPress={() => router.push('/profile')} accessibilityRole="button" accessibilityLabel="Profile">
          <Avatar name={name} src={image} />
        </Pressable>
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="caption" color="inkMuted">{greeting()},</Text>
          <Text variant="bodyStrong" numberOfLines={1}>{firstName(name)}</Text>
        </View>
        <IconPillButton icon={Bell} tone="soft" badge={unread} onPress={() => router.push('/notifications')} accessibilityLabel="Notifications" />
        <QuickActions manager={manager} />
      </View>
      <View style={{ gap: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: t.colors.accent }} />
          <Text variant="caption" color="inkMuted" style={{ letterSpacing: 1.6 }}>{date.toUpperCase()}</Text>
        </View>
        <Text variant="display">{manager ? 'Your team,\nin sync.' : 'Your day,\nin focus.'}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Search workspace" onPress={() => router.push('/search')} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, minHeight: 46, borderRadius: t.radius.pill, backgroundColor: pressed ? t.colors.cardAlt : t.colors.card, borderWidth: 1, borderColor: t.colors.hairline })}>
          <Search size={17} color={t.colors.inkMuted} /><Text variant="small" color="inkMuted" style={{ flex: 1 }}>Find a task, ticket, or project</Text><ArrowUpRight size={16} color={t.colors.hero} />
        </Pressable>
      </View>
    </View>
  );
}

/** Completion is derived from the dashboard's real task counts. */
export function CompletionCard({ done, total, detail, onPress }: { done: number; total: number; detail?: string; onPress?: () => void }) {
  const value = total > 0 ? Math.max(0, Math.min(1, done / total)) : 0;
  const pct = Math.round(value * 100);
  const shown = useAnimatedNumber(pct);
  return (
    <AuroraCard tone="rose" onPress={onPress} accessibilityLabel={`Work completed, ${pct} percent. ${done} of ${total} tasks. View completed tasks.`} style={{ minHeight: 176 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text variant="small" color="#FAF5F3">Work completed</Text>
        {onPress ? <ArrowUpRight size={18} color="#FAF5F3" strokeWidth={1.5} /> : null}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 10 }}>
        <View style={{ flex: 1, gap: 4 }}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
            <DotNumber value={shown} height={shown >= 100 ? 38 : 58} color="#FFFFFF" />
            <Text variant="unit" color="#FAF5F3">%</Text>
          </View>
          <Text variant="caption" color="#FAF5F3">{total ? `${done} of ${total} tasks complete` : 'A fresh start. Make it count.'}</Text>
        </View>
        <View accessible={false} style={{ width: 104, height: 104, alignItems: 'center', justifyContent: 'center' }}>
          <Svg width={104} height={104} style={{ position: 'absolute' }}>
            <Circle cx={52} cy={52} r={50} fill="none" stroke="rgba(255,255,255,0.36)" strokeWidth={2} strokeDasharray="1 5.54" />
            <Circle cx={52} cy={52} r={44} fill="none" stroke="rgba(255,255,255,0.16)" strokeWidth={1} />
            <CompletionRing value={value} />
          </Svg>
          <Text variant="h3" color="#FFFFFF" numberOfLines={1} adjustsFontSizeToFit style={{ maxWidth: 84 }}>{done}<Text variant="caption" color="#FAF5F3"> / {total}</Text></Text>
        </View>
      </View>
      {detail ? <Text variant="caption" color="#FAF5F3" style={{ marginTop: 12 }}>{detail}</Text> : null}
    </AuroraCard>
  );
}

export function MetricCard({ title, value, unit, detail, icon: Icon, tone, onPress }: {
  title: string; value: number | string; unit?: string; detail: string; icon: LucideIcon; tone: AuroraTone; onPress: () => void;
}) {
  const numeric = typeof value === 'number';
  const shown = useAnimatedNumber(numeric ? value : 0);
  return (
    <AuroraCard tone={tone} onPress={onPress} accessibilityLabel={`${title}, ${value}${unit ? ` ${unit}` : ''}. ${detail}`} style={{ minHeight: 158, padding: 17, justifyContent: 'space-between' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Text variant="small" color="#F8F8F3" style={{ flex: 1 }}>{title}</Text>
        <ArrowUpRight size={15} strokeWidth={1.5} color="#F8F8F3" />
      </View>
      <View style={{ marginTop: 18, gap: 7 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}>
          <Text variant="stat" color="#FFFFFF" numberOfLines={1} adjustsFontSizeToFit style={{ flexShrink: 1 }}>{numeric ? shown : value}<Text variant="small" color="#F8F8F3">{unit ? ` ${unit}` : ''}</Text></Text>
          <View style={{ flex: 1 }} />
          <Icon size={22} color="#EDF3D5" strokeWidth={1.3} />
        </View>
        <Text variant="caption" color="#F8F8F3">{detail}</Text>
      </View>
    </AuroraCard>
  );
}
