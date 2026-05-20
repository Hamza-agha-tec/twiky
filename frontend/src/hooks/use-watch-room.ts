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
  fullname?: string | null
  avatarUrl?: string | null
  bannerUrl?: string | null
  subPlan?: 'FREE' | 'PRO' | 'GEEK' | string | null
  isVerified?: boolean | null
  isHost: boolean
  joinedAt: number
  isSpeaking?: boolean
}

type UseWatchRoomOptions = {
  roomId: string
  userId: string
  username: string
  fullname?: string | null
  avatarUrl?: string | null
  bannerUrl?: string | null
  subPlan?: string | null
  isVerified?: boolean | null
  isHost: boolean
  videoRef: React.RefObject<HTMLVideoElement | null>
  onEnded?: () => void
  onKicked?: () => void
  onReaction?: (reactionType: string, senderUserId: string) => void
}

export function useWatchRoom({ roomId, userId, username, fullname, avatarUrl, bannerUrl, subPlan, isVerified, isHost, videoRef, onEnded, onKicked, onReaction }: UseWatchRoomOptions) {
  const [participants, setParticipants] = useState<WatchParticipant[]>([])
  const [syncing, setSyncing] = useState(false)
  // Initialize from sessionStorage to avoid flash of 0 timer on reload
  const [sessionStartedAt, setSessionStartedAt] = useState<number | null>(() => {
    if (typeof window === 'undefined') return null
    const raw = sessionStorage.getItem(`twiky-watch-session-${roomId}`)
    if (raw) { try { return JSON.parse(raw).sessionStartedAt ?? null } catch {} }
    return null
  })
  const suppressSync = useRef(false)

  // Persist sessionStartedAt so timer survives page reload
  useEffect(() => {
    if (sessionStartedAt) {
      sessionStorage.setItem(`twiky-watch-session-${roomId}`, JSON.stringify({ sessionStartedAt }))
    } else {
      sessionStorage.removeItem(`twiky-watch-session-${roomId}`)
    }
  }, [sessionStartedAt, roomId])

  const onEndedRef = useRef(onEnded)
  useEffect(() => { onEndedRef.current = onEnded }, [onEnded])
  const onKickedRef = useRef(onKicked)
  useEffect(() => { onKickedRef.current = onKicked }, [onKicked])
  const onReactionRef = useRef(onReaction)
  useEffect(() => { onReactionRef.current = onReaction }, [onReaction])

  // ── emit helpers ─────────────────────────────────────────────────────────
  const emitPlay = useCallback(async () => {
    if (!isHost) return
    const socket = await getSocket()
    socket.emit('watch:play', {
      roomId,
      timestamp: videoRef.current?.currentTime ?? 0,
      serverNow: Date.now(),
    })
    // host records session start locally on first play (backend also sets it and broadcasts)
    setSessionStartedAt(prev => prev ?? Date.now())
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

  const emitEnd = useCallback(async () => {
    if (!isHost) return
    setParticipants([])
    setSessionStartedAt(null)
    const socket = await getSocket()
    socket.emit('watch:end', { roomId })
  }, [isHost, roomId])

  const emitKick = useCallback(async (targetUserId: string) => {
    if (!isHost) return
    const socket = await getSocket()
    socket.emit('watch:kick', { roomId, targetUserId })
  }, [isHost, roomId])

  const emitReaction = useCallback(async (reactionType: string) => {
    const socket = await getSocket()
    socket.emit('watch:reaction', { roomId, reactionType, userId })
  }, [roomId, userId])

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

      const onPlay = (data: any) => { setSyncing(false); applySync({ ...data, type: 'play' }) }
      const onPause = (data: any) => { setSyncing(false); applySync({ ...data, type: 'pause' }) }
      const onSeek = (data: any) => applySync({ ...data, type: 'seek' })
      const onSyncResponse = (data: any) => {
        if (syncTimeoutId) { clearTimeout(syncTimeoutId); syncTimeoutId = null }
        setSyncing(false)
        applySync({ ...data, type: 'sync-response' })
      }
      const onParticipants = (data: { roomId?: string; participants: WatchParticipant[]; sessionStartedAt?: number | null }) => {
        if (!mounted) return
        if (data.roomId && data.roomId !== roomId) return
        setParticipants(data.participants)
        if ('sessionStartedAt' in data) setSessionStartedAt(data.sessionStartedAt ?? null)
      }
      const onSyncRequest = () => {
        if (!isHost) return
        const video = videoRef.current
        socket.emit('watch:sync-response', {
          roomId,
          timestamp: video?.currentTime ?? 0,
          paused: video?.paused ?? true,
          serverNow: Date.now(),
        })
      }
      const onEnd = () => {
        setParticipants([])
        setSessionStartedAt(null)
        onEndedRef.current?.()
      }
      const onKicked = () => { onKickedRef.current?.() }
      const onSocketReaction = (data: { reactionType: string; userId: string }) => {
        onReactionRef.current?.(data.reactionType, data.userId)
      }

      socket.on('watch:play', onPlay)
      socket.on('watch:pause', onPause)
      socket.on('watch:seek', onSeek)
      socket.on('watch:sync-response', onSyncResponse)
      socket.on('watch:participants', onParticipants)
      socket.on('watch:sync-request', onSyncRequest)
      socket.on('watch:end', onEnd)
      socket.on('watch:kicked', onKicked)
      socket.on('watch:reaction', onSocketReaction)

      // join AFTER listeners so the initial participants broadcast is received
      socket.emit('watch:join', {
        roomId, userId, username,
        fullname: fullname ?? null,
        avatarUrl: avatarUrl ?? null,
        bannerUrl: bannerUrl ?? null,
        subPlan: subPlan ?? null,
        isVerified: isVerified ?? null,
        isHost,
      })

      let syncTimeoutId: ReturnType<typeof setTimeout> | null = null
      if (!isHost) {
        setSyncing(true)
        socket.emit('watch:sync-request', { roomId })
        // fallback: clear syncing if no response within 3s
        syncTimeoutId = setTimeout(() => setSyncing(false), 3000)
      }

      cleanup = () => {
        if (syncTimeoutId) clearTimeout(syncTimeoutId)
        socket.off('watch:play', onPlay)
        socket.off('watch:pause', onPause)
        socket.off('watch:seek', onSeek)
        socket.off('watch:sync-response', onSyncResponse)
        socket.off('watch:participants', onParticipants)
        socket.off('watch:sync-request', onSyncRequest)
        socket.off('watch:end', onEnd)
        socket.off('watch:kicked', onKicked)
        socket.off('watch:reaction', onSocketReaction)
        socket.emit('watch:leave', { roomId, userId })
      }
    })

    return () => {
      mounted = false
      cleanup?.()
    }
  }, [roomId, userId, username, isHost, applySync, videoRef])

  return { participants, syncing, sessionStartedAt, emitPlay, emitPause, emitSeek, emitEnd, emitKick, emitReaction }
}
