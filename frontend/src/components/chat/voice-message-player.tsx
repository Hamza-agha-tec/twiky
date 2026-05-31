'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Pause, Play } from 'lucide-react'
import { cn } from '@/lib/utils'

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
  const total = Math.floor(seconds)
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

function hashSeed(input: string) {
  let h = 2166136261
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function buildWaveform(seed: string, bars: number) {
  const base = hashSeed(seed)
  const heights: number[] = []
  let x = base || 1
  for (let i = 0; i < bars; i++) {
    x ^= x << 13
    x ^= x >>> 17
    x ^= x << 5
    const v = (x >>> 0) / 0xffffffff
    const shaped = 0.25 + Math.pow(v, 0.4) * 0.6
    heights.push(shaped)
  }
  return heights
}

export function VoiceMessagePlayer({
  src,
  durationSeconds,
  className,
}: {
  src: string
  durationSeconds?: number | null
  className?: string
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const rafRef = useRef<number | null>(null)

  const [ready, setReady] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState<number>(durationSeconds ?? 0)
  const [playbackRate, setPlaybackRate] = useState(1)

  const bars = 28
  const waveform = useMemo(() => buildWaveform(src, bars), [src])
  const progress = duration > 0 ? Math.min(1, Math.max(0, currentTime / duration)) : 0

  useEffect(() => {
    const audio = new Audio(src)
    audio.preload = 'metadata'
    audio.playbackRate = playbackRate
    audioRef.current = audio

    const onLoaded = () => {
      setReady(true)
      if (Number.isFinite(audio.duration) && audio.duration > 0) setDuration(audio.duration)
    }
    const onEnded = () => {
      setPlaying(false)
      setCurrentTime(0)
    }

    audio.addEventListener('loadedmetadata', onLoaded)
    audio.addEventListener('ended', onEnded)

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      audio.pause()
      audio.removeEventListener('loadedmetadata', onLoaded)
      audio.removeEventListener('ended', onEnded)
      audioRef.current = null
    }
  }, [src])

  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = playbackRate
  }, [playbackRate])

  function tick() {
    if (!audioRef.current) return
    setCurrentTime(audioRef.current.currentTime || 0)
    rafRef.current = requestAnimationFrame(tick)
  }

  async function togglePlay() {
    const audio = audioRef.current
    if (!audio || !ready) return
    if (playing) {
      audio.pause()
      setPlaying(false)
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      return
    }
    try {
      await audio.play()
      setPlaying(true)
      rafRef.current = requestAnimationFrame(tick)
    } catch {}
  }

  function seekTo(clientX: number, target: HTMLElement) {
    const audio = audioRef.current
    if (!audio || duration <= 0) return
    const rect = target.getBoundingClientRect()
    const next = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width))
    audio.currentTime = next * duration
    setCurrentTime(audio.currentTime)
  }

  return (
    <div
      className={cn(
        'flex w-full max-w-[230px] items-center gap-3 rounded-2xl border border-gray-100 bg-white p-2 shadow-sm transition-all hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900',
        className
      )}
    >
      {/* PART 1: PLAY/PAUSE */}
      <button
        type="button"
        onClick={() => void togglePlay()}
        className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-zinc-100 text-zinc-700 transition-colors hover:bg-zinc-200 active:scale-95 dark:bg-white/8 dark:text-zinc-300"
        disabled={!ready}
      >
        {playing ? (
          <Pause size={16} fill="currentColor" />
        ) : (
          <Play size={16} fill="currentColor" className="ml-0.5" />
        )}
      </button>

      {/* PART 2: WAVE & DURATION */}
      <div className="flex flex-1 flex-col gap-1 min-w-0">
        <div
          role="slider"
          onClick={(e) => seekTo(e.clientX, e.currentTarget)}
          className="flex h-5 w-full cursor-pointer items-center justify-start gap-[2px]"
        >
          {waveform.map((h, idx) => {
            const barProgress = idx / waveform.length
            const active = barProgress <= progress
            return (
              <div
                key={idx}
                className={cn(
                  'w-[2px] rounded-full transition-all duration-300',
                  active ? 'bg-white dark:bg-zinc-200' : 'bg-gray-200 dark:bg-zinc-700'
                )}
                style={{ height: `${Math.max(25, h * 100)}%` }}
              />
            )
          })}
        </div>
        <div className="flex items-center gap-1 text-[10px] font-medium tabular-nums text-gray-400 dark:text-zinc-500">
          <span className={cn(currentTime > 0 && "text-zinc-200")}>
            {formatTime(currentTime)}
          </span>
          <span>/</span>
          <span>{formatTime(duration || durationSeconds || 0)}</span>
        </div>
      </div>

      {/* PART 3: SPEED */}
      <button
        type="button"
        onClick={() => setPlaybackRate((r) => (r === 1 ? 1.5 : r === 1.5 ? 2 : 1))}
        className="flex h-8 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-gray-50 text-[10px] font-bold text-gray-500 transition-colors hover:bg-gray-100 hover:text-zinc-900 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
      >
        {playbackRate}x
      </button>
    </div>
  )
}