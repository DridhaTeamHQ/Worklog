import { View } from 'react-native';
import { ArrowUpRight } from 'lucide-react-native';
import { AuroraCard } from './AuroraCard';
import { Avatar } from './Avatar';
import { Text } from './Text';

export function IdentityCard({ name, image, subtitle, detail, onPress, compact = false }: {
  name: string; image?: string | null; subtitle?: string; detail?: string; onPress?: () => void; compact?: boolean;
}) {
  return <AuroraCard tone="sage" onPress={onPress} accessibilityLabel={onPress ? `View ${name}'s profile` : undefined} style={{ minHeight: compact ? 150 : 200, gap: compact ? 14 : 24 }}>
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
      <Avatar name={name} src={image} size={compact ? 'sm' : 'lg'} />
      {onPress ? <ArrowUpRight size={22} color="#EDF1E4" /> : <Text variant="caption" color="#D8E0D4" style={{ letterSpacing: 2 }}>PEOPLE / PROFILE</Text>}
    </View>
    <View style={{ gap: 5 }}>
      <Text variant={compact ? 'h3' : 'h2'} color="#F8F8F1">{name}</Text>
      {subtitle && !compact ? <Text variant="small" color="#E0E4DC">{subtitle}</Text> : null}
      {detail ? <Text variant="small" color="#E0E4DC">{detail}</Text> : null}
    </View>
  </AuroraCard>;
}
