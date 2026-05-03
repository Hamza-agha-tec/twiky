'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { getSocket } from '@/lib/socket'
import type { Socket } from 'socket.io-client'

export type DmCallType = 'audio' | 'video'

export type DmCallStatus =
  | { state: 'idle' }
  | { state: 'outgoing'; conversationId: string; calleeId: string; calleeName: string; calleeAvatar: string | null; type: DmCallType }
  | { state: 'incoming'; conversationId: string; callerId: string; callerName: string; callerAvatar: string | null; type: DmCallType }
  | { state: 'active'; conversationId: string; peerId: string; peerName: string; peerAvatar: string | null; type: DmCallType; roomId: string }

interface UseDmCallOptions {
  myId: string | undefined
  onCallStarted?: (roomId: string, type: DmCallType) => void
  onCallEnded?: (roomId: string) => void
}

export function useDmCall({ myId, onCallStarted, onCallEnded }: UseDmCallOptions) {
  const [status, setStatus] = useState<DmCallStatus>({ state: 'idle' })
  const socketRef = useRef<Socket | null>(null)
  const myIdRef = useRef(myId)
  const statusRef = useRef(status)
  const onCallStartedRef = useRef(onCallStarted)
  const onCallEndedRef = useRef(onCallEnded)

  useEffect(() => { myIdRef.current = myId }, [myId])
  useEffect(() => { statusRef.current = status }, [status])
  useEffect(() => { onCallStartedRef.current = onCallStarted }, [onCallStarted])
  useEffect(() => { onCallEndedRef.current = onCallEnded }, [onCallEnded])

  const endActiveCall = useCallback((conversationId: string, peerId: string) => {
    socketRef.current?.emit('leave-voice-room', { roomId: `dm-${conversationId}` })
    socketRef.current?.emit('dm-call-ended', { conversationId, peerId })
    const roomId = `dm-${conversationId}`
    onCallEndedRef.current?.(roomId)
    setStatus({ state: 'idle' })
  }, [])

  const startCall = useCallback((
    conversationId: string,
    calleeId: string,
    calleeName: string,
    calleeAvatar: string | null,
    type: DmCallType,
  ) => {
    if (!socketRef.current) return
    if (statusRef.current.state !== 'idle') return

    socketRef.current.emit('dm-call-invite', { conversationId, calleeId, type })
    setStatus({ state: 'outgoing', conversationId, calleeId, calleeName, calleeAvatar, type })
  }, [])

  const acceptCall = useCallback((conversationId: string, callerId: string, type: DmCallType, callerName: string, callerAvatar: string | null) => {
    if (!socketRef.current) return

    socketRef.current.emit('dm-call-accepted', { conversationId, callerId })

    const roomId = `dm-${conversationId}`
    socketRef.current.emit('join-voice-room', { roomId })

    setStatus({ state: 'active', conversationId, peerId: callerId, peerName: callerName, peerAvatar: callerAvatar, type, roomId })
    onCallStartedRef.current?.(roomId, type)
  }, [])

  const rejectCall = useCallback((conversationId: string, callerId: string) => {
    socketRef.current?.emit('dm-call-rejected', { conversationId, callerId })
    setStatus({ state: 'idle' })
  }, [])

  const cancelCall = useCallback((conversationId: string, calleeId: string) => {
    socketRef.current?.emit('dm-call-cancelled', { conversationId, calleeId })
    setStatus({ state: 'idle' })
  }, [])

  const hangUp = useCallback(() => {
    const s = statusRef.current
    if (s.state === 'active') {
      endActiveCall(s.conversationId, s.peerId)
    } else if (s.state === 'outgoing') {
      cancelCall(s.conversationId, s.calleeId)
    } else if (s.state === 'incoming') {
      rejectCall(s.conversationId, s.callerId)
    }
  }, [endActiveCall, cancelCall, rejectCall])

  useEffect(() => {
    if (!myId) return
    let mounted = true

    getSocket().then((socket) => {
      if (!mounted) return
      socketRef.current = socket

      const onInvite = (data: { conversationId: string; callerId: string; type: DmCallType }) => {
        if (!mounted) return
        // Don't interrupt active calls
        if (statusRef.current.state === 'active') {
          socket.emit('dm-call-rejected', { conversationId: data.conversationId, callerId: data.callerId })
          return
        }
        setStatus({
          state: 'incoming',
          conversationId: data.conversationId,
          callerId: data.callerId,
          callerName: 'Incoming call',
          callerAvatar: null,
          type: data.type ?? 'audio',
        })
      }

      const onAccepted = (data: { conversationId: string; calleeId: string }) => {
        if (!mounted) return
        const s = statusRef.current
        if (s.state !== 'outgoing' || s.conversationId !== data.conversationId) return

        const roomId = `dm-${data.conversationId}`
        socket.emit('join-voice-room', { roomId })

        setStatus({
          state: 'active',
          conversationId: data.conversationId,
          peerId: data.calleeId,
          peerName: s.calleeName,
          peerAvatar: s.calleeAvatar,
          type: s.type,
          roomId,
        })
        onCallStartedRef.current?.(roomId, s.type)
      }

      const onRejected = (data: { conversationId: string; reason?: string }) => {
        if (!mounted) return
        const s = statusRef.current
        if (s.state !== 'outgoing' || s.conversationId !== data.conversationId) return
        setStatus({ state: 'idle' })
      }

      const onCancelled = (data: { conversationId: string }) => {
        if (!mounted) return
        const s = statusRef.current
        if (s.state !== 'incoming' || s.conversationId !== data.conversationId) return
        setStatus({ state: 'idle' })
      }

      const onEnded = (data: { conversationId: string }) => {
        if (!mounted) return
        const s = statusRef.current
        if (s.state !== 'active' || s.conversationId !== data.conversationId) return
        socket.emit('leave-voice-room', { roomId: `dm-${data.conversationId}` })
        onCallEndedRef.current?.(`dm-${data.conversationId}`)
        setStatus({ state: 'idle' })
      }

      socket.on('dm-call-invite', onInvite)
      socket.on('dm-call-accepted', onAccepted)
      socket.on('dm-call-rejected', onRejected)
      socket.on('dm-call-cancelled', onCancelled)
      socket.on('dm-call-ended', onEnded)

      return () => {
        socket.off('dm-call-invite', onInvite)
        socket.off('dm-call-accepted', onAccepted)
        socket.off('dm-call-rejected', onRejected)
        socket.off('dm-call-cancelled', onCancelled)
        socket.off('dm-call-ended', onEnded)
      }
    })

    return () => { mounted = false }
  }, [myId])

  return { status, startCall, acceptCall, rejectCall, cancelCall, hangUp }
}
