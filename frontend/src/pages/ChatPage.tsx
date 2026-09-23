import {
  useCallback, useEffect, useMemo, useRef, useState,
  type KeyboardEvent as ReactKeyboardEvent, type ReactNode,
  type ChangeEvent as ReactChangeEvent, type ClipboardEvent as ReactClipboardEvent,
} from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  ArrowLeft, AtSign, MessageCircle, MessagesSquare, Pencil, Plus, RefreshCw, Search, Send,
  Users, UserRound, Trash2, Check, X,
  Paperclip, FileText, Download, ExternalLink, Film, Image as ImageIcon,
} from 'lucide-react';
import { chatApi } from '../api/endpoints';
import { ApiError } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useChatUnread } from '../context/ChatContext';
import { useToast } from '../components/Toast';
import { formatDate, formatTime, relativeTime, todayIso } from '../lib/format';
import { Avatar, EmptyState, Spinner, Modal } from '../components/ui';
import { GroupModal } from '../components/GroupModal';
import {
  isAdmin, roleLabel,
  type ChatContact, type ChatGroup, type ChatMessage, type ChatSearchHit,
  type GroupMessage, type TeamMessage,
} from '../types';

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
    } catch {}
  }
  if (/^https?:\/\/.*\.(png|jpg|jpeg|gif|webp)(\?.*)?$/i.test(trimmed) || /^\/uploads\/.*\.(png|jpg|jpeg|gif|webp)$/i.test(trimmed)) {
    return { type: 'image', url: trimmed };
  }
  if (/^https?:\/\/.*\.(mp4|mov|webm)(\?.*)?$/i.test(trimmed) || /^\/uploads\/.*\.(mp4|mov|webm)$/i.test(trimmed)) {
    return { type: 'video', url: trimmed, name: 'Video attachment' };
  }
  if (/^https?:\/\/.*\.(pdf|docx?|xlsx?|pptx?|zip|rar|csv|txt)(\?.*)?$/i.test(trimmed) || /^\/uploads\/.*$/i.test(trimmed)) {
    const filename = trimmed.split('/').pop()?.split('?')[0] || 'Document';
    return { type: 'file', url: trimmed, name: filename };
  }
  return { type: 'text', text: body };
}

export function getMessagePreview(body?: string | null): string {
  if (!body) return '';
  const parsed = parseMessageBody(body);
  if (parsed.type === 'image') return '📷 Photo';
  if (parsed.type === 'video') return '🎥 Video';
  if (parsed.type === 'file') return `📄 ${parsed.name || 'Document'}`;
  if (parsed.type === 'sticker') return '🎨 Sticker';
  return parsed.text || body;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

async function uploadFileToCloud(file: File): Promise<string> {
  // 1. Direct binary upload to backend server
  try {
    const res = await fetch('/api/chat/upload', {
      method: 'POST',
      headers: {
        'x-filename': encodeURIComponent(file.name),
        'content-type': file.type || 'application/octet-stream',
      },
      body: file,
      credentials: 'include',
    });
    if (res.ok) {
      const json = await res.json();
      if (json?.data?.url) {
        return json.data.url;
      }
    }
  } catch (err) {
    console.warn('Backend binary upload failed, trying base64 fallback:', err);
  }

  // 2. Base64 JSON upload to backend server
  try {
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

    const res = await fetch('/api/chat/upload', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: file.name,
        type: file.type,
        data: base64,
      }),
      credentials: 'include',
    });
    if (res.ok) {
      const json = await res.json();
      if (json?.data?.url) {
        return json.data.url;
      }
    }
  } catch (err) {
    console.warn('Backend base64 upload failed:', err);
  }

  // 3. Fallback to inline Data URL for small files (< 4MB) so user is never blocked
  if (file.size < 4 * 1024 * 1024) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  throw new Error('Upload failed. Please check your network connection and try again.');
}

/**
 * The chat page — reached from the sidebar, like every other section.
 *
 * Two panes: the list of rooms and people on the left, the open conversation on the
 * right. Below `lg` there is only room for one, so the list gives way to the
 * conversation and the back arrow returns to it.
 *
 * Three kinds of room, one list. **Team Chat** is a single company-wide channel
 * everybody is in; **groups** are named rooms an admin creates for a chosen set of
 * people; below them is the directory for one-to-one threads. Every role gets all
 * three — nothing here branches on role, and the server does not either.
 *
 * The search box looks in two places at once: it narrows the list of people and
 * rooms, and it searches the text of messages across every room the viewer can see.
 * Opening a result loads the conversation *at* that message rather than at the
 * bottom, which is the only reason to search a conversation in the first place.
 *
 * Live-ness is polling, matching the notification bell. The unread counts come from
 * ChatContext, which polls once for the whole app so the sidebar badge and this page
 * do not ask the same question twice. An open room polls faster, asks only for
 * messages newer than the last one on screen, and pauses while the tab is hidden.
 */

/** How often an open conversation or channel asks for new messages. */
const THREAD_POLL_MS = 5_000;
/** Below this, searching messages is more noise than signal. */
const MIN_SEARCH = 2;

/**
 * The selected room's row in the sidebar.
 *
 * A translucent wash of the brand coral rather than a solid fill, so the row reads as
 * a pane of tinted glass laid over the list: the name and subtitle underneath keep
 * their own colours instead of being forced onto an `accent-foreground`. The inset
 * ring is what gives it an edge at that low opacity — without it the tint alone is
 * too faint to find at a glance in dark mode.
 */
const SELECTED_ROOM = 'bg-primary/10 ring-1 ring-inset ring-primary/25';

/** Which room is open. `null` is the directory. */
/** Anything that can appear in a room: a DM, a channel post, or a group post. */
type RoomMessage = ChatMessage | TeamMessage | GroupMessage;

type ActiveRoom =
  | { kind: 'dm'; contact: ChatContact }
  | { kind: 'team' }
  | { kind: 'group'; group: ChatGroup }
  | null;

export function ChatPage() {
  const { user } = useAuth();
  const { counts, refresh: refreshCounts, setTotal } = useChatUnread();
  const [searchParams, setSearchParams] = useSearchParams();

  const teamUnread = counts.team;
  const groupUnreadTotal = counts.groups;

  const [contacts, setContacts] = useState<ChatContact[]>([]);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [search, setSearch] = useState('');

  const [active, setActive] = useState<ActiveRoom>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [teamMessages, setTeamMessages] = useState<TeamMessage[]>([]);
  const [groups, setGroups] = useState<ChatGroup[]>([]);
  const [groupMessages, setGroupMessages] = useState<GroupMessage[]>([]);
  /** The create/rename dialog. `rename` carries the group being renamed. */
  const [groupDialog, setGroupDialog] = useState<{ mode: 'create' } | { mode: 'rename'; group: ChatGroup } | null>(null);
  const [groupBusy, setGroupBusy] = useState(false);
  const [groupError, setGroupError] = useState<string | null>(null);

  /** Message-search results for the current term, and whether they are in flight. */
  const [hits, setHits] = useState<ChatSearchHit[]>([]);
  const [searching, setSearching] = useState(false);
  /** The message a search result led to, marked so the eye finds it. */
  const [highlightId, setHighlightId] = useState<number | null>(null);
  const [roomLoading, setRoomLoading] = useState(false);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  /** The newest id on screen — what the poll asks for messages after. */
  const lastIdRef = useRef(0);

  /*
    The per-thread badges follow the shared counts, so a message arriving while the
    list is on screen updates the right row without this page polling for itself.
  */
  useEffect(() => {
    const byId = new Map(counts.threads.map((t) => [t.user_id, t.unread]));
    setContacts((prev) => {
      let changed = false;
      const next = prev.map((c) => {
        const n = byId.get(c.id) ?? 0;
        if (n === c.unread) return c;
        changed = true;
        return { ...c, unread: n };
      });
      return changed ? next : prev;
    });
  }, [counts.threads]);

  /* --------------------------------------------------------------- directory */

  const loadContacts = useCallback(async (term: string, signal?: AbortSignal) => {
    setContactsLoading(true);
    try {
      const { data } = await chatApi.contacts(term || undefined, signal);
      setContacts(data);
      setError(null);
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      setError(err instanceof ApiError ? err.message : 'Could not load your contacts.');
    } finally {
      setContactsLoading(false);
    }
  }, []);

  // Debounced so a request is not fired per keystroke.
  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => { void loadContacts(search, controller.signal); }, search ? 250 : 0);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [search, loadContacts]);

  /*
    Message search, on the same term as the list filter.

    One box, two questions: which person or room am I looking for, and where was that
    thing said. Running both means never having to decide which you meant. It waits
    for a couple of characters, because a single letter matches most of the history
    and tells nobody anything.
  */
  useEffect(() => {
    const term = search.trim();
    if (term.length < MIN_SEARCH) {
      setHits([]);
      setSearching(false);
      return undefined;
    }
    const controller = new AbortController();
    setSearching(true);
    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const { data } = await chatApi.search(term, controller.signal);
          setHits(data);
        } catch (err) {
          if ((err as Error).name !== 'AbortError') setHits([]);
        } finally {
          setSearching(false);
        }
      })();
    }, 300);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [search]);

  /* ------------------------------------------------------------------ groups */

  const loadGroups = useCallback(async (signal?: AbortSignal) => {
    try {
      const { data } = await chatApi.groups.list(signal);
      setGroups(data);
    } catch (err) {
      if ((err as Error).name === 'AbortError') return;
      // The directory still works without its groups; the next open retries.
    }
  }, []);

  // Refreshed whenever the directory is showing, so a badge or a new group added
  // elsewhere appears without having to close and reopen the panel.
  useEffect(() => {
    if (!open || active) return undefined;
    const controller = new AbortController();
    void loadGroups(controller.signal);
    return () => controller.abort();
  }, [open, active, groupUnreadTotal, loadGroups]);

  /* ------------------------------------------------------------------- rooms */

  const openDirectory = useCallback(() => {
    setActive(null);
    setMessages([]);
    setTeamMessages([]);
    setGroupMessages([]);
    lastIdRef.current = 0;
    setDraft('');
    setError(null);
    setHighlightId(null);
  }, []);

  const openThread = useCallback(async (contact: ChatContact, beforeId?: number) => {
    setActive({ kind: 'dm', contact });
    setMessages([]);
    lastIdRef.current = 0;
    setDraft('');
    setError(null);
    setHighlightId(beforeId ?? null);
    setRoomLoading(true);
    try {
      const { data, meta } = await chatApi.messages(contact.id, { before: beforeId });
      setMessages(data);
      lastIdRef.current = data.length ? data[data.length - 1].id : 0;
      if (typeof meta?.unread === 'number') setTotal(meta.unread);
      setContacts((prev) => prev.map((c) => (c.id === contact.id ? { ...c, unread: 0 } : c)));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not open that conversation.');
    } finally {
      setRoomLoading(false);
      window.setTimeout(() => composerRef.current?.focus(), 0);
    }
  }, [setTotal]);

  const openTeam = useCallback(async (beforeId?: number) => {
    setActive({ kind: 'team' });
    setTeamMessages([]);
    lastIdRef.current = 0;
    setDraft('');
    setError(null);
    setHighlightId(beforeId ?? null);
    setRoomLoading(true);
    try {
      const { data, meta } = await chatApi.team.messages({ before: beforeId });
      setTeamMessages(data);
      lastIdRef.current = data.length ? data[data.length - 1].id : 0;
      if (typeof meta?.unread === 'number') setTotal(meta.unread);
      void refreshCounts();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not open Team Chat.');
    } finally {
      setRoomLoading(false);
      window.setTimeout(() => composerRef.current?.focus(), 0);
    }
  }, [setTotal, refreshCounts]);

  const openGroup = useCallback(async (group: ChatGroup, beforeId?: number) => {
    setActive({ kind: 'group', group });
    setGroupMessages([]);
    lastIdRef.current = 0;
    setDraft('');
    setError(null);
    setHighlightId(beforeId ?? null);
    setRoomLoading(true);
    try {
      const { data, meta } = await chatApi.groups.messages(group.id, { before: beforeId });
      setGroupMessages(data);
      lastIdRef.current = data.length ? data[data.length - 1].id : 0;
      if (typeof meta?.unread === 'number') setTotal(meta.unread);
      void refreshCounts();
      // The server returns the group with its current name and members, which may
      // have moved on since the list was drawn.
      const fresh = meta?.group as ChatGroup | undefined;
      if (fresh) setActive({ kind: 'group', group: { ...group, ...fresh } });
      setGroups((prev) => prev.map((g) => (g.id === group.id ? { ...g, unread: 0 } : g)));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not open that group.');
    } finally {
      setRoomLoading(false);
      window.setTimeout(() => composerRef.current?.focus(), 0);
    }
  }, [setTotal, refreshCounts]);

  /**
   * Follows a search result into the room it was said in.
   *
   * The room is opened *at* that message rather than at the bottom, and the message
   * is marked so the eye lands on it — otherwise finding it in the list and then
   * having to find it again in the conversation is two searches for one question.
   */
  const openHit = useCallback((hit: ChatSearchHit) => {
    if (hit.kind === 'team') { void openTeam(hit.message_id); return; }
    if (hit.kind === 'group') {
      const group = groups.find((g) => g.id === hit.group_id);
      if (group) void openGroup(group, hit.message_id);
      return;
    }
    const contact = contacts.find((c) => c.id === hit.partner_id);
    if (contact) void openThread(contact, hit.message_id);
  }, [groups, contacts, openTeam, openGroup, openThread]);

  /*
    `?room=team` opens the channel.

    A mention notification has to lead somewhere, and chat is a widget rather than a
    route — there is no /chat to navigate to. The bell hands the intent over in the
    URL, exactly as a task notification hands over a `?highlight`, and the parameter
    is cleared once acted on so a refresh or a back-button press does not reopen it.
  */
  useEffect(() => {
    if (searchParams.get('room') !== 'team') return;
    void openTeam();
    const next = new URLSearchParams(searchParams);
    next.delete('room');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams, openTeam]);

  /** Asks only for what is newer than the last message on screen. */
  const pollRoom = useCallback(async (room: NonNullable<ActiveRoom>) => {
    try {
      if (room.kind === 'dm') {
        const { data, meta } = await chatApi.messages(room.contact.id, { after: lastIdRef.current });
        if (data.length) {
          setMessages((prev) => {
            const known = new Set(prev.map((m) => m.id));
            const fresh = data.filter((m) => !known.has(m.id));
            return fresh.length ? [...prev, ...fresh] : prev;
          });
          lastIdRef.current = data[data.length - 1].id;
        }
        if (typeof meta?.unread === 'number') setTotal(meta.unread);
        return;
      }
      if (room.kind === 'group') {
        const { data, meta } = await chatApi.groups.messages(room.group.id, { after: lastIdRef.current });
        if (data.length) {
          setGroupMessages((prev) => {
            const known = new Set(prev.map((m) => m.id));
            const fresh = data.filter((m) => !known.has(m.id));
            return fresh.length ? [...prev, ...fresh] : prev;
          });
          lastIdRef.current = data[data.length - 1].id;
        }
        if (typeof meta?.unread === 'number') setTotal(meta.unread);
        return;
      }
      const { data, meta } = await chatApi.team.messages({ after: lastIdRef.current });
      if (data.length) {
        setTeamMessages((prev) => {
          const known = new Set(prev.map((m) => m.id));
          const fresh = data.filter((m) => !known.has(m.id));
          return fresh.length ? [...prev, ...fresh] : prev;
        });
        lastIdRef.current = data[data.length - 1].id;
      }
      if (typeof meta?.unread === 'number') setTotal(meta.unread);
    } catch {
      /* transient; the next tick retries */
    }
  }, [setTotal]);

  useEffect(() => {
    if (!active) return undefined;
    const id = window.setInterval(() => {
      if (!document.hidden) void pollRoom(active);
    }, THREAD_POLL_MS);
    const onVisible = () => { if (!document.hidden) void pollRoom(active); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [open, active, pollRoom]);

  /* --------------------------------------------------------------- composing */

  const send = useCallback(async (customPayload?: string) => {
    const body = (customPayload ?? draft).trim();
    if (!body || !active || sending) return;
    setSending(true);
    setError(null);
    try {
      if (active.kind === 'dm') {
        const { data } = await chatApi.send(active.contact.id, body);
        setMessages((prev) => [...prev, data]);
        lastIdRef.current = Math.max(lastIdRef.current, data.id);
        setContacts((prev) => prev.map((c) => (c.id === active.contact.id
          ? { ...c, last_message: data.body, last_message_at: data.created_at, last_message_mine: true }
          : c)));
      } else if (active.kind === 'group') {
        const { data } = await chatApi.groups.post(active.group.id, body);
        setGroupMessages((prev) => [...prev, data]);
        lastIdRef.current = Math.max(lastIdRef.current, data.id);
        setGroups((prev) => prev.map((g) => (g.id === active.group.id
          ? { ...g, last_message: data.body, last_message_at: data.created_at, last_message_mine: true }
          : g)));
      } else {
        // Who was tagged is derived from the text rather than tracked as the picker is
        // used: editing the message afterwards then cannot leave a tag behind for a
        // name that is no longer written. The server re-checks the same way.
        const { data } = await chatApi.team.post(body, findMentions(body, contacts));
        setTeamMessages((prev) => [...prev, data]);
        lastIdRef.current = Math.max(lastIdRef.current, data.id);
      }
      if (!customPayload) {
        setDraft('');
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Your message could not be sent.');
    } finally {
      setSending(false);
      composerRef.current?.focus();
    }
  }, [draft, active, sending, contacts]);

  /**
   * Create or rename, from the one dialog.
   *
   * A new group is opened straight away — you made it to talk in it — while a rename
   * stays where it is and simply updates the name everywhere it is shown, including
   * the room header if that group happens to be open.
   */
  const submitGroup = useCallback(async (name: string, memberIds: number[]) => {
    if (!groupDialog) return;
    setGroupBusy(true);
    setGroupError(null);
    try {
      if (groupDialog.mode === 'create') {
        const { data } = await chatApi.groups.create(name, memberIds);
        setGroups((prev) => [data, ...prev]);
        setGroupDialog(null);
        void openGroup(data);
        return;
      }
      const { data } = await chatApi.groups.rename(groupDialog.group.id, name);
      setGroups((prev) => prev.map((g) => (g.id === data.id ? { ...g, name: data.name } : g)));
      setActive((prev) => (prev?.kind === 'group' && prev.group.id === data.id
        ? { kind: 'group', group: { ...prev.group, name: data.name } }
        : prev));
      setGroupDialog(null);
    } catch (err) {
      setGroupError(err instanceof ApiError ? err.message : 'That did not work. Please try again.');
    } finally {
      setGroupBusy(false);
    }
  }, [groupDialog, openGroup]);

  const toast = useToast();

  const handleEditMessage = useCallback(async (messageId: number, newBody: string) => {
    if (!active || !newBody.trim()) return;
    try {
      if (active.kind === 'dm') {
        const { data } = await chatApi.edit(messageId, newBody.trim());
        setMessages((prev) => prev.map((m) => (m.id === messageId ? data : m)));
      } else if (active.kind === 'team') {
        const { data } = await chatApi.team.edit(messageId, newBody.trim(), findMentions(newBody.trim(), contacts));
        setTeamMessages((prev) => prev.map((m) => (m.id === messageId ? data : m)));
      } else if (active.kind === 'group') {
        const { data } = await chatApi.groups.edit(active.group.id, messageId, newBody.trim());
        setGroupMessages((prev) => prev.map((m) => (m.id === messageId ? data : m)));
      }
      toast.success('Message updated.');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not edit message.');
      throw err;
    }
  }, [active, contacts, toast]);

  const handleDeleteMessage = useCallback(async (messageId: number) => {
    if (!active) return;
    try {
      if (active.kind === 'dm') {
        await chatApi.remove(messageId);
        setMessages((prev) => prev.filter((m) => m.id !== messageId));
      } else if (active.kind === 'team') {
        await chatApi.team.remove(messageId);
        setTeamMessages((prev) => prev.filter((m) => m.id !== messageId));
      } else if (active.kind === 'group') {
        await chatApi.groups.remove(active.group.id, messageId);
        setGroupMessages((prev) => prev.filter((m) => m.id !== messageId));
      }
      toast.success('Message deleted.');
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Could not delete message.');
      throw err;
    }
  }, [active, toast]);

  /* ---------------------------------------------------------------- behaviour */

  // Escape backs out of a room to the list, which is the only level there is now.
  useEffect(() => {
    if (!active) return undefined;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') openDirectory(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [active, openDirectory]);

  /*
    New messages pin the view to the bottom — except when the room was opened at a
    search result, where the whole point is to land on that message instead.
  */
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (highlightId) {
      const target = el.querySelector(`[data-message-id="${highlightId}"]`);
      if (target) { target.scrollIntoView({ block: 'center' }); return; }
    }
    el.scrollTop = el.scrollHeight;
  }, [messages, teamMessages, groupMessages, active, highlightId]);

  if (!user) return null;

  return (
    <div className="flex h-[calc(100vh-9.5rem)] min-h-[26rem] overflow-hidden rounded-xl border border-border bg-card">
      {/*
        Two panes on a wide screen, one at a time below `lg`. The list is the default
        there and the room replaces it, which is why each pane's visibility depends on
        whether a room is open rather than being fixed.
      */}
      <aside
        className={`w-full shrink-0 flex-col border-border lg:flex lg:w-80 lg:border-r ${
          active ? 'hidden' : 'flex'
        }`}
      >
        <DirectoryView
          contacts={contacts}
          groups={groups}
          canCreateGroup={isAdmin(user.role)}
          loading={contactsLoading}
          error={error}
          search={search}
          unread={counts.unread}
          teamUnread={teamUnread}
          groupUnread={groupUnreadTotal}
          hits={hits}
          searching={searching}
          active={active}
          onSearch={setSearch}
          onRefresh={() => { void loadContacts(search); void loadGroups(); void refreshCounts(); }}
          onPick={(c) => void openThread(c)}
          onPickTeam={() => void openTeam()}
          onPickGroup={(g) => void openGroup(g)}
          onPickHit={openHit}
          onNewGroup={() => { setGroupError(null); setGroupDialog({ mode: 'create' }); }}
        />
      </aside>

      <section className={`min-w-0 flex-1 flex-col ${active ? 'flex' : 'hidden lg:flex'}`}>
        {active ? (
          <RoomView
            me={user.id}
            room={active}
            messages={messages}
            teamMessages={teamMessages}
            groupMessages={groupMessages}
            contacts={contacts}
            loading={roomLoading}
            error={error}
            draft={draft}
            sending={sending}
            highlightId={highlightId}
            scrollRef={scrollRef}
            composerRef={composerRef}
            onBack={openDirectory}
            onDraft={setDraft}
            onSend={(customBody?: string) => send(customBody)}
            canRenameGroup={isAdmin(user.role)}
            onRenameGroup={(g) => { setGroupError(null); setGroupDialog({ mode: 'rename', group: g }); }}
            onEditMessage={handleEditMessage}
            onDeleteMessage={handleDeleteMessage}
          />
        ) : (
          <div className="flex flex-1 items-center justify-center">
            <EmptyState
              icon={<MessageCircle className="h-6 w-6" />}
              title="Pick a conversation"
              description="Choose Team Chat, a group, or someone on the left. Search to find a person, a room, or something that was said."
            />
          </div>
        )}
      </section>

      <GroupModal
        open={!!groupDialog}
        mode={groupDialog?.mode ?? 'create'}
        contacts={contacts}
        initialName={groupDialog?.mode === 'rename' ? groupDialog.group.name : ''}
        busy={groupBusy}
        error={groupError}
        onClose={() => { setGroupDialog(null); setGroupError(null); }}
        onSubmit={(name, memberIds) => void submitGroup(name, memberIds)}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ mentions */

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Which people are actually tagged in a body of text.
 *
 * Longest names first, so "@Anna Marie" is not matched as "@Anna" when both exist.
 * The server runs the same check against the names it holds, so a tag the text does
 * not contain never becomes a notification.
 */
function findMentions(body: string, people: { id: number; name: string }[]): number[] {
  const lower = body.toLowerCase();
  const sorted = [...people].sort((a, b) => b.name.length - a.name.length);
  const hits: number[] = [];
  for (const p of sorted) {
    if (lower.includes(`@${p.name.toLowerCase()}`)) hits.push(p.id);
  }
  return hits;
}

/**
 * The message text with every tag marked.
 *
 * Only names the server actually resolved are highlighted, so a stray "@" in prose
 * stays plain text. Being tagged yourself is styled harder than somebody else being
 * tagged — in a busy room, that difference is the point of the feature.
 */
function renderBody(body: string, mentions: { id: number; name: string }[], meId: number): ReactNode {
  if (!mentions.length) return body;
  const names = [...mentions].sort((a, b) => b.name.length - a.name.length);
  const pattern = new RegExp(`@(${names.map((m) => escapeRegex(m.name)).join('|')})`, 'gi');

  const out: ReactNode[] = [];
  let cursor = 0;
  let match = pattern.exec(body);
  let key = 0;
  while (match) {
    if (match.index > cursor) out.push(body.slice(cursor, match.index));
    const hit = names.find((m) => m.name.toLowerCase() === match![1].toLowerCase());
    const isMe = hit?.id === meId;
    out.push(
      <span
        key={`m${key}`}
        className={`rounded px-1 font-semibold ${
          isMe ? 'bg-primary/25 text-primary-strong' : 'bg-muted-foreground/15'
        }`}
      >
        {match[0]}
      </span>,
    );
    key += 1;
    cursor = match.index + match[0].length;
    match = pattern.exec(body);
  }
  if (cursor < body.length) out.push(body.slice(cursor));
  return out;
}

function ChatImage({ url, name, caption, mine }: { url: string; name?: string; caption?: string; mine?: boolean }) {
  const [error, setError] = useState(false);

  return (
    <div className="space-y-1.5">
      <div className="overflow-hidden rounded-xl border border-black/10 dark:border-white/10 group max-w-sm">
        {!error ? (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="block cursor-pointer"
            title="Click to view full image"
          >
            <img
              src={url}
              alt={name || 'Photo'}
              referrerPolicy="no-referrer"
              crossOrigin="anonymous"
              onError={() => setError(true)}
              className="max-h-72 w-auto max-w-full rounded-xl object-contain transition-transform duration-200 group-hover:scale-[1.02]"
              loading="lazy"
            />
          </a>
        ) : (
          <div className={`flex flex-col items-center justify-center p-4 text-center rounded-xl ${mine ? 'bg-black/20 text-white' : 'bg-muted text-foreground'}`}>
            <ImageIcon className="h-8 w-8 mb-1.5 opacity-60" />
            <p className="text-xs font-semibold truncate max-w-xs">{name || 'Image attachment'}</p>
            <p className="text-[11px] opacity-75 mt-0.5 mb-2.5">Image cannot be loaded directly</p>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
            >
              Open original link <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        )}
      </div>
      {caption && (
        <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{caption}</p>
      )}
    </div>
  );
}

function renderChatMessage(body: string, mentions?: { id: number; name: string }[], meId?: number, mine?: boolean): ReactNode {
  const parsed = parseMessageBody(body);

  if (parsed.type === 'image' && parsed.url) {
    return (
      <ChatImage
        url={parsed.url}
        name={parsed.name}
        caption={parsed.caption}
        mine={mine}
      />
    );
  }

  if (parsed.type === 'video' && parsed.url) {
    return (
      <div className="space-y-1.5 max-w-md">
        <video
          src={parsed.url}
          controls
          className="max-h-72 w-full rounded-xl bg-black object-contain shadow border border-border"
          preload="metadata"
        />
        {parsed.caption && (
          <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{parsed.caption}</p>
        )}
      </div>
    );
  }

  if (parsed.type === 'file' && parsed.url) {
    return (
      <div className="space-y-1.5">
        <a
          href={parsed.url}
          target="_blank"
          rel="noopener noreferrer"
          download={parsed.name || 'attachment'}
          className={`flex items-center gap-3 rounded-xl p-2.5 transition-colors ${
            mine
              ? 'bg-black/15 hover:bg-black/25 text-primary-foreground'
              : 'bg-muted/70 hover:bg-muted text-foreground border border-border'
          }`}
        >
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
              mine ? 'bg-white/20 text-white' : 'bg-primary/10 text-primary'
            }`}
          >
            <FileText className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold">{parsed.name || 'Document'}</p>
            <p className={`text-[10px] ${mine ? 'text-primary-foreground/75' : 'text-muted-foreground'}`}>
              {parsed.size || 'Attachment'} · Click to download
            </p>
          </div>
          <Download className="h-4 w-4 shrink-0 opacity-80" />
        </a>
        {parsed.caption && (
          <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{parsed.caption}</p>
        )}
      </div>
    );
  }

  if (parsed.type === 'sticker') {
    return (
      <div className="flex flex-col items-center py-1">
        <span className="text-4xl leading-none">{parsed.sticker || parsed.code || '🚀'}</span>
        {parsed.label && (
          <span className="mt-1 rounded-full bg-black/15 px-2 py-0.5 text-[10px] font-medium text-inherit">
            {parsed.label}
          </span>
        )}
      </div>
    );
  }

  return mentions && mentions.length ? renderBody(parsed.text || body, mentions, meId ?? 0) : (parsed.text || body);
}

/** The matched part of a snippet, marked so the eye finds it in a wall of text. */
function markTerm(text: string, term: string) {
  const needle = term.trim();
  if (!needle) return text;
  const at = text.toLowerCase().indexOf(needle.toLowerCase());
  if (at === -1) return text;
  /*
    A window around the hit rather than the whole message: a search result is a
    pointer, and 200 characters of unrelated text buries the thing being pointed at.
  */
  const from = Math.max(0, at - 40);
  const head = from > 0 ? '…' : '';
  const tail = text.length > at + needle.length + 60 ? '…' : '';
  return (
    <>
      {head}{text.slice(from, at)}
      <mark className="rounded bg-primary/30 px-0.5 text-foreground">{text.slice(at, at + needle.length)}</mark>
      {text.slice(at + needle.length, at + needle.length + 60)}{tail}
    </>
  );
}

/* ------------------------------------------------------------------ directory */

function DirectoryView({
  contacts, groups, canCreateGroup, loading, error, search, unread, teamUnread, groupUnread,
  hits, searching, active,
  onSearch, onRefresh, onPick, onPickTeam, onPickGroup, onPickHit, onNewGroup,
}: {
  contacts: ChatContact[];
  groups: ChatGroup[];
  canCreateGroup: boolean;
  loading: boolean;
  error: string | null;
  search: string;
  unread: number;
  teamUnread: { unread: number; mentions: number };
  groupUnread: number;
  hits: ChatSearchHit[];
  searching: boolean;
  active: ActiveRoom;
  onSearch: (v: string) => void;
  onRefresh: () => void;
  onPick: (c: ChatContact) => void;
  onPickTeam: () => void;
  onPickGroup: (g: ChatGroup) => void;
  onPickHit: (h: ChatSearchHit) => void;
  onNewGroup: () => void;
}) {
  /* Groups are filtered by the search box too — it is the fastest way to reach one
     once there are more than a handful. */
  const visibleGroups = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return groups;
    return groups.filter((g) => g.name.toLowerCase().includes(needle));
  }, [groups, search]);
  return (
    <>
      <header className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold text-foreground">
          Messages {unread > 0 && <span className="text-muted-foreground">({unread} unread)</span>}
        </h2>
        <div className="flex items-center gap-1">
          {/* Admin only. Managers run a department but do not decide the company's
              rooms — the same line drawn for creating accounts. The API refuses
              anyone else regardless of what is rendered here. */}
          {canCreateGroup && (
            <button
              type="button"
              onClick={onNewGroup}
              aria-label="New group"
              title="New group"
              className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <Plus className="h-4 w-4" />
            </button>
          )}
          <button
            type="button"
            onClick={onRefresh}
            aria-label="Refresh conversations"
            title="Refresh"
            className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>
      </header>

      <div className="shrink-0 border-b border-border p-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <input
            type="search"
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="Search people and messages…"
            aria-label="Search people and messages"
            className="input pl-9"
          />
        </div>
      </div>

      <div className="scrollbar-slim flex-1 space-y-0.5 overflow-y-auto px-2 py-2">
        {error && <p className="px-4 py-3 text-sm text-destructive" role="alert">{error}</p>}

        {/*
          The channel is pinned above the people and is not filtered by the search
          box: the search is for finding a person, and the one room everybody is in
          should not disappear while you look for one.
        */}
        <button
          type="button"
          onClick={onPickTeam}
          aria-current={active?.kind === 'team' ? 'true' : undefined}
          className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${
            active?.kind === 'team' ? SELECTED_ROOM : 'bg-muted/40 hover:bg-muted'
          }`}
        >
          <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary-strong">
            <Users className="h-6 w-6" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[15px] font-medium text-foreground">Team Chat</span>
            <span className="mt-0.5 block truncate text-sm text-muted-foreground">
              Everyone · tag someone with @
            </span>
          </span>
          <span className="flex shrink-0 items-center gap-1">
            {teamUnread.mentions > 0 && (
              <span
                title={`${teamUnread.mentions} mention${teamUnread.mentions === 1 ? '' : 's'}`}
                className="inline-flex h-5 items-center gap-0.5 rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground"
              >
                <AtSign className="h-3 w-3" />{teamUnread.mentions}
              </span>
            )}
            {teamUnread.unread > 0 && (
              <span className="inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-muted-foreground/25 px-1 text-[10px] font-bold text-foreground">
                {teamUnread.unread > 99 ? '99+' : teamUnread.unread}
              </span>
            )}
          </span>
        </button>

        {visibleGroups.length > 0 && (
          <>
            <p className="eyebrow flex items-center justify-between px-3 pb-1 pt-3 text-muted-foreground">
              Groups
              {groupUnread > 0 && (
                <span className="font-semibold text-primary-strong">{groupUnread} unread</span>
              )}
            </p>
            <ul className="space-y-0.5">
            {visibleGroups.map((g) => (
              <li key={g.id}>
                <button
                  type="button"
                  onClick={() => onPickGroup(g)}
                  aria-current={active?.kind === 'group' && active.group.id === g.id ? 'true' : undefined}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${
                    active?.kind === 'group' && active.group.id === g.id ? SELECTED_ROOM : 'hover:bg-muted'
                  }`}
                >
                  <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                    <Users className="h-6 w-6" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate text-[15px] font-medium text-foreground">{g.name}</span>
                      {g.last_message_at && (
                        <span className="shrink-0 text-xs text-muted-foreground">{relativeTime(g.last_message_at)}</span>
                      )}
                    </span>
                    <span className="mt-0.5 flex items-center justify-between gap-2">
                      <span className="truncate text-sm text-muted-foreground">
                        {g.last_message
                          ? `${g.last_message_mine ? 'You' : g.last_sender_name}: ${getMessagePreview(g.last_message)}`
                          : `${g.member_count} member${g.member_count === 1 ? '' : 's'}`}
                      </span>
                      {g.unread > 0 && (
                        <span className="inline-flex h-5 min-w-[1.25rem] shrink-0 items-center justify-center
                                         rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                          {g.unread > 99 ? '99+' : g.unread}
                        </span>
                      )}
                    </span>
                  </span>
                </button>
              </li>
            ))}
            </ul>
          </>
        )}

        {contacts.length > 0 && (
          <p className="eyebrow px-3 pb-1 pt-3 text-muted-foreground">People</p>
        )}

        {loading && contacts.length === 0 ? (
          <div className="flex justify-center py-10 text-muted-foreground"><Spinner /></div>
        ) : contacts.length === 0 ? (
          <EmptyState
            icon={<UserRound className="h-6 w-6" />}
            title={search ? 'Nobody matches that' : 'No one to chat with yet'}
            description={search
              ? 'Try a different name or email address.'
              : 'People appear here as they are added to the team.'}
          />
        ) : (
          <ul className="space-y-0.5">
            {contacts.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => onPick(c)}
                  aria-current={active?.kind === 'dm' && active.contact.id === c.id ? 'true' : undefined}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${
                    active?.kind === 'dm' && active.contact.id === c.id ? SELECTED_ROOM : 'hover:bg-muted'
                  }`}
                >
                  <Avatar name={c.name} src={c.profile_image} size="lg" />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate text-[15px] font-medium text-foreground">{c.name}</span>
                      {c.last_message_at && (
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {relativeTime(c.last_message_at)}
                        </span>
                      )}
                    </span>
                    <span className="mt-0.5 flex items-center justify-between gap-2">
                      <span className="truncate text-sm text-muted-foreground">
                        {c.last_message
                          ? `${c.last_message_mine ? 'You: ' : ''}${getMessagePreview(c.last_message)}`
                          : `${roleLabel(c.role)}${c.department ? ` · ${c.department}` : ''}`}
                      </span>
                      {c.unread > 0 && (
                        <span className="inline-flex h-5 min-w-[1.25rem] shrink-0 items-center justify-center
                                         rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                          {c.unread > 99 ? '99+' : c.unread}
                        </span>
                      )}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {/*
          Matching messages, under the people and rooms rather than instead of them:
          one box answers "who" and "where was that said" at once, and which one you
          meant is obvious from the results.
        */}
        {search.trim().length >= MIN_SEARCH && (
          <div className="border-t border-border">
            <p className="eyebrow flex items-center justify-between px-4 pb-1 pt-3 text-muted-foreground">
              Messages
              {searching && <Spinner className="h-3 w-3" />}
            </p>
            {!searching && hits.length === 0 ? (
              <p className="px-4 pb-4 text-xs text-muted-foreground">
                Nothing said matches “{search.trim()}”.
              </p>
            ) : (
              <ul>
                {hits.map((h) => (
                  <li key={`${h.kind}-${h.message_id}`}>
                    <button
                      type="button"
                      onClick={() => onPickHit(h)}
                      className="flex w-full flex-col gap-0.5 border-b border-border px-4 py-2.5 text-left transition-colors hover:bg-muted"
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span className="truncate text-xs font-semibold text-foreground">{h.room_name}</span>
                        <span className="shrink-0 text-[10px] text-muted-foreground">{relativeTime(h.created_at)}</span>
                      </span>
                      <span className="line-clamp-2 text-xs text-muted-foreground">
                        <span className="font-medium text-foreground">{h.sender_name}: </span>
                        {markTerm(h.body, search)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </>
  );
}

/* ----------------------------------------------------------------------- room */

function RoomView({
  me, room, messages, teamMessages, groupMessages, contacts, loading, error, draft, sending,
  highlightId, scrollRef, composerRef, onBack, onDraft, onSend, canRenameGroup, onRenameGroup,
  onEditMessage, onDeleteMessage,
}: {
  me: number;
  room: NonNullable<ActiveRoom>;
  messages: ChatMessage[];
  teamMessages: TeamMessage[];
  groupMessages: GroupMessage[];
  contacts: ChatContact[];
  loading: boolean;
  error: string | null;
  draft: string;
  sending: boolean;
  highlightId: number | null;
  scrollRef: React.RefObject<HTMLDivElement>;
  composerRef: React.RefObject<HTMLTextAreaElement>;
  onBack: () => void;
  onDraft: (v: string) => void;
  onSend: (customBody?: string) => Promise<void> | void;
  canRenameGroup: boolean;
  onRenameGroup: (g: ChatGroup) => void;
  onEditMessage: (messageId: number, body: string) => Promise<void>;
  onDeleteMessage: (messageId: number) => Promise<void>;
}) {
  const isTeam = room.kind === 'team';
  const isGroup = room.kind === 'group';

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editText, setEditText] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [deletingMessage, setDeletingMessage] = useState(false);

  // File attachment states
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const toast = useToast();

  const onFileChange = (e: ReactChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    if (file.type.startsWith('image/')) {
      setFilePreview(URL.createObjectURL(file));
    } else {
      setFilePreview(null);
    }
  };

  const removeSelectedFile = () => {
    if (filePreview) URL.revokeObjectURL(filePreview);
    setSelectedFile(null);
    setFilePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const onPaste = (e: ReactClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].kind === 'file') {
        const file = items[i].getAsFile();
        if (file) {
          e.preventDefault();
          setSelectedFile(file);
          if (file.type.startsWith('image/')) {
            setFilePreview(URL.createObjectURL(file));
          }
          break;
        }
      }
    }
  };

  const handleComposerSend = async () => {
    if (uploading || sending) return;
    if (selectedFile) {
      setUploading(true);
      try {
        const cloudUrl = await uploadFileToCloud(selectedFile);
        let type: 'image' | 'video' | 'file' = 'file';
        if (selectedFile.type.startsWith('image/')) type = 'image';
        else if (selectedFile.type.startsWith('video/')) type = 'video';

        const payload = JSON.stringify({
          type,
          url: cloudUrl,
          name: selectedFile.name,
          size: formatFileSize(selectedFile.size),
          caption: draft.trim() || undefined,
        });

        removeSelectedFile();
        onDraft('');
        await onSend(payload);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Could not upload file.');
      } finally {
        setUploading(false);
      }
    } else {
      if (!draft.trim()) return;
      await onSend();
    }
  };

  const startEdit = (m: ChatMessage | TeamMessage | GroupMessage) => {
    const trimmed = m.body.trim();
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (parsed?.caption !== undefined) {
          setEditText(parsed.caption);
        } else if (parsed?.text !== undefined) {
          setEditText(parsed.text);
        } else {
          setEditText(m.body);
        }
      } catch {
        setEditText(m.body);
      }
    } else {
      setEditText(m.body);
    }
    setEditingId(m.id);
  };

  const submitEdit = async (message: ChatMessage | TeamMessage | GroupMessage) => {
    if (!editText.trim()) return;
    setSavingEdit(true);
    try {
      let finalBody = editText.trim();
      const trimmed = message.body.trim();
      if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
        try {
          const parsed = JSON.parse(trimmed);
          if (parsed?.caption !== undefined) {
            parsed.caption = finalBody;
            finalBody = JSON.stringify(parsed);
          } else if (parsed?.text !== undefined) {
            parsed.text = finalBody;
            finalBody = JSON.stringify(parsed);
          }
        } catch {}
      }
      await onEditMessage(message.id, finalBody);
      setEditingId(null);
    } finally {
      setSavingEdit(false);
    }
  };

  const submitDelete = async (messageId: number) => {
    setDeletingMessage(true);
    try {
      await onDeleteMessage(messageId);
      setConfirmDeleteId(null);
    } finally {
      setDeletingMessage(false);
    }
  };

  /** The `@…` being typed right now, if the caret is inside one. */
  const [mentionQuery, setMentionQuery] = useState<{ from: number; text: string } | null>(null);
  const [mentionIndex, setMentionIndex] = useState(0);

  const suggestions = useMemo(() => {
    if (!isTeam || !mentionQuery) return [];
    const needle = mentionQuery.text.toLowerCase();
    return contacts
      .filter((c) => c.name.toLowerCase().includes(needle))
      .slice(0, 5);
  }, [isTeam, mentionQuery, contacts]);

  /*
    Finds the mention being typed: an "@" that starts a word, with no space between it
    and the caret. Names contain spaces, so the query deliberately stops at the first
    one — the picker narrows on the first name and inserting completes the rest.
  */
  const syncMention = (value: string, caret: number) => {
    if (!isTeam) return;
    const upto = value.slice(0, caret);
    const at = upto.lastIndexOf('@');
    if (at === -1) { setMentionQuery(null); return; }
    const before = at === 0 ? '' : upto[at - 1];
    const isWordStart = at === 0 || /\s/.test(before);
    const text = upto.slice(at + 1);
    if (!isWordStart || /[\s\n]/.test(text)) { setMentionQuery(null); return; }
    setMentionQuery({ from: at, text });
    setMentionIndex(0);
  };

  const applyMention = (person: ChatContact) => {
    if (!mentionQuery) return;
    const el = composerRef.current;
    const caret = el?.selectionStart ?? draft.length;
    const next = `${draft.slice(0, mentionQuery.from)}@${person.name} ${draft.slice(caret)}`;
    onDraft(next);
    setMentionQuery(null);
    // Put the caret just after the name that was inserted, not at the end of the box.
    const pos = mentionQuery.from + person.name.length + 2;
    window.setTimeout(() => {
      el?.focus();
      el?.setSelectionRange(pos, pos);
    }, 0);
  };

  /*
    Enter sends, Shift+Enter starts a new line. While the mention picker is up the
    arrows and Enter belong to it instead — otherwise choosing a name would post the
    half-typed message.
  */
  const onComposerKey = (e: ReactKeyboardEvent<HTMLTextAreaElement>) => {
    if (mentionQuery && suggestions.length) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setMentionIndex((i) => Math.min(i + 1, suggestions.length - 1)); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); setMentionIndex((i) => Math.max(i - 1, 0)); return; }
      if (e.key === 'Enter' || e.key === 'Tab') { e.preventDefault(); applyMention(suggestions[mentionIndex]); return; }
      if (e.key === 'Escape') { e.preventDefault(); setMentionQuery(null); return; }
    }
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleComposerSend();
    }
  };

  const header = isTeam
    ? { name: 'Team Chat', sub: `Everyone · ${contacts.length + 1} people` }
    : isGroup
      ? { name: room.group.name, sub: `${room.group.member_count} member${room.group.member_count === 1 ? '' : 's'}` }
      : { name: room.contact.name, sub: `${roleLabel(room.contact.role)}${room.contact.department ? ` · ${room.contact.department}` : ''}` };

  const empty = isTeam
    ? { title: 'Nothing here yet', description: 'Post an update for the whole team. Type @ to tag someone.' }
    : isGroup
      ? { title: 'Nothing here yet', description: `Start the conversation with the ${room.group.member_count} people in this group.` }
      : { title: `Say hello to ${room.contact.name.split(' ')[0]}`, description: 'Messages you send here are only visible to the two of you.' };

  const items: RoomMessage[] = isTeam
    ? teamMessages
    : isGroup ? groupMessages : messages;

  /* Grouped into days so a room read weeks later still says when things happened. */
  const days = useMemo(() => {
    const out: { day: string; items: RoomMessage[] }[] = [];
    for (const m of items) {
      const day = m.created_at.slice(0, 10);
      const last = out[out.length - 1];
      if (last && last.day === day) last.items.push(m);
      else out.push({ day, items: [m] });
    }
    return out;
  }, [items]);

  return (
    <>
      <header className="flex shrink-0 items-center gap-2 border-b border-border px-3 py-3">
        {/* Only below `lg`, where the list is not on screen beside this. */}
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to all conversations"
          className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground lg:hidden"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        {isTeam ? (
          <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary-strong">
            <Users className="h-4 w-4" />
          </span>
        ) : isGroup ? (
          <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <Users className="h-4 w-4" />
          </span>
        ) : (
          <Avatar name={room.contact.name} src={room.contact.profile_image} size="sm" />
        )}
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-foreground">{header.name}</span>
          <span className="block truncate text-[11px] text-muted-foreground">{header.sub}</span>
        </span>
        {/* Renaming is admin-only and sits in the room itself, which is where you
            are when you notice the name is wrong. */}
        {isGroup && canRenameGroup && (
          <button
            type="button"
            onClick={() => onRenameGroup(room.group)}
            aria-label="Rename group"
            title="Rename group"
            className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <Pencil className="h-4 w-4" />
          </button>
        )}
      </header>

      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto bg-muted/40 px-3 py-4">
        {loading && items.length === 0 ? (
          <div className="flex justify-center py-10 text-muted-foreground"><Spinner /></div>
        ) : items.length === 0 ? (
          <EmptyState icon={<MessagesSquare className="h-6 w-6" />} title={empty.title} description={empty.description} />
        ) : (
          days.map(({ day, items: dayItems }) => (
            <div key={day} className="space-y-1.5">
              <p className="sticky top-0 z-10 text-center">
                <span className="rounded-full bg-background/90 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                  {day === todayIso() ? 'Today' : formatDate(day)}
                </span>
              </p>
              {dayItems.map((m, i) => {
                const mine = m.sender_id === me;
                const team = 'mentions' in m ? m : null;
                /* Both rooms show who is talking; only the channel has mentions. */
                const named = 'sender_name' in m ? m : null;
                /* In a room, the name is shown once per run of messages from the
                   same person — repeating it on every bubble is noise. */
                const prev = dayItems[i - 1];
                const startsRun = !prev || prev.sender_id !== m.sender_id;
                const taggedMe = !!team?.mentions.some((x) => x.id === me);

                const found = m.id === highlightId;
                const isEditing = editingId === m.id;

                return (
                  <div
                    key={m.id}
                    data-message-id={m.id}
                    className={`group relative flex items-center gap-1.5 ${mine ? 'justify-end' : 'justify-start'}`}
                  >
                    {mine && !isEditing && (
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5 shrink-0">
                        <button
                          type="button"
                          title="Edit message"
                          onClick={() => startEdit(m)}
                          className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          title="Delete message"
                          onClick={() => setConfirmDeleteId(m.id)}
                          className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}

                    <div
                      className={`max-w-[85%] rounded-2xl px-3 py-2 shadow-sm ${
                        found ? 'ring-2 ring-ring ring-offset-2 ring-offset-muted' : ''
                      } ${
                        mine
                          ? 'rounded-br-sm bg-primary text-primary-foreground'
                          : `rounded-bl-sm bg-card text-card-foreground border ${
                            taggedMe ? 'border-primary' : 'border-border'
                          }`
                      }`}
                    >
                      {named && !mine && startsRun && (
                        <p className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold text-primary-strong">
                          <Avatar name={named.sender_name} src={named.sender_profile_image} size="sm" className="!h-4 !w-4 !text-[8px]" />
                          {named.sender_name}
                        </p>
                      )}
                      {isEditing ? (
                        <div className="space-y-2 min-w-[200px]">
                          <textarea
                            value={editText}
                            onChange={(e) => setEditText(e.target.value)}
                            className="w-full rounded bg-black/20 text-primary-foreground placeholder-primary-foreground/60 p-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-primary-foreground/40 border border-primary-foreground/30"
                            rows={2}
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                void submitEdit(m);
                              } else if (e.key === 'Escape') {
                                setEditingId(null);
                              }
                            }}
                          />
                          <div className="flex items-center justify-end gap-1.5 text-xs">
                            <button
                              type="button"
                              onClick={() => setEditingId(null)}
                              className="px-2 py-0.5 rounded bg-black/20 hover:bg-black/30 text-primary-foreground transition-colors"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              disabled={savingEdit || !editText.trim()}
                              onClick={() => void submitEdit(m)}
                              className="px-2.5 py-0.5 rounded bg-white text-primary font-semibold hover:bg-white/90 transition-colors disabled:opacity-50"
                            >
                              {savingEdit ? 'Saving…' : 'Save'}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="whitespace-pre-wrap break-words text-sm">
                          {renderChatMessage(m.body, team?.mentions, me, mine)}
                        </div>
                      )}
                      <p className={`mt-1 text-[10px] ${mine ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                        {formatTime(m.created_at)}
                        {!team && mine && (m as ChatMessage).is_read && <span className="ml-1">· Read</span>}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          ))
        )}
      </div>

      {error && (
        <p className="shrink-0 border-t border-border bg-destructive/10 px-3 py-2 text-xs text-destructive" role="alert">
          {error}
        </p>
      )}

      {selectedFile && (
        <div className="flex items-center gap-3 border-t border-border bg-muted/60 px-3 py-2">
          {filePreview ? (
            <img src={filePreview} alt="Preview" className="h-11 w-11 shrink-0 rounded-lg object-cover border border-border" />
          ) : (
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              {selectedFile.type.startsWith('video/') ? <Film className="h-5 w-5" /> : <FileText className="h-5 w-5" />}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold text-foreground">{selectedFile.name}</p>
            <p className="text-[11px] text-muted-foreground">{formatFileSize(selectedFile.size)} · Type a message to send as caption</p>
          </div>
          <button
            type="button"
            onClick={removeSelectedFile}
            className="rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            title="Remove attachment"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="relative flex shrink-0 items-end gap-2 border-t border-border p-3">
        {/* The mention picker. Sits above the composer so it never covers what is
            being typed, and is dismissed by Escape or by typing past the name. */}
        {isTeam && mentionQuery && suggestions.length > 0 && (
          <ul
            role="listbox"
            aria-label="Tag someone"
            className="absolute bottom-full left-3 right-3 mb-2 max-h-44 overflow-y-auto rounded-lg border border-border bg-popover p-1 shadow-lg"
          >
            {suggestions.map((p, i) => (
              <li
                key={p.id}
                role="option"
                aria-selected={i === mentionIndex}
                onMouseEnter={() => setMentionIndex(i)}
                onMouseDown={(e) => { e.preventDefault(); applyMention(p); }}
                className={`flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm ${
                  i === mentionIndex ? 'bg-accent text-accent-foreground' : 'text-popover-foreground'
                }`}
              >
                <Avatar name={p.name} src={p.profile_image} size="sm" className="!h-6 !w-6 !text-[9px]" />
                <span className="min-w-0 flex-1 truncate">{p.name}</span>
                <span className="shrink-0 text-[10px] text-muted-foreground">{roleLabel(p.role)}</span>
              </li>
            ))}
          </ul>
        )}

        <input
          type="file"
          ref={fileInputRef}
          onChange={onFileChange}
          className="hidden"
          accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip,.rar"
        />

        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading || sending}
          aria-label="Attach photo, video or document"
          title="Attach photo, video or document"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground transition-colors disabled:opacity-50"
        >
          <Paperclip className="h-5 w-5" />
        </button>

        <textarea
          ref={composerRef}
          value={draft}
          onChange={(e) => { onDraft(e.target.value); syncMention(e.target.value, e.target.selectionStart ?? 0); }}
          onKeyUp={(e) => syncMention(e.currentTarget.value, e.currentTarget.selectionStart ?? 0)}
          onClick={(e) => syncMention(e.currentTarget.value, e.currentTarget.selectionStart ?? 0)}
          onKeyDown={onComposerKey}
          onPaste={onPaste}
          rows={1}
          maxLength={4000}
          placeholder={
            selectedFile
              ? 'Add a caption…'
              : isTeam
                ? 'Message the team… use @ to tag'
                : isGroup
                  ? `Message ${room.group.name}…`
                  : `Message ${room.contact.name.split(' ')[0]}…`
          }
          aria-label={isTeam ? 'Message the team'
            : isGroup ? `Message ${room.group.name}`
              : `Message ${room.contact.name}`}
          className="input max-h-28 min-h-[2.5rem] flex-1 resize-none py-2"
        />
        <button
          type="button"
          onClick={() => void handleComposerSend()}
          disabled={(!draft.trim() && !selectedFile) || sending || uploading}
          aria-label="Send message"
          className="btn-primary flex h-10 w-10 shrink-0 items-center justify-center rounded-full p-0 disabled:opacity-50"
        >
          {sending || uploading ? <Spinner className="h-4 w-4" /> : <Send className="h-4 w-4" />}
        </button>
      </div>

      <Modal
        open={confirmDeleteId !== null}
        onClose={() => setConfirmDeleteId(null)}
        title="Delete message"
        description="Are you sure you want to delete this message? This cannot be undone."
        footer={
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setConfirmDeleteId(null)} className="btn-secondary">
              Cancel
            </button>
            <button
              type="button"
              disabled={deletingMessage}
              onClick={() => confirmDeleteId && void submitDelete(confirmDeleteId)}
              className="btn-danger"
            >
              {deletingMessage ? <><Spinner className="h-4 w-4" /> Deleting…</> : 'Delete'}
            </button>
          </div>
        }
      >
        <p className="text-sm text-muted-foreground">The message will be permanently removed for everyone in this chat.</p>
      </Modal>
    </>
  );
}
