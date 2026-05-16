'use client'

import { useEffect, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { Socket } from 'socket.io-client'
import { getSocket } from '@/lib/socket'
import { invitationsApi, type Invitation } from '@/lib/invitations-api'

export function useVoiceInvitationListener(
  myId: string | undefined,
  onInvitation: (invitation: Invitation) => void,
) {
  const onInvitationRef = useRef(onInvitation)
  const seenIds = useRef<Set<string>>(new Set())
  const queryClient = useQueryClient()

  useEffect(() => {
    onInvitationRef.current = onInvitation
  }, [onInvitation])

  const { data: pending = [] } = useQuery<Invitation[]>({
    queryKey: ['invitations', 'pending'],
    queryFn: invitationsApi.getPending,
    enabled: Boolean(myId),
  })

  // Socket for instant delivery — invalidates query immediately on new invitation
  useEffect(() => {
    if (!myId) return
    let mounted = true
    let s: Socket | null = null

    const onNewNotification = (notification: { type: string }) => {
      if (!mounted) return
      if (notification.type === 'INVITATION') {
        void queryClient.invalidateQueries({ queryKey: ['invitations', 'pending'] })
      }
    }

    getSocket().then((socket) => {
      if (!mounted) return
      s = socket
      s.on('newNotification', onNewNotification)
    })

    return () => {
      mounted = false
      s?.off('newNotification', onNewNotification)
    }
  }, [myId, queryClient])

  useEffect(() => {
    if (!myId) return
    ;(pending ?? [])
      .filter(
        (inv) =>
          (inv.entity_type === 'GROUP' || inv.entity_type === 'CHANNEL') &&
          inv.status === 'PENDING' &&
          !seenIds.current.has(inv.id),
      )
      .forEach((inv) => {
        seenIds.current.add(inv.id)
        onInvitationRef.current(inv)
      })
  }, [pending, myId])
}
