import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { chatApi } from '../api/endpoints';
import { getServerUrl, tokenStore } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { ChatContact, ChatGroup, ChatMessage, GroupMessage, TeamMessage } from '../types';
import { Empty, Icon } from './components';
import { palette as p, s } from './theme';

type RoomMessage = ChatMessage | TeamMessage | GroupMessage;

export interface ParsedMessage {
  type: 'text' | 'image' | 'video' | 'file' | 'sticker';
  text?: string;
  url?: string;
  name?: string;
  size?: string;
  caption?: string;
  sticker?: string;
  code?: string;
  label?: string;
}

export function parseMessageBody(body?: string | null): ParsedMessage {
  if (!body) return { type: 'text', text: '' };
  const trimmed = body.trim();
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && typeof parsed === 'object' && parsed.type) {
        return parsed as ParsedMessage;
      }
    } catch {
      // not json, continue
    }
  }
  // Detect direct image URLs
  if (/^https?:\/\/.*\.(png|jpg|jpeg|gif|webp)(\?.*)?$/i.test(trimmed)) {
    return { type: 'image', url: trimmed };
  }
  // Detect direct video URLs
  if (/^https?:\/\/.*\.(mp4|mov|webm)(\?.*)?$/i.test(trimmed)) {
    return { type: 'video', url: trimmed, name: 'Video attachment' };
  }
  // Detect direct document/file URLs
  if (/^https?:\/\/.*\.(pdf|docx?|xlsx?|pptx?|zip|rar|csv|txt)(\?.*)?$/i.test(trimmed)) {
    const filename = trimmed.split('/').pop()?.split('?')[0] || 'Document';
    return { type: 'file', url: trimmed, name: filename };
  }
  return { type: 'text', text: body };
}



async function uploadToCloud(uri: string, name: string, mimeType?: string): Promise<string> {
  const cleanName = name || `upload_${Date.now()}.jpg`;
  const cleanType = mimeType || 'image/jpeg';
  const serverBase = getServerUrl();
  const token = await tokenStore.get();

  // 1. Direct upload to local Worklog backend
  try {
    const formData = new FormData();
    formData.append('file', {
      uri,
      name: cleanName,
      type: cleanType,
    } as any);

    const res = await fetch(`${serverBase}/chat/upload`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: formData,
    });
    if (res.ok) {
      const json = await res.json();
      if (json?.data?.url) {
        const fileUrl = json.data.url;
        return fileUrl.startsWith('/') ? `${serverBase.replace(/\/api\/?$/, '')}${fileUrl}` : fileUrl;
      }
    }
  } catch (err) {
    console.warn('Backend upload failed on mobile:', err);
  }

  // 2. Fetch blob fallback
  try {
    const fileRes = await fetch(uri);
    const blob = await fileRes.blob();
    const res = await fetch(`${serverBase}/chat/upload`, {
      method: 'POST',
      headers: {
        'x-filename': encodeURIComponent(cleanName),
        'content-type': cleanType,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: blob,
    });
    if (res.ok) {
      const json = await res.json();
      if (json?.data?.url) {
        const fileUrl = json.data.url;
        return fileUrl.startsWith('/') ? `${serverBase.replace(/\/api\/?$/, '')}${fileUrl}` : fileUrl;
      }
    }
  } catch (blobErr) {
    console.warn('Blob upload failed:', blobErr);
  }

  return uri;
}

const STICKER_PACKS = [
  {
    id: 'work',
    name: 'Work',
    stickers: [
      { emoji: '🚀', label: 'Shipped!' },
      { emoji: '✅', label: 'Approved' },
      { emoji: '🎯', label: 'Target Hit' },
      { emoji: '💼', label: 'On It!' },
      { emoji: '🕒', label: 'In Progress' },
      { emoji: '⚠️', label: 'Urgent' },
      { emoji: '🤝', label: 'Done Deal' },
      { emoji: '📌', label: 'Noted' },
      { emoji: '💡', label: 'Great Idea' },
      { emoji: '📞', label: 'Call Me' },
    ],
  },
  {
    id: 'cheers',
    name: 'Cheers',
    stickers: [
      { emoji: '🔥', label: 'Super Fire' },
      { emoji: '👏', label: 'Kudos!' },
      { emoji: '🥳', label: 'Congrats!' },
      { emoji: '💯', label: '100% Agree' },
      { emoji: '🙌', label: 'Thank You' },
      { emoji: '❤️', label: 'Love It' },
      { emoji: '⭐', label: 'Top Star' },
      { emoji: '💪', label: 'Keep Pushing' },
    ],
  },
  {
    id: 'status',
    name: 'Status',
    stickers: [
      { emoji: '☕', label: 'Coffee Break' },
      { emoji: '🍕', label: 'Lunch Time' },
      { emoji: '🧠', label: 'Thinking' },
      { emoji: '😂', label: 'Lol' },
      { emoji: '👀', label: 'Checking' },
      { emoji: '🎉', label: 'Celebration' },
      { emoji: '🏃', label: 'BRB' },
      { emoji: '✨', label: 'All Good' },
    ],
  },
];

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
  const { error: showError, success: showSuccess } = useToast();
  const contact: ChatContact | undefined = route?.params?.contact;
  const group: ChatGroup | undefined = route?.params?.group;
  const teamRoom: boolean = Boolean(route?.params?.teamRoom);

  const [messages, setMessages] = useState<RoomMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  // Sticker tray & Attachment modal states
  const [stickerTrayOpen, setStickerTrayOpen] = useState(false);
  const [activeStickerTab, setActiveStickerTab] = useState(0);
  const [attachmentModalOpen, setAttachmentModalOpen] = useState(false);

  // In-app Fullscreen Photo Viewer
  const [previewImage, setPreviewImage] = useState<{ url: string; caption?: string; name?: string } | null>(null);

  // Edit message states
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingMessage, setEditingMessage] = useState<RoomMessage | null>(null);
  const [editText, setEditText] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  const listRef = useRef<FlatList<RoomMessage>>(null);
  const lastMessageId = useRef(0);
  const firstLoad = useRef(true);

  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => {
        setKeyboardVisible(true);
        setStickerTrayOpen(false);
      }
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

  useEffect(() => {
    if (messages.length === 0) return;
    requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
  }, [messages.length]);

  const sendMessage = async (customPayload?: string) => {
    const content = (customPayload ?? draft).trim();
    if (!content || sending) return;
    setSending(true);
    try {
      const result = group
        ? await chatApi.groups.send(group.id, content)
        : teamRoom
          ? await chatApi.sendTeam(content)
          : contact
            ? await chatApi.send(contact.id, content)
            : null;
      if (result?.data) {
        lastMessageId.current = Math.max(lastMessageId.current, result.data.id);
        setMessages(previous => [...previous, result.data]);
      }
      if (!customPayload) {
        setDraft('');
      }
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Could not send the message.');
    } finally {
      setSending(false);
    }
  };

  const handleDeleteMessage = async (messageId: number) => {
    try {
      if (group) {
        await chatApi.groups.remove(group.id, messageId);
      } else if (teamRoom) {
        await chatApi.removeTeam(messageId);
      } else {
        await chatApi.remove(messageId);
      }
      setMessages(previous => previous.filter(message => message.id !== messageId));
      showSuccess('Message deleted');
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Could not delete message.');
    }
  };

  const handleSaveEdit = async () => {
    if (!editingMessage) return;
    const trimmed = editText.trim();
    if (!trimmed) {
      showError('Message cannot be empty.');
      return;
    }

    setSavingEdit(true);
    try {
      const parsed = parseMessageBody(editingMessage.body);
      let newBody = trimmed;
      if (parsed.type === 'image' || parsed.type === 'video') {
        newBody = JSON.stringify({ ...parsed, caption: trimmed });
      } else if (parsed.type === 'file') {
        newBody = JSON.stringify({ ...parsed, name: trimmed });
      } else {
        newBody = trimmed;
      }

      if (group) {
        await chatApi.groups.edit(group.id, editingMessage.id, newBody);
      } else if (teamRoom) {
        await chatApi.editTeam(editingMessage.id, newBody);
      } else {
        await chatApi.edit(editingMessage.id, newBody);
      }

      setMessages(previous =>
        previous.map(message =>
          message.id === editingMessage.id ? { ...message, body: newBody } : message
        )
      );
      showSuccess('Message updated');
      setEditModalVisible(false);
      setEditingMessage(null);
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Could not update message.');
    } finally {
      setSavingEdit(false);
    }
  };

  const onMessageLongPress = (item: RoomMessage) => {
    if (item.sender_id !== user?.id) return;
    const parsed = parseMessageBody(item.body);
    const isEditable = parsed.type === 'text';
    const initialText = parsed.text ?? (parsed.type === 'text' ? item.body : '');

    const actions = [];

    if (isEditable) {
      actions.push({
        text: 'Edit Message',
        onPress: () => {
          setEditingMessage(item);
          setEditText(initialText || '');
          setEditModalVisible(true);
        },
      });
    }

    actions.push({
      text: 'Delete Message',
      style: 'destructive' as const,
      onPress: () => {
        Alert.alert(
          'Delete Message',
          'Are you sure you want to delete this message? This cannot be undone.',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Delete',
              style: 'destructive',
              onPress: () => void handleDeleteMessage(item.id),
            },
          ]
        );
      },
    });

    actions.push({ text: 'Cancel', style: 'cancel' as const });

    Alert.alert(
      'Message Options',
      'Choose an action for your message:',
      actions
    );
  };

  /* Real Native File, Photo & Video Pickers from device storage */
  const pickPhotoFromGallery = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        showError('Permission to access photos is needed.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: false,
        quality: 0.7,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        setAttachmentModalOpen(false);
        setUploading(true);
        const filename = asset.fileName || `photo_${Date.now()}.jpg`;
        const cloudUrl = await uploadToCloud(asset.uri, filename, asset.mimeType || 'image/jpeg');
        await sendMessage(JSON.stringify({
          type: 'image',
          url: cloudUrl,
          name: filename,
        }));
      }
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Could not pick photo.');
    } finally {
      setUploading(false);
    }
  };

  const takePhotoWithCamera = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        showError('Permission to use camera is needed.');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: false,
        quality: 0.7,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        setAttachmentModalOpen(false);
        setUploading(true);
        const filename = asset.fileName || `camera_${Date.now()}.jpg`;
        const cloudUrl = await uploadToCloud(asset.uri, filename, asset.mimeType || 'image/jpeg');
        await sendMessage(JSON.stringify({
          type: 'image',
          url: cloudUrl,
          name: filename,
        }));
      }
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Could not take photo.');
    } finally {
      setUploading(false);
    }
  };

  const pickVideoFromGallery = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        showError('Permission to access gallery is needed.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['videos'],
        allowsEditing: false,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        setAttachmentModalOpen(false);
        setUploading(true);
        const filename = asset.fileName || `video_${Date.now()}.mp4`;
        const cloudUrl = await uploadToCloud(asset.uri, filename, asset.mimeType || 'video/mp4');
        await sendMessage(JSON.stringify({
          type: 'video',
          url: cloudUrl,
          name: filename,
        }));
      }
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Could not pick video.');
    } finally {
      setUploading(false);
    }
  };

  const pickDocumentFromFileManager = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        copyToCacheDirectory: true,
        type: '*/*',
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        setAttachmentModalOpen(false);
        setUploading(true);
        const filename = asset.name || `doc_${Date.now()}`;
        const sizeStr = asset.size ? `${(asset.size / (1024 * 1024)).toFixed(1)} MB` : 'Document';
        const cloudUrl = await uploadToCloud(asset.uri, filename, asset.mimeType);
        await sendMessage(JSON.stringify({
          type: 'file',
          url: cloudUrl,
          name: filename,
          size: sizeStr,
        }));
      }
    } catch (err) {
      showError(err instanceof Error ? err.message : 'Could not pick document.');
    } finally {
      setUploading(false);
    }
  };

  const sendSticker = (emoji: string, label: string) => {
    const payload = JSON.stringify({
      type: 'sticker',
      sticker: emoji,
      code: emoji,
      label,
    });
    setStickerTrayOpen(false);
    void sendMessage(payload);
  };

  const openUrl = async (url?: string) => {
    if (!url) return;
    try {
      if (url.startsWith('http://') || url.startsWith('https://')) {
        const can = await Linking.canOpenURL(url);
        if (can) {
          await Linking.openURL(url);
          return;
        }
      }
      showError('Unable to open link on this device.');
    } catch {
      showError('Unable to open link.');
    }
  };

  const title = group?.name || (teamRoom ? 'Company Team Chat' : contact?.name || 'Chat');
  const subtitle = group
    ? `${group.member_count} members`
    : teamRoom
      ? 'Everyone in the company'
      : contact?.department || 'Direct message';

  const androidClearance = insets.bottom > 20 ? insets.bottom + 12 : 58;
  const stickerBottomPadding = Math.max(insets.bottom, Platform.OS === 'android' ? 36 : 20);
  const bottomInsetPadding = keyboardVisible
    ? (Platform.OS === 'ios' ? 10 : 12)
    : stickerTrayOpen
      ? 8
      : Platform.OS === 'android'
        ? androidClearance
        : Math.max(insets.bottom, 16) + 8;

  const resolveUri = (url?: string) => {
    if (!url) return '';
    if (url.startsWith('/')) {
      return `${getServerUrl().replace(/\/api\/?$/, '')}${url}`;
    }
    return url;
  };

  const renderMessageContent = (parsed: ParsedMessage, mine: boolean) => {
    if (parsed.type === 'image' && parsed.url) {
      const displayUri = resolveUri(parsed.url);
      return (
        <View style={styles.imageBubbleContainer}>
          <Pressable
            accessibilityLabel="View full photo"
            onPress={() => setPreviewImage({ url: displayUri, caption: parsed.caption, name: parsed.name })}
            style={({ pressed }) => [pressed && { opacity: 0.85 }]}
          >
            <Image
              source={{ uri: displayUri }}
              style={styles.chatImage}
              resizeMode="cover"
            />
          </Pressable>
          {Boolean(parsed.caption) && (
            <Text style={[styles.captionText, mine ? styles.messageMineText : styles.messageOtherText]}>
              {parsed.caption}
            </Text>
          )}
        </View>
      );
    }

    if (parsed.type === 'video' && parsed.url) {
      const displayUri = resolveUri(parsed.url);
      return (
        <View style={styles.mediaCardContainer}>
          <Pressable
            accessibilityLabel="Play video"
            onPress={() => openUrl(displayUri)}
            style={({ pressed }) => [styles.videoCard, pressed && { opacity: 0.85 }]}
          >
            <View style={styles.videoThumbnailBox}>
              <Icon name="videocam" size={24} color="#f4553c" />
              <View style={styles.videoPlayCircle}>
                <Icon name="play" size={13} color="#ffffff" />
              </View>
            </View>
            <View style={styles.mediaDetails}>
              <Text numberOfLines={1} style={[styles.videoTitle, mine ? styles.messageMineText : styles.messageOtherText]}>
                {parsed.name || 'Video attachment'}
              </Text>
              <Text style={[styles.mediaSub, mine ? styles.messageMineSub : styles.messageOtherSub]}>
                Tap to watch video ▶
              </Text>
            </View>
          </Pressable>
          {Boolean(parsed.caption) && (
            <Text style={[styles.captionText, mine ? styles.messageMineText : styles.messageOtherText]}>
              {parsed.caption}
            </Text>
          )}
        </View>
      );
    }

    if (parsed.type === 'file' && parsed.url) {
      const displayUri = resolveUri(parsed.url);
      return (
        <Pressable
          accessibilityLabel="Open document"
          onPress={() => openUrl(displayUri)}
          style={({ pressed }) => [
            styles.fileCard,
            mine ? styles.fileCardMine : styles.fileCardOther,
            pressed && { opacity: 0.85 },
          ]}
        >
          <View style={[styles.fileIconCircle, mine ? styles.fileIconCircleMine : styles.fileIconCircleOther]}>
            <Icon name="document-text" size={20} color={mine ? '#ffffff' : '#f4553c'} />
          </View>
          <View style={styles.mediaDetails}>
            <Text numberOfLines={1} style={[styles.fileName, mine ? styles.messageMineText : styles.messageOtherText]}>
              {parsed.name || 'Document'}
            </Text>
            <Text style={[styles.fileSub, mine ? styles.messageMineSub : styles.messageOtherSub]}>
              {parsed.size ? `${parsed.size} · Tap to view` : 'Tap to view file'}
            </Text>
          </View>
          <Icon name="cloud-download-outline" size={18} color={mine ? 'rgba(255,255,255,0.8)' : '#a1a1aa'} />
        </Pressable>
      );
    }

    if (parsed.type === 'sticker') {
      return (
        <View style={styles.stickerMessageContainer}>
          <Text style={styles.stickerEmojiLarge}>{parsed.sticker || parsed.code || '🚀'}</Text>
          {Boolean(parsed.label) && (
            <View style={[styles.stickerLabelBadge, mine ? styles.stickerLabelMine : styles.stickerLabelOther]}>
              <Text style={styles.stickerLabelText}>{parsed.label}</Text>
            </View>
          )}
        </View>
      );
    }

    return (
      <Text style={[styles.messageText, mine ? styles.messageMineText : styles.messageOtherText]}>
        {parsed.text}
      </Text>
    );
  };

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
            const parsed = parseMessageBody(item.body);
            const isSticker = parsed.type === 'sticker';

            return (
              <View style={[styles.messageRow, mine ? styles.messageMineRow : styles.messageOtherRow]}>
                <Pressable
                  delayLongPress={250}
                  onLongPress={mine ? () => onMessageLongPress(item) : undefined}
                  style={({ pressed }) => [
                    styles.messageBubble,
                    mine ? styles.messageMineBubble : styles.messageOtherBubble,
                    isSticker && styles.stickerBubblePadding,
                    pressed && mine && { opacity: 0.88 },
                  ]}
                >
                  {/* Sender Name - displayed only ONCE for other members in group/team room */}
                  {!mine && (teamRoom || group) && (
                    <Text style={styles.senderName}>{item.sender_name || 'Member'}</Text>
                  )}

                  {/* Render content */}
                  {renderMessageContent(parsed, mine)}

                  {Boolean(formattedTime) && (
                    <Text style={[styles.messageTime, mine ? styles.messageMineTime : styles.messageOtherTime]}>
                      {formattedTime}{mine && isDirectMessage ? `  ${item.read_at ? '✓✓' : '✓'}` : ''}
                    </Text>
                  )}
                </Pressable>
              </View>
            );
          }}
          ListEmptyComponent={
            loadingHistory ? <ActivityIndicator color={p.coral} style={{ marginTop: 32 }} /> : <Empty title="No messages yet" detail="Send a message to start this discussion." />
          }
        />

        {/* Uploading progress indicator */}
        {uploading && (
          <View style={styles.uploadingBar}>
            <ActivityIndicator size="small" color="#f4553c" />
            <Text style={styles.uploadingBarText}>Sending attachment...</Text>
          </View>
        )}

        {/* Input Bar */}
        <View style={[styles.inputBarContainer, { paddingBottom: bottomInsetPadding }]}>
          <View style={styles.inputInner}>
            {/* Attachment Button (Paperclip) */}
            <Pressable
              accessibilityLabel="Attach photo, video or file"
              onPress={() => {
                Keyboard.dismiss();
                setStickerTrayOpen(false);
                setAttachmentModalOpen(true);
              }}
              style={({ pressed }) => [styles.actionIconButton, pressed && { opacity: 0.7 }]}
            >
              <Icon name="attach" size={22} color="#f4553c" />
            </Pressable>

            {/* Sticker Tray Toggle Button */}
            <Pressable
              accessibilityLabel="Select sticker"
              onPress={() => {
                Keyboard.dismiss();
                setStickerTrayOpen(prev => !prev);
              }}
              style={({ pressed }) => [
                styles.actionIconButton,
                stickerTrayOpen && styles.actionIconButtonActive,
                pressed && { opacity: 0.7 },
              ]}
            >
              <Icon name="happy-outline" size={21} color={stickerTrayOpen ? '#c084fc' : '#a1a1aa'} />
            </Pressable>

            <TextInput
              style={styles.chatInput}
              placeholder="Type a message..."
              placeholderTextColor="#71717a"
              value={draft}
              onChangeText={setDraft}
              onFocus={() => {
                setStickerTrayOpen(false);
                requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
              }}
              onSubmitEditing={() => void sendMessage()}
              returnKeyType="send"
            />

            <Pressable
              disabled={sending || !draft.trim()}
              onPress={() => void sendMessage()}
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

        {/* Sticker Tray */}
        {stickerTrayOpen && (
          <View style={[styles.stickerDrawer, { height: 260 + stickerBottomPadding, paddingBottom: stickerBottomPadding }]}>
            <View style={styles.stickerTabBar}>
              {STICKER_PACKS.map((pack, index) => (
                <TouchableOpacity
                  key={pack.id}
                  onPress={() => setActiveStickerTab(index)}
                  style={[
                    styles.stickerTabItem,
                    activeStickerTab === index && styles.stickerTabItemActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.stickerTabText,
                      activeStickerTab === index && styles.stickerTabTextActive,
                    ]}
                  >
                    {pack.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <ScrollView
              contentContainerStyle={[styles.stickerGrid, { paddingBottom: stickerBottomPadding + 28 }]}
              showsVerticalScrollIndicator={false}
            >
              {STICKER_PACKS[activeStickerTab].stickers.map((s, idx) => (
                <TouchableOpacity
                  key={`${s.label}-${idx}`}
                  style={styles.stickerItemButton}
                  onPress={() => sendSticker(s.emoji, s.label)}
                >
                  <Text style={styles.stickerGridEmoji}>{s.emoji}</Text>
                  <Text numberOfLines={1} style={styles.stickerGridLabel}>
                    {s.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}
      </KeyboardAvoidingView>

      {/* Clean File, Photo & Video Chooser Modal */}
      <Modal
        visible={attachmentModalOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setAttachmentModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <Pressable style={styles.modalBackdrop} onPress={() => setAttachmentModalOpen(false)} />
          <View style={[styles.actionSheetCard, { paddingBottom: Math.max(insets.bottom, 24) + 12 }]}>
            <View style={styles.sheetHandleBar} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Choose Media or File</Text>
              <Pressable
                onPress={() => setAttachmentModalOpen(false)}
                style={({ pressed }) => [styles.modalCloseBtn, pressed && { opacity: 0.6 }]}
              >
                <Icon name="close" size={20} color="#fafafa" />
              </Pressable>
            </View>

            {/* Quick Action Buttons (Gallery, Camera, Video, Doc) */}
            <View style={styles.actionGrid}>
              <TouchableOpacity
                style={styles.actionGridItem}
                onPress={takePhotoWithCamera}
                activeOpacity={0.8}
              >
                <View style={[styles.actionCircle, { backgroundColor: '#f43f5e' }]}>
                  <Icon name="camera" size={24} color="#ffffff" />
                </View>
                <Text style={styles.actionCircleLabel}>Camera</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionGridItem}
                onPress={pickPhotoFromGallery}
                activeOpacity={0.8}
              >
                <View style={[styles.actionCircle, { backgroundColor: '#a855f7' }]}>
                  <Icon name="images" size={24} color="#ffffff" />
                </View>
                <Text style={styles.actionCircleLabel}>Gallery</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionGridItem}
                onPress={pickVideoFromGallery}
                activeOpacity={0.8}
              >
                <View style={[styles.actionCircle, { backgroundColor: '#3b82f6' }]}>
                  <Icon name="videocam" size={24} color="#ffffff" />
                </View>
                <Text style={styles.actionCircleLabel}>Video</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionGridItem}
                onPress={pickDocumentFromFileManager}
                activeOpacity={0.8}
              >
                <View style={[styles.actionCircle, { backgroundColor: '#10b981' }]}>
                  <Icon name="document-text" size={24} color="#ffffff" />
                </View>
                <Text style={styles.actionCircleLabel}>Files</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Fullscreen In-App Image Viewer */}
      <Modal
        visible={Boolean(previewImage)}
        transparent
        animationType="fade"
        onRequestClose={() => setPreviewImage(null)}
      >
        <SafeAreaView style={styles.imageViewerOverlay}>
          <StatusBar barStyle="light-content" backgroundColor="#000000" />
          {/* Header Bar */}
          <View style={styles.imageViewerHeader}>
            <TouchableOpacity
              onPress={() => setPreviewImage(null)}
              style={styles.imageViewerCloseBtn}
              accessibilityLabel="Close photo viewer"
            >
              <Icon name="close" size={22} color="#ffffff" />
            </TouchableOpacity>

            <View style={{ flex: 1, marginHorizontal: 12 }}>
              <Text numberOfLines={1} style={styles.imageViewerTitle}>
                {previewImage?.name || 'Photo'}
              </Text>
            </View>

            {Boolean(previewImage?.url?.startsWith('http')) && (
              <TouchableOpacity
                onPress={() => openUrl(previewImage!.url)}
                style={styles.imageViewerActionBtn}
                accessibilityLabel="Open in browser"
              >
                <Icon name="open-outline" size={19} color="#ffffff" />
              </TouchableOpacity>
            )}
          </View>

          {/* Center Image Container */}
          <View style={styles.imageViewerBody}>
            {Boolean(previewImage?.url) && (
              <Image
                source={{ uri: previewImage!.url }}
                style={styles.imageViewerImage}
                resizeMode="contain"
              />
            )}
          </View>

          {/* Bottom Caption */}
          {Boolean(previewImage?.caption) && (
            <View style={styles.imageViewerFooter}>
              <Text style={styles.imageViewerCaption}>{previewImage!.caption}</Text>
            </View>
          )}
        </SafeAreaView>
      </Modal>

      {/* Edit Message Modal */}
      <Modal
        visible={editModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!savingEdit) {
            setEditModalVisible(false);
            setEditingMessage(null);
          }
        }}
      >
        <KeyboardAvoidingView
          style={styles.editModalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.editMessageModalCard}>
            <View style={styles.editModalHeader}>
              <Text style={styles.editModalTitle}>Edit Message</Text>
              <TouchableOpacity
                disabled={savingEdit}
                onPress={() => {
                  setEditModalVisible(false);
                  setEditingMessage(null);
                }}
              >
                <Icon name="close" size={20} color="#a1a1aa" />
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.editMessageInput}
              multiline
              autoFocus
              value={editText}
              onChangeText={setEditText}
              placeholder="Edit your message..."
              placeholderTextColor="#71717a"
            />

            <View style={styles.editModalActions}>
              <TouchableOpacity
                disabled={savingEdit}
                onPress={() => {
                  setEditModalVisible(false);
                  setEditingMessage(null);
                }}
                style={styles.editCancelBtn}
              >
                <Text style={styles.editCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                disabled={savingEdit || !editText.trim()}
                onPress={() => void handleSaveEdit()}
                style={[styles.editSaveBtn, (!editText.trim() || savingEdit) && styles.editSaveBtnDisabled]}
              >
                {savingEdit ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.editSaveText}>Save Changes</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
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
  stickerBubblePadding: {
    paddingHorizontal: 6,
    paddingVertical: 4,
    backgroundColor: 'transparent',
    borderWidth: 0,
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
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 4,
  },
  messageText: {
    fontSize: 13,
    lineHeight: 18,
  },
  messageMineText: {
    color: '#ffffff',
  },
  messageOtherText: {
    color: '#fafafa',
  },
  captionText: {
    fontSize: 12,
    lineHeight: 16,
    marginTop: 5,
    paddingHorizontal: 2,
  },
  messageTime: {
    fontSize: 8.5,
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  messageMineTime: {
    color: 'rgba(255, 255, 255, 0.75)',
  },
  messageOtherTime: {
    color: '#71717a',
  },
  messageMineSub: {
    color: 'rgba(255, 255, 255, 0.8)',
  },
  messageOtherSub: {
    color: '#a1a1aa',
  },

  /* Images */
  imageBubbleContainer: {
    borderRadius: 10,
    overflow: 'hidden',
  },
  chatImage: {
    width: 220,
    height: 150,
    borderRadius: 10,
    backgroundColor: '#27272a',
  },

  /* Media Card (Video / Document) */
  mediaCardContainer: {
    width: 230,
  },
  videoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    padding: 8,
    borderRadius: 10,
  },
  videoThumbnailBox: {
    width: 44,
    height: 44,
    borderRadius: 8,
    backgroundColor: '#27272a',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  videoPlayCircle: {
    position: 'absolute',
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#f4553c',
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoTitle: {
    fontSize: 12.5,
    fontWeight: '600',
  },
  mediaDetails: {
    flex: 1,
  },
  mediaSub: {
    fontSize: 10,
    marginTop: 2,
  },

  /* Files */
  fileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 8,
    borderRadius: 10,
    minWidth: 200,
    maxWidth: 240,
  },
  fileCardMine: {
    backgroundColor: 'rgba(0, 0, 0, 0.18)',
  },
  fileCardOther: {
    backgroundColor: '#18181b',
    borderWidth: 1,
    borderColor: '#2c2c31',
  },
  fileIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fileIconCircleMine: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  fileIconCircleOther: {
    backgroundColor: 'rgba(244, 85, 60, 0.15)',
  },
  fileName: {
    fontSize: 12.5,
    fontWeight: '600',
  },
  fileSub: {
    fontSize: 10,
    marginTop: 2,
  },

  /* Stickers */
  stickerMessageContainer: {
    alignItems: 'center',
    paddingVertical: 2,
  },
  stickerEmojiLarge: {
    fontSize: 54,
    textAlign: 'center',
  },
  stickerLabelBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    marginTop: 2,
  },
  stickerLabelMine: {
    backgroundColor: 'rgba(244, 85, 60, 0.9)',
  },
  stickerLabelOther: {
    backgroundColor: '#27272a',
  },
  stickerLabelText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '600',
  },

  /* Uploading Banner */
  uploadingBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#1f1f23',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderTopWidth: 1,
    borderTopColor: '#27272a',
  },
  uploadingBarText: {
    color: '#fafafa',
    fontSize: 11.5,
    fontWeight: '500',
  },

  /* Input Bar */
  inputBarContainer: {
    paddingHorizontal: 10,
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
    paddingHorizontal: 8,
    paddingVertical: 4,
    minHeight: 42,
    gap: 6,
  },
  actionIconButton: {
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 15,
  },
  actionIconButtonActive: {
    backgroundColor: 'rgba(192, 132, 252, 0.15)',
  },
  chatInput: {
    flex: 1,
    color: '#fafafa',
    fontSize: 13,
    minHeight: 34,
    maxHeight: 90,
    paddingVertical: 4,
    paddingHorizontal: 4,
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

  /* Sticker Drawer */
  stickerDrawer: {
    backgroundColor: '#141417',
    borderTopWidth: 1,
    borderTopColor: '#222226',
    paddingHorizontal: 10,
    paddingTop: 8,
  },
  stickerTabBar: {
    flexDirection: 'row',
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#222226',
    paddingBottom: 6,
  },
  stickerTabItem: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 14,
    backgroundColor: '#1f1f23',
  },
  stickerTabItemActive: {
    backgroundColor: 'rgba(192, 132, 252, 0.25)',
    borderWidth: 1,
    borderColor: '#c084fc',
  },
  stickerTabText: {
    color: '#a1a1aa',
    fontSize: 11.5,
    fontWeight: '500',
  },
  stickerTabTextActive: {
    color: '#f3e8ff',
    fontWeight: '700',
  },
  stickerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingVertical: 10,
    gap: 12,
    justifyContent: 'flex-start',
  },
  stickerItemButton: {
    width: '22%',
    alignItems: 'center',
    backgroundColor: '#1c1c20',
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#27272a',
  },
  stickerGridEmoji: {
    fontSize: 28,
  },
  stickerGridLabel: {
    color: '#d4d4d8',
    fontSize: 9.5,
    fontWeight: '600',
    marginTop: 4,
  },

  /* Modal */
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFill,
  },
  actionSheetCard: {
    backgroundColor: '#18181b',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 24,
    borderTopWidth: 1,
    borderColor: '#2e2e33',
  },
  sheetHandleBar: {
    width: 36,
    height: 4,
    backgroundColor: '#3f3f46',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  modalTitle: {
    color: '#fafafa',
    fontSize: 15.5,
    fontWeight: '700',
  },
  modalCloseBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#27272a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 6,
    marginBottom: 12,
  },
  actionGridItem: {
    alignItems: 'center',
    gap: 6,
  },
  actionCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  actionCircleLabel: {
    color: '#e4e4e7',
    fontSize: 11.5,
    fontWeight: '600',
  },

  /* Fullscreen Image Preview Styles */
  imageViewerOverlay: {
    flex: 1,
    backgroundColor: '#000000fa',
    justifyContent: 'space-between',
  },
  imageViewerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  imageViewerCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageViewerActionBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  imageViewerTitle: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
  },
  imageViewerBody: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 8,
  },
  imageViewerImage: {
    width: '100%',
    height: '100%',
  },
  imageViewerFooter: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    backgroundColor: 'rgba(0,0,0,0.75)',
    alignItems: 'center',
  },
  imageViewerCaption: {
    color: '#e4e4e7',
    fontSize: 14,
    textAlign: 'center',
  },
  editModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  editMessageModalCard: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#18181b',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#27272a',
    padding: 16,
    gap: 12,
  },
  editModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  editModalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fafafa',
  },
  editMessageInput: {
    backgroundColor: '#09090b',
    borderWidth: 1,
    borderColor: '#27272a',
    borderRadius: 10,
    padding: 12,
    color: '#fafafa',
    fontSize: 14,
    minHeight: 80,
    maxHeight: 180,
    textAlignVertical: 'top',
  },
  editModalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  editCancelBtn: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#3f3f46',
  },
  editCancelText: {
    color: '#a1a1aa',
    fontSize: 13,
    fontWeight: '600',
  },
  editSaveBtn: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 8,
    backgroundColor: '#f4553c',
    alignItems: 'center',
    justifyContent: 'center',
  },
  editSaveBtnDisabled: {
    opacity: 0.5,
  },
  editSaveText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '600',
  },
});
