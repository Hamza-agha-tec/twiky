'use client'

import { useMemo, useState, useEffect } from 'react'
import { usePathname, useRouter, useParams } from 'next/navigation'
import { motion, AnimatePresence, useMotionValue, animate } from 'framer-motion'
import { WorkspaceShellLayout } from '@/components/chat/workspace-shell-layout'
import { WorkspaceSidebar, WorkspaceMode } from '@/components/chat/workspace-sidebar'
import { useChat } from '@/context/ChatContext'
import { useChannels } from '@/hooks/use-channels'
import { useDirectConversations } from '@/hooks/use-direct-conversations'
import { useProfile } from '@/hooks/use-user'
import { useDmCallContext } from '@/context/DmCallContext'
import { DmCallIncoming } from '@/components/chat/dm-call-incoming'
import { DmCallWindow, DmCallOutgoing } from '@/components/chat/dm-call-window'
import { useOnlineUsers } from '@/hooks/use-socket'
import { useVoice } from '@/context/VoiceContext'
import { VoiceGroupView } from '@/components/chat/voice-group-view'
import { FloatingVoicePiP } from '@/components/chat/floating-voice-pip'
import { WatchRoomView } from '@/components/watch/watch-room-view'
import { useWatchPresence } from '@/context/WatchPresenceContext'
import { Popcorn, Maximize2, Minimize2, PhoneOff, X, Users, Settings } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const params = useParams()
  const onlineUsers = useOnlineUsers()
  const { setGroupParticipants } = useWatchPresence()
  
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

  type Corner = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
  const [watchCorner, setWatchCorner] = useState<Corner>('bottom-right')
  const watchX = useMotionValue(0)
  const watchY = useMotionValue(0)

  const handleWatchDragEnd = (event: any, info: any) => {
    if (isViewingWatchRoom) return
    const cx = window.innerWidth / 2
    const cy = window.innerHeight / 2
    const dropX = info.point.x
    const dropY = info.point.y

    if (dropY < cy) {
      if (dropX < cx) setWatchCorner('top-left')
      else setWatchCorner('top-right')
    } else {
      if (dropX < cx) setWatchCorner('bottom-left')
      else setWatchCorner('bottom-right')
    }
    
    animate(watchX, 0, { type: 'spring', stiffness: 300, damping: 30 })
    animate(watchY, 0, { type: 'spring', stiffness: 300, damping: 30 })
  }

  const getWatchCornerClasses = (c: Corner) => {
    switch (c) {
      case 'top-left': return 'top-6 left-6'
      case 'top-right': return 'top-6 right-6'
      case 'bottom-left': return 'bottom-6 left-6'
      case 'bottom-right': return 'bottom-6 right-6'
    }
  }

  const voice = useVoice()
  const [activeWatchRoom, setActiveWatchRoom] = useState<{ roomId: string; channelId: string; groupName: string } | null>(null)
  const [isWatchWindowMinimized, setIsWatchWindowMinimized] = useState(true)

  // Sync active watch room from localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return
    const syncWatchRoom = () => {
      const raw = localStorage.getItem('twiky-active-watch-room')
      if (raw) {
        try {
          setActiveWatchRoom(JSON.parse(raw))
        } catch {
          setActiveWatchRoom(null)
        }
      } else {
        setActiveWatchRoom(null)
      }
    }
    syncWatchRoom()
    window.addEventListener('twiky-watch-room-changed', syncWatchRoom)
    window.addEventListener('storage', syncWatchRoom)
    return () => {
      window.removeEventListener('twiky-watch-room-changed', syncWatchRoom)
      window.removeEventListener('storage', syncWatchRoom)
    }
  }, [])

  const [activeVoiceMeta, setActiveVoiceMeta] = useState<{ channelId: string; groupName: string } | null>(null)

  // Sync active voice meta from localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return
    const syncVoiceMeta = () => {
      const raw = localStorage.getItem('twiky-active-voice-meta')
      if (raw) {
        try {
          setActiveVoiceMeta(JSON.parse(raw))
        } catch {
          setActiveVoiceMeta(null)
        }
      } else {
        setActiveVoiceMeta(null)
      }
    }
    syncVoiceMeta()
    window.addEventListener('twiky-voice-meta-changed', syncVoiceMeta)
    window.addEventListener('storage', syncVoiceMeta)
    return () => {
      window.removeEventListener('twiky-voice-meta-changed', syncVoiceMeta)
      window.removeEventListener('storage', syncVoiceMeta)
    }
  }, [])

  const isViewingVoiceGroup = voice.joinedGroupId && pathname.includes(`/group/${voice.joinedGroupId}`)

  // Compute if user is host of watch room
  const activeWatchChannelHost = useMemo(() => {
    if (!activeWatchRoom) return false
    const ch = channels.find(c => c.id === activeWatchRoom.channelId)
    return ch?.role === 'OWNER' || ch?.role === 'ADMIN'
  }, [channels, activeWatchRoom])

  const isViewingWatchRoom = activeWatchRoom && pathname.includes(`/group/${activeWatchRoom.roomId}`)

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
        isOnline: otherUser?.id ? onlineUsers.has(otherUser.id) : false,
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
          {activeWatchRoom && (
            <motion.div
              layout
              drag={!isViewingWatchRoom}
              dragMomentum={false}
              onDragEnd={handleWatchDragEnd}
              style={isViewingWatchRoom ? {
                x: 0,
                y: 0,
                height: '100%'
              } : {
                x: watchX,
                y: watchY
              }}
              className={cn(
                "absolute z-50",
                isViewingWatchRoom 
                  ? "top-0 right-0 bottom-0 left-0 md:left-[216px]" 
                  : cn("w-[320px] h-[180px] rounded-2xl shadow-2xl overflow-hidden border border-white/10", getWatchCornerClasses(watchCorner))
              )}
            >
              <WatchRoomView
                roomId={activeWatchRoom.roomId}
                userId={profile?.id || ''}
                username={profile?.username || ''}
                fullname={profile?.fullname || profile?.full_name}
                avatarUrl={profile?.avatar_url}
                bannerUrl={profile?.banner}
                subPlan={profile?.sub_plan}
                isVerified={profile?.is_verified}
                isHost={activeWatchChannelHost}
                isPip={!isViewingWatchRoom}
                onMaximize={() => router.push(`/channels/${activeWatchRoom.channelId}/group/${activeWatchRoom.roomId}`)}
                onLeave={() => {
                  localStorage.removeItem('twiky-active-watch-room')
                  window.dispatchEvent(new Event('twiky-watch-room-changed'))
                }}
                onParticipantsChange={(participants) => setGroupParticipants(activeWatchRoom.roomId, participants)}
              />
            </motion.div>
          )}
        </main>
      </div>
      {dmCall.status.state === 'incoming' && (() => {
        const s = dmCall.status
        return (
          <DmCallIncoming
            callerName={s.callerName}
            callerAvatar={s.callerAvatar}
            type={s.type}
            onAccept={() => dmCall.acceptCall(s.conversationId, s.callerId, s.type, s.callerName, s.callerAvatar)}
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



      {!isViewingVoiceGroup && <FloatingVoicePiP 
        groupName={activeVoiceMeta?.groupName} 
        channelUrl={activeVoiceMeta ? `/channels/${activeVoiceMeta.channelId}/group/${voice.joinedGroupId}` : undefined} 
      />}


    </WorkspaceShellLayout>
  )
}
