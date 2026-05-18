'use client'

import { useParams, useRouter } from 'next/navigation'
import { ChannelsPanel } from '@/components/chat/channels-panel'
import { useChannels } from '@/hooks/use-channels'
import { useChannelGroups, backendGroupToMock, useGroupsRealtime, useCreateGroup } from '@/hooks/use-groups'
import { WorkspaceEmptyState } from '@/components/chat/workspace-empty-state'
import { useVoice } from '@/context/VoiceContext'
import { useWatchPresence } from '@/context/WatchPresenceContext'
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

  // Subscribe to voice room presence for this channel's voice groups
  useEffect(() => {
    const voiceGroupIds = channelGroups
      .filter(g => g.group_type === 'voice')
      .map(g => g.id)
    if (!voiceGroupIds.length) return

    let socket: Awaited<ReturnType<typeof getSocket>> | null = null
    let cancelled = false

    const subscribe = (s: Awaited<ReturnType<typeof getSocket>>) => {
      s.emit('subscribe-voice-rooms', { roomIds: voiceGroupIds })
    }

    getSocket().then(s => {
      if (cancelled) return
      socket = s
      subscribe(s)
      s.on('connect', () => subscribe(s))
    })

    return () => {
      cancelled = true
      socket?.emit('unsubscribe-voice-rooms', { roomIds: voiceGroupIds })
    }
  }, [channelGroups])

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
