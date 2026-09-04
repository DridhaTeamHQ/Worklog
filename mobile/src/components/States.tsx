import { View } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { Inbox, WifiOff } from 'lucide-react-native';
import { useTheme } from '@/theme';
import { errorMessage } from '@/api/client';
import { Text } from './Text';
import { PillButton } from './Buttons';

interface EmptyProps {
  icon?: LucideIcon;
  title: string;
  body?: string;
  action?: { label: string; onPress: () => void };
  compact?: boolean;
}

/** Nothing here yet — said kindly, with something to do about it. */
export function EmptyState({ icon: Icon = Inbox, title, body, action, compact }: EmptyProps) {
  const t = useTheme();
  return (
    <View style={{ alignItems: 'center', paddingVertical: compact ? t.spacing.xl : t.spacing.huge, paddingHorizontal: t.spacing.xl, gap: t.spacing.md }}>
      <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: t.colors.infoSoft, alignItems: 'center', justifyContent: 'center' }}>
        <Icon size={28} color={t.colors.hero} strokeWidth={2} />
      </View>
      <Text variant="h3" align="center">{title}</Text>
      {body ? <Text variant="small" color="inkMuted" align="center">{body}</Text> : null}
      {action ? <PillButton label={action.label} onPress={action.onPress} variant="ink" size="sm" style={{ marginTop: 4 }} /> : null}
    </View>
  );
}

interface ErrorProps {
  error: unknown;
  onRetry?: () => void;
  compact?: boolean;
}

/** Something went wrong — the server's own words, and a retry. */
export function ErrorState({ error, onRetry, compact }: ErrorProps) {
  const t = useTheme();
  return (
    <View style={{ alignItems: 'center', paddingVertical: compact ? t.spacing.xl : t.spacing.huge, paddingHorizontal: t.spacing.xl, gap: t.spacing.md }}>
      <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: t.colors.dangerSoft, alignItems: 'center', justifyContent: 'center' }}>
        <WifiOff size={28} color={t.colors.danger} strokeWidth={2} />
      </View>
      <Text variant="h3" align="center">Could not load this</Text>
      <Text variant="small" color="inkMuted" align="center">{errorMessage(error)}</Text>
      {onRetry ? <PillButton label="Try again" onPress={onRetry} variant="ink" size="sm" style={{ marginTop: 4 }} /> : null}
    </View>
  );
}
