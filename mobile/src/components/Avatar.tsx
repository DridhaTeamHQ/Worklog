import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { Image } from 'expo-image';
import { ChevronRight } from 'lucide-react-native';
import { useTheme } from '@/theme';
import { initials } from '@/lib/format';
import { Text } from './Text';

type Size = 'sm' | 'md' | 'lg' | 'xl';
const SIZES: Record<Size, number> = { sm: 32, md: 40, lg: 56, xl: 88 };

interface AvatarProps {
  name: string;
  src?: string | null;
  size?: Size;
  /** Over the hero: white on translucent white. */
  onHero?: boolean;
}

/** A photo when there is one, otherwise initials on a soft blue disc. */
export function Avatar({ name, src, size = 'md', onHero }: AvatarProps) {
  const t = useTheme();
  const px = SIZES[size];
  const fontVariant = size === 'xl' ? 'h1' : size === 'lg' ? 'h3' : size === 'md' ? 'smallStrong' : 'caption';
  return (
    <View style={{
      width: px, height: px, borderRadius: px / 2, overflow: 'hidden',
      backgroundColor: onHero ? 'rgba(255,255,255,0.22)' : t.colors.accentSoft,
      alignItems: 'center', justifyContent: 'center',
      borderWidth: onHero ? 1.5 : 0, borderColor: 'rgba(255,255,255,0.5)',
    }}
    >
      {src ? (
        <Image source={{ uri: src }} style={{ width: px, height: px }} contentFit="cover" transition={200} />
      ) : (
        <Text variant={fontVariant} color={onHero ? '#FFFFFF' : t.colors.hero} style={{ letterSpacing: 0 }}>
          {initials(name) || '?'}
        </Text>
      )}
    </View>
  );
}

interface PersonRowProps {
  name: string;
  subtitle?: string | null;
  src?: string | null;
  size?: Size;
  right?: ReactNode;
  onPress?: () => void;
  chevron?: boolean;
  onHero?: boolean;
}

/** Avatar + name + a line underneath, the row the reference uses for people. */
export function PersonRow({ name, subtitle, src, size = 'md', right, onPress, chevron, onHero }: PersonRowProps) {
  const t = useTheme();
  const content = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.md }}>
      <Avatar name={name} src={src} size={size} onHero={onHero} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text variant={size === 'lg' || size === 'xl' ? 'h3' : 'bodyStrong'} color={onHero ? '#FFFFFF' : 'ink'} numberOfLines={1}>{name}</Text>
        {subtitle ? <Text variant="small" color={onHero ? 'onHeroMuted' : 'inkMuted'} numberOfLines={1}>{subtitle}</Text> : null}
      </View>
      {right}
      {chevron ? <ChevronRight size={18} color={onHero ? '#FFFFFF' : t.colors.inkFaint} /> : null}
    </View>
  );
  if (!onPress) return content;
  return <Pressable onPress={onPress} accessibilityRole="button">{content}</Pressable>;
}
