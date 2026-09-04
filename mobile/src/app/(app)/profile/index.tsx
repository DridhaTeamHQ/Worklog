import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { KeyRound, Pencil } from 'lucide-react-native';
import { useProfile } from '@/hooks/useProfile';
import { useUser } from '@/auth/store';
import { formatDateShort } from '@/lib/format';
import { roleLabel } from '@/types';
import { Avatar, ErrorState, IconPillButton, ListGroup, ListRow, LoadingState, Reveal, Screen, ScreenHeader, Text, ValueRow } from '@/components';

export default function Profile() {
  const router = useRouter();
  const cached = useUser();
  const profile = useProfile();
  const u = profile.data ?? cached;

  return (
    <Screen refreshing={profile.isRefetching} onRefresh={() => profile.refetch()}>
      <ScreenHeader big={false} right={<IconPillButton icon={Pencil} tone="plain" onPress={() => router.push('/profile/edit')} accessibilityLabel="Edit profile" />} />
      {profile.isError && !u ? <ErrorState error={profile.error} onRetry={() => profile.refetch()} /> : !u ? <LoadingState /> : (
        <>
          <Reveal>
            <View style={{ alignItems: 'center', gap: 12, paddingVertical: 8 }}>
              <Avatar name={u.name} src={u.profile_image} size="xl" />
              <View style={{ alignItems: 'center', gap: 2 }}>
                <Text variant="h2" align="center">{u.name}</Text>
                <Text variant="body" color="inkMuted" align="center">{roleLabel(u.role)}{u.department ? ` · ${u.department}` : ''}</Text>
              </View>
            </View>
          </Reveal>
          <Reveal index={1}>
            <ListGroup>
              <ValueRow label="Email" value={u.email} />
              <ValueRow label="Job title" value={u.job_title || '—'} divider />
              <ValueRow label="Department" value={u.department || '—'} divider />
              <ValueRow label="Phone" value={u.phone || '—'} divider />
              <ValueRow label="Timezone" value={u.timezone || 'Default'} divider />
              <ValueRow label="Joined" value={formatDateShort(u.created_at)} divider />
            </ListGroup>
          </Reveal>
          <Reveal index={2}>
            <ListGroup>
              <ListRow icon={Pencil} label="Edit details" onPress={() => router.push('/profile/edit')} />
              <ListRow icon={KeyRound} label="Change password" hint="Signs out every other device" onPress={() => router.push('/profile/password')} divider />
            </ListGroup>
          </Reveal>
        </>
      )}
    </Screen>
  );
}
