'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ChatWindow } from '@/components/chat/chat-window'
import { WorkspaceEmptyState } from '@/components/chat/workspace-empty-state'
import { useGroupMessageRealtime, useGroupMessages, useGroupMembers, useSendGroupMessage, useChannelGroups, backendGroupToMock } from '@/hooks/use-groups'
import { useCreateDirectConversation } from '@/hooks/use-direct-conversations'
import { useVoice } from '@/context/VoiceContext'
import { Button } from '@/components/ui/button'
import { Volume2, PhoneOff, Tv, Crown, MessageSquare, User, Users } from 'lucide-react'

import { useProfile } from '@/hooks/use-user'
import { useOnlineUsers } from '@/hooks/use-socket'
import { VoiceGroupView } from '@/components/chat/voice-group-view'
import { WatchRoomView } from '@/components/watch/watch-room-view'
import { DirectProfileSidebar } from '@/components/chat/direct-profile-sidebar'
import { motion, AnimatePresence } from 'framer-motion'
import { VerifiedBadge } from '@/components/chat/verified-badge'
import { UserAvatar } from '@/components/chat/user-avatar'
import { useDmCallContext } from '@/context/DmCallContext'
import { useChannels } from '@/hooks/use-channels'
import { BoardView } from '@/components/chat/board-view'

function ActiveCallBlockedView({ onHangUp, type }: { onHangUp: () => void; type: 'voice' | 'watch' }) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center bg-background relative overflow-hidden px-6">
      {/* Sleek radial backgrounds */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(99,102,241,0.06)_0%,transparent_70%)]" />
      <div className="absolute -top-40 -left-40 h-[400px] w-[400px] rounded-full bg-primary/5 blur-[128px]" />
      
      <div className="relative z-10 max-w-md w-full bg-card/45 backdrop-blur-md border border-white/5 rounded-2xl p-8 text-center shadow-2xl flex flex-col items-center gap-6">
        <div className="h-16 w-16 rounded-full bg-red-500/10 flex items-center justify-center border border-red-500/20 animate-pulse">
          <PhoneOff className="h-6 w-6 text-red-400" />
        </div>
        
        <div className="space-y-2">
          <h2 className="text-xl font-bold tracking-tight text-foreground">
            Ongoing Call Active
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            You are currently in a direct call. Please hang up your active call to join this {type === 'voice' ? 'voice channel' : 'watch room'}.
          </p>
        </div>

        <Button 
          onClick={onHangUp}
          variant="destructive"
          className="w-full h-11 font-medium rounded-xl shadow-lg shadow-red-500/20 hover:shadow-red-500/35 transition-all duration-300 transform hover:scale-[1.02]"
        >
          Hang Up Call
        </Button>
      </div>
    </div>
  )
}

function GroupInfoDashboard({
  group,
  members,
  onJoin,
  onMessage,
  onViewProfile,
  isVoice,
  voice,
  channelId,
}: {
  group: any
  members: any[]
  onJoin: () => void
  onMessage: (userId: string) => void
  onViewProfile: (userId: string) => void
  isVoice: boolean
  voice: any
  channelId: string
}) {
  const Icon = isVoice ? Volume2 : Tv

  return (
    <div className="flex h-full w-full flex-col bg-background relative overflow-hidden p-6 md:p-10">
      {/* Sleek dynamic backgrounds */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(99,102,241,0.04)_0%,transparent_60%)]" />
      <div className="absolute -top-40 -right-40 h-[400px] w-[400px] rounded-full bg-primary/5 blur-[128px]" />

      <div className="relative z-10 flex flex-col md:flex-row gap-8 items-start justify-between w-full border-b border-border/40 pb-8">
        <div className="flex items-center gap-5">
          <div className="h-16 w-16 rounded-2xl bg-linear-to-br from-indigo-500/10 to-purple-500/10 border border-white/5 shadow-inner flex items-center justify-center text-primary relative">
            <Icon className="h-7 w-7" />
            <span className="absolute -bottom-1 -right-1 h-3.5 w-3.5 rounded-full bg-emerald-500 border-2 border-background animate-ping" />
            <span className="absolute -bottom-1 -right-1 h-3.5 w-3.5 rounded-full bg-emerald-500 border-2 border-background" />
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl font-bold tracking-tight text-foreground">{group.label}</h1>
              <span className="text-[10px] font-bold tracking-wider uppercase bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                {isVoice ? 'Voice Call' : 'Watch Room'}
              </span>
            </div>
            <p className="text-sm text-muted-foreground max-w-xl">
              {group.description || `Welcome to ${group.label}! Join to collaborate in real-time.`}
            </p>
          </div>
        </div>

        <Button
          onClick={onJoin}
          className="h-11 px-6 font-semibold rounded-xl bg-primary text-primary-foreground hover:bg-primary/95 shadow-md shadow-primary/15 transition-all duration-300 shrink-0 transform hover:scale-[1.02]"
        >
          {isVoice ? 'Join Voice Group' : 'Join Watch Room'}
        </Button>
      </div>

      <div className="relative z-10 flex-1 overflow-y-auto mt-8">
        <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground/60 mb-5">
          Channel Members ({members.length})
        </h3>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {members.map((member) => {
            const u = member.user
            if (!u) return null
            const isOwner = member.role === 'OWNER'
            const isAdmin = member.role === 'ADMIN'

            return (
              <div 
                key={u.id} 
                className="group relative flex items-center gap-3.5 bg-card/35 hover:bg-card/75 border border-white/5 hover:border-white/10 rounded-2xl p-4.5 transition-all duration-300"
              >
                <div className="relative">
                  <UserAvatar src={u.avatar_url} alt={u.username} className="h-11 w-11 rounded-xl shadow-inner border border-white/5" />
                  {isOwner && (
                    <span className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-amber-500 shadow-md shadow-amber-500/20 border border-background">
                      <Crown className="h-2.5 w-2.5 text-white" />
                    </span>
                  )}
                </div>

                <div className="min-w-0 flex-1 space-y-0.5">
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-sm text-foreground truncate">{u.username}</span>
                    {u.is_verified && <VerifiedBadge className="h-3.5 w-3.5 text-primary shrink-0" />}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-muted-foreground/80 font-medium">
                      {isOwner ? 'Creator' : isAdmin ? 'Admin' : 'Member'}
                    </span>
                    {u.sub_plan && u.sub_plan !== 'FREE' && (
                      <span className="text-[8px] font-extrabold bg-linear-to-r from-amber-500 to-orange-500 text-white px-1.5 py-0.2 rounded-full uppercase tracking-wider scale-[0.9]">
                        {u.sub_plan}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8.5 w-8.5 rounded-lg border border-border/40 hover:bg-accent/80"
                    onClick={() => onMessage(u.id)}
                    title="Send DM"
                  >
                    <MessageSquare className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8.5 w-8.5 rounded-lg border border-border/40 hover:bg-accent/80"
                    onClick={() => onViewProfile(u.id)}
                    title="View Profile"
                  >
                    <User className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default function GroupPage() {
  const { channelId, groupId } = useParams()
  const router = useRouter()
  const gId = groupId as string
  
  // Initialize realtime hooks
  useGroupMessageRealtime(gId)
  
  const { data: messages = [] } = useGroupMessages(gId)
  const { data: members = [] } = useGroupMembers(gId)
  const { data: profile } = useProfile()
  const { mutate: createDm } = useCreateDirectConversation()

  const { mutate: sendMessage } = useSendGroupMessage(gId)
  const { data: channelGroups = [], isLoading: groupsLoading } = useChannelGroups(channelId as string)
  const { data: channels = [] } = useChannels()
  const activeChannel = channels.find(c => c.id === channelId)
  
  const backendGroup = channelGroups.find(g => g.id === gId)
  
  const voice = useVoice()
  const onlineUsers = useOnlineUsers()
  const [showMembers, setShowMembers] = useState(false)
  const [isJoining, setIsJoining] = useState(false)
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null)

  // Handle Escape key to close sidebar or go back to channel home
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (selectedProfileId) {
          setSelectedProfileId(null)
        } else if (showMembers) {
          setShowMembers(false)
        } else {
          router.push(`/channels/${channelId}`)
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [channelId, router, selectedProfileId, showMembers])

  if (!backendGroup) {
    if (groupsLoading) {
      return (
        <div className="flex h-full w-full items-center justify-center bg-background">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      )
    }
    return <WorkspaceEmptyState title="Group not found" subtitle="The group you are looking for does not exist." showShortcuts={false} />
  }

  const group = backendGroupToMock(backendGroup)

  const dmCall = useDmCallContext()
  const isInDmCall = dmCall.status.state === 'active'

  if (isInDmCall && (group.kind === 'voice' || group.kind === 'watch')) {
    return (
      <ActiveCallBlockedView
        type={group.kind}
        onHangUp={() => dmCall.hangUp()}
      />
    )
  }

  if (group.kind === 'voice') {
    return (
      <div className="flex h-full w-full overflow-hidden bg-background">
        <VoiceGroupView
          group={group}
          channelId={channelId as string}
          participants={voice.participantsByGroup[gId] || []}
          isJoined={voice.joinedGroupId === gId}
          isMuted={voice.isMuted}
          joinedAt={voice.joinedAt}
          myId={profile?.id}
          onJoin={() => voice.join(gId)}
          onLeave={() => voice.leave()}
          onToggleMute={() => voice.toggleMute()}
          onKick={(userId) => voice.kick(userId, gId)}
          onPlaySound={(sound) => voice.playSound(sound)}
          onSendVoiceInvite={(inviteeId) => voice.sendVoiceInvite(inviteeId, gId, group.label)}
          soundboardUserId={voice.soundboardUserId}
          soundboardIntensity={voice.soundboardIntensity}
          deafened={false}
          remoteStreams={voice.webrtc.remoteStreams}
          remoteScreenStreams={voice.webrtc.remoteScreenStreams}
          addVideoTrack={voice.webrtc.addVideoTrack}
          removeVideoTrack={voice.webrtc.removeVideoTrack}
          onScreenShareToggle={voice.webrtc.signalScreenShare}
          onSwitchAudioInput={voice.webrtc.switchAudioInput}
          localScreenStream={voice.webrtc.localScreenStream}
          isScreenSharing={voice.webrtc.isScreenSharing}
        />
      </div>
    )
  }

  if (group.kind === 'watch') {
    const myMemberInfo = members.find(m => m.user?.id === profile?.id)
    const isHost = myMemberInfo?.role === 'OWNER' || myMemberInfo?.role === 'ADMIN'

    return (
      <div className="flex h-full w-full overflow-hidden bg-background">
        <WatchRoomView
          roomId={gId}
          userId={profile?.id || ''}
          username={profile?.username || ''}
          fullname={profile?.fullname || profile?.full_name}
          avatarUrl={profile?.avatar_url}
          bannerUrl={profile?.banner}
          subPlan={profile?.sub_plan}
          isVerified={profile?.is_verified}
          isHost={isHost}
          onLeave={() => router.push(`/channels/${channelId}`)}
        />
      </div>
    )
  }

  if (group.kind === 'board') {
    return (
      <div className="flex h-full w-full overflow-hidden bg-background">
        <BoardView
          key={group.id}
          groupId={group.id}
          groupName={group.label}
          channelName={activeChannel?.name || ''}
          channelAvatar={activeChannel?.avatar_url || undefined}
          myId={profile?.id}
          isAdmin={activeChannel?.role === 'OWNER' || activeChannel?.role === 'ADMIN'}
          onMessage={async (userId) => {
            createDm(userId, {
              onSuccess: (data) => {
                if (data?.id) {
                  router.push(`/dm/${data.id}`)
                }
              }
            })
          }}
          onViewProfile={(userId) => setSelectedProfileId(userId)}
        />
      </div>
    )
  }

  const onlineMembers = members.filter((m) => m.user?.id && onlineUsers.has(m.user.id))
  const offlineMembers = members.filter((m) => !m.user?.id || !onlineUsers.has(m.user.id))

  return (
    <div className="flex h-full w-full overflow-hidden relative bg-background">
      <div className="flex-1 min-w-0 h-full">
        <ChatWindow
          activeChat={gId}
          chatOverride={{
            name: group.label || 'Group Chat',
          }}
          messages={messages as any}
          onSendMessage={(payload) => {
            sendMessage({
              content: payload.content || '',
              fileUrl: payload.fileUrl || undefined,
              replyToId: payload.replyToId
            })
          }} 
          onStartDirectMessage={(userId) => {
            createDm(userId, {
              onSuccess: (data) => {
                if (data?.id) {
                  router.push(`/dm/${data.id}`)
                }
              }
            })
          }}
          onViewMessageProfile={(userId) => {
            setSelectedProfileId(userId)
          }}
          onToggleMembers={() => setShowMembers(v => !v)}
        />
      </div>

      <AnimatePresence>
        {showMembers && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 240, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="flex-shrink-0 border-l border-border bg-sidebar h-full overflow-hidden flex flex-col z-20"
          >
            <div className="flex h-14 shrink-0 items-center justify-between border-b border-border/40 px-4 bg-background">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-foreground">Members</span>
                <span className="rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
                  {members.length}
                </span>
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto px-2 py-3 space-y-4">
              {/* Online */}
              {onlineMembers.length > 0 && (
                <div>
                  <p className="mb-1.5 px-1 text-[9.5px] font-bold uppercase tracking-[0.1em] text-muted-foreground/60">
                    Online — {onlineMembers.length}
                  </p>
                  <div className="space-y-0.5">
                    {onlineMembers.map((m) => {
                      const u = m.user
                      if (!u) return null
                      const isOwner = m.role === 'OWNER'
                      const isAdmin = m.role === 'ADMIN'
                      return (
                        <div
                          key={u.id}
                          onClick={() => setSelectedProfileId(u.id)}
                          className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-accent/40 cursor-pointer transition-colors"
                        >
                          <div className="relative flex-shrink-0">
                            <UserAvatar src={u.avatar_url ?? undefined} alt={u.username ?? ''} className="h-6 w-6 rounded-full" />
                            <span className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full border border-sidebar bg-emerald-500" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <span className="truncate text-xs font-medium text-foreground block">{u.username}</span>
                          </div>
                          {isOwner && <Crown className="h-3 w-3 text-amber-500 shrink-0" />}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Offline */}
              {offlineMembers.length > 0 && (
                <div>
                  <p className="mb-1.5 px-1 text-[9.5px] font-bold uppercase tracking-[0.1em] text-muted-foreground/60">
                    Offline — {offlineMembers.length}
                  </p>
                  <div className="space-y-0.5">
                    {offlineMembers.map((m) => {
                      const u = m.user
                      if (!u) return null
                      const isOwner = m.role === 'OWNER'
                      const isAdmin = m.role === 'ADMIN'
                      return (
                        <div
                          key={u.id}
                          onClick={() => setSelectedProfileId(u.id)}
                          className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-accent/40 cursor-pointer transition-colors opacity-70"
                        >
                          <div className="relative flex-shrink-0">
                            <UserAvatar src={u.avatar_url ?? undefined} alt={u.username ?? ''} className="h-6 w-6 rounded-full grayscale" />
                            <span className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full border border-sidebar bg-muted-foreground/40" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <span className="truncate text-xs font-medium text-foreground block">{u.username}</span>
                          </div>
                          {isOwner && <Crown className="h-3 w-3 text-amber-500/50 shrink-0" />}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selectedProfileId && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 300, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="flex-shrink-0 border-l border-border bg-sidebar hidden lg:block h-full z-10 absolute right-0 top-0 bottom-0 shadow-2xl lg:relative lg:shadow-none overflow-hidden"
          >
            <div className="w-[300px] h-full">
              <DirectProfileSidebar
                userId={selectedProfileId}
                onClose={() => setSelectedProfileId(null)}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
