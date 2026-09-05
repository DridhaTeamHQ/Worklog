import { AppearancePicker } from './AppearancePicker';
import { WorkspaceShortcuts } from './WorkspaceShortcuts';
import { Sheet } from '@/components/Sheet';
import { IdentityCard, SectionTitle, PageIntro } from '@/components';
import { Alert, View } from 'react-native';
import {
  Bell, KeyRound, LogOut, Moon, Search, Sun, SmartphoneNfc, Tags, UserRound,
} from 'lucide-react-native';
import { useTheme, useThemeMode } from '@/theme';
import { useAuthStore } from '@/auth/store';
import { isManagerLevel, roleLabel, type User } from '@/types';
import { Avatar, BentoCard, ListGroup, ListRow, PickerSheet, Reveal, Screen, Text, useSheet } from '@/components';

interface Props {
  user: User | null;
  unread: number;
  onOpen: (path: string) => void;
}

/** The "More" tab: who you are, then grouped rows. Nothing competes for attention. */
export function MoreScreen({ user, unread, onOpen }: Props) {
  const t = useTheme();
  const { mode, setMode } = useThemeMode();
  const signOut = useAuthStore((s) => s.signOut);
  const themeSheet = useSheet();
  const manager = isManagerLevel(user?.role);

  const confirmSignOut = () => {
    Alert.alert('Sign out?', 'You can sign out of this phone, or everywhere at once.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'This phone', onPress: () => void signOut() },
      { text: 'Everywhere', style: 'destructive', onPress: () => void signOut({ everywhere: true }) },
    ]);
  };

  return (
    <Screen tabBar>
      <View style={{ gap: 6, paddingHorizontal: 4, paddingVertical: 8 }}>
        <Text variant="caption" color="inkMuted" style={{ letterSpacing: 2 }}>YOUR SPACE</Text>
        <Text variant="h1">Make it yours.</Text>
      </View>
      <Reveal>
        <IdentityCard compact name={user?.name ?? 'Your profile'} image={user?.profile_image} subtitle={user?.email} detail={`${roleLabel(user?.role)}${user?.department ? ` · ${user.department}` : ''}`} onPress={() => onOpen('/profile')} />
      </Reveal>
      <SectionTitle title="Workspace" />

      <Reveal index={1}><WorkspaceShortcuts manager={manager} onOpen={onOpen} /></Reveal>
      <Reveal index={2}>
        <ListGroup>
          <ListRow icon={Search} label="Search workspace" hint="Tasks, tickets & projects" onPress={() => onOpen('/search')} />
          <ListRow icon={Bell} label="Notifications" hint={unread ? `${unread} unread` : undefined} badge={unread} onPress={() => onOpen('/notifications')} divider />
          {manager ? (
            <>
              <ListRow icon={Tags} label="Labels" onPress={() => onOpen('/labels')} divider />
            </>
          ) : null}
        </ListGroup>
      </Reveal>

      <SectionTitle title="Preferences & account" />
      <Reveal index={2}>
        <ListGroup>
          <ListRow icon={UserRound} label="Profile" onPress={() => onOpen('/profile')} />
          <ListRow icon={KeyRound} label="Change password" onPress={() => onOpen('/profile/password')} divider />
          <ListRow icon={mode === 'dark' ? Moon : Sun} label="Appearance" hint={mode === 'system' ? 'Follows the phone' : mode === 'dark' ? 'Dark' : 'Light'} onPress={themeSheet.open} divider />
          <ListRow icon={SmartphoneNfc} label="Notifications on this phone" onPress={() => onOpen('/notifications?settings=1')} divider />
        </ListGroup>
      </Reveal>

      <Reveal index={3}>
        <ListGroup>
          <ListRow icon={LogOut} label="Sign out" danger onPress={confirmSignOut} />
        </ListGroup>
      </Reveal>

      <Text variant="caption" color="inkFaint" align="center" style={{ marginTop: t.spacing.sm }}>taskr · a little more clarity</Text>

      <Sheet ref={themeSheet.ref} title="Choose your atmosphere.">
        <AppearancePicker value={mode} onChange={(next) => { setMode(next); themeSheet.close(); }} />
      </Sheet>
    </Screen>
  );
}
