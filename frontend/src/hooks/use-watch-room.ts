'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { getSocket } from '@/lib/socket'

export type WatchSyncEvent =
  | { type: 'play'; timestamp: number; serverNow: number }
  | { type: 'pause'; timestamp: number; serverNow: number }
  | { type: 'seek'; timestamp: number; serverNow: number }
  | { type: 'sync-response'; timestamp: number; paused: boolean; serverNow: number }

export type WatchParticipant = {
  userId: string
  username: string
  avatarUrl?: string | null
  isHost: boolean
}

type UseWatchRoomOptions = {
  roomId: string
  userId: string
  isHost: boolean
  videoRef: React.RefObject<HTMLVideoElement | null>
}

export function useWatchRoom({ roomId, userId, isHost, videoRef }: UseWatchRoomOptions) {
  const [participants, setParticipants] = useState<WatchParticipant[]>([])
  const [syncing, setSyncing] = useState(false)
  const suppressSync = useRef(false)

  // ── emit helpers ─────────────────────────────────────────────────────────
  const emitPlay = useCallback(async () => {
    if (!isHost) return
    const socket = await getSocket()
    socket.emit('watch:play', {
      roomId,
      timestamp: videoRef.current?.currentTime ?? 0,
      serverNow: Date.now(),
    })
  }, [isHost, roomId, videoRef])

  const emitPause = useCallback(async () => {
    if (!isHost) return
    const socket = await getSocket()
    socket.emit('watch:pause', {
      roomId,
      timestamp: videoRef.current?.currentTime ?? 0,
      serverNow: Date.now(),
    })
  }, [isHost, roomId, videoRef])

  const emitSeek = useCallback(async (timestamp: number) => {
    if (!isHost) return
    const socket = await getSocket()
    socket.emit('watch:seek', {
      roomId,
      timestamp,
      serverNow: Date.now(),
    })
  }, [isHost, roomId])

  // ── apply sync with latency compensation ─────────────────────────────────
  const applySync = useCallback((event: WatchSyncEvent) => {
    const video = videoRef.current
    if (!video || suppressSync.current) return

    const latency = (Date.now() - event.serverNow) / 2
    const targetTime = event.timestamp + latency / 1000

    suppressSync.current = true

    if (event.type === 'seek' || event.type === 'sync-response') {
      video.currentTime = targetTime
    }
    if (event.type === 'play' || (event.type === 'sync-response' && !event.paused)) {
      video.currentTime = targetTime
      video.play().catch(() => {})
    }
    if (event.type === 'pause' || (event.type === 'sync-response' && event.paused)) {
      video.currentTime = targetTime
      video.pause()
    }

    setTimeout(() => { suppressSync.current = false }, 300)
  }, [videoRef])

  // ── socket listeners ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!roomId || !userId) return
    let mounted = true
    let cleanup: (() => void) | null = null

    getSocket().then((socket) => {
      if (!mounted) return

      socket.emit('watch:join', { roomId, userId })

      const onPlay = (data: any) => applySync({ ...data, type: 'play' })
      const onPause = (data: any) => applySync({ ...data, type: 'pause' })
      const onSeek = (data: any) => applySync({ ...data, type: 'seek' })
      const onSyncResponse = (data: any) => {
        setSyncing(false)
        applySync({ ...data, type: 'sync-response' })
      }
      const onParticipants = (data: { participants: WatchParticipant[] }) => {
        if (mounted) setParticipants(data.participants)
      }
      const onSyncRequest = () => {
        if (!isHost || !videoRef.current) return
        const video = videoRef.current
        socket.emit('watch:sync-response', {
          roomId,
          timestamp: video.currentTime,
          paused: video.paused,
          serverNow: Date.now(),
        })
      }

      socket.on('watch:play', onPlay)
      socket.on('watch:pause', onPause)
      socket.on('watch:seek', onSeek)
      socket.on('watch:sync-response', onSyncResponse)
      socket.on('watch:participants', onParticipants)
      socket.on('watch:sync-request', onSyncRequest)

      // new viewer joining requests sync from host
      if (!isHost) {
        setSyncing(true)
        socket.emit('watch:sync-request', { roomId })
      }

      cleanup = () => {
        socket.off('watch:play', onPlay)
        socket.off('watch:pause', onPause)
        socket.off('watch:seek', onSeek)
        socket.off('watch:sync-response', onSyncResponse)
        socket.off('watch:participants', onParticipants)
        socket.off('watch:sync-request', onSyncRequest)
        socket.emit('watch:leave', { roomId, userId })
      }
    })

    return () => {
      mounted = false
      cleanup?.()
    }
  }, [roomId, userId, isHost, applySync, videoRef])

  return { participants, syncing, emitPlay, emitPause, emitSeek }
}
