import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowUpRight, Bug, ClipboardCheck, FolderPlus, NotebookPen, Plus, type LucideIcon } from 'lucide-react-native';
import { IconPillButton, Sheet, Text, useSheet } from '@/components';
import { AuroraCard, type AuroraTone } from '@/components/AuroraCard';

export function QuickActions({ manager = false }: { manager?: boolean }) {
  const sheet = useSheet();
  const router = useRouter();
  const actions: { title: string; detail: string; icon: LucideIcon; tone: AuroraTone; path: '/tasks/assign' | '/projects/new' | '/my-day' | '/reports' | '/tickets/new' | '/(app)/(member)/report' }[] = manager ? [
    { title: 'Assign work', detail: 'Make the next move', icon: Plus, tone: 'sage', path: '/tasks/assign' },
    { title: 'New project', detail: 'Start something good', icon: FolderPlus, tone: 'iris', path: '/projects/new' },
    { title: 'My Day', detail: 'A thought to keep', icon: NotebookPen, tone: 'rose', path: '/my-day' },
    { title: 'Team reports', detail: 'See what moved', icon: ClipboardCheck, tone: 'clay', path: '/reports' },
  ] : [
    { title: 'Daily report', detail: 'Give your day a finish', icon: ClipboardCheck, tone: 'rose', path: '/(app)/(member)/report' },
    { title: 'Raise a ticket', detail: 'Get things unstuck', icon: Bug, tone: 'clay', path: '/tickets/new' },
    { title: 'My Day', detail: 'Make a little space', icon: NotebookPen, tone: 'sage', path: '/my-day' },
  ];
  return <>
    <IconPillButton icon={Plus} tone="accent" onPress={sheet.open} accessibilityLabel="Quick actions" />
    <Sheet ref={sheet.ref} title="Make your next move." scroll size="tall">
      <Text variant="small" color="inkMuted" style={{ marginBottom: 22 }}>A little momentum starts here.</Text>
      <View style={{ gap: 12 }}>
        {actions.map(({ title, detail, icon: Icon, tone, path }) => <AuroraCard key={title} tone={tone} accessibilityLabel={title} onPress={() => { sheet.close(); router.push(path); }} style={{ minHeight: 106 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
            <Icon size={26} strokeWidth={1.3} color="#E5EDCE" />
            <View style={{ flex: 1, gap: 4 }}><Text variant="h3" color="#F8F8F1">{title}</Text><Text variant="small" color="#E0E4DC">{detail}</Text></View>
            <ArrowUpRight size={20} color="#E0E4DC" />
          </View>
        </AuroraCard>)}
      </View>
    </Sheet>
  </>;
}
