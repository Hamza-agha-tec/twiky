'use client'

import React, { createContext, useContext } from 'react'
import { useDmCall, DmCallStatus, DmCallType } from '@/hooks/use-dm-call'
import { useProfile } from '@/hooks/use-user'
import { useVoice } from '@/context/VoiceContext'
import { toast } from 'sonner'

interface DmCallContextType {
  status: DmCallStatus
  startCall: (conversationId: string, calleeId: string, calleeName: string, calleeAvatar: string | null, type: DmCallType) => void
  acceptCall: (conversationId: string, callerId: string, type: DmCallType, callerName: string, callerAvatar: string | null) => void
  rejectCall: (conversationId: string, callerId: string, type?: DmCallType) => void
  cancelCall: (conversationId: string, calleeId: string, type?: DmCallType) => void
  hangUp: () => void
}

const DmCallContext = createContext<DmCallContextType | undefined>(undefined)

export function DmCallProvider({ children }: { children: React.ReactNode }) {
  const { data: profile } = useProfile()
  const { joinedGroupId } = useVoice()

  const dmCall = useDmCall({
    myId: profile?.id,
    isInGroupVoiceCall: !!joinedGroupId,
    onCallRejected: (calleeName, reason) => {
      if (reason === 'busy') toast.error(`${calleeName} is currently in another call`)
    },
  })

  return (
    <DmCallContext.Provider value={dmCall}>
      {children}
    </DmCallContext.Provider>
  )
}

export function useDmCallContext() {
  const context = useContext(DmCallContext)
  if (context === undefined) {
    throw new Error('useDmCallContext must be used within a DmCallProvider')
  }
  return context
}
