'use client'

import { createContext, useCallback, useContext, useState } from 'react'

export type PixelPresenceParticipant = {
  userId: string
  username: string
  avatarUrl?: string | null
  bannerUrl?: string | null
  subPlan?: string | null
  micMuted: boolean
  isSpeaking: boolean
}

interface PixelPresenceContextType {
  pixelParticipants: Record<string, PixelPresenceParticipant[]>
  pixelSessionStarts: Record<string, number | null>
  setGroupParticipants: (groupId: string, participants: PixelPresenceParticipant[]) => void
  setGroupSessionStart: (groupId: string, startedAt: number | null) => void
  updateSpeaking: (groupId: string, userId: string, speaking: boolean) => void
}

const PixelPresenceContext = createContext<PixelPresenceContextType>({
  pixelParticipants: {},
  pixelSessionStarts: {},
  setGroupParticipants: () => {},
  setGroupSessionStart: () => {},
  updateSpeaking: () => {},
})

export function PixelPresenceProvider({ children }: { children: React.ReactNode }) {
  const [pixelParticipants, setPixelParticipants] = useState<Record<string, PixelPresenceParticipant[]>>({})
  const [pixelSessionStarts, setPixelSessionStarts] = useState<Record<string, number | null>>({})

  const setGroupParticipants = useCallback((groupId: string, participants: PixelPresenceParticipant[]) => {
    setPixelParticipants(prev => ({ ...prev, [groupId]: participants }))
  }, [])

  const setGroupSessionStart = useCallback((groupId: string, startedAt: number | null) => {
    setPixelSessionStarts(prev => ({ ...prev, [groupId]: startedAt }))
  }, [])

  const updateSpeaking = useCallback((groupId: string, userId: string, speaking: boolean) => {
    setPixelParticipants(prev => {
      const list = prev[groupId]
      if (!list) return prev
      return { ...prev, [groupId]: list.map(p => p.userId === userId ? { ...p, isSpeaking: speaking } : p) }
    })
  }, [])

  return (
    <PixelPresenceContext.Provider value={{ pixelParticipants, pixelSessionStarts, setGroupParticipants, setGroupSessionStart, updateSpeaking }}>
      {children}
    </PixelPresenceContext.Provider>
  )
}

export function usePixelPresence() {
  return useContext(PixelPresenceContext)
}
