import { View } from 'react-native';
import { ArrowUpRight, BarChart3, ClipboardList, FolderKanban, NotebookPen, type LucideIcon } from 'lucide-react-native';
import { AuroraCard, type AuroraTone } from '@/components/AuroraCard';
import { Text } from '@/components/Text';

export function WorkspaceShortcuts({ manager, onOpen }: { manager: boolean; onOpen: (path: string) => void }) {
  const shortcuts: { title: string; detail: string; path: string; tone: AuroraTone; icon: LucideIcon }[] = manager ? [
    { title: 'Projects', detail: 'The bigger picture', path: '/projects', tone: 'iris', icon: FolderKanban },
    { title: 'Reports', detail: 'Every day adds up', path: '/reports', tone: 'rose', icon: ClipboardList },
    { title: 'Analytics', detail: 'Read the rhythm', path: '/analytics', tone: 'sage', icon: BarChart3 },
    { title: 'My Day', detail: 'Space for your thoughts', path: '/my-day', tone: 'clay', icon: NotebookPen },
  ] : [
    { title: 'My Day', detail: 'Space for your thoughts', path: '/my-day', tone: 'sage', icon: NotebookPen },
    { title: 'Daily report', detail: 'Give your day a finish', path: '/(app)/(member)/report', tone: 'rose', icon: ClipboardList },
  ];
  return <View style={{ gap: 10 }}>{Array.from({ length: Math.ceil(shortcuts.length / 2) }, (_, row) => <View key={row} style={{ flexDirection: 'row', gap: 10 }}>{shortcuts.slice(row * 2, row * 2 + 2).map(({ title, detail, path, tone, icon: Icon }) => <AuroraCard key={path} tone={tone} onPress={() => onOpen(path)} accessibilityLabel={`Open ${title}`} style={{ minHeight: 146, padding: 18, justifyContent: 'space-between' }}>
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 10 }}><Icon size={22} color="#E5EDCE" strokeWidth={1.4} /><ArrowUpRight size={17} color="#E0E4DC" /></View>
    <View style={{ gap: 4, marginTop: 20 }}><Text variant="h3" color="#F8F8F1">{title}</Text><Text variant="caption" color="#E0E4DC">{detail}</Text></View>
  </AuroraCard>)}</View>)}</View>;
}
