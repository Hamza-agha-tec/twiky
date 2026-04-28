'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import {
  Video,
  VideoOff,
  Mic,
  MicOff,
  Headphones,
  HeadphoneOff,
  MonitorUp,
  MonitorOff,
  Maximize2,
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
  ChevronUp,
  Check,
  Smile,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import type { Socket } from 'socket.io-client'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import type { MockChannelGroup } from '@/components/chat/channels-panel'
import type { VoicePresenceUser } from '@/hooks/use-voice-presence'
import { useQuery } from '@tanstack/react-query'
import { channelsApi } from '@/lib/channels-api'
import { getSocket } from '@/lib/socket'
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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Slider } from '@/components/ui/slider'

export type { VoicePresenceUser as VoiceMember }

const VOICE_CHAT_EMOJIS = ['👍', '❤️', '😂', '🔥', '👏', '😮', '😢', '🙏']

type VoiceChatMessage = {
  id: string
  roomId: string
  userId: string
  name: string
  avatar: string | null
  text: string
  ts: number
  reactions: { emoji: string; users: string[] }[]
}

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
  deafened?: boolean
  onToggleDeafen?: () => void
  remoteStreams?: Map<string, MediaStream>
  remoteScreenStreams?: Map<string, MediaStream>
  addVideoTrack?: (track: MediaStreamTrack, stream: MediaStream, source?: 'camera' | 'screen') => void
  removeVideoTrack?: (track: MediaStreamTrack) => void
  onScreenShareToggle?: (enabled: boolean) => void
  onCameraToggle?: (enabled: boolean) => void
  onSwitchAudioInput?: (deviceId: string) => void
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
  deafened = false,
  onToggleDeafen,
  remoteStreams,
  remoteScreenStreams,
  addVideoTrack,
  removeVideoTrack,
  onScreenShareToggle,
  onCameraToggle,
  onSwitchAudioInput,
}: VoiceGroupViewProps) {
  const [videoOn, setVideoOn] = useState(false)
  const [sharing, setSharing] = useState(false)
  const [outputVolume, setOutputVolume] = useState(100)
  const [exitReason, setExitReason] = useState<'left' | null>(null)
  const [chatOpen, setChatOpen] = useState(false)
  const [chatInput, setChatInput] = useState('')
  const [chatMessages, setChatMessages] = useState<VoiceChatMessage[]>([])
  const [chatUnread, setChatUnread] = useState(false)
  const chatEndRef = useRef<HTMLDivElement | null>(null)
  const chatInputRef = useRef<HTMLInputElement | null>(null)
  const chatSocketRef = useRef<Socket | null>(null)
  const chatOpenRef = useRef(chatOpen)
  const [inviteOpen, setInviteOpen] = useState(false)
  const [inviteSearch, setInviteSearch] = useState('')
  const [sentInvites, setSentInvites] = useState<Set<string>>(new Set())

  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([])
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('default')

  useEffect(() => {
    if (!isJoined) return

    const enumerate = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices()
        const inputs = devices.filter((d) => d.kind === 'audioinput')
        setAudioDevices(inputs)

        const headphone = inputs.find((d) =>
          /headphone|headset|earphone|airpod|buds/i.test(d.label)
        )
        if (headphone && headphone.deviceId !== selectedDeviceId) {
          setSelectedDeviceId(headphone.deviceId)
          onSwitchAudioInput?.(headphone.deviceId)
        }
      } catch {}
    }

    void enumerate()

    const handleDeviceChange = () => void enumerate()
    navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange)
    return () => navigator.mediaDevices.removeEventListener('devicechange', handleDeviceChange)
  }, [isJoined]) // eslint-disable-line react-hooks/exhaustive-deps

  const videoStreamRef = useRef<MediaStream | null>(null)
  const screenStreamRef = useRef<MediaStream | null>(null)
  const localVideoRef = useRef<HTMLVideoElement | null>(null)
  const screenVideoRef = useRef<HTMLVideoElement | null>(null)

  useEffect(() => {
    const v = localVideoRef.current
    if (!v) return
    v.srcObject = videoOn ? (videoStreamRef.current ?? null) : null
    if (videoOn && v.srcObject) v.play().catch(() => {})
  }, [videoOn])

  // screenVideoRef always mounted (hidden video element), srcObject set directly in handler
  useEffect(() => {
    const v = screenVideoRef.current
    if (v && !sharing) v.srcObject = null
  }, [sharing])

  useEffect(() => {
    return () => {
      videoStreamRef.current?.getTracks().forEach((t) => t.stop())
      screenStreamRef.current?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  const handleToggleCamera = useCallback(async () => {
    if (videoOn) {
      if (localVideoRef.current) localVideoRef.current.srcObject = null
      const track = videoStreamRef.current?.getVideoTracks()[0]
      onCameraToggle?.(false)
      if (track) removeVideoTrack?.(track)
      videoStreamRef.current?.getTracks().forEach((t) => t.stop())
      videoStreamRef.current = null
      setVideoOn(false)
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
        videoStreamRef.current = stream
        const track = stream.getVideoTracks()[0]
        if (track) addVideoTrack?.(track, stream, 'camera')
        onCameraToggle?.(true)
        setVideoOn(true)
        // srcObject set after render via useEffect — but also set eagerly here in case ref already exists
        if (localVideoRef.current) localVideoRef.current.srcObject = stream
      } catch {}
    }
  }, [videoOn, addVideoTrack, removeVideoTrack, onCameraToggle])

  const handleToggleSharing = useCallback(async () => {
    if (sharing) {
      const track = screenStreamRef.current?.getVideoTracks()[0]
      if (track) removeVideoTrack?.(track)
      screenStreamRef.current?.getTracks().forEach((t) => t.stop())
      screenStreamRef.current = null
      setSharing(false)
      onScreenShareToggle?.(false)
    } else {
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({ video: true })
        screenStreamRef.current = stream
        const track = stream.getVideoTracks()[0]
        if (track) {
          // Emit socket signal BEFORE addVideoTrack so receivers know it's a screen share
          // before the WebRTC track arrives
          onScreenShareToggle?.(true)
          addVideoTrack?.(track, stream, 'screen')
          track.onended = () => {
            removeVideoTrack?.(track)
            screenStreamRef.current = null
            setSharing(false)
            onScreenShareToggle?.(false)
          }
        }
        // Set srcObject immediately — ref is always mounted
        if (screenVideoRef.current) {
          screenVideoRef.current.srcObject = stream
          void screenVideoRef.current.play().catch(() => {})
        }
        setSharing(true)
      } catch {}
    }
  }, [sharing, addVideoTrack, removeVideoTrack, onScreenShareToggle])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages])

  useEffect(() => {
    chatOpenRef.current = chatOpen
    if (chatOpen) {
      setChatUnread(false)
      setTimeout(() => chatInputRef.current?.focus(), 150)
    }
  }, [chatOpen])

  const me = participants.find((p) => p.id === myId)

  useEffect(() => {
    let mounted = true
    let socket: Socket | null = null

    const roomId = group.id
    const upsertMessage = (message: VoiceChatMessage) => {
      setChatMessages((prev) => {
        if (prev.some((item) => item.id === message.id)) {
          return prev.map((item) => item.id === message.id ? message : item)
        }
        return [...prev, message]
      })
    }

    const onHistory = (payload: { roomId?: string; messages?: VoiceChatMessage[] }) => {
      if (!mounted || payload.roomId !== roomId) return
      setChatMessages(Array.isArray(payload.messages) ? payload.messages : [])
    }

    const onMessage = (message: VoiceChatMessage) => {
      if (!mounted || message.roomId !== roomId) return
      upsertMessage(message)
      if (message.userId !== myId && !chatOpenRef.current) {
        setChatUnread(true)
        toast.custom((toastId) => (
          <button
            type="button"
            onClick={() => {
              setChatOpen(true)
              toast.dismiss(toastId)
            }}
            className="flex w-80 items-start gap-3 rounded-2xl border border-border bg-popover p-3 text-left shadow-xl transition-colors hover:bg-accent"
          >
            {message.avatar ? (
              <img src={message.avatar} alt={message.name} className="h-10 w-10 shrink-0 rounded-full object-cover" />
            ) : (
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[13px] font-bold text-primary">
                {message.name[0]?.toUpperCase() ?? '?'}
              </span>
            )}
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase text-primary">
                <MessageSquare className="h-3 w-3" />
                {group.label}
              </span>
              <span className="mt-0.5 block truncate text-[13px] font-semibold text-foreground">{message.name}</span>
              <span className="mt-0.5 line-clamp-2 block text-[12px] leading-snug text-muted-foreground">
                {message.text}
              </span>
            </span>
          </button>
        ))
      }
    }

    const onMessageUpdated = (message: VoiceChatMessage) => {
      if (!mounted || message.roomId !== roomId) return
      upsertMessage(message)
    }

    if (!isJoined) {
      setChatMessages([])
      setChatUnread(false)
      return
    }

    void getSocket().then((s) => {
      if (!mounted) return
      socket = s
      chatSocketRef.current = s
      s.on('voice-chat-history', onHistory)
      s.on('voice-chat-message', onMessage)
      s.on('voice-chat-message-updated', onMessageUpdated)
      s.emit('voice-chat-history', { roomId })
    })

    return () => {
      mounted = false
      if (socket) {
        socket.off('voice-chat-history', onHistory)
        socket.off('voice-chat-message', onMessage)
        socket.off('voice-chat-message-updated', onMessageUpdated)
      }
    }
  }, [group.id, group.label, isJoined, myId])

  const sendChatMessage = useCallback(() => {
    const text = chatInput.trim()
    if (!text || !me || !isJoined) return
    chatSocketRef.current?.emit('voice-chat-message', { roomId: group.id, text })
    setChatInput('')
  }, [chatInput, group.id, isJoined, me])

  const addChatEmoji = useCallback((emoji: string) => {
    setChatInput((prev) => `${prev}${emoji}`)
    setTimeout(() => chatInputRef.current?.focus(), 0)
  }, [])

  const toggleChatReaction = useCallback((messageId: string, emoji: string) => {
    if (!isJoined) return
    chatSocketRef.current?.emit('voice-chat-reaction', { roomId: group.id, messageId, emoji })
  }, [group.id, isJoined])

  const openChatProfile = useCallback((message: VoiceChatMessage) => {
    const participant = participants.find((p) => p.id === message.userId)
    onViewProfile?.(participant ?? {
      id: message.userId,
      name: message.name,
      avatarUrl: message.avatar,
      isMuted: false,
      joinedAt: message.ts,
    })
  }, [onViewProfile, participants])

  const copyChatMessage = useCallback((text: string) => {
    if (!navigator.clipboard) return
    void navigator.clipboard.writeText(text).then(() => {
      toast.success('Message copied')
    }).catch(() => {
      toast.error('Could not copy message')
    })
  }, [])

  const { data: channelMembersRaw = [] } = useQuery({
    queryKey: ['channel-members', channelId],
    queryFn: () => channelsApi.getMembers(channelId!),
    enabled: Boolean(channelId && inviteOpen),
  })

  const participantIds = new Set(participants.map((p) => p.id))

  const inviteSuggestions = channelMembersRaw
    .map((m) => m.user)
    .filter((u) => u && u.id !== myId && !participantIds.has(u.id))
    .filter((u) => !inviteSearch.trim() || (u.username ?? '').toLowerCase().includes(inviteSearch.toLowerCase()))

  const handleInvite = (userId: string) => {
    onSendVoiceInvite?.(userId)
    setSentInvites((prev) => new Set(prev).add(userId))
  }

  const sounds = [
    { label: '😂 Faaaa!', file: 'faaa sound.mpeg' },
    { label: '👋 Bye Bye', file: 'Voicy_And we say bye bye.mp3' },
    { label: '👏 Applause', file: 'Voicy_Applause.mp3' },
    { label: '💥 Nuke This', file: 'Voicy_blast this during class you wont regret it 🙋_♂️.mp3' },
    { label: '🤫 Pipe Down', file: 'Voicy_Do me a f___ing favor. Shut up, listen, and learn.mp3' },
    { label: '📉 Downfall', file: 'Voicy_Hitler 26 (Downfall _ DerUntergang).mp3' },
    { label: '🎵 Phonk', file: 'Voicy_phonk.mp3' },
    { label: '😤 The Hell?!', file: 'Voicy_What the hell_ (Loud).mp3' },
    { label: '😱 WHAT!?', file: 'Voicy_WHAT_!.mp3' },
    { label: '🏴‍☠️ Blackbeard LOL', file: 'Voicy_Black Bear Laugh.mp3' },
    { label: '🚫 Nope!', file: 'Voicy_Nope! .mp3' },
    { label: '🏆 Big W', file: 'Voicy_W Reaction .mp3' },
    { label: '🚀 Soviet Banger', file: 'Voicy_SOVIET UNION THEME (700k likes)(EARRAPE).mp3' },
    { label: '🤢 Eww Brother', file: 'Voicy_eww brother eww.mp3' },
  ]
  const callStartedAt = participants.length > 0
    ? Math.min(...participants.map(p => p.joinedAt))
    : (me?.joinedAt ?? joinedAt)
  const timer = useElapsedTime(callStartedAt, isJoined)

  const prevJoinedRef = useRef(isJoined)
  useEffect(() => {
    if (prevJoinedRef.current && !isJoined) {
      setExitReason('left')
      videoStreamRef.current?.getTracks().forEach((t) => t.stop())
      videoStreamRef.current = null
      if (localVideoRef.current) localVideoRef.current.srcObject = null
      setVideoOn(false)
      screenStreamRef.current?.getTracks().forEach((t) => t.stop())
      screenStreamRef.current = null
      if (screenVideoRef.current) screenVideoRef.current.srcObject = null
      setSharing(false)
    }
    prevJoinedRef.current = isJoined
  }, [isJoined])

  const setExit = (reason: 'left' | null) => {
    setExitReason(reason)
  }

  useEffect(() => {
    if (!isJoined) onJoin()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const cols =
    participants.length <= 1 ? 'grid-cols-1'
    : participants.length <= 2 ? 'grid-cols-2'
    : participants.length <= 4 ? 'grid-cols-2'
    : participants.length <= 6 ? 'grid-cols-3'
    : 'grid-cols-4'

  const remoteScreenPeerIds = new Set<string>()
  if (isJoined) {
    remoteScreenStreams?.forEach((_stream, peerId) => remoteScreenPeerIds.add(peerId))
    participants.forEach((participant) => {
      if (participant.id !== myId && participant.isScreenSharing) remoteScreenPeerIds.add(participant.id)
    })
  }
  const remoteScreenShares = Array.from(remoteScreenPeerIds)

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

      {/* Local screen share preview — always mounted so ref is valid; hidden when not sharing */}
      <div
        className="mx-4 mt-4 flex gap-3"
        style={{ display: (isJoined && (sharing || remoteScreenShares.length > 0)) ? undefined : 'none', maxHeight: '40%' }}
      >
        <div
          className="group/screen relative overflow-hidden rounded-2xl border border-border bg-black"
          style={{ flex: 1, display: sharing ? undefined : 'none', minHeight: '180px' }}
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
          <div className="absolute bottom-2 right-2 flex gap-1.5 opacity-0 transition-opacity group-hover/screen:opacity-100">
            <button
              onClick={() => screenVideoRef.current?.requestFullscreen()}
              className="flex items-center gap-1 rounded-lg bg-black/70 px-2 py-1 text-[11px] font-semibold text-white backdrop-blur-sm hover:bg-black/90"
              title="Fullscreen"
            >
              <Maximize2 className="h-3 w-3" />
              Fullscreen
            </button>
          </div>
        </div>

        {/* Remote screen shares */}
        {remoteScreenShares.map((peerId) => {
          const stream = remoteScreenStreams?.get(peerId)
          const peer = participants.find(p => p.id === peerId)
          const activeScreenTrack = stream?.getVideoTracks().find(t => t.readyState === 'live' && !t.muted)
          if (!activeScreenTrack && !peer?.isScreenSharing) return null
          
          return (
            <div key={peerId} data-screen-tile="" className="group/screen relative flex-1 overflow-hidden rounded-2xl border border-border bg-black" style={{ minHeight: '180px' }}>
              {stream && activeScreenTrack ? (
                <RemoteVideo stream={stream} fit="contain" />
              ) : (
                <div className="flex h-full min-h-[180px] w-full items-center justify-center bg-black text-[11px] font-semibold text-white/70">
                  Connecting to screen share...
                </div>
              )}
              <span className="absolute left-2 top-2 rounded-lg bg-black/60 px-2 py-0.5 text-[10px] font-semibold text-white">
                {peer?.name ?? 'User'}&apos;s screen
              </span>
              <div className="absolute bottom-2 right-2 flex gap-1.5 opacity-0 transition-opacity group-hover/screen:opacity-100">
                <button
                  onClick={(e) => (e.currentTarget.closest('[data-screen-tile]') as HTMLElement | null)?.requestFullscreen()}
                  className="flex items-center gap-1 rounded-lg bg-black/70 px-2 py-1 text-[11px] font-semibold text-white backdrop-blur-sm hover:bg-black/90"
                  title="Fullscreen"
                >
                  <Maximize2 className="h-3 w-3" />
                  Fullscreen
                </button>
              </div>
            </div>
          )
        })}
      </div>

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
                  const remoteStream = !isMe ? remoteStreams?.get(member.id) : undefined
                  const remoteVideoTrack = remoteStream
                    ?.getVideoTracks()
                    .find((track) => track.readyState === 'live' && !track.muted)
                  const showRemoteVideo = Boolean(remoteVideoTrack && (member.isCameraOn || !member.isScreenSharing))
                  
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
                          {/* Local camera video */}
                          {showVideo && (
                            <video
                              ref={localVideoRef}
                              autoPlay
                              muted
                              playsInline
                              className="absolute inset-0 h-full w-full object-cover"
                            />
                          )}

                          {/* Remote participant video — keyed by isCameraOn so toggle remounts and re-attaches srcObject */}
                          {showRemoteVideo && remoteStream && <RemoteVideo key={`${member.id}-${member.isCameraOn ? 'on' : 'off'}`} stream={remoteStream} />}

                          {/* Dark overlay for readability */}
                          {(showVideo || showRemoteVideo) && (
                            <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
                          )}

                          {/* Avatar when no video */}
                          {!showVideo && !showRemoteVideo && (
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
                              (showVideo || showRemoteVideo) ? 'bg-black/50 text-white' : 'text-foreground',
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
          <div className="flex items-center">
            <VoiceCtrlBtn
              active={!isMuted}
              danger={isMuted}
              title={isMuted ? 'Unmute' : 'Mute'}
              onClick={onToggleMute}
              rounded="left"
            >
              <AnimatePresence mode="wait" initial={false}>
                <motion.span
                  key={isMuted ? 'muted' : 'unmuted'}
                  initial={{ scale: 0.4, opacity: 0, rotate: -20 }}
                  animate={{ scale: 1, opacity: 1, rotate: 0 }}
                  exit={{ scale: 0.4, opacity: 0, rotate: 20 }}
                  transition={{ duration: 0.13 }}
                >
                  {isMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                </motion.span>
              </AnimatePresence>
            </VoiceCtrlBtn>
            <DropdownMenu onOpenChange={(open) => {
              if (open && isJoined) {
                navigator.mediaDevices.enumerateDevices().then((devices) => {
                  setAudioDevices(devices.filter((d) => d.kind === 'audioinput'))
                }).catch(() => {})
              }
            }}>
              <DropdownMenuTrigger asChild>
                <button
                  title="Select microphone"
                  className={cn(
                    'flex h-9 w-5 items-center justify-center rounded-r-xl border border-l-0 transition-colors',
                    isMuted
                      ? 'border-destructive/20 bg-destructive/10 text-destructive hover:bg-destructive/20'
                      : 'border-primary/20 bg-primary/10 text-primary hover:bg-primary/20',
                  )}
                >
                  <ChevronUp className="h-3 w-3" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" align="start" className="w-56 bg-background">
                <DropdownMenuLabel className="text-[11px]">Input Device</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {audioDevices.length === 0 ? (
                  <DropdownMenuItem disabled className="text-[12px]">No devices found</DropdownMenuItem>
                ) : (
                  audioDevices.map((device) => (
                    <DropdownMenuItem
                      key={device.deviceId}
                      className="text-[12px]"
                      onSelect={() => {
                        setSelectedDeviceId(device.deviceId)
                        onSwitchAudioInput?.(device.deviceId)
                      }}
                    >
                      <Check className={cn('mr-2 h-3 w-3', selectedDeviceId === device.deviceId ? 'opacity-100' : 'opacity-0')} />
                      {device.label || `Microphone ${audioDevices.indexOf(device) + 1}`}
                    </DropdownMenuItem>
                  ))
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <Popover>
            <PopoverTrigger asChild>
              <motion.button
                title="Sound settings"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.88 }}
                transition={{ type: 'spring', stiffness: 400, damping: 17 }}
                className={cn(
                  'flex h-9 w-9 items-center justify-center rounded-xl border transition-colors',
                  deafened
                    ? 'border-destructive/20 bg-destructive/10 text-destructive hover:bg-destructive/20'
                    : 'border-primary/20 bg-primary/10 text-primary hover:bg-primary/20',
                )}
              >
                <AnimatePresence mode="wait" initial={false}>
                  <motion.span
                    key={deafened ? 'deafened' : 'hearing'}
                    initial={{ scale: 0.4, opacity: 0, rotate: -20 }}
                    animate={{ scale: 1, opacity: 1, rotate: 0 }}
                    exit={{ scale: 0.4, opacity: 0, rotate: 20 }}
                    transition={{ duration: 0.13 }}
                  >
                    {deafened ? <HeadphoneOff className="h-4 w-4" /> : <Headphones className="h-4 w-4" />}
                  </motion.span>
                </AnimatePresence>
              </motion.button>
            </PopoverTrigger>
            <PopoverContent side="top" align="center" className="w-56 border-border bg-background p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5 text-[12px] font-semibold text-foreground">
                  <Volume2 className="h-3.5 w-3.5 text-muted-foreground" />
                  Output Volume
                </div>
                <span className="text-[11px] font-medium tabular-nums text-muted-foreground">{outputVolume}%</span>
              </div>
              <Slider
                value={[outputVolume]}
                min={0}
                max={100}
                step={1}
                onValueChange={([v]) => setOutputVolume(v)}
                className="mb-3 [&_[data-slot=slider-range]]:bg-[#92dce5] [&_[data-slot=slider-thumb]]:border-[#92dce5] [&_[data-slot=slider-thumb]]:ring-[#92dce5]/30"
              />
              <div className="border-t border-border pt-2.5">
                <button
                  onClick={onToggleDeafen}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-[12px] font-medium transition-colors',
                    deafened
                      ? 'bg-destructive/10 text-destructive hover:bg-destructive/20'
                      : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                  )}
                >
                  {deafened ? <HeadphoneOff className="h-3.5 w-3.5" /> : <Headphones className="h-3.5 w-3.5" />}
                  {deafened ? 'Undeafen' : 'Deafen'}
                </button>
              </div>
            </PopoverContent>
          </Popover>

          <VoiceCtrlBtn
            active={videoOn}
            title={videoOn ? 'Stop video' : 'Start video'}
            onClick={handleToggleCamera}
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={videoOn ? 'vid-on' : 'vid-off'}
                initial={{ scale: 0.4, opacity: 0, rotate: -20 }}
                animate={{ scale: 1, opacity: 1, rotate: 0 }}
                exit={{ scale: 0.4, opacity: 0, rotate: 20 }}
                transition={{ duration: 0.13 }}
              >
                {videoOn ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />}
              </motion.span>
            </AnimatePresence>
          </VoiceCtrlBtn>

          <VoiceCtrlBtn
            active={sharing}
            title={sharing ? 'Stop sharing' : 'Share screen'}
            onClick={handleToggleSharing}
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={sharing ? 'sharing' : 'not-sharing'}
                initial={{ scale: 0.4, opacity: 0, rotate: -20 }}
                animate={{ scale: 1, opacity: 1, rotate: 0 }}
                exit={{ scale: 0.4, opacity: 0, rotate: 20 }}
                transition={{ duration: 0.13 }}
              >
                {sharing ? <MonitorOff className="h-4 w-4" /> : <MonitorUp className="h-4 w-4" />}
              </motion.span>
            </AnimatePresence>
          </VoiceCtrlBtn>

          <VoiceCtrlBtn
            active={chatOpen}
            title={chatOpen ? 'Close chat' : 'Open chat'}
            onClick={() => setChatOpen((v) => !v)}
          >
            <motion.span
              className="relative"
              animate={{ rotate: chatOpen ? 15 : 0 }}
              transition={{ type: 'spring', stiffness: 400, damping: 17 }}
            >
              <MessageSquare className="h-4 w-4" />
              {chatUnread && !chatOpen ? (
                <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full border-2 border-background bg-destructive" />
              ) : null}
            </motion.span>
          </VoiceCtrlBtn>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <motion.button
                title="Soundboard"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.88 }}
                transition={{ type: 'spring', stiffness: 400, damping: 17 }}
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-muted/50 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <Music2 className="h-4 w-4" />
              </motion.button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center" side="top" className="w-44 bg-sidebar border-border mb-1 p-0">
              <div className="px-2 py-1.5">
                <DropdownMenuLabel className="text-[11px] text-muted-foreground px-0">Soundboard</DropdownMenuLabel>
              </div>
              <DropdownMenuSeparator className="m-0" />
              <div className="max-h-52 overflow-y-auto py-1">
                {sounds.map((s) => (
                  <DropdownMenuItem
                    key={s.file}
                    className="text-[12px] cursor-pointer"
                    onClick={() => onPlaySound?.(s.file)}
                  >
                    {s.label}
                  </DropdownMenuItem>
                ))}
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Right: leave */}
        <div className="flex w-32 shrink-0 justify-end">
        <motion.button
          onClick={() => {
            const videoTrack = videoStreamRef.current?.getVideoTracks()[0]
            if (videoTrack) removeVideoTrack?.(videoTrack)
            if (localVideoRef.current) localVideoRef.current.srcObject = null
            videoStreamRef.current?.getTracks().forEach((t) => t.stop())
            videoStreamRef.current = null
            setVideoOn(false)
            const screenTrack = screenStreamRef.current?.getVideoTracks()[0]
            if (screenTrack) removeVideoTrack?.(screenTrack)
            if (screenVideoRef.current) screenVideoRef.current.srcObject = null
            screenStreamRef.current?.getTracks().forEach((t) => t.stop())
            screenStreamRef.current = null
            if (sharing) onScreenShareToggle?.(false)
            setSharing(false)
            if (isJoined) setExit('left')
            onLeave()
          }}
          title="Leave"
          whileHover={{ scale: 1.06 }}
          whileTap={{ scale: 0.9 }}
          transition={{ type: 'spring', stiffness: 400, damping: 17 }}
          className="flex items-center gap-1.5 rounded-2xl bg-destructive/10 px-3 py-2 text-destructive transition-colors hover:bg-destructive/20"
        >
          <motion.span
            animate={{ x: 0 }}
            whileHover={{ x: -2, rotate: -12 }}
            transition={{ type: 'spring', stiffness: 500, damping: 20 }}
          >
            <PhoneOff className="h-3.5 w-3.5" />
          </motion.span>
          <span className="text-[11px] font-semibold">Leave</span>
        </motion.button>
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
          <div className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-4">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Hash className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-semibold text-foreground">{group.label}</p>
              <p className="truncate text-[11px] text-muted-foreground">Voice chat · {participants.length} active</p>
            </div>
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
                  <div key={msg.id} className={cn('group flex gap-2.5', grouped ? 'mt-0.5' : 'mt-3')}>
                    {!grouped ? (
                      <div className="shrink-0">
                        {msg.avatar ? (
                          <button type="button" onClick={() => openChatProfile(msg)} className="block rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                            <img src={msg.avatar} alt={msg.name} className="h-7 w-7 rounded-full object-cover" />
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => openChatProfile(msg)}
                            className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/15 text-[11px] font-bold text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            {msg.name[0]?.toUpperCase()}
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="w-7 shrink-0" />
                    )}
                    <div className="min-w-0 flex-1">
                      {!grouped && (
                        <div className="mb-0.5 flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => openChatProfile(msg)}
                            className="min-w-0 truncate text-[12px] font-semibold text-foreground hover:text-primary"
                          >
                            {msg.name}
                          </button>
                          <span className="shrink-0 text-[10px] text-muted-foreground">
                            {new Date(msg.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button
                                type="button"
                                className="ml-auto flex h-6 w-6 items-center justify-center rounded-lg text-muted-foreground opacity-0 transition-all hover:bg-accent hover:text-foreground group-hover:opacity-100 data-[state=open]:opacity-100"
                                title="Message actions"
                              >
                                <MoreHorizontal className="h-3.5 w-3.5" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent side="left" align="start" className="w-44 border-border bg-background">
                              <DropdownMenuLabel className="text-[11px]">Message</DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem className="text-[12px]" onSelect={() => openChatProfile(msg)}>
                                View profile
                              </DropdownMenuItem>
                              <DropdownMenuItem className="text-[12px]" onSelect={() => copyChatMessage(msg.text)}>
                                Copy text
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <div className="grid grid-cols-4 gap-1 p-1">
                                {VOICE_CHAT_EMOJIS.map((emoji) => (
                                  <button
                                    key={`${msg.id}-menu-${emoji}`}
                                    type="button"
                                    onClick={() => toggleChatReaction(msg.id, emoji)}
                                    className="flex h-7 w-7 items-center justify-center rounded-md text-[14px] hover:bg-accent"
                                  >
                                    {emoji}
                                  </button>
                                ))}
                              </div>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      )}
                      <div className="flex items-start gap-1.5">
                        <p className="min-w-0 flex-1 break-words text-[12px] leading-relaxed text-foreground/90">{msg.text}</p>
                        {grouped ? (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button
                                type="button"
                                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-muted-foreground opacity-0 transition-all hover:bg-accent hover:text-foreground group-hover:opacity-100 data-[state=open]:opacity-100"
                                title="Message actions"
                              >
                                <MoreHorizontal className="h-3.5 w-3.5" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent side="left" align="start" className="w-44 border-border bg-background">
                              <DropdownMenuLabel className="text-[11px]">Message</DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem className="text-[12px]" onSelect={() => openChatProfile(msg)}>
                                View profile
                              </DropdownMenuItem>
                              <DropdownMenuItem className="text-[12px]" onSelect={() => copyChatMessage(msg.text)}>
                                Copy text
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <div className="grid grid-cols-4 gap-1 p-1">
                                {VOICE_CHAT_EMOJIS.map((emoji) => (
                                  <button
                                    key={`${msg.id}-grouped-menu-${emoji}`}
                                    type="button"
                                    onClick={() => toggleChatReaction(msg.id, emoji)}
                                    className="flex h-7 w-7 items-center justify-center rounded-md text-[14px] hover:bg-accent"
                                  >
                                    {emoji}
                                  </button>
                                ))}
                              </div>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        ) : null}
                      </div>
                      {msg.reactions.length > 0 ? (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {msg.reactions.map((reaction) => {
                            const mine = myId ? reaction.users.includes(myId) : false
                            return (
                              <button
                                key={`${msg.id}-${reaction.emoji}`}
                                onClick={() => toggleChatReaction(msg.id, reaction.emoji)}
                                className={cn(
                                  'flex h-6 items-center gap-1 rounded-full border px-2 text-[11px] transition-colors',
                                  mine
                                    ? 'border-primary/30 bg-primary/15 text-primary'
                                    : 'border-border bg-muted/50 text-muted-foreground hover:bg-accent hover:text-foreground',
                                )}
                              >
                                <span>{reaction.emoji}</span>
                                <span className="tabular-nums">{reaction.users.length}</span>
                              </button>
                            )
                          })}
                        </div>
                      ) : null}
                      <div className="mt-1 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                        {VOICE_CHAT_EMOJIS.slice(0, 4).map((emoji) => (
                          <button
                            key={`${msg.id}-quick-${emoji}`}
                            onClick={() => toggleChatReaction(msg.id, emoji)}
                            className="flex h-6 w-6 items-center justify-center rounded-full text-[12px] transition-colors hover:bg-accent"
                            title={`React ${emoji}`}
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
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
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                    title="Add emoji"
                  >
                    <Smile className="h-3.5 w-3.5" />
                  </button>
                </PopoverTrigger>
                <PopoverContent side="top" align="start" className="w-auto border-border bg-background p-2">
                  <div className="grid grid-cols-4 gap-1">
                    {VOICE_CHAT_EMOJIS.map((emoji) => (
                      <button
                        key={`input-${emoji}`}
                        type="button"
                        onClick={() => addChatEmoji(emoji)}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-[15px] transition-colors hover:bg-accent"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
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
              const username = user.username ?? 'Unknown'
              return (
                <div
                  key={user.id}
                  className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-muted/50 transition-colors"
                >
                  {/* Avatar */}
                  {user.avatar_url ? (
                    <img src={user.avatar_url} alt={username} className="h-8 w-8 rounded-full object-cover shrink-0" />
                  ) : (
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[13px] font-bold text-primary">
                      {username[0]?.toUpperCase()}
                    </div>
                  )}

                  {/* Name */}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12px] font-semibold text-foreground">{username}</p>
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

function RemoteVideo({ stream, fit = 'cover' }: { stream: MediaStream; fit?: 'cover' | 'contain' }) {
  const ref = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.srcObject = stream
    void el.play().catch(() => {})
    return () => {
      if (el.srcObject === stream) el.srcObject = null
    }
  }, [stream])

  return (
    <video
      ref={ref}
      autoPlay
      playsInline
      muted
      className={cn('absolute inset-0 h-full w-full bg-black', fit === 'contain' ? 'object-contain' : 'object-cover')}
    />
  )
}

function VoiceCtrlBtn({
  children,
  active,
  danger,
  title,
  onClick,
  rounded = 'full',
}: {
  children: React.ReactNode
  active?: boolean
  danger?: boolean
  title?: string
  onClick?: () => void
  rounded?: 'full' | 'left'
}) {
  return (
    <motion.button
      onClick={onClick}
      title={title}
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.88 }}
      transition={{ type: 'spring', stiffness: 400, damping: 17 }}
      className={cn(
        'flex h-9 w-9 items-center justify-center border transition-colors',
        rounded === 'left' ? 'rounded-l-xl rounded-r-none' : 'rounded-xl',
        danger
          ? 'border-destructive/20 bg-destructive/10 text-destructive hover:bg-destructive/20'
          : active
          ? 'border-primary/20 bg-primary/10 text-primary hover:bg-primary/20'
          : 'border-border bg-muted/50 text-muted-foreground hover:bg-accent hover:text-foreground',
      )}
    >
      {children}
    </motion.button>
  )
}
