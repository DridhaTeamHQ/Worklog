import { Alert, View } from 'react-native';
import {
  BarChart3, Bell, ClipboardList, FolderKanban, KeyRound, LogOut, Moon, NotebookPen, Sun, SmartphoneNfc, Tags, UserRound,
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
      <Reveal>
        <BentoCard onPress={() => onOpen('/profile')}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
            <Avatar name={user?.name ?? ''} src={user?.profile_image} size="lg" />
            <View style={{ flex: 1, gap: 2 }}>
              <Text variant="h3" numberOfLines={1}>{user?.name}</Text>
              <Text variant="small" color="inkMuted" numberOfLines={1}>{user?.email}</Text>
              <Text variant="caption" color="inkFaint">{roleLabel(user?.role)}{user?.department ? ` · ${user.department}` : ''}</Text>
            </View>
          </View>
        </BentoCard>
      </Reveal>

      <Reveal index={1}>
        <ListGroup>
          <ListRow icon={Bell} label="Notifications" hint={unread ? `${unread} unread` : undefined} badge={unread} onPress={() => onOpen('/notifications')} />
          <ListRow icon={NotebookPen} label="My Day" hint="Private notes to yourself" onPress={() => onOpen('/my-day')} divider />
          {manager ? (
            <>
              <ListRow icon={ClipboardList} label="Task reports" hint="The whole team, by day" onPress={() => onOpen('/reports')} divider />
              <ListRow icon={FolderKanban} label="Projects" onPress={() => onOpen('/projects')} divider />
              <ListRow icon={Tags} label="Labels" onPress={() => onOpen('/labels')} divider />
              <ListRow icon={BarChart3} label="Analytics" onPress={() => onOpen('/analytics')} divider />
            </>
          ) : null}
        </ListGroup>
      </Reveal>

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

      <Text variant="caption" color="inkFaint" align="center" style={{ marginTop: t.spacing.sm }}>Taskr · same data as the web app</Text>

      <PickerSheet
        ref={themeSheet.ref}
        title="Appearance"
        options={[
          { value: 'system', label: 'Follow the phone', hint: 'Light or dark, whatever the system says' },
          { value: 'light', label: 'Light' },
          { value: 'dark', label: 'Dark', hint: 'True black' },
        ]}
        value={mode}
        onSelect={(v) => setMode(v)}
      />
    </Screen>
  );
}
