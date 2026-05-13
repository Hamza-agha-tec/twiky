'use client'

import { createContext, useCallback, useContext, useRef, useState } from 'react'

export interface IslandNotification {
  id: string
  type: 'dm' | 'general' | 'mention' | 'invite'
  avatar?: string | null
  title: string
  body: string
  href?: string
  icon?: string
  conversationId?: string
}

interface DynamicIslandContextValue {
  current: IslandNotification | null
  push: (n: Omit<IslandNotification, 'id'>) => void
  dismiss: () => void
}

const DynamicIslandContext = createContext<DynamicIslandContextValue | null>(null)

export function DynamicIslandProvider({ children }: { children: React.ReactNode }) {
  const [current, setCurrent] = useState<IslandNotification | null>(null)
  const queue = useRef<IslandNotification[]>([])
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const showNext = useCallback(() => {
    const next = queue.current.shift()
    if (!next) {
      setCurrent(null)
      return
    }
    setCurrent(next)
    timerRef.current = setTimeout(() => {
      setCurrent(null)
      setTimeout(showNext, 300)
    }, 4500)
  }, [])

  const push = useCallback(
    (n: Omit<IslandNotification, 'id'>) => {
      const notification: IslandNotification = { ...n, id: `${Date.now()}-${Math.random()}` }

      if (current) {
        // Deduplicate same conversation
        if (n.conversationId && queue.current.some((q) => q.conversationId === n.conversationId)) return
        queue.current.push(notification)
        return
      }

      setCurrent(notification)
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => {
        setCurrent(null)
        setTimeout(showNext, 300)
      }, 4500)
    },
    [current, showNext],
  )

  const dismiss = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    setCurrent(null)
    setTimeout(showNext, 300)
  }, [showNext])

  return (
    <DynamicIslandContext.Provider value={{ current, push, dismiss }}>
      {children}
    </DynamicIslandContext.Provider>
  )
}

export function useDynamicIsland() {
  const ctx = useContext(DynamicIslandContext)
  if (!ctx) throw new Error('useDynamicIsland must be used inside DynamicIslandProvider')
  return ctx
}
