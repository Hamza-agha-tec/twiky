'use client'

import { useRef, useState, useCallback, useEffect } from 'react'
import { Play, Pause, Volume2, VolumeX, Maximize2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface VideoPlayerProps {
  src: string
  className?: string
}

function formatTime(s: number) {
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${sec.toString().padStart(2, '0')}`
}

export function VideoPlayer({ src, className }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [muted, setMuted] = useState(false)
  const [showControls, setShowControls] = useState(true)
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const resetHideTimer = useCallback(() => {
    setShowControls(true)
    if (hideTimer.current) clearTimeout(hideTimer.current)
    hideTimer.current = setTimeout(() => {
      if (playing) setShowControls(false)
    }, 2500)
  }, [playing])

  useEffect(() => {
    if (!playing) {
      setShowControls(true)
      if (hideTimer.current) clearTimeout(hideTimer.current)
    }
  }, [playing])

  useEffect(() => () => { if (hideTimer.current) clearTimeout(hideTimer.current) }, [])

  const togglePlay = () => {
    const v = videoRef.current
    if (!v) return
    if (v.paused) { v.play(); setPlaying(true) }
    else { v.pause(); setPlaying(false) }
    resetHideTimer()
  }

  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation()
    const v = videoRef.current
    if (!v) return
    v.muted = !v.muted
    setMuted(v.muted)
    resetHideTimer()
  }

  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation()
    const v = videoRef.current
    if (!v || !duration) return
    const rect = e.currentTarget.getBoundingClientRect()
    const ratio = (e.clientX - rect.left) / rect.width
    v.currentTime = ratio * duration
    resetHideTimer()
  }

  const fullscreen = (e: React.MouseEvent) => {
    e.stopPropagation()
    videoRef.current?.requestFullscreen()
  }

  const progress = duration ? (currentTime / duration) * 100 : 0

  return (
    <div
      className={cn('relative overflow-hidden rounded-xl bg-black select-none', className)}
      onMouseMove={resetHideTimer}
      onMouseEnter={resetHideTimer}
      onClick={togglePlay}
    >
      <video
        ref={videoRef}
        src={src}
        className="block w-full max-h-64 object-contain"
        preload="metadata"
        onTimeUpdate={e => setCurrentTime(e.currentTarget.currentTime)}
        onLoadedMetadata={e => {
          const v = e.currentTarget
          setDuration(v.duration)
          v.currentTime = 0.1
        }}
        onEnded={() => setPlaying(false)}
      />

      {/* Controls bar */}
      <div
        className={cn(
          'absolute bottom-0 left-0 right-0 flex items-center gap-2 px-3 py-2 transition-opacity duration-200',
          'bg-gradient-to-t from-black/80 to-transparent',
          showControls ? 'opacity-100' : 'opacity-0 pointer-events-none'
        )}
        onClick={e => e.stopPropagation()}
      >
        {/* Play / Pause */}
        <button
          onClick={togglePlay}
          className="text-white hover:text-white/80 transition-colors shrink-0"
        >
          {playing
            ? <Pause className="h-4 w-4 fill-white" />
            : <Play className="h-4 w-4 fill-white" />}
        </button>

        {/* Time */}
        <span className="text-white text-[11px] tabular-nums shrink-0">
          {formatTime(currentTime)} / {formatTime(duration)}
        </span>

        {/* Progress bar */}
        <div
          className="flex-1 h-1 rounded-full bg-white/30 cursor-pointer relative overflow-hidden"
          onClick={seek}
        >
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-blue-500 transition-none"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Volume */}
        <button
          onClick={toggleMute}
          className="text-white hover:text-white/80 transition-colors shrink-0"
        >
          {muted
            ? <VolumeX className="h-4 w-4" />
            : <Volume2 className="h-4 w-4" />}
        </button>

        {/* Fullscreen */}
        <button
          onClick={fullscreen}
          className="text-white hover:text-white/80 transition-colors shrink-0"
        >
          <Maximize2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
