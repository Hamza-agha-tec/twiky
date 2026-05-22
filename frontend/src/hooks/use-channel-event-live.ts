'use client'

import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { CHANNEL_EVENTS_KEY } from '@/lib/channels-api'
import { isEventLive } from '@/lib/event-utils'
import type { VoiceEvent } from '@/lib/groups-api'
import { getSocket } from '@/lib/socket'

/** Listen for eventStarted on a voice group page and notify members they can join. */
export function useChannelEventLive(
  channelId: string | undefined,
  groupId: string | undefined,
  eventId: string | null,
  canManage?: boolean,
) {
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!channelId || !groupId) return

    let mounted = true
    let cleanup: (() => void) | null = null

    getSocket().then((socket) => {
      if (!mounted) return

      const joinGroup = () => socket.emit('joinGroupRoom', groupId)
      joinGroup()
      socket.on('connect', joinGroup)

      const onEventStarted = (payload: VoiceEvent) => {
        if (!mounted || payload.group_id !== groupId) return

        queryClient.setQueryData<VoiceEvent[]>(CHANNEL_EVENTS_KEY(channelId), (prev) => {
          if (!prev?.length) return prev
          const idx = prev.findIndex((e) => e.id === payload.id)
          if (idx === -1) return prev
          const next = [...prev]
          next[idx] = { ...next[idx], ...payload }
          return next
        })

        const matchesPage = !eventId || payload.id === eventId
        if (matchesPage && isEventLive(payload) && !canManage) {
          toast.success('Event has started — you can join now!', { duration: 5000 })
        }
      }

      socket.on('eventStarted', onEventStarted)
      cleanup = () => {
        socket.off('connect', joinGroup)
        socket.off('eventStarted', onEventStarted)
        socket.emit('leaveGroupRoom', groupId)
      }
    })

    return () => {
      mounted = false
      cleanup?.()
    }
  }, [channelId, groupId, eventId, canManage, queryClient])
}
