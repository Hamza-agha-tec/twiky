'use client'

import { useMemo, useState, useEffect } from 'react'
import { usePathname, useRouter, useParams } from 'next/navigation'
import { WorkspaceShellLayout } from '@/components/chat/workspace-shell-layout'
import { WorkspaceSidebar, WorkspaceMode } from '@/components/chat/workspace-sidebar'
import { useChat } from '@/context/ChatContext'
import { useChannels } from '@/hooks/use-channels'
import { useDirectConversations } from '@/hooks/use-direct-conversations'
import { useProfile } from '@/hooks/use-user'
import { useDmCallContext } from '@/context/DmCallContext'
import { DmCallIncoming } from '@/components/chat/dm-call-incoming'
import { DmCallWindow, DmCallOutgoing } from '@/components/chat/dm-call-window'

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const params = useParams()
  
  const {
    workspaceCollapsed,
    setWorkspaceCollapsed,
    workspaceMode,
    setWorkspaceMode,
    searchQuery,
    setSearchQuery,
    unreadCounts,
    typingConversations
  } = useChat()

  const { data: channels = [] } = useChannels()
  const { data: directConversations = [] } = useDirectConversations()
  const { data: profile } = useProfile()
  const dmCall = useDmCallContext()
  const [isCallMinimized, setIsCallMinimized] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('twiky-call-minimized') === 'true'
    }
    return false
  })

  useEffect(() => {
    if (typeof window === 'undefined') return
    localStorage.setItem('twiky-call-minimized', isCallMinimized ? 'true' : 'false')
  }, [isCallMinimized])

  useEffect(() => {
    if (dmCall.status.state !== 'active') {
      setIsCallMinimized(false)
    }
  }, [dmCall.status.state])

  // Determine active IDs from URL
  const activeChannelId = params.channelId as string | undefined
  const activeChatId = (params.conversationId || params.groupId) as string || ''

  // Format channels for the sidebar
  const workspaceChannels = useMemo(() => {
    return channels.map((ch, index) => ({
      id: ch.id,
      label: ch.name,
      description: ch.description ?? '',
      index,
      avatarUrl: ch.avatar_url ?? undefined,
      bannerUrl: ch.banner_url ?? undefined,
      groups: [] as any[], // In a real app, you might fetch these or pass them down
      membersLabel: '',
      access_type: ch.access_type as any,
      role: (ch.role as any) ?? 'MEMBER',
      owner_id: ch.owner_id,
      type: (ch.type as any) ?? 'NORMAL',
    }))
  }, [channels])

  // Format direct chats for the sidebar
  const sidebarDirectChats = useMemo(() => {
    return directConversations.map(conv => {
      // Find the other user in the conversation
      const otherUser = conv.user_one?.id === profile?.id ? conv.user_two : conv.user_one;
      
      // Extract the last message content safely
      let lastMessageStr = ''
      if (Array.isArray(conv.last_message) && conv.last_message.length > 0) {
        const msg = conv.last_message[0]
        if (msg.content) lastMessageStr = msg.content
        else if (msg.type === 'voice') lastMessageStr = 'Voice Message'
        else if (msg.type === 'call') lastMessageStr = 'Call'
        else if (msg.file_url) lastMessageStr = 'Attachment'
      }

      return {
        id: conv.id,
        name: otherUser?.username || 'Unknown',
        avatar: otherUser?.avatar_url || null,
        lastMessage: lastMessageStr,
        timestamp: (Array.isArray(conv.last_message) && conv.last_message.length > 0) ? conv.last_message[0].created_at : (conv as any).updated_at || new Date().toISOString(),
        isOnline: false, // You'd get this from a presence hook
        unread: unreadCounts[conv.id] || 0,
        subPlan: otherUser?.sub_plan || 'FREE',
      }
    })
  }, [directConversations, unreadCounts, profile?.id])

  const handleSelectChannel = (id: string) => {
    router.push(`/channels/${id}`)
  }

  const handleSelectChat = (id: string) => {
    if (workspaceMode === 'direct') {
      router.push(`/dm/${id}`)
    } else {
      // If we are in channels mode, it might be a group
      // But wait, the sidebar handles both. 
      // For now let's assume direct if mode is direct
      router.push(`/dm/${id}`)
    }
  }

  return (
    <WorkspaceShellLayout>
      <div className="flex h-full w-full overflow-hidden">
        <WorkspaceSidebar
          activeChannelId={activeChannelId}
          activeChat={activeChatId}
          channels={workspaceChannels}
          collapsed={workspaceCollapsed}
          mode={workspaceMode}
          onModeChange={setWorkspaceMode}
          onSearchChange={setSearchQuery}
          onSelectChannel={handleSelectChannel}
          onSelectChat={handleSelectChat}
          onToggleCollapse={() => setWorkspaceCollapsed(!workspaceCollapsed)}
          searchQuery={searchQuery}
          syntheticDirectChats={sidebarDirectChats as any}
          unreadCounts={unreadCounts}
          typingConversations={typingConversations}
        />
        <main className="flex-1 overflow-hidden relative bg-background">
          {children}
        </main>
      </div>

      {/* DM Call UI elements */}
      {dmCall.status.state === 'incoming' && (() => {
        const s = dmCall.status
        return (
          <DmCallIncoming
            callerName={s.callerName}
            callerAvatar={s.callerAvatar}
            type={s.type}
            onAccept={() => dmCall.acceptCall(
              s.conversationId,
              s.callerId,
              s.type,
              s.callerName,
              s.callerAvatar
            )}
            onReject={() => dmCall.rejectCall(s.conversationId, s.callerId, s.type)}
          />
        )
      })()}
      
      {(dmCall.status.state === 'outgoing' || dmCall.status.state === 'no-answer') && (() => {
        const s = dmCall.status
        return (
          <DmCallOutgoing
            peerName={s.calleeName}
            peerAvatar={s.calleeAvatar}
            type={s.type}
            noAnswer={s.state === 'no-answer'}
            onCancel={() => {
              if (s.state === 'outgoing') {
                dmCall.cancelCall(s.conversationId, s.calleeId, s.type)
              } else {
                dmCall.hangUp()
              }
            }}
          />
        )
      })()}
      
      {dmCall.status.state === 'active' && (() => {
        const s = dmCall.status
        return (
          <DmCallWindow
            roomId={s.roomId}
            myId={profile?.id || ''}
            myName={profile?.username || 'You'}
            peerId={s.peerId}
            peerName={s.peerName}
            peerAvatar={s.peerAvatar}
            type={s.type}
            startedAt={s.startedAt}
            inConversation={pathname === `/dm/${s.conversationId}` && !isCallMinimized}
            onHangUp={() => dmCall.hangUp()}
            onMinimize={() => {
              setIsCallMinimized(true)
            }}
            onExpand={() => {
              setIsCallMinimized(false)
              router.push(`/dm/${s.conversationId}`)
            }}
          />
        )
      })()}
    </WorkspaceShellLayout>
  )
}
