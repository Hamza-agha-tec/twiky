'use client'

import { useRef, useState, useCallback, useEffect } from 'react'
import { useRoomContext } from '@livekit/components-react'
import { Track, LocalVideoTrack } from 'livekit-client'
import { FolderOpen, Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, Maximize2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface WatchHostControlsProps {
  videoRef: React.RefObject<HTMLVideoElement | null>
  onPlay: () => void
  onPause: () => void
  onSeek: (timestamp: number) => void
  className?: string
}

function formatTime(s: number) {
  if (!isFinite(s) || isNaN(s)) return '0:00'
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${sec.toString().padStart(2, '0')}`
}

export function WatchHostControls({ videoRef, onPlay, onPause, onSeek, className }: WatchHostControlsProps) {
  const room = useRoomContext()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const publishedTrackRef = useRef<LocalVideoTrack | null>(null)

  const [fileLoaded, setFileLoaded] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [muted, setMuted] = useState(false)
  const [volume, setVolume] = useState(1)
  const [progress, setProgress] = useState(0)
  const [duration, setDuration] = useState(0)
  const [dragging, setDragging] = useState(false)
  const [controlsVisible, setControlsVisible] = useState(true)
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const objectUrlRef = useRef<string | null>(null)

  // ── auto-hide controls ────────────────────────────────────────────────────
  const showControls = useCallback(() => {
    setControlsVisible(true)
    if (hideTimer.current) clearTimeout(hideTimer.current)
    hideTimer.current = setTimeout(() => {
      if (videoRef.current && !videoRef.current.paused) setControlsVisible(false)
    }, 3000)
  }, [videoRef])

  useEffect(() => () => { if (hideTimer.current) clearTimeout(hideTimer.current) }, [])

  // ── publish to LiveKit after video loads ─────────────────────────────────
  const publishTrack = useCallback(async () => {
    const video = videoRef.current
    if (!video || !room) return

    // unpublish previous track
    if (publishedTrackRef.current) {
      try { await room.localParticipant.unpublishTrack(publishedTrackRef.current) } catch {}
      publishedTrackRef.current = null
    }

    try {
      const stream: MediaStream = (video as any).captureStream(60)
      const rawTrack = stream.getVideoTracks()[0]
      if (!rawTrack) return
      const localTrack = new LocalVideoTrack(rawTrack, { name: 'watch-video' })
      await room.localParticipant.publishTrack(localTrack, {
        source: Track.Source.Camera,
        videoEncoding: { maxBitrate: 8_000_000, maxFramerate: 60 },
      })
      publishedTrackRef.current = localTrack
    } catch (e) {
      console.error('Failed to publish watch track:', e)
    }
  }, [videoRef, room])

  // ── file selection ────────────────────────────────────────────────────────
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
    // video element is always in DOM; set src directly
    const video = videoRef.current
    if (video) {
      video.src = url
      video.load()
    }
  }, [videoRef])

  const handlePlayPause = useCallback(() => {
    const video = videoRef.current
    if (!video) return
    if (video.paused) {
      video.play()
      setPlaying(true)
      onPlay()
    } else {
      video.pause()
      setPlaying(false)
      onPause()
    }
    showControls()
  }, [videoRef, onPlay, onPause, showControls])

  const handleProgressChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const video = videoRef.current
    if (!video) return
    const t = Number(e.target.value)
    video.currentTime = t
    setProgress(t)
  }, [videoRef])

  const handleProgressMouseUp = useCallback((e: React.MouseEvent<HTMLInputElement>) => {
    const t = Number((e.target as HTMLInputElement).value)
    onSeek(t)
    setDragging(false)
  }, [onSeek])

  const skip = useCallback((seconds: number) => {
    const video = videoRef.current
    if (!video) return
    const t = Math.max(0, Math.min(video.duration || 0, video.currentTime + seconds))
    video.currentTime = t
    setProgress(t)
    onSeek(t)
    showControls()
  }, [videoRef, onSeek, showControls])

  const handleVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const v = Number(e.target.value)
    setVolume(v)
    if (videoRef.current) {
      videoRef.current.volume = v
      videoRef.current.muted = v === 0
      setMuted(v === 0)
    }
  }, [videoRef])

  const handleMute = useCallback(() => {
    const video = videoRef.current
    if (!video) return
    video.muted = !video.muted
    setMuted(video.muted)
  }, [videoRef])

  const handleFullscreen = useCallback(() => {
    videoRef.current?.requestFullscreen?.()
  }, [videoRef])

  return (
    <div className={cn('relative flex flex-col overflow-hidden bg-black', className)}>
      <input ref={fileInputRef} type="file" accept="video/*" className="hidden" onChange={handleFileChange} />

      {/* video element — always in DOM so videoRef is always valid */}
      <video
        ref={videoRef as React.RefObject<HTMLVideoElement>}
        className={cn('h-full w-full object-contain', !fileLoaded && 'hidden')}
        onLoadedMetadata={() => publishTrack()}
        onTimeUpdate={(e) => !dragging && setProgress(e.currentTarget.currentTime)}
        onDurationChange={(e) => setDuration(e.currentTarget.duration)}
        onPlay={() => {
          setPlaying(true)
          hideTimer.current = setTimeout(() => setControlsVisible(false), 3000)
        }}
        onPause={() => {
          setPlaying(false)
          setControlsVisible(true)
          if (hideTimer.current) clearTimeout(hideTimer.current)
        }}
        playsInline
        onMouseMove={showControls}
      />

      {/* file picker (before file chosen) */}
      {!fileLoaded && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 backdrop-blur">
              <FolderOpen className="h-8 w-8 text-white/70" />
            </div>
            <p className="text-sm text-white/50">Choose a video file to share with your group</p>
            <Button
              variant="default"
              className="gap-2 bg-primary hover:bg-primary/90"
              onClick={() => fileInputRef.current?.click()}
            >
              <FolderOpen className="h-4 w-4" />
              Choose video file
            </Button>
          </div>
        </div>
      )}

      {/* overlay controls (after file chosen) */}
      {fileLoaded && (
        <div
          className="absolute inset-0 cursor-pointer"
          onClick={handlePlayPause}
          onMouseMove={showControls}
        >
          <div
            className={cn(
              'absolute inset-x-0 bottom-0 flex flex-col gap-1 bg-gradient-to-t from-black/80 to-transparent px-4 pb-4 pt-10 transition-opacity duration-300',
              controlsVisible ? 'opacity-100' : 'opacity-0 pointer-events-none',
            )}
            onClick={(e) => e.stopPropagation()}
          >
            {/* scrubber */}
            <div className="flex items-center gap-2">
              <span className="shrink-0 text-[11px] tabular-nums text-white/70">{formatTime(progress)}</span>
              <input
                type="range"
                min={0}
                max={duration || 0}
                step={0.1}
                value={progress}
                onChange={handleProgressChange}
                onMouseDown={() => setDragging(true)}
                onMouseUp={handleProgressMouseUp}
                className="flex-1 h-1 accent-primary cursor-pointer"
              />
              <span className="shrink-0 text-[11px] tabular-nums text-white/70">{formatTime(duration)}</span>
            </div>

            {/* buttons row */}
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="h-8 w-8 text-white hover:bg-white/10" onClick={() => skip(-10)}>
                <SkipBack className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full text-white hover:bg-white/10" onClick={handlePlayPause}>
                {playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-white hover:bg-white/10" onClick={() => skip(10)}>
                <SkipForward className="h-4 w-4" />
              </Button>

              <Button variant="ghost" size="icon" className="h-8 w-8 text-white hover:bg-white/10" onClick={handleMute}>
                {muted || volume === 0 ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
              </Button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.02}
                value={muted ? 0 : volume}
                onChange={handleVolumeChange}
                className="w-20 h-1 accent-primary cursor-pointer"
              />

              <div className="ml-auto flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1.5 px-2 text-[11px] text-white/70 hover:bg-white/10 hover:text-white"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <FolderOpen className="h-3.5 w-3.5" />
                  Change file
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-white hover:bg-white/10" onClick={handleFullscreen}>
                  <Maximize2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
