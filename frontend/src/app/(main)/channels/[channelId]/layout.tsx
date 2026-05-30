'use client'

import { useParams, useRouter } from 'next/navigation'
import { ChannelsPanel } from '@/components/chat/channels-panel'
import { useChannels } from '@/hooks/use-channels'
import { useChannelGroups, backendGroupToMock, useGroupsRealtime, useCreateGroup } from '@/hooks/use-groups'
import { WorkspaceEmptyState } from '@/components/chat/workspace-empty-state'
import { useVoice } from '@/context/VoiceContext'
import { useWatchPresence } from '@/context/WatchPresenceContext'
import { usePixelPresence } from '@/context/PixelPresenceContext'
import { useProfile } from '@/hooks/use-user'
import { useEffect, useState } from 'react'
import { useOnlineUsers } from '@/hooks/use-socket'
import { getSocket } from '@/lib/socket'

export default function ChannelLayout({ children }: { children: React.ReactNode }) {
  const { channelId, groupId } = useParams()
  const router = useRouter()
  
  // Realtime updates for groups in this channel
  useGroupsRealtime(channelId as string)

  const { data: channels = [], isLoading: channelsLoading } = useChannels()
  const { data: channelGroups = [], isLoading: groupsLoading } = useChannelGroups(channelId as string)
  const { data: profile } = useProfile()
  const { mutateAsync: createGroupAsync } = useCreateGroup(channelId as string)
  
  const voice = useVoice()
  const { watchParticipants, watchSessionStarts, setGroupParticipants, setGroupSessionStart } = useWatchPresence()
  const { pixelParticipants, pixelSessionStarts, setGroupParticipants: setPixelParticipants, setGroupSessionStart: setPixelSessionStarts, updateSpeaking: updatePixelSpeaking } = usePixelPresence()
  const onlineUsers = useOnlineUsers()
  const [voiceTimer, setVoiceTimer] = useState<string>('00:00')

  // Watch room real-time participants synchronization
  useEffect(() => {
    let mounted = true

    getSocket().then((socket) => {
      if (!mounted) return

      const onWatchParticipants = (data: any) => {
        if (!mounted) return
        const { roomId, participants, sessionStartedAt } = data
        setGroupParticipants(roomId, participants)
        setGroupSessionStart(roomId, sessionStartedAt ?? null)
      }

      socket.on('watch:participants', onWatchParticipants)
      socket.emit('getWatchPresence')

      const onConnect = () => { socket.emit('getWatchPresence') }
      socket.on('connect', onConnect)

      return () => {
        socket.off('watch:participants', onWatchParticipants)
        socket.off('connect', onConnect)
      }
    })

    return () => { mounted = false }
  }, [setGroupParticipants, setGroupSessionStart])

  // Pixel room participants
  const pixelGroupIdsKey = channelGroups.filter(g => g.group_type === 'pixel-room').map(g => g.id).join(',')
  useEffect(() => {
    const pixelGroupIds = pixelGroupIdsKey ? pixelGroupIdsKey.split(',') : []
    if (!pixelGroupIds.length) return
    let cancelled = false
    let socket: Awaited<ReturnType<typeof getSocket>> | null = null

    const onPixelParticipants = (data: { groupId: string; participants: { userId: string; username: string; avatarUrl?: string | null; bannerUrl?: string | null; subPlan?: string | null; micMuted: boolean; isSpeaking: boolean }[]; sessionStartedAt?: number | null }) => {
      if (!pixelGroupIds.includes(data.groupId)) return
      setPixelParticipants(data.groupId, data.participants)
      setPixelSessionStarts(data.groupId, data.sessionStartedAt ?? null)
    }
    const onPixelSpeaking = (data: { groupId: string; userId: string; speaking: boolean }) => {
      if (!pixelGroupIds.includes(data.groupId)) return
      updatePixelSpeaking(data.groupId, data.userId, data.speaking)
    }

    getSocket().then(s => {
      if (cancelled) return
      socket = s
      s.emit('subscribe-pixel-rooms', { groupIds: pixelGroupIds })
      s.on('pixel-room:participants', onPixelParticipants)
      s.on('pixel-room:speaking', onPixelSpeaking)
    })
    return () => {
      cancelled = true
      if (socket) {
        socket.emit('unsubscribe-pixel-rooms', { groupIds: pixelGroupIds })
        socket.off('pixel-room:participants', onPixelParticipants)
        socket.off('pixel-room:speaking', onPixelSpeaking)
      }
    }
  }, [pixelGroupIdsKey]) // eslint-disable-line react-hooks/exhaustive-deps

  // Subscribe socket to voice room presence rooms — fast path, no extra render cycle
  const voiceGroupIdsKey = channelGroups.filter(g => g.group_type === 'voice').map(g => g.id).join(',')
  useEffect(() => {
    const voiceGroupIds = voiceGroupIdsKey ? voiceGroupIdsKey.split(',') : []
    if (!voiceGroupIds.length) return
    let cancelled = false
    let socket: Awaited<ReturnType<typeof getSocket>> | null = null
    const onConnect = () => socket?.emit('subscribe-voice-rooms', { roomIds: voiceGroupIds })
    getSocket().then(s => {
      if (cancelled) return
      socket = s
      s.emit('subscribe-voice-rooms', { roomIds: voiceGroupIds })
      s.on('connect', onConnect)
    })
    return () => {
      cancelled = true
      if (socket) {
        socket.emit('unsubscribe-voice-rooms', { roomIds: voiceGroupIds })
        socket.off('connect', onConnect)
      }
    }
  }, [voiceGroupIdsKey]) // eslint-disable-line react-hooks/exhaustive-deps

  // Voice call duration timer
  useEffect(() => {
    if (!voice.isJoined || !voice.joinedAt) {
      setVoiceTimer('00:00')
      return
    }
    const interval = setInterval(() => {
      const diff = Date.now() - voice.joinedAt
      const m = Math.floor(diff / 60000)
      const s = Math.floor((diff % 60000) / 1000)
      setVoiceTimer(`${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`)
    }, 1000)
    return () => clearInterval(interval)
  }, [voice.isJoined, voice.joinedAt])

  const backendChannel = channels.find(c => c.id === channelId)

  if (!backendChannel) {
    if (channelsLoading) {
      return (
        <div className="flex h-full w-full items-center justify-center bg-background">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      )
    }
    return <WorkspaceEmptyState title="Channel not found" subtitle="The channel you are looking for does not exist or you do not have access." showShortcuts={false} />
  }

  const workspaceChannel = {
    id: backendChannel.id,
    label: backendChannel.name,
    description: backendChannel.description ?? '',
    membersLabel: '',
    groups: channelGroups.map(backendGroupToMock),
    avatarUrl: backendChannel.avatar_url ?? undefined,
    bannerUrl: backendChannel.banner_url ?? undefined,
    access_type: backendChannel.access_type as any,
    role: backendChannel.role as any,
    owner_id: backendChannel.owner_id,
    type: (backendChannel.type as any) ?? 'NORMAL',
  }

  const gId = groupId as string | undefined

  return (
    <div className="flex h-full w-full overflow-hidden">
      {/* Groups Sidebar (Channel Panel) */}
      <div className="flex-shrink-0 border-r border-border hidden md:block">
        <ChannelsPanel
          channel={workspaceChannel}
          activeGroup={gId}
          visible={true}
          myId={profile?.id}
          onlineUsers={onlineUsers}
          // Voice props
          voiceParticipants={voice.participantsByGroup}
          activeVoiceGroupId={voice.joinedGroupId}
          voiceIsMuted={voice.isMuted}
          voiceTimer={voiceTimer}
          onVoiceLeave={voice.leave}
          onVoiceToggleMute={voice.toggleMute}
          onMoveVoiceParticipant={(payload) => voice.moveUser(payload.userId, payload.fromGroupId, payload.toGroupId)}
          onKickVoiceParticipant={(targetId) => voice.kick(targetId)}
          soundboardUserId={voice.soundboardUserId}
          soundboardIntensity={voice.soundboardIntensity}
          // Pixel room props
          pixelParticipants={pixelParticipants}
          pixelSessionStarts={pixelSessionStarts}
          activePixelGroupId={groupId as string | undefined}
          // Watch props
          watchParticipants={watchParticipants}
          watchSessionStarts={watchSessionStarts}
          onCreateGroup={async (values) => {
            await createGroupAsync({
              name: values.name,
              description: values.description,
              group_type: values.group_type,
              access_type: values.access_type,
            })
          }}
          onSelectGroup={(id) => {
            const group = workspaceChannel.groups.find(g => g.id === id)
            // Navigate to group page regardless of type, where they can click Join
            if (id !== gId) {
              router.push(`/channels/${channelId}/group/${id}`)
            }
          }}
        />
      </div>

      {/* Main Content Area (Group Chat or Empty State) */}
      <div className="flex-1 flex flex-col min-w-0 bg-background">
        {children}
      </div>
    </div>
  )
}
