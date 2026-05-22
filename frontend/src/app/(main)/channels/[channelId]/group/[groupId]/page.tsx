'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { WorkspaceEmptyState } from '@/components/chat/workspace-empty-state'
import { useGroupMessageRealtime, useGroupMessages, useGroupMembers, useSendGroupMessage, useChannelGroups, useToggleGroupMessageReaction, backendGroupToMock } from '@/hooks/use-groups'
import { useCreateDirectConversation } from '@/hooks/use-direct-conversations'
import { useVoice } from '@/context/VoiceContext'
import { Button } from '@/components/ui/button'
import { AudioLines, PhoneOff, Popcorn } from 'lucide-react'

import { useProfile } from '@/hooks/use-user'
import { useOnlineUsers } from '@/hooks/use-socket'
import { VoiceEventBanner } from '@/components/chat/voice-event-banner'
import { VoiceGroupView } from '@/components/chat/voice-group-view'
import { useChannelEventLive } from '@/hooks/use-channel-event-live'
import { CHANNEL_EVENTS_KEY, channelsApi } from '@/lib/channels-api'
import { isEventLive, resolveActiveEvent } from '@/lib/event-utils'
import { groupsApi, type VoiceEvent } from '@/lib/groups-api'
import { WatchRoomView } from '@/components/watch/watch-room-view'
import { useDmCallContext } from '@/context/DmCallContext'
import { useChannels } from '@/hooks/use-channels'
import { BoardView } from '@/components/chat/board-view'
import { ChannelFeed, type FeedPost } from '@/components/chat/channel-feed'
import { MainArea, type MainAreaTab } from '@/components/chat/main-area'
import type { GroupMessage } from '@/lib/groups-api'

// ── Blocked overlay modal — shown on top of blurred background content ───
interface BlockedOverlayProps {
  icon: React.ReactNode
  title: string
  description: React.ReactNode
  btnText: string
  onAction: () => void
  onCancel: () => void
}

function BlockedOverlay({ icon, title, description, btnText, onAction, onCancel }: BlockedOverlayProps) {
  if (typeof document === 'undefined') return null
  return createPortal(
    <div className="fixed inset-0 z-[200] flex items-center justify-center backdrop-blur-[6px] bg-background/70">
      <div className="relative w-full max-w-[340px] mx-5 rounded-2xl border border-border bg-card shadow-2xl overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
        <div className="flex flex-col items-center gap-4 px-7 py-8 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted border border-border">
            {icon}
          </div>
          <div className="space-y-1.5">
            <h2 className="text-[15px] font-semibold text-foreground">{title}</h2>
            <p className="text-[13px] text-muted-foreground leading-relaxed">{description}</p>
          </div>
          <div className="w-full h-px bg-border" />
          <div className="flex w-full gap-2">
            <Button
              onClick={onCancel}
              variant="ghost"
              className="flex-1 h-10 text-[13px] font-medium rounded-xl"
            >
              Cancel
            </Button>
            <Button
              onClick={onAction}
              variant="destructive"
              className="flex-1 h-10 text-[13px] font-medium rounded-xl"
            >
              {btnText}
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body
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
  const searchParams = useSearchParams()
  const queryClient = useQueryClient()
  const gId = groupId as string
  const eventId = searchParams.get('event')
  
  // Initialize realtime hooks
  useGroupMessageRealtime(gId)
  
  const { data: messages = [] } = useGroupMessages(gId)
  const { data: members = [] } = useGroupMembers(gId)
  const { data: profile } = useProfile()
  const { mutate: createDm } = useCreateDirectConversation()

  const { mutateAsync: sendMessage } = useSendGroupMessage(gId)
  const { mutate: toggleReaction } = useToggleGroupMessageReaction(gId, profile?.id)
  const [activeTab, setActiveTab] = useState<MainAreaTab>('feed')
  const [startingEvent, setStartingEvent] = useState(false)
  const { data: channelGroups = [], isLoading: groupsLoading } = useChannelGroups(channelId as string)
  const { data: channels = [] } = useChannels()
  const activeChannel = channels.find(c => c.id === channelId)
  const canManageChannel =
    activeChannel?.role === 'OWNER' ||
    activeChannel?.role === 'ADMIN' ||
    (!!profile?.id && activeChannel?.owner_id === profile.id)

  const { data: channelEvents = [] } = useQuery({
    queryKey: CHANNEL_EVENTS_KEY(channelId as string),
    queryFn: () => channelsApi.getChannelEvents(channelId as string),
    enabled: !!channelId,
  })

  const backendGroup = channelGroups.find(g => g.id === gId)

  const activeEvent =
    backendGroup?.group_type === 'voice'
      ? resolveActiveEvent(channelEvents, gId, eventId)
      : null

  const eventBlocksJoin = !!activeEvent && !isEventLive(activeEvent)

  useChannelEventLive(
    channelId as string,
    backendGroup?.group_type === 'voice' ? gId : undefined,
    eventId,
    canManageChannel,
  )
  
  const voice = useVoice()
  const onlineUsers = useOnlineUsers()
  const dmCall = useDmCallContext()

  // Track active watch room as React state so clearing localStorage triggers re-render
  const [activeWatchRoomLS, setActiveWatchRoomLS] = useState<string | null>(() => {
    if (typeof window !== 'undefined') return localStorage.getItem('twiky-active-watch-room')
    return null
  })

  useEffect(() => {
    const handler = () => setActiveWatchRoomLS(localStorage.getItem('twiky-active-watch-room'))
    window.addEventListener('twiky-watch-room-changed', handler)
    window.addEventListener('storage', handler)
    return () => {
      window.removeEventListener('twiky-watch-room-changed', handler)
      window.removeEventListener('storage', handler)
    }
  }, [])

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
    if (backendGroup?.group_type === 'watch' && !voice.joinedGroupId) {
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
  }, [gId, channelId, backendGroup, voice.joinedGroupId])

  // Cannot stay in voice while waiting for a scheduled event to start
  useEffect(() => {
    if (!eventBlocksJoin || backendGroup?.group_type !== 'voice') return
    if (voice.joinedGroupId === gId) {
      void voice.leave()
    }
  }, [eventBlocksJoin, backendGroup?.group_type, gId, voice])

  async function handleJoinEvent() {
    if (eventBlocksJoin) {
      toast.error('Event has not started yet')
      return
    }
    try {
      await voice.join(gId)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to join'
      toast.error(message)
    }
  }

  async function handleStartEvent() {
    if (!activeEvent) return
    setStartingEvent(true)
    try {
      const started = await groupsApi.startGroupEvent(activeEvent.group_id, activeEvent.id)
      queryClient.setQueryData<VoiceEvent[]>(
        CHANNEL_EVENTS_KEY(channelId as string),
        (prev) => {
          if (!prev?.length) return prev
          return prev.map((e) => (e.id === started.id ? { ...e, ...started } : e))
        },
      )
      if (voice.joinedGroupId !== gId) {
        await voice.join(gId)
      }
      toast.success('Event started — members can join now')
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to start event'
      toast.error(message)
    } finally {
      setStartingEvent(false)
    }
  }

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

  // Compute blocked states
  let watchRoomName = 'watch room'
  if (activeWatchRoomLS) {
    try { watchRoomName = JSON.parse(activeWatchRoomLS).groupName || watchRoomName } catch {}
  }

  let activeVoiceName = 'voice channel'
  if (typeof window !== 'undefined') {
    const raw = localStorage.getItem('twiky-active-voice-meta')
    if (raw) { try { const p = JSON.parse(raw); if (p.groupName) activeVoiceName = p.groupName } catch {} }
  }

  if (group.kind === 'voice') {
    const watchBlocked = !!activeWatchRoomLS
    const callBlocked = isInDmCall
    const isBlocked = watchBlocked || callBlocked

    if (isBlocked) {
      // Don't mount VoiceGroupView — it auto-joins on mount via useEffect
      return (
        <div className="relative flex h-full w-full overflow-hidden bg-background">
          {watchBlocked && (
            <BlockedOverlay
              icon={<Popcorn className="h-6 w-6 text-muted-foreground" />}
              title="Watch Room Active"
              description={<>You're watching <span className="font-medium text-foreground">"{watchRoomName}"</span>. Leave to join this voice channel.</>}
              btnText="Leave Watch Room"
              onAction={() => {
                localStorage.removeItem('twiky-active-watch-room')
                window.dispatchEvent(new Event('twiky-watch-room-changed'))
              }}
              onCancel={() => router.back()}
            />
          )}
          {callBlocked && (
            <BlockedOverlay
              icon={<PhoneOff className="h-6 w-6 text-muted-foreground" />}
              title="Direct Call Active"
              description="Hang up your current call to join this voice channel."
              btnText="Hang Up Call"
              onAction={() => dmCall.hangUp()}
              onCancel={() => router.back()}
            />
          )}
        </div>
      )
    }

    return (
      <div className="flex h-full w-full flex-col overflow-hidden">
        {activeEvent && (
          <VoiceEventBanner
            event={activeEvent}
            canManage={canManageChannel}
            isJoined={voice.joinedGroupId === gId}
            onJoin={handleJoinEvent}
            onStart={handleStartEvent}
            starting={startingEvent}
          />
        )}
        <div className="min-h-0 flex-1">
        <VoiceGroupView
          group={group}
          channelId={channelId as string}
          participants={voice.participantsByGroup[gId] || []}
          isJoined={voice.joinedGroupId === gId}
          isMuted={voice.isMuted}
          joinedAt={voice.joinedAt}
          myId={profile?.id}
          disableAutoJoin={!!activeEvent}
          eventNotStarted={eventBlocksJoin}
          onJoin={handleJoinEvent}
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
          localCameraStream={voice.webrtc.localCameraStream}
          isScreenSharing={voice.webrtc.isScreenSharing}
        />
        </div>
      </div>
    )
  }

  if (group.kind === 'watch') {
    const voiceBlocked = !!voice.joinedGroupId
    const callBlocked = isInDmCall
    return (
      <div className="relative flex h-full w-full items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Popcorn className="h-10 w-10 text-muted-foreground animate-pulse" />
          <p className="text-sm font-semibold text-foreground">Joining Watch Party...</p>
        </div>
        {voiceBlocked && (
          <BlockedOverlay
            icon={<AudioLines className="h-6 w-6 text-muted-foreground" />}
            title="Voice Channel Active"
            description={<>Connected to <span className="font-medium text-foreground">"{activeVoiceName}"</span>. Disconnect to join this watch room.</>}
            btnText="Disconnect Voice"
            onAction={() => voice.leave()}
            onCancel={() => router.back()}
          />
        )}
        {callBlocked && (
          <BlockedOverlay
            icon={<PhoneOff className="h-6 w-6 text-muted-foreground" />}
            title="Direct Call Active"
            description="Hang up your current call to join this watch room."
            btnText="Hang Up Call"
            onAction={() => dmCall.hangUp()}
            onCancel={() => router.back()}
          />
        )}
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
