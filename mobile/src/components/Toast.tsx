import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { AnimatePresence, MotiView } from 'moti';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { AlertCircle, Bell, CheckCircle2, Info } from 'lucide-react-native';
import { useTheme } from '@/theme';
import { Text } from './Text';
import { SuccessMark } from './Loaders';

type Tone = 'success' | 'error' | 'info';

export interface ToastInput {
  title: string;
  message?: string;
  tone?: Tone;
  /** Tap the toast to go somewhere (a push about a task, say). */
  onPress?: () => void;
  durationMs?: number;
}

interface ToastState extends ToastInput { id: number }

interface ToastApi {
  show: (input: ToastInput) => void;
  success: (title: string, message?: string) => void;
  error: (title: string, message?: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

/**
 * A single floating glass pill at the top of the screen. One at a time — a new toast
 * replaces the old — and it slides away on its own or when tapped.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const insets = useSafeAreaInsets();
  const t = useTheme();

  const dismiss = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setToast(null);
  }, []);

  const show = useCallback((input: ToastInput) => {
    if (timer.current) clearTimeout(timer.current);
    const id = Date.now();
    setToast({ id, tone: 'info', ...input });
    timer.current = setTimeout(() => setToast((cur) => (cur?.id === id ? null : cur)), input.durationMs ?? (input.tone === 'error' ? 5200 : 3600));
  }, []);

  const api = useMemo<ToastApi>(() => ({
    show,
    success: (title, message) => show({ title, message, tone: 'success' }),
    error: (title, message) => show({ title, message, tone: 'error' }),
  }), [show]);

  const toneColor = { success: t.colors.success, error: t.colors.danger, info: t.colors.hero }[toast?.tone ?? 'info'];
  const Icon = { success: CheckCircle2, error: AlertCircle, info: toast?.onPress ? Bell : Info }[toast?.tone ?? 'info'];

  return (
    <ToastContext.Provider value={api}>
      {children}
      <View pointerEvents="box-none" style={{ position: 'absolute', top: insets.top + 8, left: 16, right: 16, alignItems: 'center' }}>
        <AnimatePresence>
          {toast ? (
            <MotiView
              key={toast.id}
              from={{ opacity: 0, translateY: -24, scale: 0.96 }}
              animate={{ opacity: 1, translateY: 0, scale: 1 }}
              exit={{ opacity: 0, translateY: -16, scale: 0.98 }}
              transition={{ type: 'spring', ...t.motion.spring }}
              style={[{ borderRadius: t.radius.lg, overflow: 'hidden', maxWidth: 520, alignSelf: 'stretch', borderWidth: 1, borderColor: t.colors.glassBorder }, t.shadow.float]}
            >
              <BlurView intensity={t.isDark ? 30 : 60} tint={t.isDark ? 'dark' : 'light'} style={{ backgroundColor: t.isDark ? 'rgba(18,18,20,0.94)' : 'rgba(250,250,251,0.94)' }}>
                <Pressable
                  onPress={() => { toast.onPress?.(); dismiss(); }}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 14 }}
                  accessibilityRole="alert"
                >
                  {toast.tone === 'success' ? <SuccessMark size={34} /> : (
                    <MotiView from={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', damping: 12, stiffness: 200, delay: 60 }} style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: toneColor, alignItems: 'center', justifyContent: 'center' }}>
                      <Icon size={18} color="#FFFFFF" strokeWidth={2.4} />
                    </MotiView>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text variant="bodyStrong" numberOfLines={2}>{toast.title}</Text>
                    {toast.message ? <Text variant="small" color="inkMuted" numberOfLines={2}>{toast.message}</Text> : null}
                  </View>
                </Pressable>
              </BlurView>
            </MotiView>
          ) : null}
        </AnimatePresence>
      </View>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside a ToastProvider');
  return ctx;
}
