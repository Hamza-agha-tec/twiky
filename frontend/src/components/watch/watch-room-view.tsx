'use client'

import { useRef, useState, useEffect, useCallback } from 'react'
import {
  LiveKitRoom,
  VideoTrack,
  useTracks,
  useRoomContext,
  RoomAudioRenderer,
} from '@livekit/components-react'
import { Track, LocalVideoTrack, LocalAudioTrack, VideoQuality, RoomEvent, type Participant } from 'livekit-client'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Play, Pause, SkipBack, SkipForward, Volume2, VolumeX,
  Scan, FolderOpen, Users, Loader2, WifiOff, Tv2, Popcorn,
  RefreshCw, X, UserMinus, Heart, ThumbsUp, Flame, Smile, Sparkles, Maximize2,
  Mic, MicOff
} from 'lucide-react'
import { useLiveKitToken } from '@/hooks/use-livekit-token'
import { useWatchRoom, type WatchParticipant } from '@/hooks/use-watch-room'
import { UserAvatar } from '@/components/chat/user-avatar'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

const LIVEKIT_URL = process.env.NEXT_PUBLIC_LIVEKIT_URL ?? 'wss://twikyapp-spq2q6t8.livekit.cloud'

function formatTime(s: number) {
  if (!isFinite(s) || isNaN(s)) return '0:00'
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${sec.toString().padStart(2, '0')}`
}

function useElapsed(startMs: number) {
  const [elapsed, setElapsed] = useState(0)
  useEffect(() => {
    if (!startMs) return
    const tick = () => setElapsed(Math.floor((Date.now() - startMs) / 1000))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [startMs])
  const h = Math.floor(elapsed / 3600)
  const m = Math.floor((elapsed % 3600) / 60).toString().padStart(2, '0')
  const s = (elapsed % 60).toString().padStart(2, '0')
  return h > 0 ? `${h}:${m}:${s}` : `${m}:${s}`
}

// ── Shared control button ─────────────────────────────────────────────────
function WatchCtrlBtn({
  children, active, title, onClick, disabled,
}: {
  children: React.ReactNode
  active?: boolean
  title?: string
  onClick?: () => void
  disabled?: boolean
}) {
  return (
    <motion.button
      onClick={onClick}
      title={title}
      disabled={disabled}
      whileHover={disabled ? {} : { scale: 1.1 }}
      whileTap={disabled ? {} : { scale: 0.88 }}
      transition={{ type: 'spring', stiffness: 400, damping: 17 }}
      className={cn(
        'flex h-9 w-9 items-center justify-center rounded-xl border transition-colors disabled:opacity-40 disabled:cursor-not-allowed',
        active
          ? 'border-primary/20 bg-primary/10 text-primary hover:bg-primary/20'
          : 'border-border bg-muted/50 text-muted-foreground hover:bg-accent hover:text-foreground',
      )}
    >
      {children}
    </motion.button>
  )
}

// ── Forces HIGH quality subscription for all remote video tracks ─────────
function QualityEnforcer() {
  const room = useRoomContext()
  useEffect(() => {
    const enforce = () => {
      room.remoteParticipants.forEach((p) => {
        p.trackPublications.forEach((pub) => {
          if (pub.kind === Track.Kind.Video && pub.isSubscribed && pub.source === Track.Source.ScreenShare) {
            pub.setVideoQuality(VideoQuality.HIGH)
          }
        })
      })
    }
    room.on('trackSubscribed', enforce)
    enforce()
    return () => { room.off('trackSubscribed', enforce) }
  }, [room])
  return null
}

function SoundWave({ active }: { active: boolean }) {
  return (
    <div className="flex items-end gap-[1.5px] h-3 shrink-0">
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          className="w-[2px] rounded-full bg-green-500"
          animate={active ? { height: ['3px', '10px', '3px'] } : { height: '3px' }}
          transition={active ? {
            duration: 0.5,
            repeat: Infinity,
            delay: i * 0.12,
            ease: 'easeInOut',
          } : { duration: 0.2 }}
          style={{ height: '3px' }}
        />
      ))}
    </div>
  )
}

const REACTIONS = [
  { type: 'heart', icon: Heart, color: 'text-red-500', fill: '#ef4444', hoverBg: 'hover:bg-red-500/10' },
  { type: 'like', icon: ThumbsUp, color: 'text-blue-500', fill: '#3b82f6', hoverBg: 'hover:bg-blue-500/10' },
  { type: 'fire', icon: Flame, color: 'text-orange-500', fill: '#f97316', hoverBg: 'hover:bg-orange-500/10' },
  { type: 'laugh', icon: Smile, color: 'text-yellow-500', fill: '#eab308', hoverBg: 'hover:bg-yellow-500/10' },
  { type: 'sparkles', icon: Sparkles, color: 'text-purple-400', fill: '#c084fc', hoverBg: 'hover:bg-purple-500/10' },
]

interface FloatingReactionProps {
  type: string
  left: number
  onComplete: () => void
}

function FloatingReaction({ type, left, onComplete }: FloatingReactionProps) {
  let Icon = Heart
  let color = 'text-red-500'
  let fill = '#ef4444'

  switch (type) {
    case 'heart':
      Icon = Heart
      color = 'text-red-500'
      fill = '#ef4444'
      break
    case 'like':
      Icon = ThumbsUp
      color = 'text-blue-500'
      fill = '#3b82f6'
      break
    case 'fire':
      Icon = Flame
      color = 'text-orange-500'
      fill = '#f97316'
      break
    case 'laugh':
      Icon = Smile
      color = 'text-yellow-500'
      fill = '#eab308'
      break
    case 'sparkles':
      Icon = Sparkles
      color = 'text-purple-400'
      fill = '#c084fc'
      break
  }

  const randomX = useRef((Math.random() - 0.5) * 80)
  const randomDuration = useRef(2.5 + Math.random() * 1.5)

  return (
    <motion.div
      initial={{ opacity: 0, y: '100%', x: 0, scale: 0.5, rotate: 0 }}
      animate={{
        opacity: [0, 1, 1, 0],
        y: ['100%', '10%'],
        x: [0, randomX.current, randomX.current * 0.5],
        scale: [0.5, 1.2, 1, 0.7],
        rotate: [0, Math.random() * 30 - 15],
      }}
      transition={{ duration: randomDuration.current, ease: 'easeOut' }}
      onAnimationComplete={onComplete}
      className={cn("absolute bottom-0 pointer-events-none flex items-center justify-center p-2 rounded-full bg-black/40 backdrop-blur-[2px] border border-white/10 shadow-lg z-50", color)}
      style={{ left: `${left}%` }}
    >
      <Icon className="h-4 w-4" fill={fill} />
    </motion.div>
  )
}

// ── Viewer video (LiveKit track) ──────────────────────────────────────────
function ViewerVideo() {
  const tracks = useTracks([Track.Source.ScreenShare], { onlySubscribed: true })
  const hostTrack = tracks[0]

  if (!hostTrack) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 text-muted-foreground">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
          <Tv2 className="h-6 w-6" />
        </div>
        <p className="text-[13px] font-semibold text-foreground">Waiting for host…</p>
        <p className="text-[11px] text-muted-foreground">The host hasn't started the video yet</p>
      </div>
    )
  }

  return (
    <div className="relative flex flex-1 overflow-hidden rounded-xl bg-black">
      <VideoTrack trackRef={hostTrack} className="h-full w-full object-contain" />
    </div>
  )
}

// ── Host publisher ────────────────────────────────────────────────────────
function HostPublisher({ videoRef }: { videoRef: React.RefObject<HTMLVideoElement | null> }) {
  const room = useRoomContext()

  const s = useRef({
    videoTrack: null as LocalVideoTrack | null,
    audioTrack: null as LocalAudioTrack | null,
    ctx: null as AudioContext | null,
    dest: null as MediaStreamAudioDestinationNode | null,
    videoNode: null as MediaStreamAudioSourceNode | null,
    micNode: null as MediaStreamAudioSourceNode | null,
  })

  // Creates AudioContext + ScreenShareAudio track lazily on first call (requires user gesture).
  const ensureAudio = useCallback(async () => {
    const st = s.current
    if (st.ctx && st.ctx.state !== 'closed' && st.audioTrack) return
    st.ctx?.close()
    const ctx = new AudioContext()
    await ctx.resume() // called inside user gesture — won't be suspended
    const dest = ctx.createMediaStreamDestination()
    st.ctx = ctx
    st.dest = dest
    if (st.audioTrack) {
      try { await room.localParticipant.unpublishTrack(st.audioTrack) } catch {}
      st.audioTrack = null
    }
    const la = new LocalAudioTrack(dest.stream.getAudioTracks()[0], { name: 'watch-audio' } as any)
    try {
      await room.localParticipant.publishTrack(la, { source: Track.Source.ScreenShareAudio })
      st.audioTrack = la
    } catch {}
  }, [room])

  // Called by toggleMic with the raw mic MediaStream.
  const connectMic = useCallback(async (stream: MediaStream) => {
    await ensureAudio()
    const st = s.current
    if (!st.ctx || !st.dest) return
    st.micNode?.disconnect()
    const src = st.ctx.createMediaStreamSource(stream)
    src.connect(st.dest)
    st.micNode = src
  }, [ensureAudio])

  const disconnectMic = useCallback(() => {
    s.current.micNode?.disconnect()
    s.current.micNode = null
  }, [])

  // Called on video loadedmetadata — publishes video + routes video audio into ScreenShareAudio.
  const publish = useCallback(async () => {
    const video = videoRef.current
    if (!video) return
    const st = s.current

    if (st.videoTrack) {
      try { await room.localParticipant.unpublishTrack(st.videoTrack) } catch {}
      st.videoTrack = null
    }
    st.videoNode?.disconnect()
    st.videoNode = null

    await ensureAudio()
    if (!st.ctx || !st.dest) return

    try {
      const stream: MediaStream = (video as any).captureStream()

      const rawVideo = stream.getVideoTracks()[0]
      if (rawVideo) {
        rawVideo.contentHint = 'detail'
        const lt = new LocalVideoTrack(rawVideo, { name: 'watch-video' } as any)
        await room.localParticipant.publishTrack(lt, {
          source: Track.Source.ScreenShare,
          videoCodec: 'h264',
          videoEncoding: { maxBitrate: 30_000_000, maxFramerate: 60 },
        })
        st.videoTrack = lt
      }

      if (stream.getAudioTracks().length > 0) {
        const videoSrc = st.ctx.createMediaStreamSource(stream)
        videoSrc.connect(st.dest)            // → viewers hear video audio
        videoSrc.connect(st.ctx.destination) // → host hears video locally
        st.videoNode = videoSrc
      }
    } catch (e) {
      console.error('publish failed', e)
    }
  }, [videoRef, room, ensureAudio])

  useEffect(() => {
    return () => {
      const st = s.current
      if (st.audioTrack) room.localParticipant.unpublishTrack(st.audioTrack).catch(() => {})
      if (st.videoTrack) room.localParticipant.unpublishTrack(st.videoTrack).catch(() => {})
      st.ctx?.close()
    }
  }, [room])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    ;(video as any).__watchPublish = publish
    ;(video as any).__watchConnectMic = connectMic
    ;(video as any).__watchDisconnectMic = disconnectMic
  }, [videoRef, publish, connectMic, disconnectMic])

  return null
}

// ── Member row with per-member timer ─────────────────────────────────────
function MemberRow({ p, canKick, onKick, isSpeaking }: { p: WatchParticipant; canKick?: boolean; onKick?: (id: string) => void; isSpeaking?: boolean }) {
  const elapsed = useElapsed(p.joinedAt)
  const hasBanner = (p.subPlan === 'GEEK' || p.subPlan === 'PRO') && Boolean(p.bannerUrl)
  return (
    <div className={cn(
      'group/watch-member relative flex min-h-7 items-center gap-2 overflow-hidden rounded-lg px-2 py-0.5',
      hasBanner && 'transition-shadow duration-300 ease-out hover:shadow-[0_10px_22px_rgba(0,0,0,0.22)]',
      'hover:bg-accent/40 transition-colors',
    )}>
      {hasBanner && (
        <>
          <motion.img
            src={p.bannerUrl ?? ''}
            alt=""
            aria-hidden="true"
            draggable={false}
            className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-0 transition-opacity duration-300 group-hover/watch-member:opacity-100"
            initial={false}
            whileHover={{ scale: 1.05 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
          />
          <span className="pointer-events-none absolute inset-0 bg-gradient-to-r from-sidebar/95 via-sidebar/58 to-sidebar/18 opacity-0 transition-opacity duration-300 group-hover/watch-member:opacity-100" />
          <span className="pointer-events-none absolute inset-y-0 left-0 w-16 bg-[linear-gradient(90deg,rgba(0,0,0,0.92)_0%,rgba(0,0,0,0.72)_34%,rgba(0,0,0,0.34)_68%,rgba(0,0,0,0)_100%)] opacity-0 shadow-[inset_18px_0_22px_rgba(0,0,0,0.86)] transition-opacity duration-300 group-hover/watch-member:opacity-100" />
        </>
      )}
      <div className={cn(
        'relative z-10 shrink-0 rounded-full transition-all duration-200',
        isSpeaking && 'ring-2 ring-green-500/80 ring-offset-1 ring-offset-sidebar',
      )}>
        <UserAvatar src={p.avatarUrl} alt={p.username} className="h-5 w-5 rounded-full" />
      </div>
      <span className={cn(
        'relative z-10 min-w-0 flex-1 truncate text-[11px] font-medium transition-colors duration-300',
        isSpeaking ? 'text-green-400' : 'text-muted-foreground',
        hasBanner && 'group-hover/watch-member:text-white',
      )}>
        {p.username}
      </span>
      {isSpeaking && <SoundWave active={true} />}
      {canKick && !p.isHost && (
        <motion.button
          whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.88 }}
          transition={{ type: 'spring', stiffness: 400, damping: 17 }}
          onClick={() => onKick?.(p.userId)}
          className="relative z-10 shrink-0 flex h-5 w-5 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-opacity group-hover/watch-member:opacity-100 hover:text-destructive"
          title={`Kick ${p.username}`}
        >
          <UserMinus className="h-3 w-3" />
        </motion.button>
      )}
    </div>
  )
}

// ── Main inner component ──────────────────────────────────────────────────
interface WatchRoomInnerProps {
  roomId: string
  userId: string
  username: string
  isHost: boolean
  participants: WatchParticipant[]
  syncing: boolean
  videoRef: React.RefObject<HTMLVideoElement | null>
  ended: boolean
  sessionStartedAt: number | null
  emitPlay: () => void
  emitPause: () => void
  emitSeek: (t: number) => void
  emitReaction: (type: string) => void
  liveReactions: { id: string; type: string; left: number }[]
  onRemoveReaction: (id: string) => void
  isPip?: boolean
  onMaximize?: () => void
  onLeave: () => void
  onEnd: () => void
  onKick: (userId: string) => void
  onSpeakingChange: (speakingIds: Set<string>) => void
}

function WatchRoomInner({
  roomId, userId, isHost, participants, syncing, videoRef, ended, sessionStartedAt,
  emitPlay, emitPause, emitSeek, emitReaction, liveReactions, onRemoveReaction,
  isPip, onMaximize, onLeave, onEnd, onKick, onSpeakingChange,
}: WatchRoomInnerProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const objectUrlRef = useRef<string | null>(null)

  const [fileLoaded, setFileLoaded] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [muted, setMuted] = useState(false)
  const [volume, setVolume] = useState(1)
  const [progress, setProgress] = useState(0)
  const [duration, setDuration] = useState(0)
  const [dragging, setDragging] = useState(false)
  const [controlsVisible, setControlsVisible] = useState(false)
  const [flashIcon, setFlashIcon] = useState<'play' | 'pause' | null>(null)
  const [flashSeek, setFlashSeek] = useState<'back' | 'forward' | null>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [watchersOpen, setWatchersOpen] = useState(false)
  const [speakingUserIds, setSpeakingUserIds] = useState<Set<string>>(new Set())
  const onSpeakingChangeRef = useRef(onSpeakingChange)
  useEffect(() => { onSpeakingChangeRef.current = onSpeakingChange })
  useEffect(() => { onSpeakingChangeRef.current(speakingUserIds) }, [speakingUserIds])
  const [micEnabled, setMicEnabled] = useState(false)
  const micStreamRef = useRef<MediaStream | null>(null)
  const micAnalyserCtxRef = useRef<AudioContext | null>(null)
  const micRafRef = useRef<number | null>(null)

  const room = useRoomContext()

  const stopMicAnalyser = useCallback(() => {
    if (micRafRef.current) { cancelAnimationFrame(micRafRef.current); micRafRef.current = null }
    micAnalyserCtxRef.current?.close()
    micAnalyserCtxRef.current = null
  }, [])

  const startMicAnalyser = useCallback((stream: MediaStream) => {
    stopMicAnalyser()
    const ctx = new AudioContext()
    micAnalyserCtxRef.current = ctx
    const analyser = ctx.createAnalyser()
    analyser.fftSize = 512
    ctx.createMediaStreamSource(stream).connect(analyser)
    const buf = new Uint8Array(analyser.frequencyBinCount)
    const tick = () => {
      analyser.getByteFrequencyData(buf)
      const avg = buf.reduce((a, b) => a + b, 0) / buf.length
      setSpeakingUserIds(prev => {
        const speaking = avg > 8
        const has = prev.has(userId)
        if (speaking === has) return prev
        const next = new Set(prev)
        speaking ? next.add(userId) : next.delete(userId)
        return next
      })
      micRafRef.current = requestAnimationFrame(tick)
    }
    ctx.resume().then(() => { micRafRef.current = requestAnimationFrame(tick) })
  }, [stopMicAnalyser, userId])

  useEffect(() => {
    return () => {
      micStreamRef.current?.getTracks().forEach(t => t.stop())
      stopMicAnalyser()
    }
  }, [stopMicAnalyser])

  const toggleMic = useCallback(async () => {
    if (isHost) {
      if (!micEnabled) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
          micStreamRef.current = stream
          await (videoRef.current as any)?.__watchConnectMic?.(stream)
          startMicAnalyser(stream)
          setMicEnabled(true)
        } catch { /* mic denied */ }
      } else {
        ;(videoRef.current as any)?.__watchDisconnectMic?.()
        micStreamRef.current?.getTracks().forEach(t => t.stop())
        micStreamRef.current = null
        stopMicAnalyser()
        setSpeakingUserIds(prev => { const next = new Set(prev); next.delete(userId); return next })
        setMicEnabled(false)
      }
    } else {
      const next = !micEnabled
      await room.localParticipant.setMicrophoneEnabled(next)
      setMicEnabled(next)
    }
  }, [room, micEnabled, isHost, userId, videoRef, startMicAnalyser, stopMicAnalyser])

  useEffect(() => {
    const onActiveSpeakers = (speakers: Participant[]) => {
      setSpeakingUserIds(prev => {
        const next = new Set(speakers.map((s) => s.identity.split('__')[0]))
        // Host speaking is tracked by local analyser — don't let LiveKit clobber it
        if (isHost && prev.has(userId)) next.add(userId)
        return next
      })
    }
    const onLocalSpeaking = (speaking: boolean) => {
      if (isHost) return
      setSpeakingUserIds(prev => {
        const has = prev.has(userId)
        if (speaking === has) return prev
        const next = new Set(prev)
        speaking ? next.add(userId) : next.delete(userId)
        return next
      })
    }
    room.on(RoomEvent.ActiveSpeakersChanged, onActiveSpeakers)
    room.localParticipant.on('isSpeakingChanged', onLocalSpeaking)
    return () => {
      room.off(RoomEvent.ActiveSpeakersChanged, onActiveSpeakers)
      room.localParticipant.off('isSpeakingChanged', onLocalSpeaking)
    }
  }, [room, userId, isHost])

  // Check for saved video position from a previous page reload
  const savedVideoPositionKey = `twiky-watch-video-pos-${roomId}`
  const savedVideoPos = useRef<{ currentTime: number } | null>(
    typeof window !== 'undefined'
      ? (() => { const r = sessionStorage.getItem(savedVideoPositionKey); try { return r ? JSON.parse(r) : null } catch { return null } })()
      : null
  )

  // Save video position before page unload so host can resume after reload
  useEffect(() => {
    if (!isHost) return
    const onUnload = () => {
      if (videoRef.current && fileLoaded) {
        sessionStorage.setItem(savedVideoPositionKey, JSON.stringify({ currentTime: videoRef.current.currentTime }))
      }
    }
    window.addEventListener('beforeunload', onUnload)
    return () => window.removeEventListener('beforeunload', onUnload)
  }, [isHost, fileLoaded, videoRef, savedVideoPositionKey])

  const sessionTimer = useElapsed(sessionStartedAt ?? 0)


  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current)
    const url = URL.createObjectURL(file)
    objectUrlRef.current = url
    setFileLoaded(true)
    setPlaying(false)
    const video = videoRef.current
    if (video) {
      video.src = url
      video.load()
      // Restore position if file was reloaded after a page reload
      const saved = savedVideoPos.current
      if (saved?.currentTime) {
        video.addEventListener('loadedmetadata', () => {
          video.currentTime = saved.currentTime
          setProgress(saved.currentTime)
          savedVideoPos.current = null
          sessionStorage.removeItem(savedVideoPositionKey)
        }, { once: true })
      } else {
        setProgress(0)
        setDuration(0)
      }
    }
  }, [videoRef, savedVideoPositionKey])

  const handlePlayPause = useCallback(() => {
    const video = videoRef.current
    if (!video) return
    if (video.paused) {
      video.play(); setPlaying(true); emitPlay()
      setFlashIcon('play')
    } else {
      video.pause(); setPlaying(false); emitPause()
      setFlashIcon('pause')
    }
    setTimeout(() => setFlashIcon(null), 600)
  }, [videoRef, emitPlay, emitPause])

  const skip = useCallback((sec: number) => {
    const video = videoRef.current
    if (!video) return
    const t = Math.max(0, Math.min(video.duration || 0, video.currentTime + sec))
    video.currentTime = t
    setProgress(t)
    emitSeek(t)
    setFlashSeek(sec < 0 ? 'back' : 'forward')
    setTimeout(() => setFlashSeek(null), 600)
  }, [videoRef, emitSeek])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setIsFullscreen(false); return }
      if (!isHost || !fileLoaded) return
      if (e.target instanceof HTMLInputElement) return
      if (e.key === 'ArrowLeft') { e.preventDefault(); skip(-10) }
      if (e.key === 'ArrowRight') { e.preventDefault(); skip(10) }
      if (e.key === ' ') { e.preventDefault(); handlePlayPause() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isHost, fileLoaded, skip, handlePlayPause])

  const handleVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const v = Number(e.target.value)
    setVolume(v)
    if (videoRef.current) { videoRef.current.volume = v; videoRef.current.muted = v === 0; setMuted(v === 0) }
  }, [videoRef])

  if (ended && !isHost) {
    return (
      <motion.div
        className="flex min-w-0 flex-1 flex-col items-center justify-center gap-4 bg-background"
        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.18 }}
      >
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
          <Tv2 className="h-6 w-6 text-muted-foreground" />
        </div>
        <p className="text-[13px] font-semibold text-foreground">Watch party ended</p>
        <p className="text-[11px] text-muted-foreground">The host ended the session</p>
        <button
          onClick={onLeave}
          className="mt-1 rounded-xl bg-primary px-5 py-2 text-[12px] font-semibold text-primary-foreground hover:bg-primary/90"
        >
          Leave
        </button>
      </motion.div>
    )
  }

  if (isPip) {
    return (
      <>
      <RoomAudioRenderer />
      <motion.div
        className="relative flex h-full w-full overflow-hidden bg-black group rounded-[inherit] cursor-pointer"
        onTap={onMaximize}
      >
        <QualityEnforcer />
        {isHost && <HostPublisher videoRef={videoRef} />}
        {isHost && fileLoaded ? (
          <video
            ref={videoRef}
            className="absolute inset-0 z-[1] h-full w-full object-contain pointer-events-none"
            onLoadedMetadata={(e) => {
              setDuration(e.currentTarget.duration)
              const fn = (videoRef.current as any)?.__watchPublish
              if (typeof fn === 'function') fn()
            }}
            onTimeUpdate={(e) => { if (!dragging) setProgress(e.currentTarget.currentTime) }}
            onDurationChange={(e) => setDuration(e.currentTarget.duration)}
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
            playsInline
          />
        ) : !isHost ? (
          <ViewerVideo />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-zinc-950">
            <div className="flex flex-col items-center gap-2 text-zinc-500">
              <Tv2 className="h-6 w-6 opacity-50" />
              <span className="text-[10px] font-medium tracking-wide uppercase">Waiting for host</span>
            </div>
          </div>
        )}

        <div className="absolute inset-0 z-50 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-3 transition-opacity">
          <Button variant="secondary" size="icon" className="h-9 w-9 rounded-full bg-white/10 hover:bg-white/20 border-0" onClick={(e) => { e.stopPropagation(); onMaximize?.(); }} title="Maximize">
            <Maximize2 className="h-4 w-4 text-white" />
          </Button>
          <Button variant="secondary" size="icon" className="h-9 w-9 rounded-full bg-red-500/20 hover:bg-red-500/40 border-0" onClick={(e) => { e.stopPropagation(); isHost ? onEnd() : onLeave() }} title={isHost ? 'End watch party' : 'Leave'}>
            <X className="h-4 w-4 text-red-500" />
          </Button>
        </div>
      </motion.div>
      </>
    )
  }

  return (
    <>
    <RoomAudioRenderer />
    <motion.div
      className={cn(
        'flex overflow-hidden bg-background',
        isFullscreen ? 'fixed inset-0 z-[100]' : 'w-full h-full min-w-0 flex-1',
      )}
      initial={{ opacity: 0, y: 8, scale: 0.995 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.18, ease: 'easeOut' }}
    >
      <input ref={fileInputRef} type="file" accept="video/*" className="hidden" onChange={handleFileChange} />

      {isHost && <HostPublisher videoRef={videoRef} />}

      {/* Main area */}
      <div
        className="relative flex min-w-0 flex-1 flex-col overflow-hidden"
        onMouseEnter={() => setControlsVisible(true)}
        onMouseLeave={() => setControlsVisible(false)}
        onClick={(e) => {
          if (!isHost || !fileLoaded) return
          if ((e.target as HTMLElement).closest('button, input, a')) return
          handlePlayPause()
        }}
      >
        {/* video — always in DOM so captureStream works; visible only when host has file */}
        <video
          ref={videoRef}
          className={cn(
            'pointer-events-none',
            isHost && fileLoaded
              ? 'absolute inset-0 z-[1] h-full w-full bg-black object-contain'
              : 'absolute opacity-0',
          )}
          style={!(isHost && fileLoaded) ? { width: 1, height: 1 } : undefined}
          onLoadedMetadata={(e) => {
            setDuration(e.currentTarget.duration)
            const fn = (videoRef.current as any)?.__watchPublish
            if (typeof fn === 'function') fn()
          }}
          onTimeUpdate={(e) => { if (!dragging) setProgress(e.currentTarget.currentTime) }}
          onDurationChange={(e) => setDuration(e.currentTarget.duration)}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          playsInline
        />

        {/* Floating Reactions Overlay */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden z-10">
          {liveReactions.map((reaction) => (
            <FloatingReaction
              key={reaction.id}
              type={reaction.type}
              left={reaction.left}
              onComplete={() => onRemoveReaction(reaction.id)}
            />
          ))}
        </div>
        {/* Seek flash — left/right */}
        <AnimatePresence>
          {flashSeek && (
            <motion.div
              key={flashSeek}
              className={cn(
                'pointer-events-none absolute inset-y-0 z-30 flex w-1/3 items-center',
                flashSeek === 'back' ? 'left-0 justify-start pl-6' : 'right-0 justify-end pr-6',
              )}
              initial={{ opacity: 1 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.35 }}
            >
              <motion.div
                className="flex flex-col items-center gap-1"
                initial={{ scale: 0.7, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 1.2, opacity: 0 }}
                transition={{ duration: 0.25, ease: 'easeOut' }}
              >
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-black/50 backdrop-blur-sm">
                  {flashSeek === 'back'
                    ? <SkipBack className="h-7 w-7 fill-white text-white" />
                    : <SkipForward className="h-7 w-7 fill-white text-white" />
                  }
                </div>
                <span className="text-[11px] font-semibold text-white drop-shadow">10s</span>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Center play/pause flash */}
        <AnimatePresence>
          {flashIcon && (
            <motion.div
              key={flashIcon}
              className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center"
              initial={{ opacity: 1, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.3 }}
              transition={{ duration: 0.35, ease: 'easeOut' }}
            >
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-black/50 backdrop-blur-sm">
                {flashIcon === 'play'
                  ? <Play className="h-9 w-9 fill-white text-white" />
                  : <Pause className="h-9 w-9 fill-white text-white" />
                }
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Floating header */}
        <AnimatePresence>
          {controlsVisible && (
            <motion.div
              className="absolute top-0 left-0 right-0 z-20 flex h-12 items-center gap-2.5 bg-sidebar/90 px-4 backdrop-blur-xl border-b border-border/50 shadow-sm"
              initial={{ opacity: 0, y: -40 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -40 }}
              transition={{ type: 'spring', stiffness: 420, damping: 32, mass: 0.7 }}
            >
              <Popcorn className="h-4 w-4 shrink-0 text-primary" />
              <span className="text-[13px] font-semibold text-foreground">Watch Together</span>
              <motion.button
                onClick={() => setWatchersOpen((v) => !v)}
                whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.9 }}
                className={cn(
                  'ml-auto flex items-center gap-1.5 rounded-lg px-2 py-1 text-[11px] font-medium transition-colors',
                  watchersOpen ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                )}
              >
                <Users className="h-3.5 w-3.5" />
                {participants.length}
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Content */}
        <div className="flex flex-1 flex-col overflow-hidden p-4">
          {isHost ? (
            !fileLoaded ? (
              /* Host — no file yet */
              <motion.div
                className="flex flex-1 flex-col items-center justify-center gap-4"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.16 }}
              >
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
                  <FolderOpen className="h-6 w-6 text-muted-foreground" />
                </div>
                {savedVideoPos.current ? (
                  <>
                    <p className="text-[13px] font-semibold text-foreground">Video paused</p>
                    <p className="text-[11px] text-muted-foreground text-center max-w-[220px]">
                      Paused at <span className="font-semibold text-foreground">{formatTime(savedVideoPos.current.currentTime)}</span>. Reload the file to resume.
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-[13px] font-semibold text-foreground">No video loaded</p>
                    <p className="text-[11px] text-muted-foreground">Choose a file to start the watch party</p>
                  </>
                )}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="mt-1 rounded-xl bg-primary px-5 py-2 text-[12px] font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
                >
                  {savedVideoPos.current ? 'Reload video file' : 'Choose video file'}
                </button>
              </motion.div>
            ) : null /* video shown via absolute z-[1] above */
          ) : (
            /* Viewer */
            <div className="relative flex flex-1 overflow-hidden rounded-xl">
              <QualityEnforcer />
              <ViewerVideo />
              {syncing && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm rounded-xl">
                  <div className="flex items-center gap-2 rounded-xl bg-background/80 px-4 py-2.5">
                    <RefreshCw className="h-4 w-4 animate-spin text-primary" />
                    <span className="text-[12px] font-medium text-foreground">Syncing…</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Floating controls */}
        <AnimatePresence>
          {controlsVisible && (
            <motion.div
              className="absolute bottom-5 left-1/2 z-20 -translate-x-1/2"
              initial={{ opacity: 0, y: 20, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.96 }}
              transition={{ type: 'spring', stiffness: 420, damping: 32, mass: 0.7 }}
            >
              <div className="flex flex-col gap-2 rounded-2xl border border-border/50 bg-sidebar/90 px-4 py-2.5 shadow-[0_8px_40px_rgba(0,0,0,0.35)] backdrop-blur-xl">
                {/* seek bar */}
                {isHost && fileLoaded && (
                  <div className="flex items-center gap-2">
                    <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">{formatTime(progress)}</span>
                    <input
                      type="range" min={0} max={duration || 0} step={0.1} value={progress}
                      onChange={(e) => {
                        const t = Number(e.target.value)
                        setProgress(t)
                        if (videoRef.current) videoRef.current.currentTime = t
                        setDragging(true)
                      }}
                      onMouseUp={(e) => { emitSeek(Number((e.target as HTMLInputElement).value)); setDragging(false) }}
                      className="w-56 h-1 accent-primary cursor-pointer"
                    />
                    <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">{formatTime(duration)}</span>
                  </div>
                )}

                <div className="flex items-center gap-3">
                  {/* label + timer */}
                  <div className="flex shrink-0 items-center gap-1.5 pr-3 border-r border-border/40">
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                    <span className="text-[11px] font-medium text-muted-foreground">Watch</span>
                    <span className="font-mono text-[10px] tabular-nums" style={{ color: '#55FF55' }}>{sessionTimer}</span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {isHost ? (
                      <>
                        <WatchCtrlBtn title="Back 10s" onClick={() => skip(-10)} disabled={!fileLoaded}>
                          <SkipBack className="h-4 w-4" />
                        </WatchCtrlBtn>
                        <WatchCtrlBtn active={playing} title={playing ? 'Pause' : 'Play'} onClick={handlePlayPause} disabled={!fileLoaded}>
                          <AnimatePresence mode="wait" initial={false}>
                            <motion.span
                              key={playing ? 'pause' : 'play'}
                              initial={{ scale: 0.4, opacity: 0, rotate: -20 }}
                              animate={{ scale: 1, opacity: 1, rotate: 0 }}
                              exit={{ scale: 0.4, opacity: 0, rotate: 20 }}
                              transition={{ duration: 0.13 }}
                            >
                              {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                            </motion.span>
                          </AnimatePresence>
                        </WatchCtrlBtn>
                        <WatchCtrlBtn title="Forward 10s" onClick={() => skip(10)} disabled={!fileLoaded}>
                          <SkipForward className="h-4 w-4" />
                        </WatchCtrlBtn>
                        <WatchCtrlBtn title={muted ? 'Unmute' : 'Mute'} onClick={() => {
                          if (!videoRef.current) return
                          videoRef.current.muted = !videoRef.current.muted
                          setMuted(videoRef.current.muted)
                        }} disabled={!fileLoaded}>
                          {muted || volume === 0 ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                        </WatchCtrlBtn>
                        <input
                          type="range" min={0} max={1} step={0.02} value={muted ? 0 : volume}
                          onChange={handleVolumeChange}
                          className="w-16 h-1 accent-primary cursor-pointer"
                        />
                        <WatchCtrlBtn title="Choose file" onClick={() => fileInputRef.current?.click()}>
                          <FolderOpen className="h-4 w-4" />
                        </WatchCtrlBtn>
                      </>
                    ) : (
                      <div className="flex items-center gap-2 px-1">
                        {syncing ? (
                          <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                            <RefreshCw className="h-3.5 w-3.5 animate-spin" /> Syncing
                          </span>
                        ) : (
                          <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                            <Tv2 className="h-3.5 w-3.5 text-primary" /> Live
                          </span>
                        )}
                      </div>
                    )}

                  </div>

                  <div className="flex shrink-0 items-center gap-1.5 pl-3 border-l border-border/40">
                    <motion.button
                      title={micEnabled ? 'Mute mic' : 'Enable mic'}
                      whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.88 }}
                      transition={{ type: 'spring', stiffness: 400, damping: 17 }}
                      onClick={toggleMic}
                      className={cn(
                        'flex h-9 w-9 items-center justify-center rounded-xl border transition-colors',
                        micEnabled
                          ? 'border-primary/20 bg-primary/10 text-primary hover:bg-primary/20'
                          : 'border-border/60 bg-muted/40 text-muted-foreground hover:bg-accent hover:text-foreground',
                      )}
                    >
                      {micEnabled ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
                    </motion.button>
                    <motion.button
                      title="Fullscreen"
                      whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.88 }}
                      transition={{ type: 'spring', stiffness: 400, damping: 17 }}
                      onClick={() => setIsFullscreen((v) => !v)}
                      className="flex h-9 w-9 items-center justify-center rounded-xl border border-border/60 bg-muted/40 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                    >
                      <Scan className="h-4 w-4" />
                    </motion.button>
                    {/* Leave / End */}
                    {isHost ? (
                      <div className="flex items-center gap-1">
                        <motion.button
                          title="End watch party (kicks all)"
                          whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.9 }}
                          transition={{ type: 'spring', stiffness: 400, damping: 17 }}
                          onClick={onEnd}
                          className="flex h-9 items-center gap-1.5 rounded-xl bg-destructive/10 px-2.5 text-[11px] font-semibold text-destructive transition-colors hover:bg-destructive/20"
                        >
                          <X className="h-4 w-4" />
                          End
                        </motion.button>
                      </div>
                    ) : (
                      <motion.button
                        title="Leave watch party"
                        whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.9 }}
                        transition={{ type: 'spring', stiffness: 400, damping: 17 }}
                        onClick={onLeave}
                        className="flex h-9 w-9 items-center justify-center rounded-xl bg-destructive/10 text-destructive transition-colors hover:bg-destructive/20"
                      >
                        <X className="h-4 w-4" />
                      </motion.button>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Floating Reactions Trigger Bar */}
        <AnimatePresence>
          {controlsVisible && !isPip && (
            <motion.div
              className="absolute bottom-24 right-6 z-20 flex flex-col gap-2 rounded-2xl border border-border/50 bg-sidebar/95 p-2 shadow-2xl backdrop-blur-xl"
              initial={{ opacity: 0, x: 20, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 20, scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 420, damping: 32 }}
            >
              {REACTIONS.map(({ type, icon: Icon, color, fill, hoverBg }) => (
                <motion.button
                  key={type}
                  onClick={() => emitReaction(type)}
                  whileHover={{ scale: 1.15 }}
                  whileTap={{ scale: 0.85 }}
                  className={cn("flex h-9 w-9 items-center justify-center rounded-xl transition-all", color, hoverBg)}
                >
                  <Icon className="h-5 w-5" fill={fill} />
                </motion.button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Participants sidebar */}
      <AnimatePresence initial={false}>
        {watchersOpen && (
          <motion.div
            key="watchers-sidebar"
            className="flex w-52 shrink-0 flex-col overflow-hidden border-l border-border/50 bg-sidebar"
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 208, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 420, damping: 36, mass: 0.7 }}
          >
            <div className="flex h-10 shrink-0 items-center gap-1.5 border-b border-border/50 px-3">
              <Users className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Watching</span>
              <span className="ml-auto text-[10px] text-muted-foreground">{participants.length}</span>
            </div>
            <div className="flex flex-col gap-0.5 overflow-y-auto p-2">
              {participants.map((p) => (
                <MemberRow
                  key={p.userId}
                  p={p}
                  canKick={isHost}
                  onKick={onKick}
                  isSpeaking={speakingUserIds.has(p.userId)}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </motion.div>
    </>
  )
}

// ── Public entry ──────────────────────────────────────────────────────────
export type { WatchParticipant }

interface WatchRoomViewProps {
  roomId: string
  userId: string
  username: string
  fullname?: string | null
  avatarUrl?: string | null
  bannerUrl?: string | null
  subPlan?: string | null
  isVerified?: boolean | null
  isHost: boolean
  isPip?: boolean
  onMaximize?: () => void
  onLeave: () => void
  onParticipantsChange?: (participants: WatchParticipant[]) => void
}

export function WatchRoomView({ roomId, userId, username, fullname, avatarUrl, bannerUrl, subPlan, isVerified, isHost, isPip, onMaximize, onLeave, onParticipantsChange }: WatchRoomViewProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const participantIdentity = `${userId}__${username}`
  const [ended, setEnded] = useState(false)
  const [liveReactions, setLiveReactions] = useState<{ id: string; type: string; left: number }[]>([])

  const addLocalReaction = useCallback((reactionType: string) => {
    // Spawn floaters randomly across bottom-center/bottom-right of player
    const randomLeft = 40 + Math.random() * 45
    setLiveReactions((prev) => [
      ...prev,
      { id: Math.random().toString(), type: reactionType, left: randomLeft },
    ])
  }, [])

  const { token, loading, error } = useLiveKitToken(roomId, participantIdentity)
  const { participants, syncing, sessionStartedAt, emitPlay, emitPause, emitSeek, emitEnd, emitKick, emitReaction } = useWatchRoom({
    roomId, userId, username, fullname, avatarUrl, bannerUrl, subPlan, isVerified, isHost, videoRef,
    onEnded: () => setEnded(true),
    onKicked: () => {
      toast.error('You were removed from the watch party')
      onLeave()
    },
    onReaction: (reactionType, senderUserId) => {
      if (senderUserId !== userId) {
        addLocalReaction(reactionType)
      }
    },
  })

  // Auto-leave when host ends the party (viewers don't need to click anything)
  useEffect(() => {
    if (ended && !isHost) {
      const t = setTimeout(onLeave, 1500)
      return () => clearTimeout(t)
    }
  }, [ended, isHost, onLeave])

  const [speakingIds, setSpeakingIds] = useState<Set<string>>(new Set())

  // Merge socket participants with local speaking state before propagating up
  const onParticipantsChangeRef = useRef(onParticipantsChange)
  useEffect(() => { onParticipantsChangeRef.current = onParticipantsChange })
  useEffect(() => {
    const enriched = participants.map(p => ({ ...p, isSpeaking: speakingIds.has(p.userId) }))
    onParticipantsChangeRef.current?.(enriched)
  }, [participants, speakingIds])

  const handleEnd = useCallback(async () => {
    await emitEnd()
    onLeave()
  }, [emitEnd, onLeave])

  const handleSendReaction = useCallback(async (type: string) => {
    addLocalReaction(type)
    await emitReaction(type)
  }, [addLocalReaction, emitReaction])

  const handleRemoveReaction = useCallback((id: string) => {
    setLiveReactions((prev) => prev.filter((r) => r.id !== id))
  }, [])

  if (loading) {
    return (
      <div className="flex min-w-0 flex-1 flex-col items-center justify-center gap-3 bg-background">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
        <p className="text-[13px] font-semibold text-foreground">Connecting…</p>
      </div>
    )
  }

  if (error || !token) {
    return (
      <div className="flex min-w-0 flex-1 flex-col items-center justify-center gap-3 bg-background text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/10">
          <WifiOff className="h-6 w-6 text-destructive" />
        </div>
        <p className="text-[13px] font-semibold text-foreground">Could not connect</p>
        <p className="text-[11px] text-muted-foreground">{error ?? 'Failed to get room token'}</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-1 rounded-xl bg-primary px-4 py-2 text-[12px] font-semibold text-primary-foreground hover:bg-primary/90"
        >
          Retry
        </button>
      </div>
    )
  }

  return (
    <LiveKitRoom
      serverUrl={LIVEKIT_URL} token={token} connect={true} video={false} audio={false}
      options={{ dynacast: false, adaptiveStream: false }}
      className="w-full h-full min-w-0 flex-1 flex overflow-hidden"
    >
      <WatchRoomInner
        roomId={roomId} userId={userId} username={username} isHost={isHost}
        participants={participants} syncing={syncing} videoRef={videoRef}
        ended={ended} sessionStartedAt={sessionStartedAt}
        emitPlay={emitPlay} emitPause={emitPause} emitSeek={emitSeek}
        emitReaction={handleSendReaction} liveReactions={liveReactions}
        onRemoveReaction={handleRemoveReaction}
        isPip={isPip} onMaximize={onMaximize}
        onLeave={onLeave} onEnd={handleEnd} onKick={emitKick}
        onSpeakingChange={setSpeakingIds}
      />
    </LiveKitRoom>
  )
}
