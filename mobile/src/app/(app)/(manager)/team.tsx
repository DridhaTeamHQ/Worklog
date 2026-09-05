import { PageIntro } from '@/components/ScreenHeader';
import { useMemo, useState } from 'react';
import { FlatList, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Building2, Users } from 'lucide-react-native';
import { useTheme } from '@/theme';
import { useUser } from '@/auth/store';
import { useDepartments, useTeam } from '@/hooks/useTeam';
import { isAdmin } from '@/types';
import { EmptyState, ErrorState, IconPillButton, PickerSheet, Reveal, SearchField, SkeletonList, Text, useSheet, useTabBarInset } from '@/components';
import { useAutoHideTabBar } from '@/lib/tabBar';
import { MemberRow } from '@/features/MemberRow';

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
  const [department, setDepartment] = useState<string | null>(null);
  const deptSheet = useSheet();
  const departments = useDepartments(admin);
  const team = useTeam({ search: search || undefined, department: department ?? undefined });

  const submitted = useMemo(() => (team.data ?? []).filter((m) => m.submitted_today).length, [team.data]);

  const header = (
    <View style={{ gap: 12, paddingTop: insets.top + 12, paddingBottom: 16 }}>
      <PageIntro title="Team" tone="iris" eyebrow="BETTER TOGETHER" subtitle={team.data ? `${team.data.length} people · ${submitted} reported today` : ' '} right={<>{admin ? <IconPillButton icon={Building2} tone="glass" onPress={deptSheet.open} accessibilityLabel="Filter by department" /> : null}</>} />
      <SearchField value={search} onChange={setSearch} placeholder="Search by name, email or department" loading={team.isFetching && !!search} />
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: t.colors.ground }}>
      <FlatList
        data={team.isPending ? [] : team.data ?? []}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item, index }) => (
          <Reveal index={index} style={{ marginBottom: 16 }}>
            <MemberRow member={item} onPress={() => router.push(`/team/${item.id}`)} />
          </Reveal>
        )}
        ListHeaderComponent={header}
        ListEmptyComponent={team.isPending ? <SkeletonList count={4} lines={1} /> : team.isError ? <ErrorState error={team.error} onRetry={() => team.refetch()} /> : (
          <EmptyState icon={Users} title={search ? 'Nobody matches' : 'No team members yet'} body={search ? 'Try another name.' : admin ? 'Add people from the web app; they will appear here.' : 'Nobody is in your department yet.'} />
        )}
        contentContainerStyle={{ paddingHorizontal: t.spacing.screen, paddingBottom: bottom }}
        onScroll={barScroll.onScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        refreshing={team.isRefetching}
        onRefresh={() => team.refetch()}
        keyboardShouldPersistTaps="handled"
      />
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
