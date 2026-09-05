import { ScrollView, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { ArrowRight, Asterisk, CheckCheck, CircleDot } from 'lucide-react-native';
import { useTheme } from '@/theme';
import { usePrefs } from '@/lib/prefs';
import { PillButton, Reveal, Text } from '@/components';
import { AuroraCard } from '@/components/AuroraCard';
import { CompletionCard } from '@/features/Dashboard';

/** Illustrative counts belong only to onboarding; home always uses API data. */
export default function Onboarding() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const setPrefs = usePrefs((p) => p.set);
  const go = () => {
    setPrefs({ onboardingSeen: true });
    router.replace('/(auth)/login');
  };

  return (
    <View style={{ flex: 1, backgroundColor: t.colors.ground }}>
      <StatusBar style={t.isDark ? 'light' : 'dark'} />
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ flexGrow: 1, paddingTop: insets.top + 28, paddingBottom: insets.bottom + 24, paddingHorizontal: t.spacing.screen, gap: 32, justifyContent: 'space-between' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: t.colors.accent, alignItems: 'center', justifyContent: 'center' }}>
            <Asterisk size={26} color={t.colors.onAccent} strokeWidth={1.8} />
          </View>
          <Text variant="h2" style={{ letterSpacing: -1 }}>taskr</Text>
          <View style={{ flex: 1 }} />
          <Text variant="caption" color="inkMuted">A calmer way to work</Text>
        </View>

        <View style={{ gap: 28 }}>
          <Reveal>
            <Text variant="display" style={{ fontSize: 46, lineHeight: 52 }}>Good work.{'\n'}Clear mind.</Text>
            <Text variant="body" color="inkMuted" style={{ marginTop: 12, maxWidth: 310 }}>Your tasks, team, and daily progress. Everything in a good place.</Text>
          </Reveal>
          <Reveal delay={120}>
            <View style={{ gap: 10 }}>
              <Text variant="caption" color="inkMuted" style={{ letterSpacing: 1.3, marginBottom: 2 }}>A GLIMPSE OF YOUR DAY · EXAMPLE</Text>
              <CompletionCard done={8} total={12} />
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <AuroraCard tone="sage" style={{ minHeight: 130, justifyContent: 'space-between' }}>
                  <Text variant="small" color="#FFFFFF">In the flow</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 22 }}>
                    <Text variant="stat" color="#FFFFFF">03</Text>
                    <CircleDot size={24} color="#E5EDCE" strokeWidth={1.4} />
                  </View>
                </AuroraCard>
                <AuroraCard tone="iris" style={{ minHeight: 130, justifyContent: 'space-between' }}>
                  <Text variant="small" color="#FFFFFF">Daily report</Text>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 22 }}>
                    <Text variant="h2" color="#FFFFFF">All set</Text>
                    <CheckCheck size={24} color="#E5EDCE" strokeWidth={1.4} />
                  </View>
                </AuroraCard>
              </View>
            </View>
          </Reveal>
        </View>

        <Reveal delay={240}>
          <PillButton label="Find your focus" iconRight={ArrowRight} variant="accent" size="lg" block onPress={go} haptic="medium" />
          <Text variant="caption" color="inkMuted" align="center" style={{ marginTop: 14 }}>Less noise. More moving forward.</Text>
        </Reveal>
      </ScrollView>
    </View>
  );
}
