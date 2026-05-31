'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useParams, useRouter } from 'next/navigation'
import { WorkspaceEmptyState } from '@/components/chat/workspace-empty-state'
import { useGroupMessageRealtime, useGroupMessages, useGroupMembers, useSendGroupMessage, useChannelGroups, useToggleGroupMessageReaction, backendGroupToMock } from '@/hooks/use-groups'
import { useCreateDirectConversation } from '@/hooks/use-direct-conversations'
import { useVoice } from '@/context/VoiceContext'
import { usePixelPresence } from '@/context/PixelPresenceContext'
import { Button } from '@/components/ui/button'
import { AudioLines, Gamepad2, PhoneOff, Popcorn } from 'lucide-react'

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

// ── Pixel Room gate — registers active room into context, blocks on conflicts ─
interface PixelRoomGateProps {
  groupId: string
  channelId: string
  groupName: string
  voiceActive: boolean
  watchActive: boolean
  callActive: boolean
  activeVoiceName: string
  watchRoomName: string
  onVoiceLeave: () => void
  onWatchLeave: () => void
  onCallHangup: () => void
}

function PixelRoomGate({
  groupId, channelId, groupName,
  voiceActive, watchActive, callActive,
  activeVoiceName, watchRoomName,
  onVoiceLeave, onWatchLeave, onCallHangup,
}: PixelRoomGateProps) {
  const router = useRouter()
  const pixel = usePixelPresence()
  const blocked = voiceActive || watchActive || callActive

  const setActiveRoom = pixel.setActiveRoom
  const activeRoomId = pixel.activeRoom?.groupId
  useEffect(() => {
    if (blocked) return
    if (activeRoomId !== groupId) {
      setActiveRoom({ groupId, channelId, groupName })
    }
  }, [blocked, groupId, channelId, groupName, activeRoomId, setActiveRoom])

  if (blocked) {
    return (
      <div className="relative flex h-full w-full overflow-hidden bg-background">
        {voiceActive && (
          <BlockedOverlay
            icon={<AudioLines className="h-6 w-6 text-muted-foreground" />}
            title="Voice Channel Active"
            description={<>Connected to <span className="font-medium text-foreground">"{activeVoiceName}"</span>. Disconnect to enter this pixel room.</>}
            btnText="Disconnect Voice"
            onAction={onVoiceLeave}
            onCancel={() => router.back()}
          />
        )}
        {!voiceActive && watchActive && (
          <BlockedOverlay
            icon={<Popcorn className="h-6 w-6 text-muted-foreground" />}
            title="Watch Room Active"
            description={<>You're watching <span className="font-medium text-foreground">"{watchRoomName}"</span>. Leave to enter this pixel room.</>}
            btnText="Leave Watch Room"
            onAction={onWatchLeave}
            onCancel={() => router.back()}
          />
        )}
        {!voiceActive && !watchActive && callActive && (
          <BlockedOverlay
            icon={<PhoneOff className="h-6 w-6 text-muted-foreground" />}
            title="Direct Call Active"
            description="Hang up your current call to enter this pixel room."
            btnText="Hang Up Call"
            onAction={onCallHangup}
            onCancel={() => router.back()}
          />
        )}
      </div>
    )
  }

  // Render-empty: PersistentPixelRoom in layout draws the room.
  return <div className="h-full w-full bg-background" />
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
  const pixel = usePixelPresence()
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

  // Navigate when admin moves us to a different voice group in this channel
  useEffect(() => {
    if (backendGroup?.group_type !== 'voice') return
    const handler = (e: Event) => {
      const { targetRoomId } = (e as CustomEvent).detail
      if (!targetRoomId || targetRoomId === gId) return
      const targetGroup = channelGroups.find(g => g.id === targetRoomId)
      if (targetGroup) {
        router.push(`/channels/${channelId}/group/${targetRoomId}`)
      }
    }
    window.addEventListener('twiky-voice-moved', handler)
    return () => window.removeEventListener('twiky-voice-moved', handler)
  }, [backendGroup?.group_type, gId, channelId, channelGroups, router])

  // Sync voice meta for PiP
  useEffect(() => {
    if (voice.joinedGroupId === gId && backendGroup?.group_type === 'voice') {
      localStorage.setItem('twiky-active-voice-meta', JSON.stringify({ channelId, groupName: backendGroup.name }))
      window.dispatchEvent(new Event('twiky-voice-meta-changed'))
    }
  }, [voice.joinedGroupId, gId, channelId, backendGroup])

  // Sync active watch room for watch groups — skip on page reload
  const isPageReload = useRef(
    typeof performance !== 'undefined' &&
    (performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined)?.type === 'reload'
  )
  useEffect(() => {
    if (isPageReload.current) return
    if (backendGroup?.group_type === 'watch' && !voice.joinedGroupId) {
      const activeWatch = localStorage.getItem('twiky-active-watch-room')
      let shouldUpdate = true
      if (activeWatch) {
        try {
          const parsed = JSON.parse(activeWatch)
          if (parsed.roomId === gId) shouldUpdate = false
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

  const activePixelName = pixel.activeRoom?.groupName ?? 'pixel room'

  if (group.kind === 'voice') {
    const watchBlocked = !!activeWatchRoomLS
    const callBlocked = isInDmCall
    const pixelBlocked = !!pixel.activeRoom
    const isBlocked = watchBlocked || callBlocked || pixelBlocked

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
          {!watchBlocked && pixelBlocked && (
            <BlockedOverlay
              icon={<Gamepad2 className="h-6 w-6 text-muted-foreground" />}
              title="Pixel Room Active"
              description={<>You're in <span className="font-medium text-foreground">"{activePixelName}"</span>. Leave to join this voice channel.</>}
              btnText="Leave Pixel Room"
              onAction={() => pixel.leaveRoom()}
              onCancel={() => router.back()}
            />
          )}
          {!watchBlocked && !pixelBlocked && callBlocked && (
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
          localCameraStream={voice.webrtc.localCameraStream}
          isScreenSharing={voice.webrtc.isScreenSharing}
        />
      </div>
    )
  }

  if (group.kind === 'watch') {
    const voiceBlocked = !!voice.joinedGroupId
    const callBlocked = isInDmCall
    const pixelBlocked = !!pixel.activeRoom
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
        {!voiceBlocked && pixelBlocked && (
          <BlockedOverlay
            icon={<Gamepad2 className="h-6 w-6 text-muted-foreground" />}
            title="Pixel Room Active"
            description={<>You're in <span className="font-medium text-foreground">"{activePixelName}"</span>. Leave to join this watch room.</>}
            btnText="Leave Pixel Room"
            onAction={() => pixel.leaveRoom()}
            onCancel={() => router.back()}
          />
        )}
        {!voiceBlocked && !pixelBlocked && callBlocked && (
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

  if (group.kind === 'pixel-room') {
    return (
      <PixelRoomGate
        groupId={gId}
        channelId={channelId as string}
        groupName={group.label}
        voiceActive={!!voice.joinedGroupId}
        watchActive={!!activeWatchRoomLS}
        callActive={isInDmCall}
        activeVoiceName={activeVoiceName}
        watchRoomName={watchRoomName}
        onVoiceLeave={() => voice.leave()}
        onWatchLeave={() => {
          localStorage.removeItem('twiky-active-watch-room')
          window.dispatchEvent(new Event('twiky-watch-room-changed'))
        }}
        onCallHangup={() => dmCall.hangUp()}
      />
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
