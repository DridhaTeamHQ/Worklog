import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { chatApi } from '../api/endpoints';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { ChatContact, ChatGroup, ChatMessage, GroupMessage, TeamMessage } from '../types';
import { Empty, Icon } from './components';
import { palette as p, s } from './theme';

type RoomMessage = ChatMessage | TeamMessage | GroupMessage;

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

export function ChatThreadScreen({ route, navigation }: any) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { error: showError } = useToast();
  const contact: ChatContact | undefined = route?.params?.contact;
  const group: ChatGroup | undefined = route?.params?.group;
  const teamRoom: boolean = Boolean(route?.params?.teamRoom);

  const [messages, setMessages] = useState<RoomMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const listRef = useRef<FlatList<RoomMessage>>(null);
  const lastMessageId = useRef(0);
  const firstLoad = useRef(true);

  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => setKeyboardVisible(true)
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setKeyboardVisible(false)
    );
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  useEffect(() => {
    let live = true;
    const load = async () => {
      try {
        const after = firstLoad.current ? 0 : lastMessageId.current;
        const result = group
          ? await chatApi.groups.messages(group.id, after)
          : teamRoom
          ? await chatApi.teamMessages(after)
          : contact
          ? await chatApi.messages(contact.id, after)
          : null;
        if (live && result?.data) {
          if (result.data.length) {
            lastMessageId.current = Math.max(lastMessageId.current, ...result.data.map(message => message.id));
            setMessages(previous => firstLoad.current
              ? result.data
              : [...previous, ...result.data.filter(message => !previous.some(existing => existing.id === message.id))]);
          }
          firstLoad.current = false;
          setLoadingHistory(false);
        }
      } catch {
        // A failed poll should keep the conversation visible and retry next cycle.
        if (live) setLoadingHistory(false);
      }
    };
    void load();
    const timer = setInterval(() => {
      void load();
    }, 4000);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, [contact, group, teamRoom]);

  // Keep the newest message visible after sending or receiving while the keyboard
  // is open. The content-size callback below also covers the initial history load.
  useEffect(() => {
    if (messages.length === 0) return;
    requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
  }, [messages.length]);

  const send = async () => {
    const body = draft.trim();
    if (!body || sending) return;
    setSending(true);
      try {
      const result = group
        ? await chatApi.groups.send(group.id, body)
        : teamRoom
        ? await chatApi.sendTeam(body)
        : contact
        ? await chatApi.send(contact.id, body)
        : null;
      if (result?.data) {
        lastMessageId.current = Math.max(lastMessageId.current, result.data.id);
        setMessages(previous => [...previous, result.data]);
      }
      setDraft('');
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Could not send the message.');
    } finally {
      setSending(false);
    }
  };

  const title = group?.name || (teamRoom ? 'Company Team Chat' : contact?.name || 'Chat');
  const subtitle = group
    ? `${group.member_count} members`
    : teamRoom
    ? 'Everyone in the company'
    : contact?.department || 'Direct message';

  const androidClearance = insets.bottom > 20 ? insets.bottom + 12 : 58;
  const bottomInsetPadding = keyboardVisible
    ? (Platform.OS === 'ios' ? 10 : 12)
    : Platform.OS === 'android'
    ? androidClearance
    : Math.max(insets.bottom, 16) + 8;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {/* Header */}
      <View style={styles.threadHeader}>
        <Pressable
          accessibilityLabel="Back to chats"
          onPress={() => navigation.goBack()}
          style={({ pressed }) => [styles.backButton, pressed && { opacity: 0.7 }]}
        >
          <Icon name="chevron-back" size={20} color="#fafafa" />
        </Pressable>

        {contact && (
          <View style={styles.avatarWrapper}>
            {contact.profile_image ? (
              <Image source={{ uri: contact.profile_image }} style={styles.threadAvatar} />
            ) : (
              <View style={[styles.threadAvatar, styles.avatarFallback]}>
                <Text style={styles.avatarText}>{getInitials(contact.name)}</Text>
              </View>
            )}
            <View style={styles.onlineDot} />
          </View>
        )}

        {group && (
          <View style={[styles.threadAvatar, styles.groupAvatarBg]}>
            <Icon name="people" color="#c084fc" size={17} />
          </View>
        )}

        {teamRoom && (
          <View style={[styles.threadAvatar, styles.teamAvatarBg]}>
            <Icon name="megaphone" color="#f4553c" size={16} />
          </View>
        )}

        <View style={s.grow}>
          <Text style={styles.threadTitle} numberOfLines={1}>{title}</Text>
          <Text style={styles.threadSubtitle} numberOfLines={1}>{subtitle}</Text>
        </View>
      </View>

      {/* Message Thread */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top : 0}
      >
        <FlatList
          ref={listRef}
          data={messages}
          onContentSizeChange={() => {
            if (messages.length > 0) listRef.current?.scrollToEnd({ animated: true });
          }}
          keyExtractor={item => String(item.id)}
          contentContainerStyle={styles.messageList}
          renderItem={({ item }) => {
            const mine = item.sender_id === user?.id;
            const formattedTime = formatChatTime(item.created_at);
            const isDirectMessage = 'read_at' in item;
            return (
          <View style={[styles.messageRow, mine ? styles.messageMineRow : styles.messageOtherRow]}>
                <View style={[styles.messageBubble, mine ? styles.messageMineBubble : styles.messageOtherBubble]}>
                  <Text style={[styles.messageWho, mine ? styles.messageMineTime : styles.messageOtherTime]}>
                    {mine ? 'You' : (contact?.name || item.sender_name || 'Sender')}
                  </Text>
                  {!mine && item.sender_name && (
                    <Text style={styles.senderName}>{item.sender_name}</Text>
                  )}
                  <Text style={[styles.messageText, mine ? styles.messageMineText : styles.messageOtherText]}>
                    {item.body}
                  </Text>
                      {Boolean(formattedTime) && (
                    <Text style={[styles.messageTime, mine ? styles.messageMineTime : styles.messageOtherTime]}>
                      {formattedTime}{mine && isDirectMessage ? `  ${item.read_at ? '✓✓' : '✓'}` : ''}
                    </Text>
                  )}
                </View>
              </View>
            );
          }}
          ListEmptyComponent={
            loadingHistory ? <ActivityIndicator color={p.coral} style={{ marginTop: 32 }} /> : <Empty title="No messages yet" detail="Send a message to start this discussion." />
          }
        />

        {/* Input Bar with clear bottom padding */}
        <View style={[styles.inputBarContainer, { paddingBottom: bottomInsetPadding }]}>
          <View style={styles.inputInner}>
            <TextInput
              style={styles.chatInput}
              placeholder="Type a message..."
              placeholderTextColor="#71717a"
              value={draft}
              onChangeText={setDraft}
              onFocus={() => requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }))}
              onSubmitEditing={() => void send()}
              returnKeyType="send"
            />
            <Pressable
              disabled={sending || !draft.trim()}
              onPress={() => void send()}
              style={({ pressed }) => [
                styles.sendButton,
                !draft.trim() && styles.sendButtonDisabled,
                pressed && { opacity: 0.8 },
              ]}
            >
              {sending ? (
                <ActivityIndicator color="#ffffff" size="small" />
              ) : (
                <Icon
                  name="send"
                  color={draft.trim() ? '#ffffff' : 'rgba(255, 255, 255, 0.45)'}
                  size={15}
                />
              )}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#09090b',
  },
  threadHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 9,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#222226',
    backgroundColor: '#111114',
  },
  backButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1c1c20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  threadAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarWrapper: {
    position: 'relative',
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
  threadTitle: {
    color: '#fafafa',
    fontSize: 14,
    fontWeight: '600',
  },
  threadSubtitle: {
    color: '#71717a',
    fontSize: 10.5,
  },
  messageList: {
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 14,
    gap: 8,
    flexGrow: 1,
  },
  messageRow: {
    flexDirection: 'row',
  },
  messageMineRow: {
    justifyContent: 'flex-end',
  },
  messageOtherRow: {
    justifyContent: 'flex-start',
  },
  messageBubble: {
    maxWidth: '82%',
    paddingHorizontal: 11,
    paddingVertical: 7,
  },
  messageMineBubble: {
    backgroundColor: '#f4553c',
    borderRadius: 14,
    borderBottomRightRadius: 2,
  },
  messageOtherBubble: {
    backgroundColor: '#1f1f23',
    borderWidth: 1,
    borderColor: '#2c2c31',
    borderRadius: 14,
    borderBottomLeftRadius: 2,
  },
  senderName: {
    color: '#a78bfa',
    fontSize: 10,
    fontWeight: '600',
    marginBottom: 2,
  },
  messageText: {
    fontSize: 12.5,
    lineHeight: 17,
  },
  messageWho: {
    fontSize: 10,
    fontWeight: '700',
    marginBottom: 3,
  },
  messageMineText: {
    color: '#ffffff',
  },
  messageOtherText: {
    color: '#fafafa',
  },
  messageTime: {
    fontSize: 8.5,
    marginTop: 3,
    alignSelf: 'flex-end',
  },
  messageMineTime: {
    color: 'rgba(255, 255, 255, 0.75)',
  },
  messageOtherTime: {
    color: '#71717a',
  },
  inputBarContainer: {
    paddingHorizontal: 12,
    paddingTop: 8,
    backgroundColor: '#111114',
    borderTopWidth: 1,
    borderTopColor: '#222226',
  },
  inputInner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#18181b',
    borderWidth: 1,
    borderColor: '#27272a',
    borderRadius: 22,
    paddingHorizontal: 12,
    paddingVertical: 4,
    minHeight: 42,
    gap: 8,
  },
  chatInput: {
    flex: 1,
    color: '#fafafa',
    fontSize: 13,
    minHeight: 34,
    maxHeight: 90,
    paddingVertical: 4,
    paddingRight: 6,
  },
  sendButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f4553c',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  sendButtonDisabled: {
    backgroundColor: 'rgba(244, 85, 60, 0.25)',
  },
});
