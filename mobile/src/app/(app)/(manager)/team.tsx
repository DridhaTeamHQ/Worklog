import { PageIntro } from '@/components/ScreenHeader';
import { useMemo, useState } from 'react';
import { FlatList, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Building2, UserPlus, Users } from 'lucide-react-native';
import { useTheme } from '@/theme';
import { useUser } from '@/auth/store';
import { useAdmins, useDepartments, useTeam } from '@/hooks/useTeam';
import { isAdmin, roleLabel, type Manager, type TeamMember } from '@/types';
import { BentoCard, Chip, EmptyState, ErrorState, IconPillButton, PersonRow, PickerSheet, Reveal, SearchField, SegmentedTabs, SkeletonList, Text, useSheet, useTabBarInset } from '@/components';
import { useAutoHideTabBar } from '@/lib/tabBar';
import { MemberRow } from '@/features/MemberRow';
import { RoleSheet, type RolePerson } from '@/features/RoleSheet';

/** The roster. A manager sees their department; an admin can filter across all of them. */
export default function ManagerTeam() {
  const t = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const bottom = useTabBarInset();
  const barScroll = useAutoHideTabBar();
  const user = useUser();
  const admin = isAdmin(user?.role);
  const [search, setSearch] = useState('');
  const [scope, setScope] = useState<'team' | 'access'>('team');
  const [department, setDepartment] = useState<string | null>(null);
  const deptSheet = useSheet();
  const roleSheet = useSheet();
  const [target, setTarget] = useState<RolePerson | null>(null);
  const departments = useDepartments(admin);
  const team = useTeam({ search: search || undefined, department: department ?? undefined });
  // Managers and admins live on their own endpoint; only an admin may list them.
  const elevated = useAdmins(admin);
  const showing = scope === 'access' && admin;
  const rows: (TeamMember | Manager)[] = showing
    ? (elevated.data ?? []).filter((m) => !search || `${m.name} ${m.email}`.toLowerCase().includes(search.toLowerCase()))
    : (team.data ?? []);
  const source = showing ? elevated : team;

  const submitted = useMemo(() => (team.data ?? []).filter((m) => m.submitted_today).length, [team.data]);

  const header = (
    <View style={{ gap: 12, paddingTop: insets.top + 12, paddingBottom: 16 }}>
      <PageIntro title="Team" tone="iris" eyebrow="BETTER TOGETHER" subtitle={team.data ? `${team.data.length} people · ${submitted} reported today` : ' '} right={<>{admin ? <><IconPillButton icon={Building2} tone="glass" onPress={deptSheet.open} accessibilityLabel="Filter by department" /><IconPillButton icon={UserPlus} tone="glass" onPress={() => router.push('/team/new')} accessibilityLabel="Add a team member" /></> : null}</>} />
      {admin ? (
        <SegmentedTabs
          items={[{ key: 'team', label: 'Members', count: team.data?.length }, { key: 'access', label: 'Managers', count: elevated.data?.length }]}
          value={scope}
          onChange={setScope}
        />
      ) : null}
      <SearchField value={search} onChange={setSearch} placeholder={showing ? 'Search managers and admins' : 'Search by name, email or department'} loading={source.isFetching && !!search} />
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: t.colors.ground }}>
      <FlatList
        data={source.isPending ? [] : rows}
        keyExtractor={(item) => `${showing ? 'a' : 'm'}${item.id}`}
        renderItem={({ item, index }) => (
          <Reveal index={index} style={{ marginBottom: 16 }}>
            {'counts' in item ? (
              <MemberRow member={item} onPress={() => router.push(`/team/${item.id}`)} />
            ) : (
              <BentoCard onPress={item.id === user?.id ? undefined : () => { setTarget({ id: item.id, name: item.name, role: item.role, department: item.department, job_title: item.job_title }); roleSheet.open(); }}>
                <PersonRow
                  name={item.name}
                  subtitle={item.email}
                  src={item.profile_image}
                  right={<Chip label={roleLabel(item.role)} color={item.role === 'admin' ? t.colors.hero : t.colors.info} size="sm" />}
                />
                <Text variant="caption" color="inkFaint" style={{ marginTop: 10 }}>
                  {item.invited ? 'Invitation pending · ' : ''}{item.assigned_tasks} assigned · {item.open_tasks} still open
                  {item.id === user?.id ? ' · you' : ' · tap to change access'}
                </Text>
              </BentoCard>
            )}
          </Reveal>
        )}
        ListHeaderComponent={header}
        ListEmptyComponent={source.isPending ? <SkeletonList count={4} lines={1} /> : source.isError ? <ErrorState error={source.error} onRetry={() => source.refetch()} /> : (
          <EmptyState
            icon={Users}
            title={search ? 'Nobody matches' : 'No team members yet'}
            body={search ? 'Try another name.' : admin ? 'Add someone and they get an invite to set their own password.' : 'Nobody is in your department yet.'}
            action={!search && admin ? { label: 'Add a team member', onPress: () => router.push('/team/new') } : undefined}
          />
        )}
        contentContainerStyle={{ paddingHorizontal: t.spacing.screen, paddingBottom: bottom }}
        onScroll={barScroll.onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        refreshing={source.isRefetching}
        onRefresh={() => { void team.refetch(); void elevated.refetch(); }}
        keyboardShouldPersistTaps="handled"
      />
      <RoleSheet ref={roleSheet.ref} person={target} onDone={() => { roleSheet.close(); void elevated.refetch(); void team.refetch(); }} />
      <PickerSheet
        ref={deptSheet.ref}
        title="Department"
        options={(departments.data ?? []).map((d) => ({ value: d, label: d }))}
        value={department}
        onSelect={setDepartment}
        clearLabel="All departments"
        onClear={() => setDepartment(null)}
      />
    </View>
  );
}
