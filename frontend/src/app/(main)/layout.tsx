'use client'

import { useMemo, useState, useEffect } from 'react'
import { usePathname, useRouter, useParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
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
import { WatchRoomView } from '@/components/watch/watch-room-view'
import { Volume2, Tv, Maximize2, Minimize2, PhoneOff, X, Users, Settings } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const params = useParams()
  const onlineUsers = useOnlineUsers()
  
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

  // Find active voice group channel/details
  const activeVoiceGroup = useMemo(() => {
    if (!voice.joinedGroupId) return null
    for (const channel of channels) {
      const g = (channel as any).groups?.find((g: any) => g.id === voice.joinedGroupId)
      if (g) return g
    }
    return null
  }, [channels, voice.joinedGroupId])

  // Compute if user is host of watch room
  const activeWatchChannelHost = useMemo(() => {
    if (!activeWatchRoom) return false
    const ch = channels.find(c => c.id === activeWatchRoom.channelId)
    return ch?.role === 'OWNER' || ch?.role === 'ADMIN'
  }, [channels, activeWatchRoom])

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



      {/* Floating Watch Room Window */}
      {activeWatchRoom && (() => {
        return (
          <AnimatePresence>
            {isWatchWindowMinimized ? (
              <motion.div
                initial={{ opacity: 0, y: 50, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 30, scale: 0.95 }}
                className="fixed bottom-24 right-6 z-50 flex items-center gap-4 bg-card/65 backdrop-blur-md border border-white/5 rounded-2xl p-4 shadow-2xl min-w-[280px]"
              >
                <div className="relative">
                  <div className="h-10 w-10 rounded-xl bg-linear-to-br from-indigo-500/10 to-purple-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                    <Tv className="h-5 w-5 animate-pulse" />
                  </div>
                  <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-indigo-500 border-2 border-background animate-ping" />
                  <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-indigo-500 border-2 border-background" />
                </div>

                <div className="flex-1 min-w-0">
                  <h4 className="text-xs font-bold text-foreground truncate">{activeWatchRoom.groupName}</h4>
                  <p className="text-[10px] text-indigo-400 font-semibold tracking-wide uppercase mt-0.5">
                    Watch Party Active
                  </p>
                </div>

                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent/50"
                    onClick={() => setIsWatchWindowMinimized(false)}
                    title="Maximize"
                  >
                    <Maximize2 className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-lg text-red-400 hover:text-red-300 hover:bg-red-500/10"
                    onClick={() => {
                      localStorage.removeItem('twiky-active-watch-room')
                      window.dispatchEvent(new Event('twiky-watch-room-changed'))
                    }}
                    title="Leave Party"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="fixed inset-6 md:inset-auto md:bottom-6 md:right-[640px] md:w-[640px] md:h-[480px] z-50 bg-card/90 backdrop-blur-lg border border-white/5 rounded-3xl shadow-2xl flex flex-col overflow-hidden"
              >
                <div className="flex h-14 items-center justify-between border-b border-border/40 px-6 shrink-0 bg-accent/20">
                  <div className="flex items-center gap-3">
                    <Tv className="h-5 w-5 text-primary" />
                    <div>
                      <h3 className="text-sm font-bold text-foreground">{activeWatchRoom.groupName}</h3>
                      <p className="text-[10px] text-muted-foreground">Watch Party Stream</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent"
                      onClick={() => setIsWatchWindowMinimized(true)}
                      title="Minimize"
                    >
                      <Minimize2 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 rounded-lg text-red-400 hover:text-red-300 hover:bg-red-500/10"
                      onClick={() => {
                        localStorage.removeItem('twiky-active-watch-room')
                        window.dispatchEvent(new Event('twiky-watch-room-changed'))
                      }}
                      title="Leave"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="flex-1 overflow-hidden">
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
                    onLeave={() => {
                      localStorage.removeItem('twiky-active-watch-room')
                      window.dispatchEvent(new Event('twiky-watch-room-changed'))
                    }}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        )
      })()}
    </WorkspaceShellLayout>
  )
}
