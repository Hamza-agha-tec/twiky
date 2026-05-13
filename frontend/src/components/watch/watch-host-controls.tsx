'use client'

import { useRef, useState, useCallback } from 'react'
import { FolderOpen, Play, Pause, SkipBack, SkipForward, Volume2, VolumeX } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface WatchHostControlsProps {
  videoRef: React.RefObject<HTMLVideoElement | null>
  onPlay: () => void
  onPause: () => void
  onSeek: (timestamp: number) => void
  className?: string
}

export function WatchHostControls({ videoRef, onPlay, onPause, onSeek, className }: WatchHostControlsProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [fileLoaded, setFileLoaded] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [muted, setMuted] = useState(false)
  const [progress, setProgress] = useState(0)
  const [duration, setDuration] = useState(0)
  const objectUrlRef = useRef<string | null>(null)

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !videoRef.current) return

    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current)
    const url = URL.createObjectURL(file)
    objectUrlRef.current = url
    videoRef.current.src = url
    videoRef.current.load()
    setFileLoaded(true)
    setPlaying(false)
    setProgress(0)
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
  }, [videoRef, onPlay, onPause])

  const handleSeek = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const video = videoRef.current
    if (!video) return
    const t = Number(e.target.value)
    video.currentTime = t
    setProgress(t)
    onSeek(t)
  }, [videoRef, onSeek])

  const skip = useCallback((seconds: number) => {
    const video = videoRef.current
    if (!video) return
    const t = Math.max(0, Math.min(video.duration, video.currentTime + seconds))
    video.currentTime = t
    setProgress(t)
    onSeek(t)
  }, [videoRef, onSeek])

  const handleMute = useCallback(() => {
    const video = videoRef.current
    if (!video) return
    video.muted = !video.muted
    setMuted(video.muted)
  }, [videoRef])

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60)
    const sec = Math.floor(s % 60)
    return `${m}:${sec.toString().padStart(2, '0')}`
  }

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      {/* file picker */}
      <input ref={fileInputRef} type="file" accept="video/*" className="hidden" onChange={handleFileChange} />
      <Button
        variant="outline"
        className="gap-2 w-full"
        onClick={() => fileInputRef.current?.click()}
      >
        <FolderOpen className="h-4 w-4" />
        {fileLoaded ? 'Change file' : 'Choose video file'}
      </Button>

      {fileLoaded && (
        <>
          {/* progress bar */}
          <input
            type="range"
            min={0}
            max={duration || 0}
            step={0.1}
            value={progress}
            onChange={handleSeek}
            onMouseUp={(e) => onSeek(Number((e.target as HTMLInputElement).value))}
            className="w-full accent-primary"
          />
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{formatTime(progress)}</span>
            <span>{formatTime(duration)}</span>
          </div>

          {/* controls row */}
          <div className="flex items-center justify-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => skip(-10)}>
              <SkipBack className="h-4 w-4" />
            </Button>
            <Button variant="default" size="icon" className="h-10 w-10 rounded-full" onClick={handlePlayPause}>
              {playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
            </Button>
            <Button variant="ghost" size="icon" onClick={() => skip(10)}>
              <SkipForward className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={handleMute}>
              {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </Button>
          </div>
        </>
      )}

      {/* hidden video element — host sees this, captureStream reads from it */}
      <video
        ref={videoRef as React.RefObject<HTMLVideoElement>}
        className="hidden"
        onTimeUpdate={(e) => setProgress(e.currentTarget.currentTime)}
        onDurationChange={(e) => setDuration(e.currentTarget.duration)}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        playsInline
      />
    </div>
  )
}
