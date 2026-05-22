'use client'

import { useEffect, useRef, useState } from 'react'
import { getSocket } from '@/lib/socket'

export interface LiveParticipant {
  id: string
  name: string
  avatarUrl: string | null
}

export interface RoomEvent {
  type: 'join' | 'leave'
  name: string
  id: string
}

export function useVoiceRoomLive(groupId: string) {
  const [participants, setParticipants] = useState<LiveParticipant[] | null>(null)
  const [lastEvent, setLastEvent] = useState<RoomEvent | null>(null)
  const nameMapRef = useRef<Map<string, string>>(new Map())
  const eventTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!groupId) return
    let mounted = true
    let socket: Awaited<ReturnType<typeof getSocket>> | null = null

    function fireEvent(event: RoomEvent) {
      if (!mounted) return
      setLastEvent(event)
      if (eventTimerRef.current) clearTimeout(eventTimerRef.current)
      eventTimerRef.current = setTimeout(() => {
        if (mounted) setLastEvent(null)
      }, 3500)
    }

    const onRoomUsers = (payload: { roomId?: string; participants?: any[] }) => {
      if (!mounted || payload.roomId !== groupId) return
      const users = Array.isArray(payload.participants) ? payload.participants : []
      users.forEach((u: any) => nameMapRef.current.set(u.id, u.name))
      setParticipants(users.map((u: any) => ({ id: u.id, name: u.name ?? 'Unknown', avatarUrl: u.avatarUrl ?? null })))
    }

    const onRoomParticipants = (payload: { roomId?: string; users?: any[] }) => {
      if (!mounted || payload.roomId !== groupId) return
      const users = Array.isArray(payload.users) ? payload.users : []
      users.forEach((u: any) => nameMapRef.current.set(u.id, u.name))
      setParticipants(users.map((u: any) => ({ id: u.id, name: u.name ?? 'Unknown', avatarUrl: u.avatarUrl ?? null })))
    }

    const onUserJoined = (payload: { roomId?: string; user?: any }) => {
      if (!mounted || payload.roomId !== groupId || !payload.user?.id) return
      nameMapRef.current.set(payload.user.id, payload.user.name)
      setParticipants(prev => {
        const list = prev ?? []
        return [...list.filter(p => p.id !== payload.user.id), {
          id: payload.user.id,
          name: payload.user.name ?? 'Unknown',
          avatarUrl: payload.user.avatarUrl ?? null,
        }]
      })
      fireEvent({ type: 'join', name: payload.user.name ?? 'Someone', id: payload.user.id })
    }

    const onUserLeft = (payload: { roomId?: string; userId?: string }) => {
      if (!mounted || payload.roomId !== groupId || !payload.userId) return
      const name = nameMapRef.current.get(payload.userId) ?? 'Someone'
      setParticipants(prev => (prev ?? []).filter(p => p.id !== payload.userId))
      fireEvent({ type: 'leave', name, id: payload.userId })
    }

    const onConnect = () => socket?.emit('subscribe-voice-rooms', { roomIds: [groupId] })

    getSocket().then(s => {
      if (!mounted) return
      socket = s
      s.emit('subscribe-voice-rooms', { roomIds: [groupId] })
      s.on('connect', onConnect)
      s.on('voice-room-users', onRoomUsers)
      s.on('voice-room-participants', onRoomParticipants)
      s.on('user-joined-voice', onUserJoined)
      s.on('user-left-voice', onUserLeft)
    })

    return () => {
      mounted = false
      if (eventTimerRef.current) clearTimeout(eventTimerRef.current)
      if (socket) {
        socket.off('connect', onConnect)
        socket.off('voice-room-users', onRoomUsers)
        socket.off('voice-room-participants', onRoomParticipants)
        socket.off('user-joined-voice', onUserJoined)
        socket.off('user-left-voice', onUserLeft)
        // Don't unsubscribe — the channel layout manages subscription lifetime
        // for all voice rooms in the channel. Unsubscribing here would evict the
        // socket from sub_voice_<roomId> even while the layout still needs it.
      }
    }
  }, [groupId])

  return { participants, lastEvent }
}
