'use client';

import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Check, CheckCheck, Forward, FileText, Download, X, Pin, Play, AudioLines } from 'lucide-react';
import { VoiceMessagePlayer } from './voice-message-player'
import { VideoPlayer } from './video-player';
import { AppleText, EmojiImg } from './apple-text';
import { Message } from '@/lib/mock-data';
import { format } from 'date-fns';
import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { MessageContextMenu } from './message-context-menu';
import { HoverProfileCard } from '@/components/chat/hover-profile-card'
import { LinkPreviewCard, extractFirstUrl } from '@/components/chat/link-preview-card';
import { useVoiceRoomLive } from '@/hooks/use-voice-room-live';

interface MessageBubbleProps {
  message: Message;
  showAvatar?: boolean;
  searchHighlight?: string;
  onReply?: (message: Message) => void;
  onPin?: () => void;
  onForward?: () => void;
  onDelete?: () => void;
  onReact?: (emoji: string) => void;
  onAvatarClick?: (senderId: string) => void;
  onMessage?: (userId: string) => void;
  onViewProfile?: (userId: string) => void;
  hideMessage?: boolean;
  isReceiverOnline?: boolean;
}

interface ProfilePayload { __twiky_type: 'profile'; username: string; name: string; avatarUrl: string | null; url: string }

export interface ForumPostPayload { __twiky_type: 'forum_post'; title: string; content: string; imageUrl: string | null; groupName: string; url: string | null }

export interface VoiceInvitePayload {
  __twiky_type: 'voice_invite'
  groupId: string
  groupName: string
  channelId?: string
  inviterName: string
  participants?: { id: string; name: string; avatarUrl: string | null }[]
}

function tryParseProfile(content: string): ProfilePayload | null {
  try {
    const p = JSON.parse(content)
    if (p?.__twiky_type === 'profile') return p as ProfilePayload
  } catch { /* not JSON */ }
  return null
}

export function tryParseForumPost(content: string): ForumPostPayload | null {
  try {
    const p = JSON.parse(content)
    if (p?.__twiky_type === 'forum_post') return p as ForumPostPayload
  } catch { /* not JSON */ }
  return null
}

export function tryParseVoiceInvite(content: string): VoiceInvitePayload | null {
  try {
    const p = JSON.parse(content)
    if (p?.__twiky_type === 'voice_invite') return p as VoiceInvitePayload
  } catch { /* not JSON */ }
  return null
}

export function VoiceInviteCard({ data }: { data: VoiceInvitePayload }) {
  const router = useRouter()
  const { participants: livePts, lastEvent } = useVoiceRoomLive(data.groupId)

  // null = still loading → optimistically show active
  // [] = server confirmed empty → expired
  const isActive = livePts === null ? true : livePts.length > 0
  const displayPts = (livePts ?? data.participants ?? [])
  const shownPts = displayPts.slice(0, 5)
  const overflow = displayPts.length - shownPts.length

  function handleJoin(e: React.MouseEvent) {
    e.stopPropagation()
    if (!isActive) return
    if (data.channelId && data.groupId) {
      router.push(`/channels/${data.channelId}/group/${data.groupId}`)
    }
  }

  return (
    <div className={`mt-1 w-[268px] overflow-hidden rounded-2xl border shadow-xl transition-all duration-300 ${isActive ? 'border-zinc-800 bg-zinc-950 hover:border-zinc-700' : 'border-zinc-800/40 bg-zinc-950/50'}`}>
      <div className={`h-0.5 w-full bg-gradient-to-r ${isActive ? 'from-zinc-700 via-zinc-500 to-zinc-700' : 'from-zinc-800/60 via-zinc-700/60 to-zinc-800/60'}`} />
      <div className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1 space-y-1.5">
            {/* Status badge */}
            <div className="flex items-center gap-1.5">
              {isActive ? (
                <>
                  <span className="relative flex h-1.5 w-1.5 shrink-0">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-60" />
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-500" />
                  </span>
                  <span className="text-[9px] font-semibold uppercase tracking-widest text-green-500">Voice · Live</span>
                </>
              ) : (
                <>
                  <span className="relative inline-flex h-1.5 w-1.5 shrink-0 rounded-full bg-zinc-600" />
                  <span className="text-[9px] font-semibold uppercase tracking-widest text-zinc-600">Room Expired</span>
                </>
              )}
            </div>

            <p className={`text-[14px] font-bold leading-snug truncate ${isActive ? 'text-zinc-50' : 'text-zinc-500'}`}>
              {data.groupName}
            </p>

            {/* Participant avatars + count */}
            {shownPts.length > 0 ? (
              <div className="flex items-center gap-1.5 pt-0.5">
                <div className="flex items-center">
                  {shownPts.map((p, i) => (
                    <div
                      key={p.id}
                      className="relative shrink-0"
                      style={{ marginLeft: i === 0 ? 0 : -6, zIndex: shownPts.length - i }}
                      title={p.name}
                    >
                      <div className={`flex h-5 w-5 items-center justify-center overflow-hidden rounded-full ring-2 ring-zinc-950 text-[8px] font-bold transition-all ${isActive ? 'bg-zinc-700 text-zinc-200' : 'bg-zinc-800/60 text-zinc-600'}`}>
                        {p.avatarUrl ? (
                          <img src={p.avatarUrl} alt={p.name} className={`block h-full w-full object-cover ${!isActive && 'opacity-30'}`} />
                        ) : (
                          p.name[0]?.toUpperCase() ?? '?'
                        )}
                      </div>
                    </div>
                  ))}
                  {overflow > 0 && <span className="ml-1 text-[9px] font-semibold text-zinc-500">+{overflow}</span>}
                </div>
                <span className="text-[10px] text-zinc-500">
                  {isActive ? `${displayPts.length} in call` : `${displayPts.length} were in call`}
                </span>
              </div>
            ) : (
              <p className="text-[10px] text-zinc-600">
                Shared by <span className="text-zinc-500">@{data.inviterName}</span>
              </p>
            )}
          </div>

          {/* Icon */}
          <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border transition-all ${isActive ? 'bg-zinc-900 border-zinc-800 text-zinc-400' : 'bg-zinc-900/30 border-zinc-800/30 text-zinc-700'}`}>
            {isActive ? <AudioLines className="h-4 w-4 animate-pulse" /> : <AudioLines className="h-4 w-4 opacity-30" />}
          </div>
        </div>

        {/* Join/leave event ticker */}
        {lastEvent && isActive && (
          <div className="flex items-center gap-1.5 rounded-lg bg-zinc-900/60 px-2.5 py-1.5">
            <span className={`text-[9px] font-bold uppercase tracking-wide ${lastEvent.type === 'join' ? 'text-green-500' : 'text-zinc-500'}`}>
              {lastEvent.type === 'join' ? '↑' : '↓'}
            </span>
            <span className="truncate text-[11px] text-zinc-400">
              <span className="font-semibold text-zinc-300">{lastEvent.name}</span>
              {lastEvent.type === 'join' ? ' joined' : ' left'}
            </span>
          </div>
        )}

        {/* Action button */}
        {isActive ? (
          <button
            onClick={handleJoin}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-zinc-100 px-3 py-2 text-[11px] font-bold text-zinc-900 shadow-sm transition-all hover:bg-white active:scale-[0.98]"
          >
            <Play className="h-3 w-3 fill-current" />
            Join Voice Room
          </button>
        ) : (
          <div className="flex w-full items-center justify-center gap-2 rounded-xl bg-zinc-900/40 border border-zinc-800/30 px-3 py-2 text-[11px] font-medium text-zinc-600 cursor-not-allowed select-none">
            <AudioLines className="h-3 w-3 opacity-50" />
            Room no longer active
          </div>
        )}
      </div>
    </div>
  )
}


export function ForumPostCard({ data }: { data: ForumPostPayload }) {
  const router = useRouter()
  function handleClick(e: React.MouseEvent) {
    e.stopPropagation()
    if (data.url) router.push(data.url)
  }
  return (
    <div
      onClick={data.url ? handleClick : undefined}
      className={`mt-1 w-[260px] overflow-hidden rounded-xl border border-border/60 bg-muted/30 transition-colors hover:bg-muted/50${data.url ? ' cursor-pointer' : ''}`}
    >
      {data.imageUrl && (
        <img src={data.imageUrl} alt="" className="h-[120px] w-full object-cover" />
      )}
      <div className="px-3 py-2.5 space-y-1.5">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-widest text-primary/70 mb-1">#{data.groupName}</p>
          <p className="text-[13px] font-bold text-foreground leading-snug line-clamp-2">{data.title}</p>
          {data.content && (
            <p className="mt-1 text-[11px] text-muted-foreground leading-relaxed line-clamp-2">{data.content}</p>
          )}
        </div>
        <div className="pt-1 border-t border-border/40">
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary">See post →</span>
        </div>
      </div>
    </div>
  )
}

function ProfileCard({ data }: { data: ProfilePayload }) {
  return (
    <a
      href={data.url}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-1 flex items-center gap-3 rounded-xl border border-border/60 bg-muted/40 px-3 py-2.5 transition-colors hover:bg-muted/70 max-w-[260px] no-underline"
    >
      {data.avatarUrl ? (
        <img src={data.avatarUrl} alt={data.name} className="h-10 w-10 rounded-xl object-cover shrink-0" />
      ) : (
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-[15px] font-bold text-primary">
          {data.name[0]?.toUpperCase()}
        </div>
      )}
      <div className="min-w-0">
        <p className="truncate text-[13px] font-semibold text-foreground leading-tight">{data.name}</p>
        <p className="truncate text-[11px] text-muted-foreground">@{data.username}</p>
        <p className="mt-0.5 text-[10px] text-primary">View Profile →</p>
      </div>
    </a>
  )
}

function HighlightedText({ text, query }: { text: string; query: string }) {
  if (!query) return <>{text}</>;
  const parts = text.split(new RegExp(`(${query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === query.toLowerCase()
          ? <mark key={i} className="bg-yellow-400/50 text-inherit rounded-[2px] px-px">{part}</mark>
          : part
      )}
    </>
  );
}

export function MessageBubble({ message, showAvatar = true, searchHighlight, onReply, onPin, onForward, onDelete, onReact, onAvatarClick, onMessage, onViewProfile, hideMessage, isReceiverOnline = false }: MessageBubbleProps) {
  const [isMounted, setIsMounted] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [lightbox, setLightbox] = useState(false);
  const messageRef = useRef<HTMLDivElement>(null);
  const avatarRef = useRef<HTMLDivElement>(null);

  const messageReactions = message.reactions ?? [];

  const initials = message.senderName
    .split(' ')
    .map((word) => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY });
  };

  const handleAddReaction = (emoji: string) => {
    onReact?.(emoji);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.15 }}
      className="flex gap-3 group relative px-1 py-0.5 rounded-md hover:bg-white/[0.03] transition-colors"
      onContextMenu={handleContextMenu}
    >
      {/* Avatar column — always left */}
      <div className="shrink-0 w-9 pt-0.5">
        {showAvatar ? (
          <HoverProfileCard
            userId={message.senderId}
            onMessage={message.isOwn ? undefined : onMessage}
            onViewProfile={onViewProfile}
            hideMessage={message.isOwn}
            side="right"
          >
            <div ref={avatarRef} className="rounded-full">
              <Avatar className="h-9 w-9">
                <AvatarImage src={message.avatar} alt={message.senderName} />
                <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                  {initials}
                </AvatarFallback>
              </Avatar>
            </div>
          </HoverProfileCard>
        ) : (
          <div className="h-9 w-9" />
        )}
      </div>

      {/* Content column */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Header: name + timestamp — only when avatar shown */}
        {showAvatar && (
          <div className="flex items-baseline gap-2 mb-0.5">
            <HoverProfileCard
              userId={message.senderId}
              onMessage={message.isOwn ? undefined : onMessage}
              onViewProfile={onViewProfile}
              hideMessage={message.isOwn}
              side="right"
              anchorRef={avatarRef}
            >
              <span className={`text-sm font-semibold leading-tight ${message.isOwn ? 'text-blue-400' : 'text-foreground'}`}>
                {message.senderName}
              </span>
            </HoverProfileCard>
            {isMounted && (
              <span className="text-[11px] text-muted-foreground/60 tabular-nums">
                {format(new Date(message.timestamp), 'MMM d, h:mm a')}
              </span>
            )}
            {message.isOwn && (
              <span className="ml-0.5">
                {message.isRead ? (
                  <CheckCheck aria-label="Read" className="h-3 w-3 text-blue-500 inline" />
                ) : isReceiverOnline ? (
                  <CheckCheck aria-label="Delivered" className="h-3 w-3 text-muted-foreground/60 inline" />
                ) : (
                  <Check aria-label="Sent" className="h-3 w-3 text-muted-foreground/60 inline" />
                )}
              </span>
            )}
          </div>
        )}

        {/* Pinned indicator */}
        {message.isPinned && (
          <div className="flex items-center gap-1 mb-0.5 text-[11px] text-yellow-500/80">
            <Pin className="h-2.5 w-2.5" />
            <span>Pinned</span>
          </div>
        )}

        {/* Forwarded indicator */}
        {message.isForwarded && (
          <div className="text-[11px] text-muted-foreground flex items-center gap-1 mb-0.5">
            <Forward className="h-3 w-3" />
            <span>Forwarded</span>
          </div>
        )}

        {/* Reply quote */}
        {message.reply && (
          <div className="flex items-start gap-2 mb-1 pl-2 border-l-2 border-primary/50">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold text-primary truncate">{message.reply.senderName}</p>
              <p className="text-[12px] text-muted-foreground truncate">{message.reply.content}</p>
            </div>
          </div>
        )}

        {/* Message content — no bubble */}
        <div ref={messageRef} className="max-w-xl">
          {message.type === 'text' && (() => {
            const profileData = tryParseProfile(message.content)
            if (profileData) return <ProfileCard data={profileData} />
            const forumPost = tryParseForumPost(message.content)
            if (forumPost) return <ForumPostCard data={forumPost} />
            const voiceInvite = tryParseVoiceInvite(message.content)
            if (voiceInvite) return <VoiceInviteCard data={voiceInvite} />
            const firstUrl = extractFirstUrl(message.content)
            return (
              <>
                <p className="text-sm text-foreground/90 wrap-break-word whitespace-pre-wrap leading-relaxed">
                  {searchHighlight ? <HighlightedText text={message.content} query={searchHighlight} /> : <AppleText text={message.content} />}
                  {message.isEdited && <span className="text-[10px] text-muted-foreground ml-1.5">(edited)</span>}
                </p>
                {firstUrl && <LinkPreviewCard url={firstUrl} />}
              </>
            )
          })()}

          {message.type === 'image' && (
            <div className="mt-1">
              {message.content && !message.content.startsWith('http') && (
                <p className="text-sm text-foreground/90 leading-relaxed mb-1">{message.content}</p>
              )}
              <img
                src={message.fileUrl || message.content}
                alt="Shared image"
                className="max-w-[300px] max-h-56 object-cover rounded-lg cursor-zoom-in"
                onClick={() => setLightbox(true)}
              />
            </div>
          )}

          {message.type === 'gif' && (
            <div className="mt-1">
              <div className="relative inline-block">
                <img
                  src={message.fileUrl || message.content}
                  alt="GIF"
                  className="max-w-[260px] max-h-52 rounded-lg object-contain"
                />
                <span className="absolute bottom-1.5 left-1.5 rounded bg-black/60 px-1 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">
                  GIF
                </span>
              </div>
            </div>
          )}

          {message.type === 'sticker' && (
            <div className="mt-1">
              <img
                src={message.fileUrl || message.content}
                alt="Sticker"
                className="h-28 w-28 object-contain"
              />
            </div>
          )}

          {message.type === 'voice' && (
            <div className="mt-0.5">
              <VoiceMessagePlayer
                src={message.fileUrl || message.content}
                durationSeconds={(() => {
                  const m = message.content?.match(/^(\d+):(\d{2})$/)
                  return m ? parseInt(m[1]) * 60 + parseInt(m[2]) : null
                })()}
              />
            </div>
          )}

          {message.type === 'video' && (
            <div className="max-w-xs mt-1">
              {message.content && !message.content.startsWith('http') && (
                <p className="text-sm text-foreground/90 leading-relaxed mb-1">{message.content}</p>
              )}
              <VideoPlayer src={message.fileUrl || message.content || ''} className="w-full" />
            </div>
          )}

          {message.type === 'file' && (
            <div className="mt-1">
              {message.content && !message.content.startsWith('http') && (
                <p className="text-sm text-foreground/90 leading-relaxed mb-1">{message.content}</p>
              )}
            <a
              href={message.fileUrl || message.content}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2.5 rounded-xl bg-muted/50 hover:bg-muted/80 px-3 py-2.5 max-w-[240px] transition-colors border border-border"
            >
              <div className="h-9 w-9 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-medium truncate">
                  {(message.fileUrl || message.content)?.split('/').pop() ?? 'File'}
                </p>
                <p className="text-[10px] opacity-60">Tap to open</p>
              </div>
              <Download className="h-3.5 w-3.5 opacity-60 shrink-0" />
            </a>
            </div>
          )}

          {message.embeds && message.embeds.length > 0 && message.embeds.map((emb, idx) => (
            <LinkPreviewCard key={idx} url={emb.url} />
          ))}
        </div>

        {/* Reactions */}
        {messageReactions.length > 0 && (
          <div className="flex gap-1 mt-1 flex-wrap">
            {messageReactions.map(({ emoji, count, reactedByMe }) => (
              <motion.button
                key={`${message.id}-r-${emoji}`}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => handleAddReaction(emoji)}
                title={reactedByMe ? 'Remove reaction' : 'React'}
                className={`group inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold transition-all duration-150 select-none ${
                  reactedByMe
                    ? 'bg-primary/15 text-primary ring-1 ring-primary/40 hover:bg-primary/20'
                    : 'bg-muted/60 text-muted-foreground ring-1 ring-border hover:bg-muted hover:text-foreground hover:ring-border/80'
                }`}
              >
                <EmojiImg
                  value={emoji}
                  unified={[...emoji].map(c => c.codePointAt(0)!.toString(16).toLowerCase()).join('-')}
                  size={15}
                />
                <span className={reactedByMe ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'}>
                  {count}
                </span>
              </motion.button>
            ))}
          </div>
        )}
      </div>

      {/* Hover timestamp (no-avatar rows) */}
      {!showAvatar && isMounted && (
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-9 flex justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
          <span className="text-[10px] text-muted-foreground/50 tabular-nums leading-tight">
            {format(new Date(message.timestamp), 'h:mm')}
          </span>
        </div>
      )}

      {/* Context Menu */}
      {contextMenu && (
        <MessageContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          onReact={handleAddReaction}
          onReply={onReply ? () => { onReply(message); setContextMenu(null); } : undefined}
          isPinned={message.isPinned}
          isOwn={message.isOwn}
          onPin={onPin ? () => { onPin(); setContextMenu(null); } : undefined}
          onForward={onForward ? () => { onForward(); setContextMenu(null); } : undefined}
          onCopy={message.type === 'text' ? () => { navigator.clipboard.writeText(message.content); setContextMenu(null); } : undefined}
          onDelete={onDelete ? () => { onDelete(); setContextMenu(null); } : undefined}
        />
      )}

      {/* Image lightbox */}
      {lightbox && isMounted && createPortal(
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[999] flex items-center justify-center bg-black/90 backdrop-blur-sm"
          onClick={() => setLightbox(false)}
        >
          <button
            className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
            onClick={() => setLightbox(false)}
          >
            <X className="h-5 w-5" />
          </button>
          <img
            src={message.fileUrl || message.content}
            alt="Full size"
            className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </motion.div>,
        document.body,
      )}
    </motion.div>
  );
}
