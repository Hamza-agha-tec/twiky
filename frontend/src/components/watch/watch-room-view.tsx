'use client'

import { useRef, useState, useEffect, useCallback } from 'react'
import {
  LiveKitRoom,
  VideoTrack,
  useTracks,
  useRoomContext,
} from '@livekit/components-react'
import { Track, LocalVideoTrack } from 'livekit-client'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Play, Pause, SkipBack, SkipForward, Volume2, VolumeX,
  Scan, FolderOpen, Users, Crown, Loader2, WifiOff, Tv2,
  RefreshCw, X, UserMinus, ChevronDown,
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useLiveKitToken } from '@/hooks/use-livekit-token'
import { useWatchRoom, type WatchParticipant } from '@/hooks/use-watch-room'
import { UserAvatar } from '@/components/chat/user-avatar'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

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

// ── Viewer video (LiveKit track) ──────────────────────────────────────────
function ViewerVideo() {
  const tracks = useTracks([Track.Source.Camera], { onlySubscribed: true })
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
  const publishedRef = useRef<LocalVideoTrack | null>(null)

  const publish = useCallback(async () => {
    const video = videoRef.current
    if (!video) return
    if (publishedRef.current) {
      try { await room.localParticipant.unpublishTrack(publishedRef.current) } catch {}
      publishedRef.current = null
    }
    try {
      const stream: MediaStream = (video as any).captureStream(60)
      const raw = stream.getVideoTracks()[0]
      if (!raw) return
      const lt = new LocalVideoTrack(raw, { name: 'watch-video' })
      await room.localParticipant.publishTrack(lt, {
        source: Track.Source.Camera,
        videoEncoding: { maxBitrate: 15_000_000, maxFramerate: 60 },
        videoCodec: 'vp9',
        scalabilityMode: 'L3T3',
      })
      publishedRef.current = lt
    } catch (e) {
      console.error('publish failed', e)
    }
  }, [videoRef, room])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    ;(video as any).__watchPublish = publish
  }, [videoRef, publish])

  return null
}

// ── Member row with per-member timer ─────────────────────────────────────
function MemberRow({ p }: { p: WatchParticipant }) {
  const elapsed = useElapsed(p.joinedAt)
  return (
    <div className="flex items-center gap-3 rounded-xl px-3 py-2.5 hover:bg-muted/50 transition-colors">
      <div className="relative shrink-0">
        <UserAvatar src={p.avatarUrl} alt={p.username} className="h-8 w-8 rounded-full" />
        {p.isHost && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 ring-2 ring-background">
            <Crown className="h-2 w-2 text-white" />
          </span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[12px] font-semibold text-foreground">{p.username}</p>
        {p.isHost
          ? <p className="text-[10px] text-amber-500">Host</p>
          : <p className="text-[10px] text-muted-foreground">{elapsed}</p>
        }
      </div>
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
  onLeave: () => void
  onEnd: () => void
  onKick: (userId: string) => void
}

function WatchRoomInner({
  isHost, participants, syncing, videoRef, ended, sessionStartedAt,
  emitPlay, emitPause, emitSeek, onLeave, onEnd, onKick,
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
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [watchersOpen, setWatchersOpen] = useState(false)

  const sessionTimer = useElapsed(sessionStartedAt ?? 0)

  useEffect(() => {
    if (!isFullscreen) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setIsFullscreen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isFullscreen])

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current)
    const url = URL.createObjectURL(file)
    objectUrlRef.current = url
    setFileLoaded(true)
    setPlaying(false)
    setProgress(0)
    setDuration(0)
    const video = videoRef.current
    if (video) { video.src = url; video.load() }
  }, [videoRef])

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
  }, [videoRef, emitSeek])

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

  return (
    <motion.div
      className={cn(
        'flex overflow-hidden bg-background',
        isFullscreen ? 'fixed inset-0 z-[100]' : 'min-w-0 flex-1',
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
          // host click on video area = toggle play/pause (ignore clicks on controls)
          if (!isHost || !fileLoaded) return
          if ((e.target as HTMLElement).closest('[data-controls]')) return
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
              data-controls className="absolute top-0 left-0 right-0 z-20 flex h-12 items-center gap-2.5 bg-sidebar/90 px-4 backdrop-blur-xl border-b border-border/50 shadow-sm"
              initial={{ opacity: 0, y: -40 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -40 }}
              transition={{ type: 'spring', stiffness: 420, damping: 32, mass: 0.7 }}
            >
              <Tv2 className="h-4 w-4 shrink-0 text-primary" />
              <span className="text-[13px] font-semibold text-foreground">Watch Together</span>
              {isHost && (
                <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-500 ring-1 ring-amber-500/30">
                  Host
                </span>
              )}
              <span className="ml-auto text-[11px] text-muted-foreground">
                {participants.length} watching
              </span>
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
                <p className="text-[13px] font-semibold text-foreground">No video loaded</p>
                <p className="text-[11px] text-muted-foreground">Choose a file to start the watch party</p>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="mt-1 rounded-xl bg-primary px-5 py-2 text-[12px] font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
                >
                  Choose video file
                </button>
              </motion.div>
            ) : null /* video shown via absolute z-[1] above */
          ) : (
            /* Viewer */
            <div className="relative flex flex-1 overflow-hidden rounded-xl">
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
              <div data-controls className="flex flex-col gap-2 rounded-2xl border border-border/50 bg-sidebar/90 px-4 py-2.5 shadow-[0_8px_40px_rgba(0,0,0,0.35)] backdrop-blur-xl">
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

                    <WatchCtrlBtn active={watchersOpen} title="Watchers" onClick={() => setWatchersOpen((v) => !v)}>
                      <span className="relative">
                        <Users className="h-4 w-4" />
                        {participants.length > 0 && (
                          <span className="absolute -right-1 -top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-primary text-[8px] font-bold text-primary-foreground">
                            {participants.length}
                          </span>
                        )}
                      </span>
                    </WatchCtrlBtn>
                  </div>

                  <div className="flex shrink-0 items-center gap-1.5 pl-3 border-l border-border/40">
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
                        {/* Kick individual — dropdown of non-host participants */}
                        {participants.filter(p => !p.isHost).length > 0 && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <motion.button
                                title="Kick viewer"
                                whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.9 }}
                                transition={{ type: 'spring', stiffness: 400, damping: 17 }}
                                className="flex h-9 items-center gap-1 rounded-xl bg-amber-500/10 px-2 text-amber-500 transition-colors hover:bg-amber-500/20"
                              >
                                <UserMinus className="h-4 w-4" />
                                <ChevronDown className="h-3 w-3" />
                              </motion.button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-44 bg-sidebar border-border">
                              {participants.filter(p => !p.isHost).map(p => (
                                <DropdownMenuItem
                                  key={p.userId}
                                  className="text-destructive focus:text-destructive"
                                  onClick={() => onKick(p.userId)}
                                >
                                  <UserMinus className="mr-2 h-3.5 w-3.5" />
                                  {p.username}
                                </DropdownMenuItem>
                              ))}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
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
      </div>

      {/* Watchers sidebar */}
      <AnimatePresence>
        {watchersOpen && (
          <motion.div
            key="watchers-sidebar"
            className="flex w-64 shrink-0 flex-col border-l border-border bg-background"
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 256, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: 'easeInOut' }}
          >
            <div className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-4">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Users className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-semibold text-foreground">Watching</p>
                <p className="truncate text-[11px] text-muted-foreground">
                  {participants.length} {participants.length === 1 ? 'person' : 'people'}
                </p>
              </div>
              <button
                onClick={() => setWatchersOpen(false)}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-2 py-3">
              {participants.length === 0 ? (
                <div className="flex flex-1 flex-col items-center justify-center gap-2 py-8 text-center">
                  <Users className="h-8 w-8 text-muted-foreground/40" />
                  <p className="text-[12px] font-semibold text-foreground">Nobody here yet</p>
                </div>
              ) : (
                participants.map((p) => <MemberRow key={p.userId} p={p} />)
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
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
  onLeave: () => void
  onParticipantsChange?: (participants: WatchParticipant[]) => void
}

export function WatchRoomView({ roomId, userId, username, fullname, avatarUrl, bannerUrl, subPlan, isVerified, isHost, onLeave, onParticipantsChange }: WatchRoomViewProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const participantIdentity = `${userId}__${username}`
  const [ended, setEnded] = useState(false)

  const { token, loading, error } = useLiveKitToken(roomId, participantIdentity)
  const { participants, syncing, sessionStartedAt, emitPlay, emitPause, emitSeek, emitEnd, emitKick } = useWatchRoom({
    roomId, userId, username, fullname, avatarUrl, bannerUrl, subPlan, isVerified, isHost, videoRef,
    onEnded: () => setEnded(true),
    onKicked: () => {
      toast.error('You were removed from the watch party')
      onLeave()
    },
  })

  // stable ref so the effect doesn't re-run (and loop) when the parent re-renders
  const onParticipantsChangeRef = useRef(onParticipantsChange)
  useEffect(() => { onParticipantsChangeRef.current = onParticipantsChange })
  useEffect(() => { onParticipantsChangeRef.current?.(participants) }, [participants])

  const handleEnd = useCallback(async () => {
    await emitEnd()
    onLeave()
  }, [emitEnd, onLeave])

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
      options={{ dynacast: false, videoCaptureDefaults: { resolution: { width: 1920, height: 1080, frameRate: 60 } } }}
      className="min-w-0 flex-1 flex overflow-hidden"
    >
      <WatchRoomInner
        roomId={roomId} userId={userId} username={username} isHost={isHost}
        participants={participants} syncing={syncing} videoRef={videoRef}
        ended={ended} sessionStartedAt={sessionStartedAt}
        emitPlay={emitPlay} emitPause={emitPause} emitSeek={emitSeek}
        onLeave={onLeave} onEnd={handleEnd} onKick={emitKick}
      />
    </LiveKitRoom>
  )
}
