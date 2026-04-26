'use client'

import { useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { invitationsApi, type Invitation } from '@/lib/invitations-api'

export function useVoiceInvitationListener(
  myId: string | undefined,
  onInvitation: (invitation: Invitation) => void,
) {
  const onInvitationRef = useRef(onInvitation)
  onInvitationRef.current = onInvitation
  const seenIds = useRef<Set<string>>(new Set())

  const { data: pending = [] } = useQuery<Invitation[]>({
    queryKey: ['invitations', 'pending'],
    queryFn: invitationsApi.getPending,
    enabled: Boolean(myId),
    refetchInterval: 5000,
  })

  useEffect(() => {
    if (!myId) return
    pending
      .filter((inv) => inv.entity_type === 'GROUP' && inv.status === 'PENDING' && !seenIds.current.has(inv.id))
      .forEach((inv) => {
        seenIds.current.add(inv.id)
        onInvitationRef.current(inv)
      })
  }, [pending, myId])
}
