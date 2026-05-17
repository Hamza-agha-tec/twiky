'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ChatWindow } from '@/components/chat/chat-window'
import { WorkspaceEmptyState } from '@/components/chat/workspace-empty-state'
import { useGroupMessageRealtime, useGroupMessages, useGroupMembers, useSendGroupMessage, useChannelGroups, backendGroupToMock } from '@/hooks/use-groups'
import { useCreateDirectConversation } from '@/hooks/use-direct-conversations'
import { useVoice } from '@/context/VoiceContext'
import { Button } from '@/components/ui/button'
import { Volume2, PhoneOff } from 'lucide-react'

import { useProfile } from '@/hooks/use-user'
import { VoiceGroupView } from '@/components/chat/voice-group-view'
import { WatchRoomView } from '@/components/watch/watch-room-view'
import { DirectProfileSidebar } from '@/components/chat/direct-profile-sidebar'
import { motion, AnimatePresence } from 'framer-motion'
import { useDmCallContext } from '@/context/DmCallContext'

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
  
  const backendGroup = channelGroups.find(g => g.id === gId)
  
  const voice = useVoice()
  const [isJoining, setIsJoining] = useState(false)
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null)

  // Handle Escape key to close sidebar or go back to channel home
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (selectedProfileId) {
          setSelectedProfileId(null)
        } else {
          router.push(`/channels/${channelId}`)
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [channelId, router, selectedProfileId])

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
      <div className="flex h-full w-full overflow-hidden">
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
        />
      </div>

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
