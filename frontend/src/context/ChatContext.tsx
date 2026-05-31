'use client'

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { WorkspaceMode } from '@/components/chat/workspace-sidebar'
import { ActiveView } from '@/components/chat/icon-rail'

interface ChatContextType {
  workspaceCollapsed: boolean
  setWorkspaceCollapsed: (collapsed: boolean) => void
  workspaceMode: WorkspaceMode
  setWorkspaceMode: (mode: WorkspaceMode) => void
  searchQuery: string
  setSearchQuery: (query: string) => void
  unreadCounts: Record<string, number>
  setUnreadCounts: React.Dispatch<React.SetStateAction<Record<string, number>>>
  typingConversations: Record<string, boolean>
  setTypingConversations: React.Dispatch<React.SetStateAction<Record<string, boolean>>>
  groupUnreadCounts: Record<string, number>
  setGroupUnreadCounts: React.Dispatch<React.SetStateAction<Record<string, number>>>
  groupChannelMap: Record<string, string>
  setGroupChannelMap: React.Dispatch<React.SetStateAction<Record<string, string>>>
}

const ChatContext = createContext<ChatContextType | undefined>(undefined)

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const [workspaceCollapsed, setWorkspaceCollapsed] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('twiky-workspace-collapsed') === 'true'
    }
    return false
  })
  const [workspaceMode, setWorkspaceMode] = useState<WorkspaceMode>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('twiky-workspace-mode')
      if (saved === 'direct' || saved === 'channels') return saved
    }
    return 'channels'
  })
  const [searchQuery, setSearchQuery] = useState('')
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({})
  const [typingConversations, setTypingConversations] = useState<Record<string, boolean>>({})
  const [groupUnreadCounts, setGroupUnreadCounts] = useState<Record<string, number>>(() => {
    if (typeof window !== 'undefined') {
      try { return JSON.parse(localStorage.getItem('twiky-group-unreads') || '{}') } catch { return {} }
    }
    return {}
  })
  const [groupChannelMap, setGroupChannelMap] = useState<Record<string, string>>(() => {
    if (typeof window !== 'undefined') {
      try { return JSON.parse(localStorage.getItem('twiky-group-channel-map') || '{}') } catch { return {} }
    }
    return {}
  })

  // Persistence for some UI states
  useEffect(() => {
    localStorage.setItem('twiky-workspace-collapsed', String(workspaceCollapsed))
  }, [workspaceCollapsed])

  useEffect(() => {
    localStorage.setItem('twiky-workspace-mode', workspaceMode)
  }, [workspaceMode])

  useEffect(() => {
    localStorage.setItem('twiky-group-unreads', JSON.stringify(groupUnreadCounts))
  }, [groupUnreadCounts])

  useEffect(() => {
    localStorage.setItem('twiky-group-channel-map', JSON.stringify(groupChannelMap))
  }, [groupChannelMap])

  return (
    <ChatContext.Provider
      value={{
        workspaceCollapsed,
        setWorkspaceCollapsed,
        workspaceMode,
        setWorkspaceMode,
        searchQuery,
        setSearchQuery,
        unreadCounts,
        setUnreadCounts,
        typingConversations,
        setTypingConversations,
        groupUnreadCounts,
        setGroupUnreadCounts,
        groupChannelMap,
        setGroupChannelMap,
      }}
    >
      {children}
    </ChatContext.Provider>
  )
}

export function useChat() {
  const context = useContext(ChatContext)
  if (context === undefined) {
    throw new Error('useChat must be used within a ChatProvider')
  }
  return context
}
