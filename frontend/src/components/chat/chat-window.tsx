'use client';

import { useState, useRef, useLayoutEffect, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { UserAvatar } from '@/components/chat/user-avatar';
import { Button } from '@/components/ui/button';
import { Search, Phone, Video, MoreVertical, X, ChevronUp, ChevronDown, User, BellOff, Archive, ShieldOff, Pin, Star, Trash2 } from 'lucide-react';
import type { Message } from '@/lib/mock-data';
import { MessageBubble } from './message-bubble';
import { CallLogBubble } from './call-log-bubble';
import { Composer } from './composer';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { format } from 'date-fns';
import { ChatMessage } from '@/hooks/use-messaging';
import { useProfile } from '@/hooks/use-user';
import { useChatThemeContext } from '@/context/ChatThemeContext';
import { useAuth } from '@/context/AuthContext';
import { VerifiedBadge, getVerifiedBadgeVariant, isVerifiedAccountIdentity } from '@/components/chat/verified-badge';

interface ChatWindowProps {
  activeChat: string;
  chatOverride?: {
    avatarUrl?: string | null;
    isOnline?: boolean;
    subPlan?: string | null;
    isVerified?: boolean;
    name: string;
    subtitle?: string | null;
  };
  messages?: ChatMessage[];
  onSendMessage?: (payload: {
    content?: string;
    type?: string;
    replyToId?: string | null;
    fileUrl?: string | null;
    mime?: string;
    duration?: number;
    size?: number;
  }) => void;
  onTyping?: (isTyping: boolean) => void;
  otherIsTyping?: boolean;
  onReact?: (messageId: string, emoji: string) => void;
  onEdit?: (messageId: string, content: string) => void;
  onDelete?: (messageId: string) => void;
  onProfileClick?: () => void;
  onMessageAvatarClick?: (senderId: string) => void;
  onVoiceCall?: () => void;
  onVideoCall?: () => void;
  onMute?: () => void;
  onPinConversation?: () => void;
  onFavorite?: () => void;
  onArchive?: () => void;
  onDeleteChat?: () => void;
  onBlock?: () => void;
  onPin?: (messageId: string) => void;
  conversations?: { id: string; name: string; avatarUrl?: string | null }[];
  onForwardMessage?: (messageId: string, content: string, toConversationId: string, fileUrl?: string, type?: string) => void;
}

interface ReplyTo {
  id: string;
  senderName: string;
  content: string;
}


function getDisabledConversationMetadata(): { is_group: boolean; participants: unknown[] } | null {
  return null;
}

function formatCallDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return s > 0 ? `${m}m ${s}s` : `${m}m`
}

function toUiMessage(
  m: ChatMessage,
  currentIdentity: { id?: string | null; isVerified: boolean; sub_plan?: string | null },
): Message {
  // Group reactions: [{ userId, emoji }] → [{ emoji, count, reactedByMe }]
  const reactionMap: Record<string, { count: number; reactedByMe: boolean }> = {};
  for (const r of m.reactions ?? []) {
    if (!reactionMap[r.emoji]) reactionMap[r.emoji] = { count: 0, reactedByMe: false };
    reactionMap[r.emoji].count += 1;
    if (r.userId === currentIdentity.id) reactionMap[r.emoji].reactedByMe = true;
  }
  const reactions = Object.entries(reactionMap).map(([emoji, { count, reactedByMe }]) => ({ emoji, count, reactedByMe }));
  const myReaction = (m.reactions ?? []).find((r) => r.userId === currentIdentity.id)?.emoji ?? null;

  const rawMime = (m.metadata as any)?.mime as string | undefined
  const fileUrl = m.file_url ?? m.content ?? ''
  const urlExt = fileUrl.split('?')[0].split('.').pop()?.toLowerCase() ?? ''
  const IMAGE_EXTS = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'avif', 'bmp', 'ico'])
  const VIDEO_EXTS = new Set(['mp4', 'webm', 'mov', 'avi', 'mkv'])
  const mimeFromExt = IMAGE_EXTS.has(urlExt) ? `image/${urlExt === 'jpg' ? 'jpeg' : urlExt}` :
    VIDEO_EXTS.has(urlExt) ? `video/${urlExt}` : ''
  const mime = (rawMime && rawMime.includes('/')) ? rawMime : (mimeFromExt || rawMime || '')
  const rawType: string = m.type ?? 'text'
  const resolvedType: Message['type'] =
    rawType === 'voice' ? 'voice' :
    rawType === 'call' ? 'call' :
    rawType === 'gif' ? 'gif' :
    rawType === 'sticker' ? 'sticker' :
    rawType === 'image' && mime === 'image/gif' ? 'gif' :
    rawType === 'image' ? 'image' :
    rawType === 'video' ? 'video' :
    (rawType === 'file' || rawType === 'image') && mime.startsWith('video/') ? 'video' :
    (rawType === 'file' || rawType === 'image') && mime.startsWith('image/') ? 'image' :
    rawType === 'file' ? 'file' :
    'text'

  const callDurationSecs = rawType === 'call' && typeof (m.metadata as any)?.duration === 'number'
    ? (m.metadata as any).duration as number
    : null

  return {
    id: m.id,
    senderId: m.sender_id,
    senderName: m.sender.username,
    senderSubPlan: m.sender.sub_plan ?? (m.sender.id === currentIdentity.id ? currentIdentity.sub_plan : null) ?? null,
    senderIsVerified: isVerifiedAccountIdentity(
      {
        email: m.sender.email,
        id: m.sender.id,
        is_verified: m.sender.is_verified,
        sub_plan: m.sender.sub_plan,
      },
      currentIdentity,
    ),
    avatar: m.sender.avatar_url ?? undefined,
    fileUrl: m.file_url ?? undefined,
    mime: rawType === 'call' ? ((m.metadata as any)?.mime as string ?? '') : mime,
    content:
      m.type === 'voice'
        ? (typeof (m.metadata as any)?.duration === 'number'
            ? `${Math.round((m.metadata as any).duration)}s`
            : 'Voice message')
        : m.type === 'call'
        ? (m.content ?? 'ended')
        : (m.content ?? m.file_url ?? ''),
    duration: callDurationSecs != null ? formatCallDuration(callDurationSecs) : undefined,
    type: resolvedType,
    timestamp: m.created_at,
    isOwn: m.sender_id === currentIdentity.id,
    isRead: m.status === 'read',
    isDelivered: m.status === 'delivered' || m.status === 'read',
    isPinned: m.is_pinned ?? false,
    isForwarded: m.is_forwarded ?? false,
    reactions: reactions.length ? reactions : undefined,
    myReaction,
    reply: m.reply_to?.sender
      ? { senderName: m.reply_to.sender.username, content: m.reply_to.content ?? '' }
      : undefined,
  };
}

export function ChatWindow({ activeChat, chatOverride, messages: providedMessages = [], onSendMessage, onTyping, otherIsTyping = false, onReact, onDelete, onPin, onProfileClick, onMessageAvatarClick, onVoiceCall, onVideoCall, onMute, onPinConversation, onFavorite, onArchive, onDeleteChat, onBlock, conversations = [], onForwardMessage }: ChatWindowProps) {
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const { resolved: chatTheme } = useChatThemeContext();
  const conv = getDisabledConversationMetadata();
  const currentIsVerified = isVerifiedAccountIdentity({
    email: profile?.email ?? user?.email,
    id: profile?.id,
    is_verified: profile?.is_verified,
    sub_plan: profile?.sub_plan,
  });
  const currentIdentity = {
    id: profile?.id,
    isVerified: currentIsVerified,
    sub_plan: profile?.sub_plan,
  }
  const messages = providedMessages
    .slice()
    .map((m) => toUiMessage(m, currentIdentity));
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const initialScrollDone = useRef(false);
  const [replyTo, setReplyTo] = useState<ReplyTo | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchMatchIndex, setSearchMatchIndex] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const searchMatches = searchQuery.trim().length > 0
    ? messages.filter(m => m.type === 'text' && m.content.toLowerCase().includes(searchQuery.toLowerCase()))
    : [];
  const activeMatchId = searchMatches[searchMatchIndex]?.id ?? null;

  useEffect(() => {
    if (searchOpen) searchInputRef.current?.focus();
    else { setSearchQuery(''); setSearchMatchIndex(0); }
  }, [searchOpen]);

  useEffect(() => { setSearchMatchIndex(0); }, [searchQuery]);

  useEffect(() => {
    if (!activeMatchId || !scrollContainerRef.current) return;
    const el = scrollContainerRef.current.querySelector(`[data-message-id="${activeMatchId}"]`);
    if (!el) return;
    const containerRect = scrollContainerRef.current.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    const offset = elRect.top - containerRect.top + scrollContainerRef.current.scrollTop - containerRect.height / 2 + elRect.height / 2;
    scrollContainerRef.current.scrollTo({ top: offset, behavior: 'smooth' });
  }, [activeMatchId]);

  const goToPrev = useCallback(() => {
    if (!searchMatches.length) return;
    setSearchMatchIndex(i => (i + 1) % searchMatches.length);
  }, [searchMatches.length]);

  const goToNext = useCallback(() => {
    if (!searchMatches.length) return;
    setSearchMatchIndex(i => (i - 1 + searchMatches.length) % searchMatches.length);
  }, [searchMatches.length]);

  const [forwardingMessage, setForwardingMessage] = useState<Message | null>(null);
  const [forwardSearch, setForwardSearch] = useState('');
  const [pinnedIndex, setPinnedIndex] = useState(0);
  const pinnedMessages = messages.filter(m => m.isPinned).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  const pinnedMessage = pinnedMessages[pinnedIndex % Math.max(1, pinnedMessages.length)] ?? null;
  const [pinnedSpotlight, setPinnedSpotlight] = useState<{ id: string; nonce: number } | null>(null);
  const pinnedSpotlightTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const spotlightPinnedMessage = useCallback((messageId: string) => {
    const nonce = Date.now();

    if (pinnedSpotlightTimeoutRef.current) {
      clearTimeout(pinnedSpotlightTimeoutRef.current);
    }

    setPinnedSpotlight({ id: messageId, nonce });
    pinnedSpotlightTimeoutRef.current = setTimeout(() => {
      setPinnedSpotlight((current) => current?.nonce === nonce ? null : current);
    }, 1400);
  }, []);

  // Reset index when pin count changes
  useEffect(() => {
    setPinnedIndex(0);
  }, [pinnedMessages.length]);

  useEffect(() => {
    return () => {
      if (pinnedSpotlightTimeoutRef.current) {
        clearTimeout(pinnedSpotlightTimeoutRef.current);
      }
    };
  }, []);

  useLayoutEffect(() => {
    initialScrollDone.current = false;
  }, [activeChat]);

  useLayoutEffect(() => {
    if (messages.length === 0) return;
    const el = scrollContainerRef.current;
    if (!el) return;

    const scrollToBottom = () => { if (el) el.scrollTop = el.scrollHeight; };

    if (!initialScrollDone.current) {
      initialScrollDone.current = true;
      scrollToBottom();
      const r = requestAnimationFrame(scrollToBottom);
      const t1 = setTimeout(scrollToBottom, 100);
      const t2 = setTimeout(scrollToBottom, 400);
      return () => {
        cancelAnimationFrame(r);
        clearTimeout(t1);
        clearTimeout(t2);
      };
    } else {
      const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
      if (nearBottom) {
        requestAnimationFrame(scrollToBottom);
        setTimeout(scrollToBottom, 100);
      }
    }
  }, [messages.length, activeChat]);


  const conversationBackgroundStyle = chatTheme.bg ? { backgroundColor: chatTheme.bg } : undefined;
  const chatName = chatOverride?.name ?? 'Chat';
  const resolvedChatAvatar = chatOverride?.avatarUrl ?? undefined;
  const initials = chatName
    .split(' ')
    .map((word: string) => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const isOnline = chatOverride?.isOnline ?? false;
  const chatSubtitle = chatOverride?.subtitle ?? null;
  const visibleChatSubtitle = chatSubtitle === 'Online' || chatSubtitle === 'Offline' ? null : chatSubtitle;

  const groupedMessages = messages.reduce(
    (acc, message) => {
      const date = format(new Date(message.timestamp), 'yyyy-MM-dd');
      if (!acc[date]) acc[date] = [];
      acc[date].push(message);
      return acc;
    },
    {} as Record<string, typeof messages>
  );

  const getDayLabel = (dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (format(date, 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd')) return 'Today';
    if (format(date, 'yyyy-MM-dd') === format(yesterday, 'yyyy-MM-dd')) return 'Yesterday';
    return format(date, 'MMM d, yyyy');
  };

  const handleReply = (message: Message) => {
    setReplyTo({
      id: message.id,
      senderName: message.senderName,
      content: message.type === 'text' ? message.content : `[${message.type}]`,
    });
  };

  return (
    <div className="flex-1 flex flex-col bg-sidebar h-full min-w-0">
      {/* Header */}
      <div className="h-14 border-b border-border px-4 flex items-center justify-between bg-sidebar shrink-0">
        <AnimatePresence mode="wait" initial={false}>
          {searchOpen ? (
            <motion.div
              key="search-bar"
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 16 }}
              transition={{ duration: 0.15 }}
              className="flex flex-1 items-center gap-2 min-w-0"
            >
              <Search className="h-4 w-4 text-muted-foreground shrink-0" />
              <input
                ref={searchInputRef}
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onKeyDown={e => { if (e.key === 'Escape') setSearchOpen(false); if (e.key === 'Enter') goToPrev(); }}
                placeholder="Search messages…"
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/60 text-foreground min-w-0"
              />
              {searchQuery.length > 0 && (
                <span className="text-xs text-muted-foreground shrink-0 tabular-nums">
                  {searchMatches.length > 0 ? `${searchMatchIndex + 1}/${searchMatches.length}` : '0/0'}
                </span>
              )}
              <div className="flex gap-0.5 shrink-0">
                <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full" onClick={goToPrev} disabled={searchMatches.length === 0}>
                  <ChevronUp className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full" onClick={goToNext} disabled={searchMatches.length === 0}>
                  <ChevronDown className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full" onClick={() => setSearchOpen(false)}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="header-info"
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              transition={{ duration: 0.15 }}
              className="flex items-center gap-3 flex-1 min-w-0"
            >
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={onProfileClick}
                disabled={!onProfileClick}
                className="relative rounded-full hover:ring-2 ring-primary/40 transition-all shrink-0 disabled:cursor-default disabled:hover:ring-0"
              >
                <Avatar className="h-9 w-9">
                  <AvatarImage src={resolvedChatAvatar} alt={chatName} />
                  <AvatarFallback className="bg-primary text-primary-foreground text-sm">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <span
                  className={`absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-sidebar ${
                    isOnline ? 'bg-green-500' : 'bg-muted-foreground/55'
                  }`}
                />
              </motion.button>

              <div className="flex-1 min-w-0">
                <div className="flex min-w-0 items-center gap-1.5">
                  <h2 className="truncate text-sm font-semibold leading-tight text-foreground">{chatName}</h2>
                  {chatOverride?.isVerified ? <VerifiedBadge size="sm" variant={getVerifiedBadgeVariant(chatOverride.subPlan)} /> : null}
                </div>
                {conv?.is_group ? (
                  <p className="text-xs text-muted-foreground">
                    Channel · {conv.participants.length} members
                  </p>
                ) : visibleChatSubtitle ? (
                  <p className="text-xs text-muted-foreground">
                    {visibleChatSubtitle}
                  </p>
                ) : null}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {!searchOpen && (
          <div className="flex gap-1 shrink-0">
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => setSearchOpen(true)}>
              <Search className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={onVoiceCall} disabled={!onVoiceCall}>
              <Phone className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={onVideoCall} disabled={!onVideoCall}>
              <Video className="h-4 w-4" />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                {onProfileClick && (
                  <DropdownMenuItem onClick={onProfileClick} className="gap-2">
                    <User className="h-4 w-4" />
                    View profile
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={() => setSearchOpen(true)} className="gap-2">
                  <Search className="h-4 w-4" />
                  Search
                </DropdownMenuItem>
                {onMute && (
                  <DropdownMenuItem onClick={onMute} className="gap-2">
                    <BellOff className="h-4 w-4" />
                    Mute
                  </DropdownMenuItem>
                )}
                {onPinConversation && (
                  <DropdownMenuItem onClick={onPinConversation} className="gap-2">
                    <Pin className="h-4 w-4" />
                    Pin chat
                  </DropdownMenuItem>
                )}
                {onFavorite && (
                  <DropdownMenuItem onClick={onFavorite} className="gap-2">
                    <Star className="h-4 w-4" />
                    Add to favorites
                  </DropdownMenuItem>
                )}
                {onArchive && (
                  <DropdownMenuItem onClick={onArchive} className="gap-2">
                    <Archive className="h-4 w-4" />
                    Archive
                  </DropdownMenuItem>
                )}
                {(onDeleteChat || onBlock) && <DropdownMenuSeparator />}
                {onDeleteChat && (
                  <DropdownMenuItem onClick={onDeleteChat} className="gap-2 text-destructive focus:text-destructive">
                    <Trash2 className="h-4 w-4" />
                    Delete chat
                  </DropdownMenuItem>
                )}
                {onBlock && (
                  <DropdownMenuItem onClick={onBlock} className="gap-2 text-destructive focus:text-destructive">
                    <ShieldOff className="h-4 w-4" />
                    Block
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>

      {/* Pinned message banner */}
      <AnimatePresence>
        {pinnedMessage && (
          <motion.button
            key={pinnedMessage.id}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            onClick={() => {
              spotlightPinnedMessage(pinnedMessage.id);
              // Scroll to current pinned message
              const el = scrollContainerRef.current?.querySelector(`[data-message-id="${pinnedMessage.id}"]`);
              if (el && scrollContainerRef.current) {
                const containerRect = scrollContainerRef.current.getBoundingClientRect();
                const elRect = el.getBoundingClientRect();
                const offset = elRect.top - containerRect.top + scrollContainerRef.current.scrollTop - containerRect.height / 2 + elRect.height / 2;
                scrollContainerRef.current.scrollTo({ top: offset, behavior: 'smooth' });
              }
              // Cycle to next pinned message
              if (pinnedMessages.length > 1) {
                setPinnedIndex(i => (i + 1) % pinnedMessages.length);
              }
            }}
            className="flex w-full items-center gap-2 border-b border-border bg-sidebar px-4 py-1.5 text-left transition-colors shrink-0"
            style={conversationBackgroundStyle}
          >
            <Pin className="h-3 w-3 shrink-0 text-[color:var(--twiky-blue)]" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="truncate text-xs font-medium text-[color:var(--twiky-blue)]">
                  {pinnedMessage.senderName}: {pinnedMessage.type === 'text' ? pinnedMessage.content : `[${pinnedMessage.type}]`}
                </span>
              </div>
            </div>
            {pinnedMessages.length > 1 && (
              <span className="shrink-0 text-[10px] tabular-nums text-[color:var(--twiky-blue)] opacity-80">
                {(pinnedIndex % pinnedMessages.length) + 1}/{pinnedMessages.length}
              </span>
            )}
          </motion.button>
        )}
      </AnimatePresence>

      {/* Messages Area */}
      <div
        ref={scrollContainerRef}
        className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-4"
        style={conversationBackgroundStyle}
      >
        {Object.entries(groupedMessages).map(([date, dayMessages]) => (
          <div key={date}>
            {/* Day Separator */}
            <div className="flex items-center gap-3 my-4">
              <div className="h-px flex-1 bg-[var(--twiky-blue-border)]" />
              <span className="rounded-full border border-[var(--twiky-blue-border)] bg-[var(--twiky-blue-bg)] px-3 py-1 text-[11px] font-medium text-[color:var(--twiky-blue)]">
                {getDayLabel(date)}
              </span>
              <div className="h-px flex-1 bg-[var(--twiky-blue-border)]" />
            </div>

            <div className="space-y-0.5">
              {dayMessages.map((message) => {
                const isSearchMatch = message.id === activeMatchId;
                const isPinnedSpotlight = pinnedSpotlight?.id === message.id;
                const messageFrameClassName = [
                  'transition-all duration-300',
                  isSearchMatch ? 'rounded-xl ring-2 ring-primary/50 ring-offset-1 ring-offset-sidebar' : '',
                  isPinnedSpotlight ? 'rounded-xl bg-yellow-500/10 shadow-lg shadow-yellow-500/15' : '',
                ].filter(Boolean).join(' ');

                return (
                  <div
                    key={message.id}
                    data-message-id={message.id}
                    className={messageFrameClassName}
                  >
                    {message.type === 'call' ? (
                      <CallLogBubble message={message} />
                    ) : (
                      <MessageBubble
                        message={message}
                        searchHighlight={searchOpen && searchQuery.trim() ? searchQuery : undefined}
                        showAvatar={true}
                        onReply={handleReply}
                        onPin={() => onPin?.(message.id)}
                        onForward={() => setForwardingMessage(message)}
                        onDelete={() => onDelete?.(message.id)}
                        onReact={(emoji) => onReact?.(message.id, emoji)}
                        onAvatarClick={(senderId) => {
                          if (onMessageAvatarClick) {
                            onMessageAvatarClick(senderId);
                            return;
                          }
                          if (senderId !== profile?.id) onProfileClick?.();
                        }}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {/* Typing Indicator */}
        <AnimatePresence>
          {otherIsTyping && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              className="flex gap-2 items-end"
            >
              <Avatar className="h-7 w-7 shrink-0">
                <AvatarImage src={resolvedChatAvatar} alt={chatName} />
                <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                  {chatName[0]}
                </AvatarFallback>
              </Avatar>
              <div className="bg-muted rounded-2xl rounded-bl-sm px-4 py-3 flex gap-1 items-center">
                {[0, 0.15, 0.3].map((delay, i) => (
                  <motion.div
                    key={i}
                    className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50"
                    animate={{ y: [0, -5, 0] }}
                    transition={{ duration: 0.5, repeat: Infinity, delay }}
                  />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div ref={messagesEndRef} />
      </div>

      {/* Composer */}
      <Composer
        onTyping={onTyping}
        placeholder={chatOverride?.name ? `Message @${chatOverride.name}` : 'Message'}
        onSendMessage={(payload) => {
          onSendMessage?.(payload);
          setReplyTo(null);
        }}
        replyTo={replyTo}
        onCancelReply={() => setReplyTo(null)}
      />

      {/* Forward dialog */}
      <AnimatePresence>
        {forwardingMessage && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => { setForwardingMessage(null); setForwardSearch(''); }}
              className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 12 }}
              transition={{ duration: 0.15 }}
              className="fixed left-1/2 top-1/2 z-50 w-80 -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-sidebar border border-border shadow-2xl overflow-hidden"
            >
              <div className="px-4 pt-4 pb-3 border-b border-border">
                <h3 className="text-sm font-semibold text-foreground mb-2">Forward message</h3>
                <div className="text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2 line-clamp-2 italic">
                  {forwardingMessage.content}
                </div>
              </div>
              <div className="px-3 pt-2">
                <input
                  autoFocus
                  value={forwardSearch}
                  onChange={e => setForwardSearch(e.target.value)}
                  placeholder="Search conversations…"
                  className="w-full bg-muted/40 rounded-lg px-3 py-1.5 text-sm outline-none placeholder:text-muted-foreground/60 mb-1"
                />
              </div>
              <div className="max-h-56 overflow-y-auto py-1">
                {conversations
                  .filter(c => c.name.toLowerCase().includes(forwardSearch.toLowerCase()))
                  .map(conv => (
                    <button
                      key={conv.id}
                      onClick={() => {
                        onForwardMessage?.(forwardingMessage.id, forwardingMessage.content, conv.id, forwardingMessage.fileUrl, forwardingMessage.type);
                        setForwardingMessage(null);
                        setForwardSearch('');
                      }}
                      className="flex w-full items-center gap-3 px-4 py-2.5 hover:bg-muted/50 transition-colors"
                    >
                      <UserAvatar src={conv.avatarUrl} alt={conv.name} className="h-8 w-8 rounded-full object-cover shrink-0" />
                      <span className="text-sm text-foreground truncate">{conv.name}</span>
                    </button>
                  ))}
                {conversations.filter(c => c.name.toLowerCase().includes(forwardSearch.toLowerCase())).length === 0 && (
                  <p className="px-4 py-3 text-xs text-muted-foreground">No conversations found</p>
                )}
              </div>
              <div className="px-4 py-3 border-t border-border">
                <button
                  onClick={() => { setForwardingMessage(null); setForwardSearch(''); }}
                  className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors"
                >Cancel</button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
