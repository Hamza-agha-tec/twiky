'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { getSocket } from '@/lib/socket'

export type DmCallType = 'audio' | 'video'

export type DmCallStatus =
  | { state: 'idle' }
  | { state: 'outgoing'; conversationId: string; calleeId: string; calleeName: string; calleeAvatar: string | null; type: DmCallType }
  | { state: 'no-answer'; calleeName: string; calleeAvatar: string | null; type: DmCallType }
  | { state: 'incoming'; conversationId: string; callerId: string; callerName: string; callerAvatar: string | null; type: DmCallType }
  | { state: 'active'; conversationId: string; peerId: string; peerName: string; peerAvatar: string | null; type: DmCallType; roomId: string }

interface UseDmCallOptions {
  myId: string | undefined
  isInGroupVoiceCall?: boolean
  onCallStarted?: (roomId: string, type: DmCallType) => void
  onCallEnded?: (roomId: string) => void
  onCallRejected?: (calleeName: string, reason?: string) => void
}

export function useDmCall({ myId, isInGroupVoiceCall, onCallStarted, onCallEnded, onCallRejected }: UseDmCallOptions) {
  const [status, setStatus] = useState<DmCallStatus>({ state: 'idle' })
  const socketRef = useRef<Awaited<ReturnType<typeof getSocket>> | null>(null)
  const myIdRef = useRef(myId)
  const statusRef = useRef(status)
  const onCallStartedRef = useRef(onCallStarted)
  const onCallEndedRef = useRef(onCallEnded)
  const onCallRejectedRef = useRef(onCallRejected)
  const isInGroupVoiceCallRef = useRef(isInGroupVoiceCall)
  const noAnswerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const incomingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const callStartedAtRef = useRef<number | null>(null)

  useEffect(() => { myIdRef.current = myId }, [myId])
  useEffect(() => { statusRef.current = status }, [status])
  useEffect(() => { onCallStartedRef.current = onCallStarted }, [onCallStarted])
  useEffect(() => { onCallEndedRef.current = onCallEnded }, [onCallEnded])
  useEffect(() => { onCallRejectedRef.current = onCallRejected }, [onCallRejected])
  useEffect(() => { isInGroupVoiceCallRef.current = isInGroupVoiceCall }, [isInGroupVoiceCall])

  const endActiveCall = useCallback((conversationId: string, peerId: string, callType: DmCallType) => {
    const durationSecs = callStartedAtRef.current
      ? Math.floor((Date.now() - callStartedAtRef.current) / 1000)
      : 0
    callStartedAtRef.current = null
    socketRef.current?.emit('leave-voice-room', { roomId: `dm-${conversationId}` })
    socketRef.current?.emit('dm-call-ended', { conversationId, peerId, callType, durationSecs })
    const roomId = `dm-${conversationId}`
    onCallEndedRef.current?.(roomId)
    setStatus({ state: 'idle' })
  }, [])

  const clearNoAnswerTimer = useCallback(() => {
    if (noAnswerTimerRef.current) {
      clearTimeout(noAnswerTimerRef.current)
      noAnswerTimerRef.current = null
    }
  }, [])

  const clearIncomingTimer = useCallback(() => {
    if (incomingTimerRef.current) {
      clearTimeout(incomingTimerRef.current)
      incomingTimerRef.current = null
    }
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

    // Auto-cancel after 65s — matches callee's 65s incoming timeout
    clearNoAnswerTimer()
    noAnswerTimerRef.current = setTimeout(() => {
      const s = statusRef.current
      if (s.state !== 'outgoing' || s.conversationId !== conversationId) return
      socketRef.current?.emit('dm-call-cancelled', { conversationId, calleeId, callType: type })
      setStatus({ state: 'no-answer', calleeName, calleeAvatar, type })
      // Auto-dismiss the "no answer" card after 4s
      noAnswerTimerRef.current = setTimeout(() => setStatus({ state: 'idle' }), 4_000)
    }, 65_000)
  }, [clearNoAnswerTimer])

  const acceptCall = useCallback((conversationId: string, callerId: string, type: DmCallType, callerName: string, callerAvatar: string | null) => {
    if (!socketRef.current) return
    clearIncomingTimer()
    callStartedAtRef.current = Date.now()
    socketRef.current.emit('dm-call-accepted', { conversationId, callerId })

    const roomId = `dm-${conversationId}`
    socketRef.current.emit('join-voice-room', { roomId })

    setStatus({ state: 'active', conversationId, peerId: callerId, peerName: callerName, peerAvatar: callerAvatar, type, roomId })
    onCallStartedRef.current?.(roomId, type)
  }, [clearIncomingTimer])

  const rejectCall = useCallback((conversationId: string, callerId: string, callType?: DmCallType) => {
    clearIncomingTimer()
    socketRef.current?.emit('dm-call-rejected', { conversationId, callerId, callType: callType ?? 'audio' })
    setStatus({ state: 'idle' })
  }, [clearIncomingTimer])

  const cancelCall = useCallback((conversationId: string, calleeId: string, callType?: DmCallType) => {
    clearNoAnswerTimer()
    socketRef.current?.emit('dm-call-cancelled', { conversationId, calleeId, callType: callType ?? 'audio' })
    setStatus({ state: 'idle' })
  }, [clearNoAnswerTimer])

  const hangUp = useCallback(() => {
    const s = statusRef.current
    if (s.state === 'active') {
      endActiveCall(s.conversationId, s.peerId, s.type)
    } else if (s.state === 'outgoing') {
      cancelCall(s.conversationId, s.calleeId, s.type)
    } else if (s.state === 'incoming') {
      rejectCall(s.conversationId, s.callerId, s.type)
    } else if (s.state === 'no-answer') {
      clearNoAnswerTimer()
      setStatus({ state: 'idle' })
    }
  }, [endActiveCall, cancelCall, rejectCall, clearNoAnswerTimer])

  useEffect(() => {
    if (!myId) return
    let mounted = true
    let cleanup: (() => void) | undefined

    getSocket().then((socket) => {
      if (!mounted) return
      socketRef.current = socket

      const onInvite = (data: { conversationId: string; callerId: string; type: DmCallType }) => {
        if (!mounted) return
        if (statusRef.current.state === 'active' || isInGroupVoiceCallRef.current) {
          socket.emit('dm-call-rejected', { conversationId: data.conversationId, callerId: data.callerId, reason: 'busy' })
          return
        }
        // Already ringing for this call — ignore re-invite (server resends periodically)
        if (statusRef.current.state === 'incoming' && statusRef.current.conversationId === data.conversationId) return
        clearIncomingTimer()
        setStatus({
          state: 'incoming',
          conversationId: data.conversationId,
          callerId: data.callerId,
          callerName: 'Incoming call',
          callerAvatar: null,
          type: data.type ?? 'audio',
        })
        // Auto-dismiss after 65s if caller's cancel event is missed
        incomingTimerRef.current = setTimeout(() => {
          setStatus(prev => prev.state === 'incoming' ? { state: 'idle' } : prev)
        }, 65_000)
      }

      const onAccepted = (data: { conversationId: string; calleeId: string }) => {
        if (!mounted) return
        const s = statusRef.current
        if (s.state !== 'outgoing' || s.conversationId !== data.conversationId) return
        clearNoAnswerTimer()
        callStartedAtRef.current = Date.now()

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
        clearNoAnswerTimer()
        if (data.reason === 'busy') onCallRejectedRef.current?.(s.calleeName, data.reason)
        setStatus({ state: 'idle' })
      }

      const onCancelled = (data: { conversationId?: string }) => {
        if (!mounted) return
        const prev = statusRef.current
        if (prev.state !== 'incoming') return
        if (data.conversationId && prev.conversationId !== data.conversationId) return
        clearIncomingTimer()
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

      cleanup = () => {
        socket.off('dm-call-invite', onInvite)
        socket.off('dm-call-accepted', onAccepted)
        socket.off('dm-call-rejected', onRejected)
        socket.off('dm-call-cancelled', onCancelled)
        socket.off('dm-call-ended', onEnded)
      }
    })

    return () => {
      mounted = false
      cleanup?.()
      clearNoAnswerTimer()
      clearIncomingTimer()
    }
  }, [myId, clearNoAnswerTimer, clearIncomingTimer])

  return { status, startCall, acceptCall, rejectCall, cancelCall, hangUp }
}
