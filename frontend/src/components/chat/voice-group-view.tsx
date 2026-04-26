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
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import type { MockChannelGroup } from '@/components/chat/channels-panel'
import type { VoicePresenceUser } from '@/hooks/use-voice-presence'
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
  soundboardUserId?: string | null
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
  soundboardUserId,
}: VoiceGroupViewProps) {
  const [deafened, setDeafened] = useState(false)
  const [videoOn, setVideoOn] = useState(false)
  const [sharing, setSharing] = useState(false)
  const [exitReason, setExitReason] = useState<'left' | null>(null)

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

  const sounds = [
    { label: '😂 Faaa', file: 'faaa sound.mpeg' },
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
      className="flex min-w-0 flex-1 flex-col overflow-hidden bg-background"
      initial={{ opacity: 0, y: 8, scale: 0.995 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.18, ease: 'easeOut' }}
    >
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
                            soundboardUserId === member.id && 'ring-1 ring-green-400 shadow-[0_0_8px_1px_rgba(74,222,128,0.4)]',
                          )}
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
            <button className="mx-auto flex items-center gap-2 rounded-xl border border-dashed border-border/50 px-5 py-2 text-[12px] font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-primary">
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
