import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { MotiView } from 'moti';
import { Asterisk, CheckCircle2 } from 'lucide-react-native';
import { useReducedMotion, useTheme } from '@/theme';
import { usePrefs } from '@/lib/prefs';
import { BentoCard, BigNumber, PillButton, Reveal, Text, TrendChart } from '@/components';

const SAMPLE = [2, 3, 3, 5, 4, 6, 5, 7, 6, 8];

/**
 * The first screen ever: the product's own metric card as the illustration, one
 * statement, one button. Seen once per install.
 */
export default function Onboarding() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const setPrefs = usePrefs((p) => p.set);
  const reduced = useReducedMotion();

  const go = () => {
    setPrefs({ onboardingSeen: true });
    router.replace('/(auth)/login');
  };

  return (
    <View style={{ flex: 1, backgroundColor: t.colors.ground }}>
      <StatusBar style={t.isDark ? 'light' : 'dark'} />
      <View style={{ flex: 1, paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24, paddingHorizontal: t.spacing.screen, justifyContent: 'space-between' }}>
        <MotiView from={reduced ? undefined : { opacity: 0, scale: 0.6, rotate: '-20deg' }} animate={{ opacity: 1, scale: 1, rotate: '0deg' }} transition={{ type: 'spring', damping: 14, stiffness: 120, delay: 100, opacity: { type: 'timing', duration: 400, delay: 100 } }}>
          <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: t.colors.hero, alignItems: 'center', justifyContent: 'center' }}>
            <Asterisk size={34} color="#FFFFFF" strokeWidth={2.6} />
          </View>
        </MotiView>

        <View style={{ gap: 24 }}>
          <Reveal delay={250}>
            <BentoCard>
              <BigNumber icon={CheckCircle2} value={8} unit="done this week" verdict="You are on track. Keep it up." />
              <View style={{ marginTop: 12 }}>
                <TrendChart data={SAMPLE} height={120} annotate="last" />
              </View>
            </BentoCard>
          </Reveal>
          <Reveal delay={400}>
            <Text variant="display">Track the work.{'\n'}Not the paperwork.</Text>
          </Reveal>
          <Reveal delay={520}>
            <Text variant="body" color="inkMuted">
              Your tasks, today's report and the team's tickets — in one calm place, with a nudge when something needs you.
            </Text>
          </Reveal>
        </View>

        <Reveal delay={650}>
          <PillButton label="Get started" variant="hero" size="lg" block onPress={go} haptic="medium" />
        </Reveal>
      </View>
    </View>
  );
}
