'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Maximize2, Minimize2, MessageCircle, Mic, MicOff, Smile, Users, X } from 'lucide-react'
import { motion as Motion } from 'framer-motion'

import { PixelRoomCanvas, type OtherParticipant } from './pixel-room-canvas'
import {
  createDefaultRoomState,
  DEFAULT_AVATAR_ID,
  OBJECT_CATALOG,
  type PixelDirection,
  type PixelRoomState,
  ROOM_COLUMNS,
  ROOM_ROWS,
} from './game-data'
import { fetchPublicRoom, fetchMyRoom } from '@/lib/rooms-api'
import { useProfile } from '@/hooks/use-user'
import { getSocket } from '@/lib/socket'
import type { MockChannelGroup } from '@/components/chat/channels-panel'
import { useSpotifyNowPlaying } from '@/hooks/use-spotify'

const EMOJI_LIST = ['👍', '❤️', '😂', '😮', '😢', '😡', '🎉', '👋', '🔥', '💯', '🙌', '😎']

function emojiAppleUrl(emoji: string): string {
  const codes = [...emoji].map(c => c.codePointAt(0)!.toString(16)).join('-')
  return `https://cdn.jsdelivr.net/npm/emoji-datasource-apple/img/apple/64/${codes}.png`
}

type VisitorMotion = {
  avatarId: string
  avatarX: number
  avatarY: number
  avatarDirection: PixelDirection
  isSitting: boolean
  sittingObjectId: string | null
}

function directionFromDelta(dx: number, dy: number): PixelDirection {
  if (dx < 0) return 'left'
  if (dx > 0) return 'right'
  if (dy < 0) return 'up'
  return 'down'
}

function defaultMotion(): VisitorMotion {
  return {
    avatarId: DEFAULT_AVATAR_ID,
    avatarX: Math.floor(ROOM_COLUMNS / 2),
    avatarY: Math.floor(ROOM_ROWS / 2),
    avatarDirection: 'down',
    isSitting: false,
    sittingObjectId: null,
  }
}

interface Props {
  group: MockChannelGroup
  channelId: string
  myId?: string
}

export function PixelRoomGroupView({ group, channelId, myId }: Props) {
  const router = useRouter()
  const { data: currentUser } = useProfile()
  const { data: nowPlaying } = useSpotifyNowPlaying(currentUser?.id)

  const roomUsername = group.description || ''

  const [ownerObjects, setOwnerObjects] = useState<PixelRoomState['objects']>([])
  const [visitor, setVisitor] = useState<VisitorMotion>(defaultMotion)
  const [others, setOthers] = useState<OtherParticipant[]>([])
  const [participantCount, setParticipantCount] = useState(1)
  const [micMuted, setMicMuted] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [localChatBubble, setLocalChatBubble] = useState<string | null>(null)
  const [localChatBubbleAt, setLocalChatBubbleAt] = useState(0)
  const [localFloatingEmoji, setLocalFloatingEmoji] = useState<string | null>(null)
  const [localFloatingEmojiAt, setLocalFloatingEmojiAt] = useState(0)
  const [chatInputOpen, setChatInputOpen] = useState(false)
  const [chatInput, setChatInput] = useState('')
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const sectionRef = useRef<HTMLElement | null>(null)

  const joinedRef = useRef(false)
  const visitorRef = useRef<VisitorMotion>(defaultMotion())
  const lastEmitRef = useRef(0)
  const micMutedRef = useRef(false)
  const speakingStateRef = useRef(false)
  const liveGroupIdRef = useRef(group.id)
  liveGroupIdRef.current = group.id
  visitorRef.current = visitor

  // Broadcast own Spotify track to pixel room on change
  useEffect(() => {
    if (!currentUser || !joinedRef.current) return
    getSocket().then(socket => {
      socket.emit('pixel-room:spotify-update', {
        groupId: group.id,
        track: nowPlaying?.is_playing && nowPlaying.track ? nowPlaying.track : null,
      })
    })
  }, [nowPlaying, currentUser, group.id])

  // Fetch room furniture
  useEffect(() => {
    if (!roomUsername) return
    let cancelled = false
    fetchPublicRoom<PixelRoomState>(roomUsername)
      .then((res) => {
        if (cancelled) return
        const merged = { ...createDefaultRoomState(), ...(res.state ?? {}) }
        setOwnerObjects(merged.objects)
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [roomUsername])

  // Mic + speaking detection
  useEffect(() => {
    if (!currentUser) return
    let stream: MediaStream | null = null
    let audioCtx: AudioContext | null = null
    let intervalId = 0

    navigator.mediaDevices.getUserMedia({ audio: true, video: false })
      .then((s) => {
        stream = s
        audioCtx = new AudioContext()
        const source = audioCtx.createMediaStreamSource(s)
        const analyser = audioCtx.createAnalyser()
        analyser.fftSize = 512
        source.connect(analyser)
        const buffer = new Uint8Array(analyser.frequencyBinCount)

        intervalId = window.setInterval(() => {
          analyser.getByteFrequencyData(buffer)
          const avg = buffer.reduce((a, b) => a + b, 0) / buffer.length
          const nowSpeaking = !micMutedRef.current && avg > 8
          setIsSpeaking(nowSpeaking)
          if (nowSpeaking !== speakingStateRef.current) {
            speakingStateRef.current = nowSpeaking
            getSocket().then(s => s.emit('pixel-room:speaking', {
              groupId: liveGroupIdRef.current,
              speaking: nowSpeaking,
            }))
          }
        }, 100)
      })
      .catch(() => {})

    return () => {
      clearInterval(intervalId)
      audioCtx?.close()
      stream?.getTracks().forEach(t => t.stop())
    }
  }, [currentUser])

  // Socket presence + new events
  useEffect(() => {
    if (!currentUser || joinedRef.current) return
    joinedRef.current = true

    let mounted = true
    let cleanup: (() => void) | null = null

    Promise.all([
      fetchMyRoom<PixelRoomState>().catch(() => null),
      getSocket(),
    ]).then(([roomData, socket]) => {
      if (!mounted) return

      const avatarId = roomData?.state?.avatarId ?? DEFAULT_AVATAR_ID
      setVisitor(prev => ({ ...prev, avatarId }))
      visitorRef.current = { ...visitorRef.current, avatarId }

      const onParticipants = (data: { groupId: string; participants: OtherParticipant[] }) => {
        if (data.groupId !== group.id) return
        const filtered = data.participants.filter(p => p.userId !== currentUser.id)
        setOthers(prev => filtered.map(p => {
          const existing = prev.find(e => e.userId === p.userId)
          return {
            ...p,
            chatBubble: existing?.chatBubble,
            chatBubbleAt: existing?.chatBubbleAt,
            floatingEmoji: existing?.floatingEmoji,
            floatingEmojiAt: existing?.floatingEmojiAt,
            movedAt: existing?.movedAt,
            spotifyTrack: p.spotifyTrack ?? existing?.spotifyTrack,
          }
        }))
        setParticipantCount(data.participants.length)
      }

      const onMoved = (data: { groupId: string; userId: string; x: number; y: number; direction: string; isSitting: boolean }) => {
        if (data.groupId !== group.id || data.userId === currentUser.id) return
        const movedAt = performance.now()
        setOthers(prev => prev.map(p =>
          p.userId === data.userId
            ? { ...p, x: data.x, y: data.y, direction: data.direction as PixelDirection, isSitting: data.isSitting, movedAt }
            : p
        ))
      }

      const onChat = (data: { groupId: string; userId: string; text: string; at: number }) => {
        if (data.groupId !== group.id || data.userId === currentUser.id) return
        setOthers(prev => prev.map(p =>
          p.userId === data.userId
            ? { ...p, chatBubble: data.text, chatBubbleAt: data.at }
            : p
        ))
      }

      const onEmoji = (data: { groupId: string; userId: string; emoji: string; at: number }) => {
        if (data.groupId !== group.id || data.userId === currentUser.id) return
        setOthers(prev => prev.map(p =>
          p.userId === data.userId
            ? { ...p, floatingEmoji: data.emoji, floatingEmojiAt: data.at }
            : p
        ))
      }

      const onSpeaking = (data: { groupId: string; userId: string; speaking: boolean }) => {
        if (data.groupId !== group.id || data.userId === currentUser.id) return
        setOthers(prev => prev.map(p =>
          p.userId === data.userId ? { ...p, isSpeaking: data.speaking } : p
        ))
      }

      const onSpotifyTrack = (data: { groupId: string; userId: string; track: OtherParticipant['spotifyTrack'] }) => {
        if (data.groupId !== group.id || data.userId === currentUser.id) return
        setOthers(prev => prev.map(p =>
          p.userId === data.userId ? { ...p, spotifyTrack: data.track } : p
        ))
      }

      socket.on('pixel-room:participants', onParticipants)
      socket.on('pixel-room:moved', onMoved)
      socket.on('pixel-room:chat', onChat)
      socket.on('pixel-room:emoji', onEmoji)
      socket.on('pixel-room:speaking', onSpeaking)
      socket.on('pixel-room:spotify-track', onSpotifyTrack)

      socket.emit('pixel-room:join', {
        groupId: group.id,
        user: {
          id: currentUser.id,
          username: currentUser.username || currentUser.fullname || 'Visitor',
          avatarId,
          avatarUrl: currentUser.avatar_url ?? null,
          bannerUrl: currentUser.banner ?? null,
          subPlan: currentUser.sub_plan ?? null,
          x: visitorRef.current.avatarX,
          y: visitorRef.current.avatarY,
        },
      })

      cleanup = () => {
        socket.emit('pixel-room:leave', { groupId: group.id })
        socket.off('pixel-room:participants', onParticipants)
        socket.off('pixel-room:moved', onMoved)
        socket.off('pixel-room:chat', onChat)
        socket.off('pixel-room:emoji', onEmoji)
        socket.off('pixel-room:speaking', onSpeaking)
        socket.off('pixel-room:spotify-track', onSpotifyTrack)
      }
    })

    return () => {
      mounted = false
      cleanup?.()
      joinedRef.current = false
    }
  }, [currentUser, group.id])

  const emitMove = useCallback((motion: VisitorMotion, force = false) => {
    const now = Date.now()
    if (!force && now - lastEmitRef.current < 100) return
    if (!force) lastEmitRef.current = now
    getSocket().then(socket => {
      socket.emit('pixel-room:move', {
        groupId: group.id,
        x: Math.round(motion.avatarX),
        y: Math.round(motion.avatarY),
        direction: motion.avatarDirection,
        isSitting: motion.isSitting,
      })
    })
  }, [group.id])

  const toggleMic = useCallback(() => {
    setMicMuted(prev => {
      const next = !prev
      micMutedRef.current = next
      getSocket().then(socket => {
        socket.emit('pixel-room:mic', { groupId: liveGroupIdRef.current, muted: next })
      })
      return next
    })
  }, [])

  const sendChat = useCallback((text: string) => {
    const trimmed = text.trim().slice(0, 80)
    if (!trimmed) return
    const at = Date.now()
    setLocalChatBubble(trimmed)
    setLocalChatBubbleAt(at)
    getSocket().then(socket => {
      socket.emit('pixel-room:chat', { groupId: liveGroupIdRef.current, text: trimmed })
    })
  }, [])

  const sendEmoji = useCallback((emoji: string) => {
    setLocalFloatingEmoji(emoji)
    setLocalFloatingEmojiAt(Date.now())
    setEmojiPickerOpen(false)
    getSocket().then(socket => {
      socket.emit('pixel-room:emoji', { groupId: liveGroupIdRef.current, emoji })
    })
  }, [])

  const handleMoveAvatar = useCallback((dx: number, dy: number) => {
    const prev = visitorRef.current
    const next: VisitorMotion = {
      ...prev,
      avatarDirection: directionFromDelta(dx, dy),
      isSitting: false,
      sittingObjectId: null,
      avatarX: Math.max(1, Math.min(ROOM_COLUMNS - 2, prev.avatarX + dx)),
      avatarY: Math.max(1, Math.min(ROOM_ROWS - 2, prev.avatarY + dy)),
    }
    visitorRef.current = next
    setVisitor(next)
    emitMove(next)
  }, [emitMove])

  const handleToggleSit = useCallback(() => {
    const prev = visitorRef.current
    if (prev.isSitting) {
      const next: VisitorMotion = { ...prev, isSitting: false, sittingObjectId: null }
      visitorRef.current = next
      setVisitor(next)
      emitMove(next, true)
      return
    }
    const seat = ownerObjects
      .map(obj => ({
        obj,
        asset: OBJECT_CATALOG.find(item => item.id === obj.itemId),
        dist: Math.abs(obj.x - prev.avatarX) + Math.abs(obj.y - prev.avatarY),
      }))
      .filter(e => e.asset?.canSit && e.dist <= 1)
      .sort((a, b) => a.dist - b.dist)[0]
    if (!seat?.asset) return
    const next: VisitorMotion = {
      ...prev,
      avatarX: seat.obj.x,
      avatarY: seat.obj.y,
      avatarDirection: seat.asset.seatDirection ?? prev.avatarDirection,
      isSitting: true,
      sittingObjectId: seat.obj.id,
    }
    visitorRef.current = next
    setVisitor(next)
    emitMove(next, true)
  }, [ownerObjects, emitMove])

  // Keyboard shortcuts: M=mic, T=chat, R=emoji
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      const key = e.key.toLowerCase()
      if (key === 'm') { e.preventDefault(); toggleMic() }
      if (key === 't') { e.preventDefault(); setChatInputOpen(true) }
      if (key === 'r') { e.preventDefault(); setEmojiPickerOpen(prev => !prev) }
      if (key === 'f') { e.preventDefault(); toggleFullscreen() }
      if (key === 'escape') { setChatInputOpen(false); setEmojiPickerOpen(false) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [toggleMic])

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      sectionRef.current?.requestFullscreen()
    } else {
      document.exitFullscreen()
    }
  }, [])

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', onFsChange)
    return () => document.removeEventListener('fullscreenchange', onFsChange)
  }, [])

  const canvasState: PixelRoomState = useMemo(() => ({
    ...visitor,
    objects: ownerObjects,
    ownedItemIds: [],
  }), [visitor, ownerObjects])

  const myName = currentUser?.fullname ?? currentUser?.username ?? 'You'
  const ownerLabel = roomUsername || group.label

  return (
    <section ref={sectionRef} className="relative flex h-full min-w-0 flex-1 flex-col overflow-hidden bg-background text-foreground">
      <Motion.header
        className="flex flex-shrink-0 items-center justify-between border-b border-border px-4 py-3"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push(`/channels/${channelId}`)}
            className="flex h-8 w-8 items-center justify-center rounded-[8px] border border-border text-muted-foreground hover:border-primary hover:text-primary"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="min-w-0">
            <h2 className="truncate text-[14px] font-semibold text-foreground">{group.label}</h2>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-[8px] border border-border bg-card px-2.5 py-1 text-[11px] text-muted-foreground">
            <Users className="h-3 w-3" />
            {participantCount}
          </span>
          <button
            onClick={toggleFullscreen}
            className="flex h-8 w-8 items-center justify-center rounded-[8px] border border-border text-muted-foreground hover:border-primary hover:text-primary"
            title={isFullscreen ? 'Exit fullscreen (F)' : 'Fullscreen (F)'}
          >
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
        </div>
      </Motion.header>

      <Motion.main
        className="relative flex min-w-0 flex-1 flex-col overflow-hidden p-4"
        initial={{ opacity: 0, scale: 0.975 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
      >
        <div className="relative mx-auto flex h-full max-h-[576px] w-full max-w-[832px] shrink overflow-hidden rounded-[10px] border border-border shadow-lg">
          <PixelRoomCanvas
            state={canvasState}
            playerName={myName}
            selectedObjectId={null}
            onSelectObject={() => {}}
            onMoveObject={() => {}}
            onMoveAvatar={handleMoveAvatar}
            onToggleSit={handleToggleSit}
            otherParticipants={others}
            localMicMuted={micMuted}
            localIsSpeaking={isSpeaking}
            localChatBubble={localChatBubble}
            localChatBubbleAt={localChatBubbleAt}
            localFloatingEmoji={localFloatingEmoji}
            localFloatingEmojiAt={localFloatingEmojiAt}
          />

          <div className="pointer-events-none absolute left-1/2 top-[10px] z-10 -translate-x-1/2 rounded-full border border-border bg-background/90 px-3.5 py-1.5 text-[10px] text-muted-foreground backdrop-blur-sm">
            {group.label} · WASD move · E sit · T chat · R emoji · M mic · F fullscreen
          </div>

          {/* Emoji picker */}
          {emojiPickerOpen && (
            <div className="absolute bottom-16 left-1/2 z-20 -translate-x-1/2 rounded-[14px] border border-white/10 bg-black/55 p-3 shadow-2xl backdrop-blur-md">
              <div className="mb-2.5 flex items-center justify-between">
                <span className="text-[9px] font-bold uppercase tracking-widest text-white/40">Reactions</span>
                <button
                  onClick={() => setEmojiPickerOpen(false)}
                  className="flex h-5 w-5 items-center justify-center rounded-full text-white/40 transition-colors hover:bg-white/10 hover:text-white"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
              <div className="grid grid-cols-6 gap-1">
                {EMOJI_LIST.map(emoji => (
                  <button
                    key={emoji}
                    onClick={() => sendEmoji(emoji)}
                    className="flex h-10 w-10 items-center justify-center rounded-[8px] transition-colors hover:bg-white/12"
                  >
                    <img src={emojiAppleUrl(emoji)} alt={emoji} className="h-7 w-7 select-none" draggable={false} />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Chat bubble input */}
          {chatInputOpen && (
            <div className="absolute bottom-16 left-1/2 z-20 flex w-72 -translate-x-1/2 items-center gap-2 rounded-[12px] border border-white/10 bg-black/55 px-3 py-2.5 shadow-2xl backdrop-blur-md">
              <MessageCircle className="h-4 w-4 flex-shrink-0 text-white/40" />
              <input
                autoFocus
                className="min-w-0 flex-1 bg-transparent text-[13px] text-white outline-none placeholder:text-white/35"
                placeholder="Say something..."
                maxLength={80}
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    sendChat(chatInput)
                    setChatInput('')
                    setChatInputOpen(false)
                  }
                  if (e.key === 'Escape') {
                    setChatInput('')
                    setChatInputOpen(false)
                  }
                }}
              />
              <button
                onClick={() => { setChatInput(''); setChatInputOpen(false) }}
                className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-white/40 transition-colors hover:bg-white/10 hover:text-white"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          )}

          {/* Spotify now playing */}
          {nowPlaying?.is_playing && nowPlaying.track && (
            <a
              href={nowPlaying.track.spotify_url}
              target="_blank"
              rel="noopener noreferrer"
              className="absolute bottom-4 left-4 z-10 flex items-center gap-2.5 rounded-[12px] border border-white/10 bg-black/45 px-2.5 py-2 shadow-lg backdrop-blur-md transition-colors hover:bg-black/60"
            >
              <img src={nowPlaying.track.album_art} alt="" className="h-9 w-9 flex-shrink-0 rounded-[6px] object-cover" />
              <div className="min-w-0">
                <p className="max-w-[130px] truncate text-[11px] font-semibold leading-tight text-white">{nowPlaying.track.name}</p>
                <p className="max-w-[130px] truncate text-[10px] text-white/55">{nowPlaying.track.artist}</p>
                <div className="mt-1.5 h-[3px] w-full overflow-hidden rounded-full bg-white/15">
                  <div
                    className="h-full rounded-full bg-[#1DB954]"
                    style={{ width: `${Math.round((nowPlaying.track.progress_ms / nowPlaying.track.duration_ms) * 100)}%` }}
                  />
                </div>
              </div>
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 flex-shrink-0 fill-[#1DB954]">
                <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
              </svg>
            </a>
          )}

          {/* Bottom toolbar */}
          <div className="pointer-events-auto absolute bottom-4 right-4 z-10 flex items-center gap-1.5 rounded-[12px] border border-white/10 bg-black/30 px-2 py-1.5 shadow-lg backdrop-blur-md">
            <button
              onClick={toggleMic}
              title={micMuted ? 'Unmute (M)' : 'Mute (M)'}
              className={`flex h-8 w-8 items-center justify-center rounded-[8px] transition-colors ${
                micMuted
                  ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                  : isSpeaking
                  ? 'bg-green-500/20 text-green-400'
                  : 'text-white/60 hover:bg-white/10 hover:text-white'
              }`}
            >
              {micMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            </button>
            <div className="h-4 w-px bg-white/10" />
            <button
              onClick={() => setEmojiPickerOpen(prev => !prev)}
              className="flex h-8 w-8 items-center justify-center rounded-[8px] text-white/60 transition-colors hover:bg-white/10 hover:text-white"
              title="React (R)"
            >
              <Smile className="h-4 w-4" />
            </button>
            <button
              onClick={() => setChatInputOpen(true)}
              className="flex h-8 w-8 items-center justify-center rounded-[8px] text-white/60 transition-colors hover:bg-white/10 hover:text-white"
              title="Chat (T)"
            >
              <MessageCircle className="h-4 w-4" />
            </button>
          </div>
        </div>
      </Motion.main>
    </section>
  )
}
