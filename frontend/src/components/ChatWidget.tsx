import {
  useCallback, useEffect, useMemo, useRef, useState,
  type KeyboardEvent as ReactKeyboardEvent, type ReactNode,
} from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  ArrowLeft, AtSign, MessageCircle, MessagesSquare, Pencil, Plus, RefreshCw, Search, Send,
  Users, UserRound, X,
} from 'lucide-react';
import { chatApi } from '../api/endpoints';
import { ApiError } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { formatDate, formatTime, relativeTime, todayIso } from '../lib/format';
import { Avatar, EmptyState, Spinner } from './ui';
import { GroupModal } from './GroupModal';
import {
  isAdmin, roleLabel,
  type ChatContact, type ChatGroup, type ChatMessage, type GroupMessage, type TeamMessage,
} from '../types';

/**
 * The chat launcher and its panel.
 *
 * Mounted once by AppLayout, so it is present on every signed-in screen rather than
 * being a page someone has to navigate to — a conversation is something you have
 * *while* looking at a task, not instead of.
 *
 * Two kinds of room, one panel. **Team Chat** is a single company-wide channel that
 * everybody is in; below it is the directory of people for one-to-one threads. Every
 * role gets both — nothing here branches on role, and the server does not either.
 *
 * In the channel you can tag somebody with `@`. A tag is not just styling: the person
 * named gets a notification, and the channel row shows an `@` marker so being
 * addressed reads differently from ordinary traffic.
 *
 * Live-ness is polling, matching the notification bell. Two rates, because they answer
 * different questions: the badge only has to be roughly current, an open room has to
 * feel immediate. Both pause while the tab is hidden, and an open room asks only for
 * messages newer than the last one on screen.
 */

/** How often the launcher badge re-checks. Matches the notification bell. */
const BADGE_POLL_MS = 20_000;
/** How often an open conversation or channel asks for new messages. */
const THREAD_POLL_MS = 5_000;

/** Which room is open. `null` is the directory. */
/** Anything that can appear in a room: a DM, a channel post, or a group post. */
type RoomMessage = ChatMessage | TeamMessage | GroupMessage;

type ActiveRoom =
  | { kind: 'dm'; contact: ChatContact }
  | { kind: 'team' }
  | { kind: 'group'; group: ChatGroup }
  | null;

export function ChatWidget() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [teamUnread, setTeamUnread] = useState({ unread: 0, mentions: 0 });
  const [groupUnreadTotal, setGroupUnreadTotal] = useState(0);

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
  const [roomLoading, setRoomLoading] = useState(false);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  /** The newest id on screen — what the poll asks for messages after. */
  const lastIdRef = useRef(0);

  /* ------------------------------------------------------------ unread badge */

  const refreshBadge = useCallback(async (signal?: AbortSignal) => {
    try {
      const { data } = await chatApi.unreadCount(signal);
      setUnread(data.unread);
      setTeamUnread(data.team);
      setGroupUnreadTotal(data.groups);
      const byId = new Map(data.threads.map((t) => [t.user_id, t.unread]));
      setContacts((prev) => prev.map((c) => ({ ...c, unread: byId.get(c.id) ?? 0 })));
    } catch {
      // A failed poll is not worth interrupting anyone over; the next tick retries.
    }
  }, []);

  useEffect(() => {
    if (!user) {
      setUnread(0);
      setTeamUnread({ unread: 0, mentions: 0 });
      setGroupUnreadTotal(0);
      setOpen(false);
      return undefined;
    }
    const controller = new AbortController();
    void refreshBadge(controller.signal);

    const id = window.setInterval(() => {
      if (!document.hidden) void refreshBadge();
    }, BADGE_POLL_MS);
    const onVisible = () => { if (!document.hidden) void refreshBadge(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      controller.abort();
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [user, refreshBadge]);

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

  useEffect(() => {
    if (!open || active) return undefined;
    const controller = new AbortController();
    const timer = window.setTimeout(() => { void loadContacts(search, controller.signal); }, search ? 250 : 0);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [open, active, search, loadContacts]);

  /*
    The channel's mention picker needs the full roster, which the directory only holds
    while it is showing and unfiltered. Loading it once when the panel opens means the
    picker is populated no matter which room you go into first.
  */
  useEffect(() => {
    if (!open || contacts.length) return;
    void loadContacts('');
  }, [open, contacts.length, loadContacts]);

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
  }, []);

  const openThread = useCallback(async (contact: ChatContact) => {
    setActive({ kind: 'dm', contact });
    setMessages([]);
    lastIdRef.current = 0;
    setDraft('');
    setError(null);
    setRoomLoading(true);
    try {
      const { data, meta } = await chatApi.messages(contact.id);
      setMessages(data);
      lastIdRef.current = data.length ? data[data.length - 1].id : 0;
      if (typeof meta?.unread === 'number') setUnread(meta.unread);
      setContacts((prev) => prev.map((c) => (c.id === contact.id ? { ...c, unread: 0 } : c)));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not open that conversation.');
    } finally {
      setRoomLoading(false);
      window.setTimeout(() => composerRef.current?.focus(), 0);
    }
  }, []);

  const openTeam = useCallback(async () => {
    setActive({ kind: 'team' });
    setTeamMessages([]);
    lastIdRef.current = 0;
    setDraft('');
    setError(null);
    setRoomLoading(true);
    try {
      const { data, meta } = await chatApi.team.messages();
      setTeamMessages(data);
      lastIdRef.current = data.length ? data[data.length - 1].id : 0;
      if (typeof meta?.unread === 'number') setUnread(meta.unread);
      setTeamUnread({ unread: 0, mentions: 0 });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not open Team Chat.');
    } finally {
      setRoomLoading(false);
      window.setTimeout(() => composerRef.current?.focus(), 0);
    }
  }, []);

  const openGroup = useCallback(async (group: ChatGroup) => {
    setActive({ kind: 'group', group });
    setGroupMessages([]);
    lastIdRef.current = 0;
    setDraft('');
    setError(null);
    setRoomLoading(true);
    try {
      const { data, meta } = await chatApi.groups.messages(group.id);
      setGroupMessages(data);
      lastIdRef.current = data.length ? data[data.length - 1].id : 0;
      if (typeof meta?.unread === 'number') setUnread(meta.unread);
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
  }, []);

  /*
    `?chat=team` opens the channel.

    A mention notification has to lead somewhere, and chat is a widget rather than a
    route — there is no /chat to navigate to. The bell hands the intent over in the
    URL, exactly as a task notification hands over a `?highlight`, and the parameter
    is cleared once acted on so a refresh or a back-button press does not reopen it.
  */
  useEffect(() => {
    if (searchParams.get('chat') !== 'team') return;
    setOpen(true);
    void openTeam();
    const next = new URLSearchParams(searchParams);
    next.delete('chat');
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
        if (typeof meta?.unread === 'number') setUnread(meta.unread);
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
        if (typeof meta?.unread === 'number') setUnread(meta.unread);
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
      if (typeof meta?.unread === 'number') setUnread(meta.unread);
    } catch {
      /* transient; the next tick retries */
    }
  }, []);

  useEffect(() => {
    if (!open || !active) return undefined;
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

  const send = useCallback(async () => {
    const body = draft.trim();
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
      setDraft('');
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

  /* ---------------------------------------------------------------- behaviour */

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (active) openDirectory();
      else setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, active, openDirectory]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, teamMessages, groupMessages, active]);

  if (!user) return null;

  const title = active?.kind === 'dm'
    ? `Chat with ${active.contact.name}`
    : active?.kind === 'team' ? 'Team Chat'
      : active?.kind === 'group' ? active.group.name : 'Chat';

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={unread > 0 ? `Chat, ${unread} unread messages` : 'Chat'}
        aria-expanded={open}
        title="Chat"
        className="fixed bottom-5 right-5 z-40 inline-flex h-14 w-14 items-center justify-center rounded-full
                   bg-primary text-primary-foreground shadow-lg transition-transform
                   hover:bg-primary/90 active:scale-95 sm:bottom-6 sm:right-6"
      >
        {open ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
        {!open && unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-[1.25rem] items-center justify-center
                           rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="false"
          aria-label={title}
          className="animate-in-up fixed bottom-24 right-4 z-40 flex w-[min(23rem,calc(100vw-2rem))]
                     h-[min(32rem,calc(100vh-9rem))] flex-col overflow-hidden rounded-2xl border border-border
                     bg-popover text-popover-foreground shadow-2xl sm:right-6"
        >
          {active === null ? (
            <DirectoryView
              contacts={contacts}
              groups={groups}
              canCreateGroup={isAdmin(user.role)}
              loading={contactsLoading}
              error={error}
              search={search}
              unread={unread}
              teamUnread={teamUnread}
              onSearch={setSearch}
              onRefresh={() => { void loadContacts(search); void loadGroups(); }}
              onClose={() => setOpen(false)}
              onPick={(c) => void openThread(c)}
              onPickTeam={() => void openTeam()}
              onPickGroup={(g) => void openGroup(g)}
              onNewGroup={() => { setGroupError(null); setGroupDialog({ mode: 'create' }); }}
            />
          ) : (
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
              scrollRef={scrollRef}
              composerRef={composerRef}
              onBack={openDirectory}
              onClose={() => { openDirectory(); setOpen(false); }}
              onDraft={setDraft}
              onSend={() => void send()}
              canRenameGroup={isAdmin(user.role)}
              onRenameGroup={(g) => { setGroupError(null); setGroupDialog({ mode: 'rename', group: g }); }}
            />
          )}
        </div>
      )}

      {/*
        The dialog lives outside the panel so it is not clipped by its rounded,
        overflow-hidden frame, and it renders above it — creating a group is a
        deliberate act that should take the foreground while it is happening.
      */}
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
    </>
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

/* ------------------------------------------------------------------ directory */

function DirectoryView({
  contacts, groups, canCreateGroup, loading, error, search, unread, teamUnread,
  onSearch, onRefresh, onClose, onPick, onPickTeam, onPickGroup, onNewGroup,
}: {
  contacts: ChatContact[];
  groups: ChatGroup[];
  canCreateGroup: boolean;
  loading: boolean;
  error: string | null;
  search: string;
  unread: number;
  teamUnread: { unread: number; mentions: number };
  onSearch: (v: string) => void;
  onRefresh: () => void;
  onClose: () => void;
  onPick: (c: ChatContact) => void;
  onPickTeam: () => void;
  onPickGroup: (g: ChatGroup) => void;
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
            aria-label="Refresh contacts"
            className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close chat"
            className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="h-4 w-4" />
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
            placeholder="Search people…"
            aria-label="Search people"
            className="input pl-9"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {error && <p className="px-4 py-3 text-sm text-destructive" role="alert">{error}</p>}

        {/*
          The channel is pinned above the people and is not filtered by the search
          box: the search is for finding a person, and the one room everybody is in
          should not disappear while you look for one.
        */}
        <button
          type="button"
          onClick={onPickTeam}
          className="flex w-full items-center gap-3 border-b border-border bg-muted/40 px-4 py-3 text-left transition-colors hover:bg-muted"
        >
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary-strong">
            <Users className="h-5 w-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold text-foreground">Team Chat</span>
            <span className="mt-0.5 block truncate text-xs text-muted-foreground">
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
          <ul>
            {visibleGroups.map((g) => (
              <li key={g.id}>
                <button
                  type="button"
                  onClick={() => onPickGroup(g)}
                  className="flex w-full items-center gap-3 border-b border-border px-4 py-3 text-left transition-colors hover:bg-muted"
                >
                  <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                    <Users className="h-5 w-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-semibold text-foreground">{g.name}</span>
                      {g.last_message_at && (
                        <span className="shrink-0 text-[11px] text-muted-foreground">{relativeTime(g.last_message_at)}</span>
                      )}
                    </span>
                    <span className="mt-0.5 flex items-center justify-between gap-2">
                      <span className="truncate text-xs text-muted-foreground">
                        {g.last_message
                          ? `${g.last_message_mine ? 'You' : g.last_sender_name}: ${g.last_message}`
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
          <ul>
            {contacts.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => onPick(c)}
                  className="flex w-full items-center gap-3 border-b border-border px-4 py-3 text-left transition-colors hover:bg-muted"
                >
                  <Avatar name={c.name} src={c.profile_image} size="md" />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-semibold text-foreground">{c.name}</span>
                      {c.last_message_at && (
                        <span className="shrink-0 text-[11px] text-muted-foreground">
                          {relativeTime(c.last_message_at)}
                        </span>
                      )}
                    </span>
                    <span className="mt-0.5 flex items-center justify-between gap-2">
                      <span className="truncate text-xs text-muted-foreground">
                        {c.last_message
                          ? `${c.last_message_mine ? 'You: ' : ''}${c.last_message}`
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
      </div>
    </>
  );
}

/* ----------------------------------------------------------------------- room */

function RoomView({
  me, room, messages, teamMessages, groupMessages, contacts, loading, error, draft, sending,
  scrollRef, composerRef, onBack, onClose, onDraft, onSend, canRenameGroup, onRenameGroup,
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
  scrollRef: React.RefObject<HTMLDivElement>;
  composerRef: React.RefObject<HTMLTextAreaElement>;
  onBack: () => void;
  onClose: () => void;
  onDraft: (v: string) => void;
  onSend: () => void;
  canRenameGroup: boolean;
  onRenameGroup: (g: ChatGroup) => void;
}) {
  const isTeam = room.kind === 'team';
  const isGroup = room.kind === 'group';

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
      onSend();
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
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to all conversations"
          className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
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
        <button
          type="button"
          onClick={onClose}
          aria-label="Close chat"
          className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
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

                return (
                  <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`max-w-[85%] rounded-2xl px-3 py-2 shadow-sm ${
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
                      <p className="whitespace-pre-wrap break-words text-sm">
                        {team ? renderBody(team.body, team.mentions, me) : m.body}
                      </p>
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

        <textarea
          ref={composerRef}
          value={draft}
          onChange={(e) => { onDraft(e.target.value); syncMention(e.target.value, e.target.selectionStart ?? 0); }}
          onKeyUp={(e) => syncMention(e.currentTarget.value, e.currentTarget.selectionStart ?? 0)}
          onClick={(e) => syncMention(e.currentTarget.value, e.currentTarget.selectionStart ?? 0)}
          onKeyDown={onComposerKey}
          rows={1}
          maxLength={4000}
          placeholder={isTeam ? 'Message the team… use @ to tag'
            : isGroup ? `Message ${room.group.name}…`
              : `Message ${room.contact.name.split(' ')[0]}…`}
          aria-label={isTeam ? 'Message the team'
            : isGroup ? `Message ${room.group.name}`
              : `Message ${room.contact.name}`}
          className="input max-h-28 min-h-[2.5rem] flex-1 resize-none py-2"
        />
        <button
          type="button"
          onClick={onSend}
          disabled={!draft.trim() || sending}
          aria-label="Send message"
          className="btn-primary h-10 w-10 shrink-0 rounded-full p-0"
        >
          {sending ? <Spinner className="h-4 w-4" /> : <Send className="h-4 w-4" />}
        </button>
      </div>
    </>
  );
}
