'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Camera,
  CameraOff,
  Mic,
  MicOff,
  Headphones,
  HeadphoneOff,
  MonitorUp,
  MonitorOff,
  PhoneOff,
  Volume2,
  UserMinus,
  VolumeX,
  Volume1,
  Shield,
  MoreHorizontal,
  Music2,
  MessageSquare,
  X,
  Send,
  Hash,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import type { MockChannelGroup } from '@/components/chat/channels-panel'
import type { VoicePresenceUser } from '@/hooks/use-voice-presence'
import { useQuery } from '@tanstack/react-query'
import { channelsApi } from '@/lib/channels-api'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

export type { VoicePresenceUser as VoiceMember }

interface VoiceGroupViewProps {
  group: MockChannelGroup
  channelId?: string
  participants: VoicePresenceUser[]
  isJoined: boolean
  isMuted: boolean
  joinedAt: number
  myId?: string
  onJoin: () => void
  onLeave: () => void
  onToggleMute: () => void
  onViewProfile?: (participant: VoicePresenceUser) => void
  onKick?: (userId: string) => void
  onPlaySound?: (sound: string) => void
  onSendVoiceInvite?: (inviteeId: string) => void
  soundboardUserId?: string | null
  soundboardIntensity?: number
}

function useElapsedTime(startMs: number, active: boolean) {
  const [elapsed, setElapsed] = useState(0)
  useEffect(() => {
    if (!active || !startMs) return
    const tick = () => setElapsed(Math.floor((Date.now() - startMs) / 1000))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [startMs, active])
  if (!active) return null
  const h = Math.floor(elapsed / 3600)
  const m = Math.floor((elapsed % 3600) / 60).toString().padStart(2, '0')
  const s = (elapsed % 60).toString().padStart(2, '0')
  return h > 0 ? `${h}:${m}:${s}` : `${m}:${s}`
}

export function VoiceGroupView({
  group,
  channelId,
  participants,
  isJoined,
  isMuted,
  joinedAt,
  myId,
  onJoin,
  onLeave,
  onToggleMute,
  onViewProfile,
  onKick,
  onPlaySound,
  onSendVoiceInvite,
  soundboardUserId,
  soundboardIntensity = 0,
}: VoiceGroupViewProps) {
  const [deafened, setDeafened] = useState(false)
  const [videoOn, setVideoOn] = useState(false)
  const [sharing, setSharing] = useState(false)
  const [exitReason, setExitReason] = useState<'left' | null>(null)
  const [chatOpen, setChatOpen] = useState(false)
  const [chatInput, setChatInput] = useState('')
  const [chatMessages, setChatMessages] = useState<{ id: string; userId: string; name: string; avatar: string | null; text: string; ts: number }[]>([])
  const chatEndRef = useRef<HTMLDivElement | null>(null)
  const chatInputRef = useRef<HTMLInputElement | null>(null)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [inviteSearch, setInviteSearch] = useState('')
  const [sentInvites, setSentInvites] = useState<Set<string>>(new Set())

  const videoStreamRef = useRef<MediaStream | null>(null)
  const screenStreamRef = useRef<MediaStream | null>(null)
  const localVideoRef = useRef<HTMLVideoElement | null>(null)
  const screenVideoRef = useRef<HTMLVideoElement | null>(null)

  useEffect(() => {
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = videoOn ? (videoStreamRef.current ?? null) : null
    }
  }, [videoOn])

  useEffect(() => {
    if (screenVideoRef.current) {
      screenVideoRef.current.srcObject = sharing ? (screenStreamRef.current ?? null) : null
    }
  }, [sharing])

  useEffect(() => {
    return () => {
      videoStreamRef.current?.getTracks().forEach((t) => t.stop())
      screenStreamRef.current?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  const handleToggleCamera = useCallback(async () => {
    if (videoOn) {
      videoStreamRef.current?.getTracks().forEach((t) => t.stop())
      videoStreamRef.current = null
      setVideoOn(false)
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
        videoStreamRef.current = stream
        setVideoOn(true)
      } catch {}
    }
  }, [videoOn])

  const handleToggleSharing = useCallback(async () => {
    if (sharing) {
      screenStreamRef.current?.getTracks().forEach((t) => t.stop())
      screenStreamRef.current = null
      setSharing(false)
    } else {
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({ video: true })
        screenStreamRef.current = stream
        stream.getVideoTracks()[0].onended = () => {
          screenStreamRef.current = null
          setSharing(false)
        }
        setSharing(true)
      } catch {}
    }
  }, [sharing])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages])

  useEffect(() => {
    if (chatOpen) setTimeout(() => chatInputRef.current?.focus(), 150)
  }, [chatOpen])

  const me = participants.find((p) => p.id === myId)

  const sendChatMessage = useCallback(() => {
    const text = chatInput.trim()
    if (!text || !me) return
    setChatMessages((prev) => [...prev, {
      id: crypto.randomUUID(),
      userId: me.id,
      name: me.name,
      avatar: me.avatarUrl,
      text,
      ts: Date.now(),
    }])
    setChatInput('')
  }, [chatInput, me])

  const { data: channelMembersRaw = [] } = useQuery({
    queryKey: ['channel-members', channelId],
    queryFn: () => channelsApi.getMembers(channelId!),
    enabled: Boolean(channelId && inviteOpen),
  })

  const participantIds = new Set(participants.map((p) => p.id))

  const inviteSuggestions = channelMembersRaw
    .map((m) => m.user)
    .filter((u) => u && u.id !== myId && !participantIds.has(u.id))
    .filter((u) => !inviteSearch.trim() || u.username.toLowerCase().includes(inviteSearch.toLowerCase()))

  const handleInvite = (userId: string) => {
    onSendVoiceInvite?.(userId)
    setSentInvites((prev) => new Set(prev).add(userId))
  }

  const sounds = [
    { label: '😂 Faaa', file: 'faaa sound.mpeg' },
    { label: '👋 Bye Bye', file: 'Voicy_And we say bye bye.mp3' },
    { label: '👏 Applause', file: 'Voicy_Applause.mp3' },
    { label: '💥 Blast', file: 'Voicy_blast this during class you wont regret it 🙋_♂️.mp3' },
    { label: '🤫 Shut Up', file: 'Voicy_Do me a f___ing favor. Shut up, listen, and learn.mp3' },
    { label: '🎭 Hitler', file: 'Voicy_Hitler 26 (Downfall _ DerUntergang).mp3' },
    { label: '🎵 Phonk', file: 'Voicy_phonk.mp3' },
    { label: '😤 What Hell', file: 'Voicy_What the hell_ (Loud).mp3' },
    { label: '😱 WHAT', file: 'Voicy_WHAT_!.mp3' },
  ]
  const timer = useElapsedTime(joinedAt, isJoined)

  const prevJoinedRef = useRef(isJoined)
  useEffect(() => {
    if (prevJoinedRef.current && !isJoined) {
      setExitReason('left')
    }
    prevJoinedRef.current = isJoined
  }, [isJoined])

  const setExit = (reason: 'left' | null) => {
    setExitReason(reason)
  }

  useEffect(() => {
    onJoin()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const cols =
    participants.length <= 1 ? 'grid-cols-1'
    : participants.length <= 2 ? 'grid-cols-2'
    : participants.length <= 4 ? 'grid-cols-2'
    : participants.length <= 6 ? 'grid-cols-3'
    : 'grid-cols-4'

  return (
    <motion.div
      className="flex min-w-0 flex-1 overflow-hidden bg-background"
      initial={{ opacity: 0, y: 8, scale: 0.995 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.18, ease: 'easeOut' }}
    >
    {/* Main voice area */}
    <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
      {/* Header */}
      <div className="flex h-12 flex-shrink-0 items-center gap-2.5 border-b border-border bg-sidebar px-4">
        <Volume2 className="h-4 w-4 flex-shrink-0 text-primary" />
        <span className="text-[13px] font-semibold text-foreground">{group.label}</span>
        {timer && (
          <span className="ml-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-mono font-semibold text-primary">
            {timer}
          </span>
        )}
        <span className="ml-auto text-[11px] text-muted-foreground">
          {participants.length} {participants.length === 1 ? 'participant' : 'participants'}
        </span>
      </div>

      {/* Screen share preview */}
      <AnimatePresence>
        {sharing && (
          <motion.div
            key="screen-share"
            className="relative mx-4 mt-4 overflow-hidden rounded-2xl border border-border bg-black"
            style={{ maxHeight: '40%' }}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
          >
            <video
              ref={screenVideoRef}
              autoPlay
              muted
              playsInline
              className="h-full w-full object-contain"
            />
            <span className="absolute left-2 top-2 rounded-lg bg-black/60 px-2 py-0.5 text-[10px] font-semibold text-white">
              Your screen
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Participants grid */}
      <div className="flex flex-1 flex-col overflow-hidden p-4">
        <AnimatePresence mode="wait" initial={false}>
          {!isJoined ? (
          <motion.div
            key={exitReason === 'left' ? 'left' : 'connecting'}
            className="flex flex-1 flex-col items-center justify-center gap-4 text-center"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.16, ease: 'easeOut' }}
          >
            {exitReason === 'left' ? (
              <>
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
                  <PhoneOff className="h-6 w-6 text-muted-foreground" />
                </div>
                <p className="text-[13px] font-semibold text-foreground">You left the call</p>
                <p className="text-[11px] text-muted-foreground">Click join to reconnect</p>
                <button
                  onClick={() => { setExit(null); onJoin() }}
                  className="mt-1 rounded-xl bg-primary px-4 py-2 text-[12px] font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
                >
                  Rejoin
                </button>
              </>
            ) : (
              <>
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
                  <Volume2 className="h-6 w-6 text-muted-foreground" />
                </div>
                <p className="text-[13px] font-semibold text-foreground">Connecting…</p>
              </>
            )}
          </motion.div>
        ) : (
          <motion.div
            key="participants"
            className="flex h-full flex-col gap-3"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.16, ease: 'easeOut' }}
          >
            {/* Participant grid — fills available space */}
            <div className={cn('grid flex-1 gap-2', cols)}>
              <AnimatePresence>
                {participants.map((member) => {
                  const isMe = member.id === myId
                  const showVideo = isMe && videoOn
                  return (
                    <ContextMenu key={member.id}>
                      <ContextMenuTrigger asChild>
                        <motion.div
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          transition={{ duration: 0.15 }}
                          className={cn(
                            'group/tile relative flex flex-col items-center justify-center overflow-hidden rounded-xl border border-white/5 bg-muted/30 cursor-default select-none transition-all duration-200 min-h-[120px]',
                            member.isSpeaking && !member.isMuted && 'ring-2 ring-green-500/80',
                          )}
                          style={soundboardUserId === member.id ? {
                            outline: `${1 + soundboardIntensity * 3}px solid rgba(74,222,128,${0.5 + soundboardIntensity * 0.5})`,
                            boxShadow: `0 0 ${6 + soundboardIntensity * 24}px ${soundboardIntensity * 10}px rgba(74,222,128,${0.2 + soundboardIntensity * 0.6})`,
                          } : undefined}
                        >
                          {/* Camera video fills tile */}
                          {showVideo && (
                            <video
                              ref={localVideoRef}
                              autoPlay
                              muted
                              playsInline
                              className="absolute inset-0 h-full w-full object-cover"
                            />
                          )}

                          {/* Dark overlay for readability */}
                          {showVideo && (
                            <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
                          )}

                          {/* Avatar when no camera */}
                          {!showVideo && (
                            <div className="relative z-10 flex flex-col items-center gap-2">
                              {member.avatarUrl ? (
                                <img src={member.avatarUrl} alt={member.name} className="h-16 w-16 rounded-full object-cover shadow-lg" />
                              ) : (
                                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/20 text-[24px] font-bold text-primary shadow-lg">
                                  {member.name[0]?.toUpperCase()}
                                </div>
                              )}
                            </div>
                          )}

                          {/* Name + mute pinned bottom-left like Discord */}
                          <div className="absolute bottom-2 left-2 z-10 flex items-center gap-1.5">
                            {member.isMuted && (
                              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-destructive shadow">
                                <MicOff className="h-2.5 w-2.5 text-white" />
                              </span>
                            )}
                            <span className={cn(
                              'rounded px-1.5 py-0.5 text-[11px] font-semibold',
                              showVideo ? 'bg-black/50 text-white' : 'text-foreground',
                            )}>
                              {isMe ? `${member.name} (You)` : member.name}
                            </span>
                          </div>

                          {/* Hover 3-dot */}
                          {!isMe && (
                            <span className="absolute right-2 top-2 z-10 opacity-0 transition-opacity group-hover/tile:opacity-100">
                              <MoreHorizontal className="h-3.5 w-3.5 text-white/70" />
                            </span>
                          )}
                        </motion.div>
                      </ContextMenuTrigger>

                      {!isMe && (
                        <ContextMenuContent className="w-44 bg-sidebar border-border">
                          <ContextMenuItem onClick={() => onViewProfile?.(member)}>
                            <Shield className="mr-2 h-3.5 w-3.5" />
                            View profile
                          </ContextMenuItem>
                          <ContextMenuSeparator />
                          <ContextMenuItem>
                            <Volume1 className="mr-2 h-3.5 w-3.5" />
                            Adjust volume
                          </ContextMenuItem>
                          <ContextMenuItem>
                            <VolumeX className="mr-2 h-3.5 w-3.5" />
                            Mute for me
                          </ContextMenuItem>
                          <ContextMenuSeparator />
                          <ContextMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => onKick?.(member.id)}
                          >
                            <UserMinus className="mr-2 h-3.5 w-3.5" />
                            Kick from voice
                          </ContextMenuItem>
                        </ContextMenuContent>
                      )}
                    </ContextMenu>
                  )
                })}
              </AnimatePresence>
            </div>

            {/* Invite friends */}
            <button
              onClick={() => { setInviteSearch(''); setSentInvites(new Set()); setInviteOpen(true) }}
              className="mx-auto flex items-center gap-2 rounded-xl border border-dashed border-border/50 px-5 py-2 text-[12px] font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-primary"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/>
              </svg>
              Invite Friends
            </button>
          </motion.div>
        )}
        </AnimatePresence>
      </div>

      {/* Controls */}
      {exitReason === null && <motion.div
        className="flex flex-shrink-0 items-center justify-between border-t border-border bg-sidebar px-6 py-3"
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.18, ease: 'easeOut' }}
      >
        {/* Left: voice info */}
        <div className="flex w-32 shrink-0 items-center gap-2">
          <span className="flex h-2 w-2 shrink-0 rounded-full bg-green-500" />
          <span className="truncate text-[11px] font-medium text-muted-foreground">
            {group.label}
          </span>
          {timer && (
            <span className="shrink-0 font-mono text-[11px] tabular-nums text-primary">{timer}</span>
          )}
        </div>

        {/* Center: controls */}
        <div className="flex items-center gap-2">
          <VoiceCtrlBtn
            active={!isMuted}
            danger={isMuted}
            title={isMuted ? 'Unmute' : 'Mute'}
            onClick={onToggleMute}
          >
            {isMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          </VoiceCtrlBtn>

          <VoiceCtrlBtn
            active={!deafened}
            danger={deafened}
            title={deafened ? 'Undeafen' : 'Deafen'}
            onClick={() => setDeafened((v) => !v)}
          >
            {deafened ? <HeadphoneOff className="h-4 w-4" /> : <Headphones className="h-4 w-4" />}
          </VoiceCtrlBtn>

          <VoiceCtrlBtn
            active={videoOn}
            title={videoOn ? 'Stop camera' : 'Start camera'}
            onClick={handleToggleCamera}
          >
            {videoOn ? <Camera className="h-4 w-4" /> : <CameraOff className="h-4 w-4" />}
          </VoiceCtrlBtn>

          <VoiceCtrlBtn
            active={sharing}
            title={sharing ? 'Stop sharing' : 'Share screen'}
            onClick={handleToggleSharing}
          >
            {sharing ? <MonitorOff className="h-4 w-4" /> : <MonitorUp className="h-4 w-4" />}
          </VoiceCtrlBtn>

          <VoiceCtrlBtn
            active={chatOpen}
            title={chatOpen ? 'Close chat' : 'Open chat'}
            onClick={() => setChatOpen((v) => !v)}
          >
            <div className="relative">
              <MessageSquare className="h-4 w-4" />
            </div>
          </VoiceCtrlBtn>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                title="Soundboard"
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-muted/50 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <Music2 className="h-4 w-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center" side="top" className="w-44 bg-sidebar border-border mb-1">
              <DropdownMenuLabel className="text-[11px] text-muted-foreground">Soundboard</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {sounds.map((s) => (
                <DropdownMenuItem
                  key={s.file}
                  className="text-[12px] cursor-pointer"
                  onClick={() => onPlaySound?.(s.file)}
                >
                  {s.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Right: leave */}
        <div className="flex w-32 shrink-0 justify-end">
        <button
          onClick={() => {
            videoStreamRef.current?.getTracks().forEach((t) => t.stop())
            videoStreamRef.current = null
            setVideoOn(false)
            screenStreamRef.current?.getTracks().forEach((t) => t.stop())
            screenStreamRef.current = null
            setSharing(false)
            if (isJoined) setExit('left')
            onLeave()
          }}
          title="Leave"
          className="flex items-center gap-1.5 rounded-2xl bg-destructive/10 px-3 py-2 text-destructive transition-colors hover:bg-destructive/20"
        >
          <PhoneOff className="h-3.5 w-3.5" />
          <span className="text-[11px] font-semibold">Leave</span>
        </button>
        </div>
      </motion.div>}
    </div>

    {/* Chat sidebar */}
    <AnimatePresence>
      {chatOpen && (
        <motion.div
          key="chat-sidebar"
          className="flex w-72 shrink-0 flex-col border-l border-border bg-background"
          initial={{ width: 0, opacity: 0 }}
          animate={{ width: 288, opacity: 1 }}
          exit={{ width: 0, opacity: 0 }}
          transition={{ duration: 0.22, ease: 'easeInOut' }}
        >
          {/* Chat header */}
          <div className="flex h-12 shrink-0 items-center gap-2 border-b border-border px-4">
            <Hash className="h-4 w-4 text-muted-foreground" />
            <span className="flex-1 text-[13px] font-semibold text-foreground">Voice Chat</span>
            <button
              onClick={() => setChatOpen(false)}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-3 py-3">
            {chatMessages.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted">
                  <MessageSquare className="h-5 w-5 text-muted-foreground" />
                </div>
                <p className="text-[12px] font-semibold text-foreground">No messages yet</p>
                <p className="text-[11px] text-muted-foreground">Say something to the group!</p>
              </div>
            ) : (
              chatMessages.map((msg, i) => {
                const prev = chatMessages[i - 1]
                const grouped = prev?.userId === msg.userId && msg.ts - prev.ts < 60000
                return (
                  <div key={msg.id} className={cn('flex gap-2.5', grouped ? 'mt-0.5' : 'mt-3')}>
                    {!grouped ? (
                      <div className="shrink-0">
                        {msg.avatar ? (
                          <img src={msg.avatar} alt={msg.name} className="h-7 w-7 rounded-full object-cover" />
                        ) : (
                          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/15 text-[11px] font-bold text-primary">
                            {msg.name[0]?.toUpperCase()}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="w-7 shrink-0" />
                    )}
                    <div className="min-w-0 flex-1">
                      {!grouped && (
                        <div className="mb-0.5 flex items-baseline gap-2">
                          <span className="text-[12px] font-semibold text-foreground">{msg.name}</span>
                          <span className="text-[10px] text-muted-foreground">
                            {new Date(msg.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      )}
                      <p className="break-words text-[12px] leading-relaxed text-foreground/90">{msg.text}</p>
                    </div>
                  </div>
                )
              })
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Input */}
          <div className="shrink-0 border-t border-border p-3">
            <div className="flex items-center gap-2 rounded-xl border border-border bg-muted/40 px-3 py-2 focus-within:border-primary/40 focus-within:ring-1 focus-within:ring-primary/20 transition-all">
              <input
                ref={chatInputRef}
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChatMessage() } }}
                placeholder="Message the group…"
                className="min-w-0 flex-1 bg-transparent text-[12px] text-foreground placeholder:text-muted-foreground outline-none"
              />
              <button
                onClick={sendChatMessage}
                disabled={!chatInput.trim()}
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:text-primary disabled:opacity-30"
              >
                <Send className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
    {/* Invite Friends dialog */}
    <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
      <DialogContent className="max-w-sm p-0 gap-0 overflow-hidden bg-background border-border">
        <DialogHeader className="px-5 pt-5 pb-3 border-b border-border">
          <DialogTitle className="text-[14px] font-semibold">Invite to {group.label}</DialogTitle>
          <p className="text-[11px] text-muted-foreground mt-0.5">Invite friends to join this voice channel</p>
        </DialogHeader>

        {/* Search */}
        <div className="px-4 pt-3">
          <div className="flex items-center gap-2 rounded-xl border border-border bg-muted/40 px-3 py-2 focus-within:border-primary/40 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 shrink-0 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
            <input
              autoFocus
              value={inviteSearch}
              onChange={(e) => setInviteSearch(e.target.value)}
              placeholder="Search by username…"
              className="flex-1 bg-transparent text-[12px] text-foreground placeholder:text-muted-foreground outline-none"
            />
          </div>
        </div>

        {/* User list */}
        <div className="flex flex-col gap-0.5 overflow-y-auto px-2 py-3" style={{ maxHeight: 320 }}>
          {inviteSuggestions.length === 0 ? (
            <p className="py-8 text-center text-[12px] text-muted-foreground">
              {inviteSearch ? 'No members found' : 'No channel members to invite'}
            </p>
          ) : (
            inviteSuggestions.map((user) => {
              if (!user) return null
              const alreadyIn = participantIds.has(user.id)
              const sent = sentInvites.has(user.id)
              return (
                <div
                  key={user.id}
                  className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-muted/50 transition-colors"
                >
                  {/* Avatar */}
                  {user.avatar_url ? (
                    <img src={user.avatar_url} alt={user.username} className="h-8 w-8 rounded-full object-cover shrink-0" />
                  ) : (
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[13px] font-bold text-primary">
                      {user.username[0]?.toUpperCase()}
                    </div>
                  )}

                  {/* Name */}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12px] font-semibold text-foreground">{user.username}</p>
                    {alreadyIn && <p className="text-[10px] text-green-500">Already in call</p>}
                  </div>

                  {/* Action */}
                  <button
                    disabled={alreadyIn || sent}
                    onClick={() => handleInvite(user.id)}
                    className={cn(
                      'shrink-0 rounded-lg px-3 py-1.5 text-[11px] font-semibold transition-all',
                      alreadyIn
                        ? 'bg-muted text-muted-foreground cursor-not-allowed'
                        : sent
                        ? 'bg-green-500/10 text-green-500 cursor-default'
                        : 'bg-primary text-primary-foreground hover:bg-primary/90 active:scale-95',
                    )}
                  >
                    {alreadyIn ? 'In call' : sent ? '✓ Sent' : 'Invite'}
                  </button>
                </div>
              )
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
    </motion.div>
  )
}

function VoiceCtrlBtn({
  children,
  active,
  danger,
  title,
  onClick,
}: {
  children: React.ReactNode
  active?: boolean
  danger?: boolean
  title?: string
  onClick?: () => void
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={cn(
        'flex h-9 w-9 items-center justify-center rounded-xl border transition-colors',
        danger
          ? 'border-destructive/20 bg-destructive/10 text-destructive hover:bg-destructive/20'
          : active
          ? 'border-primary/20 bg-primary/10 text-primary hover:bg-primary/20'
          : 'border-border bg-muted/50 text-muted-foreground hover:bg-accent hover:text-foreground',
      )}
    >
      {children}
    </button>
  )
}
