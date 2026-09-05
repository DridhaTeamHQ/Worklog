import { Pressable, View } from 'react-native';
import { Check, Moon, Smartphone, Sun } from 'lucide-react-native';
import { MotiView } from 'moti';
import * as Haptics from 'expo-haptics';
import { useReducedMotion, useTheme } from '@/theme';
import { Text } from '@/components/Text';
import { AuroraSurface } from '@/components/AuroraCard';

type Mode = 'light' | 'dark' | 'system';
export function AppearancePicker({ value, onChange }: { value: Mode; onChange: (mode: Mode) => void }) {
  const t = useTheme();
  const reduced = useReducedMotion();
  const select = (mode: Mode) => { Haptics.selectionAsync().catch(() => {}); onChange(mode); };
  return <View style={{ gap: 20 }}>
    <Text variant="small" color="inkMuted">Same workspace. A different atmosphere.</Text>
    <View style={{ flexDirection: 'row', gap: 12 }}>
      {(['light', 'dark'] as const).map((mode) => {
        const selected = value === mode;
        const Icon = mode === 'dark' ? Moon : Sun;
        const bg = mode === 'dark' ? '#080A09' : '#F6F6F0';
        const ink = mode === 'dark' ? '#E5EDCE' : '#273D31';
        return <Pressable key={mode} onPress={() => select(mode)} accessibilityRole="radio" accessibilityLabel={`${mode === 'dark' ? 'Dark' : 'Light'} appearance`} accessibilityState={{ checked: selected }} aria-checked={selected} style={{ flex: 1 }}>
          {({ pressed }) => <MotiView animate={{ scale: pressed && !reduced ? 0.97 : 1 }} transition={{ type: 'timing', duration: reduced ? 0 : 140 }} style={{ borderRadius: 26, overflow: 'hidden', padding: 12, backgroundColor: bg, borderWidth: 2, borderColor: selected ? t.colors.hero : t.colors.border }}>
            <View accessible={false} pointerEvents="none" style={{ gap: 12, height: 152 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}><View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: ink, opacity: 0.3 }} /><View style={{ width: 38, height: 4, borderRadius: 2, backgroundColor: ink, opacity: 0.25 }} /></View>
              <View style={{ gap: 5 }}><View style={{ width: '70%', height: 7, borderRadius: 4, backgroundColor: ink }} /><View style={{ width: '48%', height: 7, borderRadius: 4, backgroundColor: ink, opacity: 0.3 }} /></View>
              <View style={{ height: 46, borderRadius: 13, overflow: 'hidden' }}><AuroraSurface tone="rose" /></View>
              <View style={{ flexDirection: 'row', gap: 7 }}><View style={{ flex: 1, height: 30, borderRadius: 10, overflow: 'hidden' }}><AuroraSurface tone="sage" /></View><View style={{ flex: 1, height: 30, borderRadius: 10, overflow: 'hidden' }}><AuroraSurface tone="iris" /></View></View>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, paddingTop: 10 }}><Icon size={15} color={ink} /><Text variant="smallStrong" color={ink} style={{ flex: 1 }}>{mode === 'dark' ? 'Dark' : 'Light'}</Text>{selected ? <Check size={16} color={ink} /> : null}</View>
          </MotiView>}
        </Pressable>;
      })}
    </View>
    <Pressable accessibilityRole="radio" accessibilityLabel="Follow system appearance" accessibilityState={{ checked: value === 'system' }} aria-checked={value === 'system'} onPress={() => select('system')} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 18, borderRadius: 22, backgroundColor: pressed ? t.colors.cardAlt : t.colors.neutralSoft })}>
      <Smartphone size={22} color={t.colors.hero} /><View style={{ flex: 1, gap: 4 }}><Text variant="bodyStrong">Follow your device</Text><Text variant="small" color="inkMuted">Changes with your system settings.</Text></View>{value === 'system' ? <Check size={18} color={t.colors.hero} /> : null}
    </Pressable>
  </View>;
}
