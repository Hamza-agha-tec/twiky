'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { WorkspaceEmptyState } from '@/components/chat/workspace-empty-state'
import { useGroupMessageRealtime, useGroupMessages, useGroupMembers, useSendGroupMessage, useChannelGroups, useToggleGroupMessageReaction, backendGroupToMock } from '@/hooks/use-groups'
import { useCreateDirectConversation } from '@/hooks/use-direct-conversations'
import { useVoice } from '@/context/VoiceContext'
import { Button } from '@/components/ui/button'
import { Volume2, PhoneOff, Tv } from 'lucide-react'

import { useProfile } from '@/hooks/use-user'
import { useOnlineUsers } from '@/hooks/use-socket'
import { VoiceGroupView } from '@/components/chat/voice-group-view'
import { WatchRoomView } from '@/components/watch/watch-room-view'
import { useDmCallContext } from '@/context/DmCallContext'
import { useChannels } from '@/hooks/use-channels'
import { BoardView } from '@/components/chat/board-view'
import { ChannelFeed, type FeedPost } from '@/components/chat/channel-feed'
import { MainArea, type MainAreaTab } from '@/components/chat/main-area'
import type { GroupMessage } from '@/lib/groups-api'

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

function ActiveVoiceBlockedView({ onDisconnect, groupName }: { onDisconnect: () => void; groupName: string }) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center bg-background relative overflow-hidden px-6">
      {/* Sleek radial backgrounds */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(99,102,241,0.06)_0%,transparent_70%)]" />
      <div className="absolute -top-40 -left-40 h-[400px] w-[400px] rounded-full bg-primary/5 blur-[128px]" />
      
      <div className="relative z-10 max-w-md w-full bg-card/45 backdrop-blur-md border border-white/5 rounded-2xl p-8 text-center shadow-2xl flex flex-col items-center gap-6">
        <div className="h-16 w-16 rounded-full bg-blue-500/10 flex items-center justify-center border border-blue-500/20 animate-pulse">
          <Volume2 className="h-6 w-6 text-blue-400" />
        </div>
        
        <div className="space-y-2">
          <h2 className="text-xl font-bold tracking-tight text-foreground">
            Voice Channel Active
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            You are currently connected to the voice channel <span className="font-semibold text-foreground">"{groupName}"</span>. Please disconnect from voice to join this watch room.
          </p>
        </div>

        <Button 
          onClick={onDisconnect}
          variant="destructive"
          className="w-full h-11 font-medium rounded-xl shadow-lg shadow-red-500/20 hover:shadow-red-500/35 transition-all duration-300 transform hover:scale-[1.02]"
        >
          Disconnect Voice
        </Button>
      </div>
    </div>
  )
}

function toFeedPosts(messages: GroupMessage[], myId?: string): FeedPost[] {
  return messages.map(msg => ({
    id: msg.id,
    author: msg.sender?.username ?? 'Unknown',
    authorId: msg.sender_id,
    authorAvatarUrl: msg.sender?.avatar_url ?? null,
    authorIsVerified: msg.sender?.is_verified ?? false,
    authorSubPlan: (msg.sender?.sub_plan as FeedPost['authorSubPlan']) ?? null,
    role: '',
    time: msg.created_at,
    body: msg.content ?? '',
    isOwn: msg.sender_id === myId,
    imageUrl: (msg.type === 'image' || msg.type === 'gif' || msg.type === 'sticker') ? (msg.file_url ?? undefined) : undefined,
    attachmentType: msg.type ?? undefined,
    attachmentMime: msg.mime ?? null,
    attachmentDuration: msg.duration ?? null,
    pinned: msg.is_pinned ?? false,
    reactions: (msg.reactions ?? []).map(r => {
      const users = Array.isArray(r.users) ? r.users : []
      return {
        emoji: r.emoji,
        count: users.length,
        mine: users.includes(myId ?? '')
      }
    }),
    replyCount: 0,
    embeds: msg.embeds ?? [],
  }))
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

  const { mutateAsync: sendMessage } = useSendGroupMessage(gId)
  const { mutate: toggleReaction } = useToggleGroupMessageReaction(gId, profile?.id)
  const [activeTab, setActiveTab] = useState<MainAreaTab>('feed')
  const { data: channelGroups = [], isLoading: groupsLoading } = useChannelGroups(channelId as string)
  const { data: channels = [] } = useChannels()
  const activeChannel = channels.find(c => c.id === channelId)
  
  const backendGroup = channelGroups.find(g => g.id === gId)
  
  const voice = useVoice()
  const onlineUsers = useOnlineUsers()
  const dmCall = useDmCallContext()

  // Handle Escape key to go back to channel home for non-text groups
  useEffect(() => {
    if (backendGroup?.group_type === 'text') return // Handled by MainArea which manages sidebars first
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') router.push(`/channels/${channelId}`)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [channelId, router, backendGroup?.group_type])

  // Sync voice meta for PiP
  useEffect(() => {
    if (voice.joinedGroupId === gId && backendGroup?.group_type === 'voice') {
      localStorage.setItem('twiky-active-voice-meta', JSON.stringify({ channelId, groupName: backendGroup.name }))
      window.dispatchEvent(new Event('twiky-voice-meta-changed'))
    }
  }, [voice.joinedGroupId, gId, channelId, backendGroup])

  // Sync active watch room for watch groups
  useEffect(() => {
    if (backendGroup?.group_type === 'watch') {
      const activeWatch = localStorage.getItem('twiky-active-watch-room')
      let shouldUpdate = true
      if (activeWatch) {
        try {
          const parsed = JSON.parse(activeWatch)
          if (parsed.roomId === gId) {
            shouldUpdate = false
          }
        } catch {
          shouldUpdate = true
        }
      }
      if (shouldUpdate) {
        localStorage.setItem('twiky-active-watch-room', JSON.stringify({
          roomId: gId,
          channelId: channelId as string,
          groupName: backendGroup.name
        }))
        window.dispatchEvent(new Event('twiky-watch-room-changed'))
      }
    }
  }, [gId, channelId, backendGroup])

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

  const isInDmCall = dmCall.status.state === 'active'

  if (isInDmCall && (group.kind === 'voice' || group.kind === 'watch')) {
    return (
      <ActiveCallBlockedView
        type={group.kind}
        onHangUp={() => dmCall.hangUp()}
      />
    )
  }

  if (group.kind === 'watch' && voice.joinedGroupId) {
    let activeVoiceName = 'active voice channel'
    if (typeof window !== 'undefined') {
      const raw = localStorage.getItem('twiky-active-voice-meta')
      if (raw) {
        try {
          const parsed = JSON.parse(raw)
          if (parsed.groupName) activeVoiceName = parsed.groupName
        } catch {}
      }
    }

    return (
      <ActiveVoiceBlockedView
        groupName={activeVoiceName}
        onDisconnect={() => voice.leave()}
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
    return (
      <div className="flex h-full w-full items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Tv className="h-10 w-10 text-muted-foreground animate-pulse" />
          <p className="text-sm font-semibold text-foreground">Joining Watch Party...</p>
        </div>
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
          onViewProfile={() => {}}
        />
      </div>
    )
  }

  const workspaceChannel = {
    id: activeChannel?.id ?? gId,
    label: activeChannel?.name ?? '',
    description: activeChannel?.description ?? '',
    membersLabel: '',
    groups: channelGroups.map(backendGroupToMock),
    avatarUrl: activeChannel?.avatar_url ?? undefined,
    bannerUrl: activeChannel?.banner_url ?? undefined,
    access_type: activeChannel?.access_type as any,
    role: activeChannel?.role as any,
    owner_id: activeChannel?.owner_id,
    type: (activeChannel?.type as any) ?? 'NORMAL',
  }

  return (
    <MainArea
      activeChannel={workspaceChannel}
      activeGroup={group}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      members={members}
      onlineUsers={onlineUsers}
      onEscape={() => router.push(`/channels/${channelId}`)}
      onMemberMessage={(userId) => createDm(userId, {
        onSuccess: (data) => { if (data?.id) router.push(`/dm/${data.id}`) }
      })}
    >
      <ChannelFeed
        channel={workspaceChannel}
        group={group}
        members={members}
        myAvatarUrl={profile?.avatar_url}
        postsOverride={toFeedPosts(messages, profile?.id)}
        onSendPost={async (payload) => {
          await sendMessage({
            content: payload.content,
            fileUrl: payload.fileUrl,
            replyToId: payload.replyToId,
            type: payload.type,
            mime: payload.mime,
            duration: payload.duration,
            size: payload.size,
          })
        }}
        onOpenDirectConversation={(target) => {
          const userId = typeof target === 'string' ? target : target.id
          if (!userId) return
          createDm(userId, {
            onSuccess: (data) => { if (data?.id) router.push(`/dm/${data.id}`) }
          })
        }}
        onToggleReaction={(postId, emoji) => toggleReaction({ messageId: postId, emoji })}
      />
    </MainArea>
  )
}
