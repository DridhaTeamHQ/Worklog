import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { chatApi } from '../api/endpoints';
import { ChatContact, ChatGroup } from '../types';
import { Empty, Icon } from './components';
import { palette as p, s } from './theme';

type TabFilter = 'all' | 'direct' | 'groups';

function getInitials(name?: string) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function formatChatTime(dateString?: string | null): string {
  if (!dateString) return '';
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return '';
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    if (isToday) {
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
    }
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    }
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  } catch {
    return '';
  }
}

function formatChatSnippet(msg?: string | null): string {
  if (!msg) return '';
  const trimmed = msg.trim();
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed?.type === 'image') return parsed.caption ? `📷 ${parsed.caption}` : '📷 Photo';
      if (parsed?.type === 'video') return parsed.caption || parsed.name ? `🎥 ${parsed.caption || parsed.name}` : '🎥 Video';
      if (parsed?.type === 'file') return `📄 ${parsed.name || 'Document'}`;
      if (parsed?.type === 'sticker') return `${parsed.sticker || parsed.code || '🎭'} Sticker (${parsed.label || 'Reaction'})`;
    } catch {}
  }
  if (/^https?:\/\/.*\.(png|jpg|jpeg|gif|webp)/i.test(trimmed)) return '📷 Photo';
  if (/^https?:\/\/.*\.(mp4|mov|webm)/i.test(trimmed)) return '🎥 Video';
  if (/^https?:\/\/.*\.(pdf|docx?|xlsx?|zip)/i.test(trimmed)) return '📄 Document';
  return msg;
}

export function ChatScreen({ navigation }: any) {
  const [contacts, setContacts] = useState<ChatContact[]>([]);
  const [groups, setGroups] = useState<ChatGroup[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<TabFilter>('all');
  const [clearing, setClearing] = useState(false);

  const loadDirectory = useCallback(async (term = '') => {
    try {
      const [people, rooms] = await Promise.all([chatApi.contacts(term || undefined), chatApi.groups.list()]);
      setContacts(people.data || []);
      setGroups(rooms.data || []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadDirectory(search);
      const timer = setInterval(() => {
        void loadDirectory(search);
      }, 4000);
      return () => clearInterval(timer);
    }, [loadDirectory, search])
  );

  const openContact = (contact: ChatContact) => {
    navigation.navigate('ChatThread', { contact });
  };
  const openGroup = (group: ChatGroup) => {
    navigation.navigate('ChatThread', { group });
  };
  const openTeam = () => {
    navigation.navigate('ChatThread', { teamRoom: true });
  };

  const clearAllChats = () => {
    Alert.alert('Delete all chats?', 'Your chat history will be permanently deleted.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete all', style: 'destructive', onPress: async () => {
        setClearing(true);
        try {
          await chatApi.clearAll();
          setContacts([]); setGroups([]);
        } catch {
          Alert.alert('Could not delete chats', 'Please try again.');
        } finally { setClearing(false); }
      } },
    ]);
  };

  const filteredContacts = useMemo(() => {
    const list = contacts.filter(item =>
      `${item.name} ${item.email} ${item.department || ''}`.toLowerCase().includes(search.toLowerCase())
    );
    return list.sort((a, b) => {
      const timeA = a.last_message_at ? new Date(a.last_message_at).getTime() : 0;
      const timeB = b.last_message_at ? new Date(b.last_message_at).getTime() : 0;
      if (timeA !== timeB) {
        return timeB - timeA; // Latest messages on top
      }
      if (timeA > 0 && timeB === 0) return -1;
      if (timeB > 0 && timeA === 0) return 1;
      if (a.unread !== b.unread) {
        return b.unread - a.unread;
      }
      return a.name.localeCompare(b.name);
    });
  }, [contacts, search]);

  const filteredGroups = useMemo(() => {
    return groups.filter(item =>
      item.name.toLowerCase().includes(search.toLowerCase())
    );
  }, [groups, search]);

  const showTeam = filter === 'all' || filter === 'groups';
  const showGroups = filter === 'all' || filter === 'groups';
  const showDirect = filter === 'all' || filter === 'direct';

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {/* Top Header */}
      <View style={styles.header}>
        <View style={s.between}>
          <View>
            <Text style={styles.mainTitle}>Messages</Text>
            <Text style={styles.mainSubtitle}>Company & team communication</Text>
          </View>
          <View style={styles.statusIndicator}>
            <View style={styles.greenPill} />
            <Text style={styles.statusText}>Connected</Text>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="Delete all chat history" onPress={clearAllChats} disabled={clearing} style={{ marginLeft: 10, opacity: clearing ? 0.5 : 1 }}>
            <Icon name="trash-outline" size={20} color="#f87171" />
          </Pressable>
        </View>

        {/* Search Bar */}
        <View style={styles.searchBar}>
          <Icon name="search" size={16} color="#71717a" />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search conversations, people..."
            placeholderTextColor="#71717a"
            style={styles.searchInput}
          />
          {search.length > 0 && (
            <Pressable onPress={() => setSearch('')}>
              <Icon name="close-circle" size={16} color="#71717a" />
            </Pressable>
          )}
        </View>

        {/* Filter Pills */}
        <View style={styles.filterRow}>
          <Pressable
            onPress={() => setFilter('all')}
            style={[styles.filterChip, filter === 'all' && styles.filterChipActive]}
          >
            <Text style={[styles.filterText, filter === 'all' && styles.filterTextActive]}>All</Text>
          </Pressable>
          <Pressable
            onPress={() => setFilter('direct')}
            style={[styles.filterChip, filter === 'direct' && styles.filterChipActive]}
          >
            <Text style={[styles.filterText, filter === 'direct' && styles.filterTextActive]}>
              Direct ({contacts.length})
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setFilter('groups')}
            style={[styles.filterChip, filter === 'groups' && styles.filterChipActive]}
          >
            <Text style={[styles.filterText, filter === 'groups' && styles.filterTextActive]}>
              Channels & Groups ({groups.length + 1})
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Main List */}
      {loading ? (
        <View style={styles.loaderCenter}>
          <ActivityIndicator color={p.coral} size="small" />
        </View>
      ) : (
        <FlatList
          data={[]}
          renderItem={null}
          contentContainerStyle={{ paddingBottom: 10 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                void loadDirectory(search);
              }}
              tintColor={p.coral}
            />
          }
          ListHeaderComponent={
            <View>
              {/* Pinned Team Channel */}
              {showTeam && !search && (
                <>
                  <Pressable
                    onPress={openTeam}
                    style={({ pressed }) => [styles.listItem, pressed && styles.listItemPressed]}
                  >
                    <View style={[styles.avatarBox, styles.teamAvatarBg]}>
                      <Icon name="megaphone" color="#f4553c" size={18} />
                    </View>
                    <View style={styles.itemBody}>
                      <View style={styles.itemTitleRow}>
                        <View style={styles.nameWithBadge}>
                          <Text style={styles.itemTitle}>Company Team Chat</Text>
                          <View style={styles.officialBadge}>
                            <Text style={styles.officialBadgeText}>ALL</Text>
                          </View>
                        </View>
                        <Text style={styles.itemMeta}>Broadcast</Text>
                      </View>
                      <Text numberOfLines={1} style={styles.itemSnippet}>
                        General company updates & announcements
                      </Text>
                    </View>
                  </Pressable>
                  <View style={styles.divider} />
                </>
              )}

              {/* Group Channels */}
              {showGroups && filteredGroups.length > 0 && (
                <>
                  {filter === 'all' && (
                    <Text style={styles.sectionHeader}>CHANNELS</Text>
                  )}
                  {filteredGroups.map(group => (
                    <View key={`group-${group.id}`}>
                      <Pressable
                        onPress={() => openGroup(group)}
                        style={({ pressed }) => [styles.listItem, pressed && styles.listItemPressed]}
                      >
                        <View style={[styles.avatarBox, styles.groupAvatarBg]}>
                          <Icon name="people" color="#c084fc" size={18} />
                        </View>
                        <View style={styles.itemBody}>
                          <View style={styles.itemTitleRow}>
                            <Text style={styles.itemTitle}>{group.name}</Text>
                            {group.unread > 0 && (
                              <View style={styles.unreadBadge}>
                                <Text style={styles.unreadText}>{group.unread}</Text>
                              </View>
                            )}
                          </View>
                          <Text numberOfLines={1} style={styles.itemSnippet}>
                            {formatChatSnippet(group.last_message) || `${group.member_count} team members`}
                          </Text>
                        </View>
                      </Pressable>
                      <View style={styles.divider} />
                    </View>
                  ))}
                </>
              )}

              {/* Direct Messages */}
              {showDirect && (
                <>
                  {filter === 'all' && (
                    <Text style={styles.sectionHeader}>DIRECT MESSAGES</Text>
                  )}
                  {filteredContacts.map((contact, idx) => {
                    const formattedTime = formatChatTime(contact.last_message_at);
                    const isLast = idx === filteredContacts.length - 1;
                    return (
                      <View key={`contact-${contact.id}`}>
                        <Pressable
                          onPress={() => openContact(contact)}
                          style={({ pressed }) => [styles.listItem, pressed && styles.listItemPressed]}
                        >
                          <View style={styles.avatarWrapper}>
                            {contact.profile_image ? (
                              <Image source={{ uri: contact.profile_image }} style={styles.avatarImg} />
                            ) : (
                              <View style={[styles.avatarImg, styles.avatarFallback]}>
                                <Text style={styles.avatarText}>{getInitials(contact.name)}</Text>
                              </View>
                            )}
                            <View style={styles.onlineDot} />
                          </View>

                          <View style={styles.itemBody}>
                            <View style={styles.itemTitleRow}>
                              <Text style={styles.itemTitle} numberOfLines={1}>
                                {contact.name}
                              </Text>
                              {Boolean(formattedTime) && (
                                <Text style={styles.itemMeta}>{formattedTime}</Text>
                              )}
                            </View>
                            <View style={styles.snippetRow}>
                              <Text
                                numberOfLines={1}
                                style={[
                                  styles.itemSnippet,
                                  Boolean(contact.unread > 0) && { color: '#fafafa', fontWeight: '600' },
                                ]}
                              >
                                {formatChatSnippet(contact.last_message) || contact.department || 'Tap to send message'}
                              </Text>
                              {contact.unread > 0 && (
                                <View style={styles.unreadBadge}>
                                  <Text style={styles.unreadText}>{contact.unread}</Text>
                                </View>
                              )}
                            </View>
                          </View>
                        </Pressable>
                        {!isLast && <View style={styles.divider} />}
                      </View>
                    );
                  })}
                </>
              )}

              {filteredContacts.length === 0 && filteredGroups.length === 0 && (
                <Empty title="No conversations" detail="No contacts or chats matched your search." />
              )}
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#09090b',
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#1c1c20',
  },
  mainTitle: {
    color: '#fafafa',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  mainSubtitle: {
    color: '#71717a',
    fontSize: 11.5,
    marginTop: 2,
  },
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.25)',
  },
  greenPill: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#22c55e',
  },
  statusText: {
    color: '#22c55e',
    fontSize: 10.5,
    fontWeight: '600',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#18181b',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#27272a',
    paddingHorizontal: 10,
    height: 36,
    marginTop: 10,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    color: '#fafafa',
    fontSize: 12.5,
    paddingVertical: 0,
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginTop: 10,
    marginBottom: 4,
  },
  filterChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
    backgroundColor: '#141416',
    borderWidth: 1,
    borderColor: '#242428',
  },
  filterChipActive: {
    backgroundColor: 'rgba(244, 85, 60, 0.14)',
    borderColor: 'rgba(244, 85, 60, 0.5)',
  },
  filterText: {
    color: '#71717a',
    fontSize: 11,
    fontWeight: '500',
  },
  filterTextActive: {
    color: '#f4553c',
    fontWeight: '600',
  },
  sectionHeader: {
    fontSize: 10.5,
    fontWeight: '700',
    letterSpacing: 0.6,
    color: '#52525b',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 4,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    gap: 12,
  },
  listItemPressed: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },
  avatarWrapper: {
    position: 'relative',
  },
  avatarBox: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImg: {
    width: 38,
    height: 38,
    borderRadius: 19,
  },
  avatarFallback: {
    backgroundColor: '#27272a',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#3f3f46',
  },
  avatarText: {
    color: '#fafafa',
    fontSize: 13,
    fontWeight: '600',
  },
  teamAvatarBg: {
    backgroundColor: 'rgba(244, 85, 60, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(244, 85, 60, 0.35)',
  },
  groupAvatarBg: {
    backgroundColor: 'rgba(168, 85, 247, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(168, 85, 247, 0.35)',
  },
  onlineDot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: '#22c55e',
    position: 'absolute',
    bottom: 0,
    right: 0,
    borderWidth: 1.5,
    borderColor: '#09090b',
  },
  itemBody: {
    flex: 1,
    gap: 2,
  },
  itemTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  nameWithBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  officialBadge: {
    backgroundColor: 'rgba(244, 85, 60, 0.2)',
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(244, 85, 60, 0.4)',
  },
  officialBadgeText: {
    color: '#f4553c',
    fontSize: 8.5,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  itemTitle: {
    color: '#fafafa',
    fontSize: 13.5,
    fontWeight: '600',
  },
  itemMeta: {
    color: '#71717a',
    fontSize: 10.5,
  },
  snippetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  itemSnippet: {
    color: '#a1a1aa',
    fontSize: 11.5,
    flex: 1,
  },
  unreadBadge: {
    backgroundColor: '#f4553c',
    borderRadius: 9,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadText: {
    color: '#ffffff',
    fontSize: 9.5,
    fontWeight: '700',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#1f1f23',
    marginLeft: 66,
  },
  loaderCenter: {
    padding: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
