'use client'

import { createContext, useCallback, useContext, useState } from 'react'
import type { WatchParticipant } from '@/hooks/use-watch-room'

interface WatchPresenceContextType {
  watchParticipants: Record<string, WatchParticipant[]>
  watchSessionStarts: Record<string, number | null>
  setGroupParticipants: (groupId: string, participants: WatchParticipant[]) => void
  setGroupSessionStart: (groupId: string, startedAt: number | null) => void
}

const WatchPresenceContext = createContext<WatchPresenceContextType>({
  watchParticipants: {},
  watchSessionStarts: {},
  setGroupParticipants: () => {},
  setGroupSessionStart: () => {},
})

export function WatchPresenceProvider({ children }: { children: React.ReactNode }) {
  const [watchParticipants, setWatchParticipants] = useState<Record<string, WatchParticipant[]>>({})
  const [watchSessionStarts, setWatchSessionStarts] = useState<Record<string, number | null>>({})

  const setGroupParticipants = useCallback((groupId: string, participants: WatchParticipant[]) => {
    setWatchParticipants(prev => {
      const existing = prev[groupId] ?? []
      // Preserve isSpeaking — socket data doesn't carry it, onParticipantsChange does
      const merged = participants.map(p => ({
        ...p,
        isSpeaking: p.isSpeaking ?? existing.find(e => e.userId === p.userId)?.isSpeaking ?? false,
      }))
      return { ...prev, [groupId]: merged }
    })
  }, [])

  const setGroupSessionStart = useCallback((groupId: string, startedAt: number | null) => {
    setWatchSessionStarts(prev => ({ ...prev, [groupId]: startedAt }))
  }, [])

  return (
    <WatchPresenceContext.Provider value={{ watchParticipants, watchSessionStarts, setGroupParticipants, setGroupSessionStart }}>
      {children}
    </WatchPresenceContext.Provider>
  )
}

export function useWatchPresence() {
  return useContext(WatchPresenceContext)
}
