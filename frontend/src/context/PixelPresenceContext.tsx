'use client'

import { createContext, useCallback, useContext, useEffect, useState } from 'react'

export type PixelPresenceParticipant = {
  userId: string
  username: string
  avatarUrl?: string | null
  bannerUrl?: string | null
  subPlan?: string | null
  micMuted: boolean
  isSpeaking: boolean
}

export type ActivePixelRoom = {
  groupId: string
  channelId: string
  groupName: string
}

const LS_KEY = 'twiky-active-pixel-room'
const EVT = 'twiky-active-pixel-room-changed'

interface PixelPresenceContextType {
  pixelParticipants: Record<string, PixelPresenceParticipant[]>
  pixelSessionStarts: Record<string, number | null>
  setGroupParticipants: (groupId: string, participants: PixelPresenceParticipant[]) => void
  setGroupSessionStart: (groupId: string, startedAt: number | null) => void
  updateSpeaking: (groupId: string, userId: string, speaking: boolean) => void
  activeRoom: ActivePixelRoom | null
  setActiveRoom: (room: ActivePixelRoom) => void
  leaveRoom: () => void
  mountTarget: HTMLElement | null
  setMountTarget: (el: HTMLElement | null) => void
}

const PixelPresenceContext = createContext<PixelPresenceContextType>({
  pixelParticipants: {},
  pixelSessionStarts: {},
  setGroupParticipants: () => {},
  setGroupSessionStart: () => {},
  updateSpeaking: () => {},
  activeRoom: null,
  setActiveRoom: () => {},
  leaveRoom: () => {},
  mountTarget: null,
  setMountTarget: () => {},
})

function readLS(): ActivePixelRoom | null {
  if (typeof window === 'undefined') return null
  const raw = localStorage.getItem(LS_KEY)
  if (!raw) return null
  try { return JSON.parse(raw) as ActivePixelRoom } catch { return null }
}

export function PixelPresenceProvider({ children }: { children: React.ReactNode }) {
  const [pixelParticipants, setPixelParticipants] = useState<Record<string, PixelPresenceParticipant[]>>({})
  const [pixelSessionStarts, setPixelSessionStarts] = useState<Record<string, number | null>>({})
  const [activeRoom, setActiveRoomState] = useState<ActivePixelRoom | null>(null)
  const [mountTarget, setMountTarget] = useState<HTMLElement | null>(null)

  // Clear persisted room on reload (like watch room)
  useEffect(() => {
    if (typeof window === 'undefined') return
    const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined
    if (nav?.type === 'reload') {
      localStorage.removeItem(LS_KEY)
      setActiveRoomState(null)
    } else {
      setActiveRoomState(readLS())
    }
    const sync = () => setActiveRoomState(readLS())
    window.addEventListener(EVT, sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener(EVT, sync)
      window.removeEventListener('storage', sync)
    }
  }, [])

  const setActiveRoom = useCallback((room: ActivePixelRoom) => {
    if (typeof window === 'undefined') return
    localStorage.setItem(LS_KEY, JSON.stringify(room))
    setActiveRoomState(room)
    window.dispatchEvent(new Event(EVT))
  }, [])

  const leaveRoom = useCallback(() => {
    if (typeof window === 'undefined') return
    localStorage.removeItem(LS_KEY)
    setActiveRoomState(null)
    window.dispatchEvent(new Event(EVT))
  }, [])

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
    <PixelPresenceContext.Provider value={{ pixelParticipants, pixelSessionStarts, setGroupParticipants, setGroupSessionStart, updateSpeaking, activeRoom, setActiveRoom, leaveRoom, mountTarget, setMountTarget }}>
      {children}
    </PixelPresenceContext.Provider>
  )
}

export function usePixelPresence() {
  return useContext(PixelPresenceContext)
}
