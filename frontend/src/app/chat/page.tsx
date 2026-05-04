'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { BookUser, ListTodo, MessageSquare, Target } from 'lucide-react'

import {
  ChannelFeed,
  buildStandaloneFeedMemberProfile,
  FeedMemberProfileView,
  type FeedDirectConversationTarget,
} from '@/components/chat/channel-feed'
import {
  buildChannelGroup,
  buildWorkspaceChannel,
  ChannelsPanel,
  getMockChannel,
  getMockGroup,
  type MockChannelGroup,
  type VoiceParticipant,
  type WorkspaceChannel,
} from '@/components/chat/channels-panel'
import { ChatWindow } from '@/components/chat/chat-window'
import { VoiceGroupView } from '@/components/chat/voice-group-view'
import { useVoicePresence, type VoicePresenceUser } from '@/hooks/use-voice-presence'
import { useWebRTC } from '@/hooks/use-webrtc'
import { DirectProfileSidebar } from '@/components/chat/direct-profile-sidebar'
import { FeedProfileSidebarDock } from '@/components/chat/feed-profile-sidebar-dock'
import { GoalsPanel } from '@/components/chat/goals-panel'
import { ActiveView, IconRail } from '@/components/chat/icon-rail'
import { MainArea, MainAreaTab } from '@/components/chat/main-area'
import { NotesPanel } from '@/components/chat/notes-panel'
import { TasksPanel } from '@/components/chat/tasks-panel'
import { WorkspaceEmptyState } from '@/components/chat/workspace-empty-state'
import { AddFriendsView } from '@/components/chat/views/add-friends-view'
import { DiscoverChannelsView } from '@/components/chat/views/discover-channels-view'
import { NotificationsView } from '@/components/chat/views/notifications-view'
import { StoreView } from '@/components/chat/views/store-view'
import { PixelRoomGame } from '@/components/game/pixel-room-game'
import {
  WorkspaceMode,
  WorkspaceNavTarget,
  WorkspaceSidebar,
} from '@/components/chat/workspace-sidebar'
import type { CreateEntityValues } from '@/components/chat/create-entity-dialog'
import { useChannels, useCreateChannel, useUpdateChannel, useChannelMembers, CHANNEL_KEYS, CHANNEL_MEMBER_KEYS } from '@/hooks/use-channels'
import { useCreateGroup, useGroupMembers, useGroupMessages, useGroupMessageRealtime, backendGroupToMock } from '@/hooks/use-groups'
import { useToggleGroupMessageReaction } from '@/hooks/use-groups'
import { groupsApi, type BackendGroup, type GroupJoinRequest, type GroupMessage } from '@/lib/groups-api'
import { useQueryClient, useQueries } from '@tanstack/react-query'
import { GROUP_KEYS } from '@/hooks/use-groups'
import type { FeedPost } from '@/components/chat/channel-feed'
import { type ChatMessage } from '@/hooks/use-messaging'
import { useMutualFollowers, useProfile } from '@/hooks/use-user'
import { useNotifications, useMarkAsRead } from '@/hooks/use-notifications'
import type { BackendChannel } from '@/lib/channel-api'
import { filesApi } from '@/lib/files-api'
import { type Chat } from '@/lib/mock-data'
import { useRouter } from 'next/navigation'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { DIRECT_KEYS, useCreateDirectConversation, useDirectConversations, useDirectMessages, useDirectMessageRealtime, useSendDirectMessage, useToggleDirectMessageReaction } from '@/hooks/use-direct-conversations'
import { useVoiceInvitationListener } from '@/hooks/use-voice-invitation-listener'
import { invitationsApi, type Invitation } from '@/lib/invitations-api'
import { getSocket } from '@/lib/socket'
import { useStoriesFeed, useCreateStory, useDeleteStory, useRecordView } from '@/hooks/use-stories'
import { StoriesStrip, type StoryBubble } from '@/components/chat/stories-strip'
import { StoryViewer, type StorySlide } from '@/components/chat/story-viewer'
import { StoryUploadDialog } from '@/components/chat/story-upload-dialog'
import { useDmCall } from '@/hooks/use-dm-call'
import { DmCallIncoming } from '@/components/chat/dm-call-incoming'
import { DmCallWindow, DmCallOutgoing } from '@/components/chat/dm-call-window'
import { useOnlineUsers, usePresenceSocket } from '@/hooks/use-socket'
import type { Socket } from 'socket.io-client'
import { toast } from 'sonner'

type JoinRequestPayload = {
  requestId: string
  groupId: string
  groupName: string
  user: { id: string; username: string | null; avatar_url: string | null }
  createdAt: string
}

type ChannelJoinRequestPayload = {
  requestId: string
  channelId: string
  channelName: string
  user: { id: string; username: string | null; avatar_url: string | null }
  createdAt: string
}

type ChatSurface =
  | 'channel'
  | 'direct'
  | 'personal-goals'
  | 'personal-notes'
  | 'personal-tasks'

type PersistedChatState = {
  activeChannelId: string
  activeDirectChat: string | null
  activeGroupId: string
  activeSurface: ChatSurface
  activeView: ActiveView
  channelTab: MainAreaTab
  settingsSection: string
  syntheticDirectChats: Record<string, FeedDirectConversationTarget>
  syntheticDirectMessages: Record<string, ChatMessage[]>
  workspaceCollapsed: boolean
  workspaceMode: WorkspaceMode
}

const PERSONAL_SURFACE_META = {
  'personal-notes': {
    icon: BookUser,
    title: 'My Notes',
    description: 'Personal notes that belong to you, not to a channel or group.',
  },
  'personal-tasks': {
    icon: ListTodo,
    title: 'My Tasks',
    description: 'Your own tasks and deadlines across the workspace.',
  },
  'personal-goals': {
    icon: Target,
    title: 'My Goals',
    description: 'Personal goals that sit outside any shared channel.',
  },
} as const

const CHAT_VIEW_STATE_KEY = 'twiky-chat-view-state'
const CHAT_SURFACES = ['channel', 'direct', 'personal-goals', 'personal-notes', 'personal-tasks'] as const
const WORKSPACE_MODES = ['direct', 'channels'] as const
const MAIN_AREA_TABS = ['feed', 'notes', 'tasks', 'goals'] as const
const ACTIVE_VIEWS = ['chat', 'discover-channels', 'settings', 'store', 'add-friends', 'notifications', 'game'] as const

function versionedAssetUrl(url: string) {
  const separator = url.includes('?') ? '&' : '?'
  return `${url}${separator}v=${Date.now()}`
}

function isOneOf<T extends readonly string[]>(value: unknown, options: T): value is T[number] {
  return typeof value === 'string' && options.includes(value as T[number])
}

function readPersistedChatState(): Partial<PersistedChatState> {
  if (typeof window === 'undefined') return {}

  try {
    const raw = localStorage.getItem(CHAT_VIEW_STATE_KEY)
    if (!raw) return {}

    const parsed = JSON.parse(raw) as Record<string, unknown>
    const next: Partial<PersistedChatState> = {}

    if (typeof parsed.activeChannelId === 'string') next.activeChannelId = parsed.activeChannelId
    if (parsed.activeDirectChat === null || typeof parsed.activeDirectChat === 'string') {
      next.activeDirectChat = parsed.activeDirectChat
    }
    if (typeof parsed.activeGroupId === 'string') next.activeGroupId = parsed.activeGroupId
    if (isOneOf(parsed.activeSurface, CHAT_SURFACES)) next.activeSurface = parsed.activeSurface
    if (isOneOf(parsed.activeView, ACTIVE_VIEWS)) next.activeView = parsed.activeView
    if (isOneOf(parsed.channelTab, MAIN_AREA_TABS)) next.channelTab = parsed.channelTab
    if (typeof parsed.settingsSection === 'string') next.settingsSection = parsed.settingsSection
    next.syntheticDirectChats = {}
    next.syntheticDirectMessages = {}
    if (typeof parsed.workspaceCollapsed === 'boolean') {
      next.workspaceCollapsed = parsed.workspaceCollapsed
    }
    if (isOneOf(parsed.workspaceMode, WORKSPACE_MODES)) {
      next.workspaceMode = parsed.workspaceMode
    }

    if (next.activeDirectChat && !/^[0-9a-f-]{36}$/i.test(next.activeDirectChat)) {
      next.activeDirectChat = null
    }

    return next
  } catch {
    return {}
  }
}

function toSlug(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'channel'
}

function createUniqueId(base: string, existingIds: string[]) {
  let nextId = base
  let suffix = 2
  while (existingIds.includes(nextId)) { nextId = `${base}-${suffix}`; suffix++ }
  return nextId
}

function getChannelRoleLabel(role?: string | null) {
  if (!role) return 'Member'
  return role.charAt(0).toUpperCase() + role.slice(1).toLowerCase()
}

const ROLE_RANK: Record<string, number> = { Owner: 3, Admin: 2, Member: 1 }
function getEffectiveRole(channelRole?: string, groupRole?: string): string {
  const cr = channelRole ?? 'Member'
  const gr = groupRole ?? 'Member'
  return (ROLE_RANK[cr] ?? 1) >= (ROLE_RANK[gr] ?? 1) ? cr : gr
}

function toWorkspaceChannel(
  channel: BackendChannel,
  index: number,
  groupsByChannel: Record<string, MockChannelGroup[]>,
): WorkspaceChannel {
  const base = buildWorkspaceChannel({
    id: channel.id,
    label: channel.name,
    description: channel.description ?? undefined,
    index,
  })

  return {
    ...base,
    avatarUrl: channel.avatar_url ?? undefined,
    bannerUrl: channel.banner_url ?? undefined,
    groups: groupsByChannel[channel.id] ?? base.groups,
    membersLabel: getChannelRoleLabel(channel.role),
    access_type: channel.access_type,
    role: (channel.role as 'OWNER' | 'ADMIN' | 'MEMBER') ?? 'MEMBER',
    type: channel.type ?? 'NORMAL',
  }
}

type ChatPageProps = {
  lockedView?: ActiveView
  hideRail?: boolean
}

export function ChatPageContent({ lockedView, hideRail = false }: ChatPageProps = {}) {
  const [viewStateReady, setViewStateReady] = useState(false)
  const [activeDirectChat, setActiveDirectChat] = useState<string | null>(null)
  const [typingConversations, setTypingConversations] = useState<Record<string, boolean>>({})
  const [activeViewState, setActiveViewState] = useState<ActiveView>(lockedView ?? 'chat')
  const activeView = lockedView ?? activeViewState
  const setActiveView = useCallback(
    (view: ActiveView) => {
      if (!lockedView) {
        setActiveViewState(view)
      }
    },
    [lockedView],
  )

  const [settingsSection, setSettingsSection] = useState<string>('account')
  const [localAvatar, setLocalAvatar] = useState<string | null>(null)
  const [activeSurface, setActiveSurface] = useState<ChatSurface>('direct')
  const [workspaceMode, setWorkspaceMode] = useState<WorkspaceMode>('direct')
  const [workspaceCollapsed, setWorkspaceCollapsed] = useState(false)
  const [channelTab, setChannelTab] = useState<MainAreaTab>('feed')
  const [syntheticDirectChats, setSyntheticDirectChats] = useState<
    Record<string, FeedDirectConversationTarget>
  >({})
  const [syntheticDirectMessages, setSyntheticDirectMessages] = useState<
    Record<string, ChatMessage[]>
  >({})
  const [channelGroupsById, setChannelGroupsById] = useState<Record<string, MockChannelGroup[]>>({})
  const [activeChannelId, setActiveChannelId] = useState('')
  const [activeGroupId, setActiveGroupId] = useState('')
  const [channelFeedClosed, setChannelFeedClosed] = useState(false)
  const [activeVoiceGroupId, setActiveVoiceGroupId] = useState<string | null>(null)
  const [deafened, setDeafened] = useState(false)
  const [pendingJoinRequests, setPendingJoinRequests] = useState<Record<string, JoinRequestPayload[]>>({})
  const [voiceProfileTarget, setVoiceProfileTarget] = useState<VoicePresenceUser | null>(null)
  const [voiceElapsed, setVoiceElapsed] = useState<string | null>(null)
  const voiceElapsedRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [showDirectProfile, setShowDirectProfile] = useState(false)
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({})
  const [channelAssets, setChannelAssets] = useState<Record<string, { avatar: string | null; banner: string | null }>>(() => {
    return {}
  })

  const [storyViewUserId, setStoryViewUserId] = useState<string | null>(null)
  const [storyUploadOpen, setStoryUploadOpen] = useState(false)

  const queryClient = useQueryClient()
  const { data: profile } = useProfile()
  usePresenceSocket(Boolean(profile?.id))
  const onlineUsers = useOnlineUsers()

  const { status: dmCallStatus, startCall, acceptCall, rejectCall, hangUp } = useDmCall({ myId: profile?.id })
  const [dmCallMinimized, setDmCallMinimized] = useState(false)

  // Reset minimized when a new call starts
  useEffect(() => {
    if (dmCallStatus.state === 'active') setDmCallMinimized(false)
  }, [dmCallStatus.state])

  const dmContactAction = useCallback(async (targetUserId: string, path: string, body: Record<string, unknown>) => {
    const { createClient } = await import('@/utils/supabase/client')
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    const token = session?.access_token ?? ''
    const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3500'
    await fetch(`${API_URL}/contacts/${targetUserId}/${path}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  }, [])

  const { data: storiesFeed = [] } = useStoriesFeed()
  const createStory = useCreateStory()
  const deleteStory = useDeleteStory()
  const recordView = useRecordView()

  const storyBubbles: StoryBubble[] = (() => {
    const ownGroup = storiesFeed.find((g) => g.user.id === profile?.id)
    const others = storiesFeed.filter((g) => g.user.id !== profile?.id)
    const own: StoryBubble = {
      userId: profile?.id ?? 'me',
      username: profile?.username ?? 'You',
      avatar_url: profile?.avatar_url ?? null,
      hasStory: (ownGroup?.stories.length ?? 0) > 0,
      hasUnseen: false,
      isOwn: true,
    }
    const rest: StoryBubble[] = others.map((g) => ({
      userId: g.user.id,
      username: g.user.username,
      avatar_url: g.user.avatar_url ?? null,
      hasStory: g.stories.length > 0,
      hasUnseen: g.stories.length > 0,
      isOwn: false,
    }))
    return [own, ...rest]
  })()

  const storySlides: StorySlide[] = storiesFeed.flatMap((g) =>
    g.stories.map((s) => ({
      id: s.id,
      media_url: s.media_url,
      type: s.type,
      caption: s.caption,
      created_at: s.created_at,
      user: g.user,
      isOwn: g.user.id === profile?.id,
      viewsCount: s.views_count?.[0]?.count ?? 0,
    }))
  )

  const storyStartId = storyViewUserId
    ? (storiesFeed.find((g) => g.user.id === storyViewUserId)?.stories[0]?.id ?? storySlides[0]?.id ?? '')
    : ''

  const voiceMyInfo = profile
    ? {
        id: profile.id,
        name: profile.fullname ?? profile.username ?? 'You',
        avatarUrl: profile.avatar_url,
        bannerUrl: profile.banner ?? null,
        subPlan: profile.sub_plan ?? null,
        isVerified: profile.is_verified ?? null,
        enterSoundUrl: profile.enter_sound_url ?? null,
      }
    : null
  const { data: directConversations = [] } = useDirectConversations()
  const { data: mutualFollowers = [] } = useMutualFollowers()
  const createDirectConversation = useCreateDirectConversation()

  const [startDmOpen, setStartDmOpen] = useState(false)
  const [startDmQuery, setStartDmQuery] = useState('')
  const { data: allNotifications = [] } = useNotifications()
  const unreadNotificationCount = allNotifications.filter((n) => !n.is_read && n.type !== 'MENTION').length
  const { data: backendChannels = [] } = useChannels()
  const createChannel = useCreateChannel()
  const updateChannel = useUpdateChannel()
  const channelGroupQueries = useQueries({
    queries: backendChannels.map((ch) => ({
      queryKey: GROUP_KEYS.byChannel(ch.id),
      queryFn: () => groupsApi.getChannelGroups(ch.id),
      staleTime: 30_000,
      enabled: !!ch.id,
    })),
  })

  const allBackendGroupsById = useMemo(() => {
    const result: Record<string, ReturnType<typeof backendGroupToMock>[]> = {}
    backendChannels.forEach((ch, idx) => {
      const data = channelGroupQueries[idx]?.data
      if (data) result[ch.id] = data.map(backendGroupToMock)
    })
    return result
  }, [backendChannels, channelGroupQueries])

  const mergedGroupsById = useMemo(
    () => ({ ...channelGroupsById, ...allBackendGroupsById }),
    [allBackendGroupsById, channelGroupsById],
  )

  const createGroup = useCreateGroup(activeChannelId)
  const isRealGroupId = /^[0-9a-f-]{36}$/i.test(activeGroupId)
  const { data: rawMessages } = useGroupMessages(isRealGroupId ? activeGroupId : undefined)
  useGroupMessageRealtime(isRealGroupId ? activeGroupId : undefined)
  const toggleGroupReaction = useToggleGroupMessageReaction(activeGroupId)
  const { data: activeGroupMembers = [] } = useGroupMembers(isRealGroupId ? activeGroupId : undefined)
  const isRealVoiceGroupId = /^[0-9a-f-]{36}$/i.test(activeVoiceGroupId ?? '')
  const { data: voiceGroupMembers = [] } = useGroupMembers(isRealVoiceGroupId ? (activeVoiceGroupId ?? undefined) : undefined)
  const isRealChannelId = /^[0-9a-f-]{36}$/i.test(activeChannelId)
  const { data: activeChannelMembers = [] } = useChannelMembers(isRealChannelId ? activeChannelId : undefined)

  const groupPosts: FeedPost[] = useMemo(() => {
  const groupMessageById = new Map((rawMessages ?? []).map((msg) => [msg.id, msg]))
  const channelMemberRoleByUserId = new Map(
    activeChannelMembers
      .filter((member) => member.user)
      .map((member) => [member.user.id, getChannelRoleLabel(member.role)]),
  )
  const groupMemberRoleByUserId = new Map(
    activeGroupMembers
      .filter((member) => member.user)
      .map((member) => [member.user.id, getChannelRoleLabel(member.role)]),
  )
  const groupMemberNameByUserId = new Map(
    activeGroupMembers
      .filter((member) => member.user)
      .map((member) => [
        member.user.id,
        member.user.fullname ?? member.user.full_name ?? member.user.username ?? 'Unknown',
      ]),
  )
  const groupReplyCounts = (rawMessages ?? []).reduce((counts, msg) => {
    if (!msg.reply_to_id) return counts
    counts.set(msg.reply_to_id, (counts.get(msg.reply_to_id) ?? 0) + 1)
    return counts
  }, new Map<string, number>())
  return (rawMessages ?? []).map((msg: GroupMessage) => {
    const isSystem = !msg.sender_id
    const replySource = msg.reply_to_id ? groupMessageById.get(msg.reply_to_id) : null
    const replyBody = replySource?.content?.trim()
      || (replySource?.file_url ? 'Attachment' : '')

    const normalizedReactions = Array.isArray((msg as any).reactions)
      ? (msg as any).reactions
          .filter((reaction: any) => reaction && typeof reaction.emoji === 'string')
          .map((reaction: any) => {
            const users = Array.isArray(reaction.users)
              ? reaction.users.filter((id: unknown): id is string => typeof id === 'string')
              : []
            return {
              emoji: reaction.emoji,
              count: users.length,
              mine: users.includes(profile?.id ?? ''),
              users: users.map((id: string) => ({
                id,
                name: groupMemberNameByUserId.get(id) ?? 'Unknown',
              })),
            }
          })
          .filter((reaction: { count: number }) => reaction.count > 0)
      : []

    return {
      id: msg.id,
      author: isSystem ? 'System' : (msg.sender?.fullname ?? msg.sender?.full_name ?? msg.sender?.username ?? 'Unknown'),
      authorId: msg.sender_id,
      authorAvatarUrl: isSystem ? null : (msg.sender?.avatar_url ?? null),
      authorIsVerified: Boolean(msg.sender?.is_verified || msg.sender?.sub_plan === 'PRO' || msg.sender?.sub_plan === 'GEEK'),
      authorSubPlan: msg.sender?.sub_plan ?? null,
      isSystem,
      role: isSystem ? 'Automation' : getEffectiveRole(channelMemberRoleByUserId.get(msg.sender_id), groupMemberRoleByUserId.get(msg.sender_id)),
      time: new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      body: msg.content,
      isOwn: msg.sender_id === profile?.id,
      imageUrl: msg.file_url ?? undefined,
      attachmentType: (msg as any).type ?? undefined,
      attachmentMime: (msg as any).mime ?? undefined,
      attachmentDuration: (msg as any).duration ?? undefined,
      pinned: Boolean(msg.is_pinned),
      reactions: normalizedReactions,
      replyCount: groupReplyCounts.get(msg.id) ?? 0,
      replyTo: replySource
        ? {
            author: replySource.sender?.username ?? 'Unknown',
            body: replyBody.slice(0, 60) + (replyBody.length > 60 ? '...' : ''),
          }
        : undefined,
    }
  })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawMessages, activeGroupMembers, activeChannelMembers, profile?.id])

  const activeSyntheticChat = activeDirectChat ? (syntheticDirectChats[activeDirectChat] ?? null) : null
  const activeIsRealDirect = Boolean(activeDirectChat && /^[0-9a-f-]{36}$/i.test(activeDirectChat))
  const visibleDirectConversationId = activeView === 'chat' && activeSurface === 'direct' && activeIsRealDirect
    ? activeDirectChat
    : undefined
  const { data: activeDirectRealMessages = [] } = useDirectMessages(activeIsRealDirect ? activeDirectChat : null)
  const handleIncomingDirectMessage = useCallback((message: ChatMessage, isVisibleConversation: boolean) => {
    if (isVisibleConversation) {
      setUnreadCounts((prev) =>
        prev[message.conversation_id] ? { ...prev, [message.conversation_id]: 0 } : prev,
      )
      return
    }

    setUnreadCounts((prev) => ({
      ...prev,
      [message.conversation_id]: (prev[message.conversation_id] ?? 0) + 1,
    }))
  }, [])
  useDirectMessageRealtime(visibleDirectConversationId, profile?.id, {
    onIncomingMessage: handleIncomingDirectMessage,
  })

  useEffect(() => {
    let mounted = true
    getSocket().then((socket) => {
      if (!mounted) return
      const onUserTyping = ({ userId, isTyping, conversationId: convId }: { userId: string; isTyping: boolean; conversationId?: string }) => {
        if (!mounted || userId === profile?.id) return
        const id = convId ?? visibleDirectConversationId
        if (!id) return
        setTypingConversations((prev) => ({ ...prev, [id]: isTyping }))
        if (isTyping) {
          setTimeout(() => {
            if (mounted) setTypingConversations((prev) => ({ ...prev, [id]: false }))
          }, 4000)
        }
      }
      socket.on('userTyping', onUserTyping)
      return () => { socket.off('userTyping', onUserTyping) }
    })
    return () => { mounted = false }
  }, [profile?.id, visibleDirectConversationId])

  const sendDirectMessage = useSendDirectMessage(activeDirectChat ?? '')
  const toggleDirectReaction = useToggleDirectMessageReaction(activeDirectChat ?? '')

  const mentionedGroupIds = useMemo(
    () => new Set(
      allNotifications
        .filter((n) => !n.is_read && n.type === 'MENTION')
        .flatMap((n) => {
          const candidates: string[] = []
          if (typeof n.metadata?.group_id === 'string') candidates.push(n.metadata.group_id)
          if (typeof n.metadata?.channel_group_id === 'string') candidates.push(n.metadata.channel_group_id)
          if (n.entity_type?.toLowerCase().includes('group')) candidates.push(n.entity_id)
          // fallback: entity_id itself might be the group UUID
          if (n.entity_id) candidates.push(n.entity_id)
          return candidates
        }),
    ),
    [allNotifications],
  )

  const workspaceChannels = useMemo(
    () =>
      backendChannels.map((channel, index) => {
        const wc = toWorkspaceChannel(channel, index, mergedGroupsById)
        return {
          ...wc,
          groups: wc.groups.map((g) => ({
            ...g,
            hasMention: mentionedGroupIds.has(g.id),
          })),
        }
      }),
    [backendChannels, mergedGroupsById, mentionedGroupIds],
  )

  const voiceGroupIds = useMemo(
    () => workspaceChannels.flatMap((channel) =>
      channel.groups.filter((group) => group.kind === 'voice').map((group) => group.id),
    ),
    [workspaceChannels],
  )

  const voice = useVoicePresence(voiceMyInfo, voiceGroupIds, (payload) => {
    const { groupId, groupName, inviterName, inviterAvatar } = payload
    toast.custom(
      (t) => (
        <div className="flex w-80 items-start gap-3 rounded-2xl border border-border bg-popover p-4 shadow-xl">
          {inviterAvatar ? (
            <img src={inviterAvatar} alt={inviterName} className="h-9 w-9 shrink-0 rounded-full object-cover" />
          ) : (
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[13px] font-bold text-primary">
              {inviterName[0]?.toUpperCase()}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-[12px] font-semibold text-foreground">
              <span className="text-primary">{inviterName}</span> invited you to join
            </p>
            <p className="text-[11px] text-muted-foreground">#{groupName}</p>
            <div className="mt-2.5 flex gap-2">
              <button
                onClick={() => {
                  toast.dismiss(t)
                  const ch = workspaceChannels.find((c) => c.groups.some((g) => g.id === groupId))
                  if (ch) { setActiveChannelId(ch.id); setActiveGroupId(groupId) }
                  setActiveVoiceGroupId(groupId)
                  void voice.join(groupId)
                }}
                className="rounded-lg bg-primary px-3 py-1.5 text-[11px] font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
              >
                Join
              </button>
              <button
                onClick={() => toast.dismiss(t)}
                className="rounded-lg bg-muted px-3 py-1.5 text-[11px] font-semibold text-foreground transition-colors hover:bg-accent"
              >
                Decline
              </button>
            </div>
          </div>
        </div>
      ),
      { duration: 30000, id: `voice-invite-${groupId}` },
    )
  })

  const webrtc = useWebRTC(voice.joinedGroupId, profile?.id ?? null, voice.isMuted)

  const handleCameraToggle = useCallback(async (enabled: boolean) => {
    const groupId = voice.joinedGroupId
    if (!groupId) return
    const socket = await getSocket()
    socket.emit('voice-room-video-toggle', { roomId: groupId, enabled })
  }, [voice.joinedGroupId])

  useEffect(() => {
    voice.setSpeaking(webrtc.isSpeaking)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [webrtc.isSpeaking])

  useEffect(() => {
    setActiveVoiceGroupId(voice.joinedGroupId)
  }, [voice.joinedGroupId])

  const handleJoinVoiceGroup = useCallback((groupId: string) => {
    const channelForGroup = workspaceChannels.find((ch) => ch.groups.some((g) => g.id === groupId))
    if (channelForGroup) {
      setActiveChannelId(channelForGroup.id)
      setActiveGroupId(groupId)
    }
    setActiveVoiceGroupId(groupId)
    void voice.join(groupId)
  }, [workspaceChannels, voice])

  useVoiceInvitationListener(profile?.id, (invitation: Invitation) => {
    const inviterName = invitation.inviter?.username ?? 'Someone'

    if (invitation.entity_type === 'CHANNEL') {
      const channel = workspaceChannels.find((c) => c.id === invitation.entity_id)
      const channelName = channel?.label ?? 'a channel'
      toast.custom(
        (t) => (
          <div className="flex w-80 items-start gap-3 rounded-2xl border border-border bg-popover p-4 shadow-xl">
            {invitation.inviter?.avatar_url ? (
              <img src={invitation.inviter.avatar_url} alt={inviterName} className="h-9 w-9 shrink-0 rounded-full object-cover" />
            ) : (
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[13px] font-bold text-primary">
                {inviterName[0]?.toUpperCase()}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-[12px] font-semibold text-foreground">
                <span className="text-primary">{inviterName}</span> invited you to
              </p>
              <p className="text-[11px] text-muted-foreground font-medium">{channelName}</p>
              <div className="mt-2.5 flex gap-2">
                <button
                  onClick={async () => {
                    toast.dismiss(t)
                    try {
                      await invitationsApi.respond(invitation.id, 'ACCEPTED')
                      queryClient.invalidateQueries({ queryKey: ['channels'] })
                    } catch {}
                  }}
                  className="rounded-lg bg-primary px-3 py-1.5 text-[11px] font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
                >
                  Accept
                </button>
                <button
                  onClick={async () => {
                    toast.dismiss(t)
                    try { await invitationsApi.respond(invitation.id, 'REJECTED') } catch {}
                  }}
                  className="rounded-lg bg-muted px-3 py-1.5 text-[11px] font-semibold text-foreground transition-colors hover:bg-accent"
                >
                  Decline
                </button>
              </div>
            </div>
          </div>
        ),
        { duration: 30000, id: invitation.id },
      )
      return
    }

    const groupId = invitation.entity_id
    const allGroups = workspaceChannels.flatMap((ch) => ch.groups)
    const group = allGroups.find((g) => g.id === groupId)
    const groupName = group?.label ?? 'a voice channel'

    toast.custom(
      (t) => (
        <div className="flex w-80 items-start gap-3 rounded-2xl border border-border bg-popover p-4 shadow-xl">
          {invitation.inviter?.avatar_url ? (
            <img src={invitation.inviter.avatar_url} alt={inviterName} className="h-9 w-9 shrink-0 rounded-full object-cover" />
          ) : (
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[13px] font-bold text-primary">
              {inviterName[0]?.toUpperCase()}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-[12px] font-semibold text-foreground">
              <span className="text-primary">{inviterName}</span> invited you to join
            </p>
            <p className="text-[11px] text-muted-foreground">#{groupName}</p>
            <div className="mt-2.5 flex gap-2">
              <button
                onClick={async () => {
                  toast.dismiss(t)
                  try {
                    await invitationsApi.respond(invitation.id, 'ACCEPTED')
                    handleJoinVoiceGroup(groupId)
                  } catch {}
                }}
                className="rounded-lg bg-primary px-3 py-1.5 text-[11px] font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
              >
                Accept
              </button>
              <button
                onClick={async () => {
                  toast.dismiss(t)
                  try { await invitationsApi.respond(invitation.id, 'REJECTED') } catch {}
                }}
                className="rounded-lg bg-muted px-3 py-1.5 text-[11px] font-semibold text-foreground transition-colors hover:bg-accent"
              >
                Decline
              </button>
            </div>
          </div>
        </div>
      ),
      { duration: 30000, id: invitation.id },
    )
  })

  const workspaceChannelsRef = useRef(workspaceChannels)
  workspaceChannelsRef.current = workspaceChannels

  const voiceRef = useRef(voice)
  voiceRef.current = voice

  useEffect(() => {
    setActiveVoiceGroupId(voice.currentGroupId)
    if (!voice.currentGroupId) return

    const voiceChannel = workspaceChannelsRef.current.find((channel) =>
      channel.groups.some((group) => group.id === voice.currentGroupId),
    )
    if (!voiceChannel) return

    setActiveChannelId(voiceChannel.id)
    setActiveGroupId(voice.currentGroupId)
    setWorkspaceMode('channels')
    setActiveSurface('channel')
    setActiveView('chat')
    setChannelTab('feed')
    setChannelFeedClosed(false)
    setShowDirectProfile(false)
  }, [setActiveView, voice.currentGroupId])

  const { mutate: markNotifAsRead } = useMarkAsRead()

  // Clear mention badge when user opens a group
  useEffect(() => {
    if (!activeGroupId) return
    const toMark = allNotifications.filter(
      (n) =>
        !n.is_read &&
        n.type === 'MENTION' &&
        (
          n.metadata?.group_id === activeGroupId ||
          n.metadata?.channel_group_id === activeGroupId ||
          (n.entity_type?.toLowerCase().includes('group') && n.entity_id === activeGroupId) ||
          n.entity_id === activeGroupId
        ),
    )
    toMark.forEach((n) => markNotifAsRead(n.id))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeGroupId])

  function handleChannelAssetSave(channelId: string, avatar: string | null, banner: string | null) {
    setChannelAssets((prev) => ({ ...prev, [channelId]: { avatar, banner } }))
  }

  const activeChannel = useMemo(
    () => getMockChannel(activeChannelId, workspaceChannels),
    [activeChannelId, workspaceChannels],
  )

  const activeGroup = useMemo(
    () => getMockGroup(activeChannelId, activeGroupId, workspaceChannels),
    [activeChannelId, activeGroupId, workspaceChannels],
  )

  useEffect(() => {
    if (!workspaceChannels.length) return

    const channel = workspaceChannels.find((item) => item.id === activeChannelId)
    if (!channel) {
      const firstChannel = workspaceChannels[0]
      setActiveChannelId(firstChannel.id)
      setActiveGroupId(firstChannel.groups[0]?.id ?? '')
      return
    }

    if (!channel.groups.some((group) => group.id === activeGroupId)) {
      setActiveGroupId(channel.groups[0]?.id ?? '')
    }
  }, [activeChannelId, activeGroupId, workspaceChannels])

  useEffect(() => {
    if (activeChannel?.type === 'NORMAL' && channelTab !== 'feed') {
      setChannelTab('feed')
    }
  }, [activeChannel?.id, activeChannel?.type, channelTab])

  useEffect(() => {
    const persisted = readPersistedChatState()

    if (persisted.activeDirectChat !== undefined) setActiveDirectChat(persisted.activeDirectChat)
    if (!lockedView && persisted.activeView) setActiveViewState(persisted.activeView)
    if (persisted.settingsSection) setSettingsSection(persisted.settingsSection)
    if (persisted.activeSurface) setActiveSurface(persisted.activeSurface)
    if (persisted.syntheticDirectChats) setSyntheticDirectChats(persisted.syntheticDirectChats)
    if (persisted.syntheticDirectMessages) setSyntheticDirectMessages(persisted.syntheticDirectMessages)
    if (persisted.workspaceMode) setWorkspaceMode(persisted.workspaceMode)
    if (persisted.workspaceCollapsed !== undefined) setWorkspaceCollapsed(persisted.workspaceCollapsed)
    if (persisted.channelTab) setChannelTab(persisted.channelTab)
    if (persisted.activeChannelId) setActiveChannelId(persisted.activeChannelId)
    if (persisted.activeGroupId) setActiveGroupId(persisted.activeGroupId)

    setViewStateReady(true)
  }, [lockedView])

  useEffect(() => {
    if (!viewStateReady) return

    try {
      const nextState: PersistedChatState = {
        activeChannelId: activeChannel?.id ?? activeChannelId,
        activeDirectChat,
        activeGroupId: activeGroup?.id ?? activeGroupId,
        activeSurface,
        activeView,
        channelTab,
        settingsSection,
        syntheticDirectChats: {},
        syntheticDirectMessages: {},
        workspaceCollapsed,
        workspaceMode,
      }

      localStorage.setItem(CHAT_VIEW_STATE_KEY, JSON.stringify(nextState))
    } catch {}
  }, [
    activeChannel?.id,
    activeChannelId,
    activeDirectChat,
    activeGroup?.id,
    activeGroupId,
    activeSurface,
    activeView,
    channelTab,
    settingsSection,
    viewStateReady,
    workspaceCollapsed,
    workspaceMode,
  ])

  const userInitial = (profile?.username?.[0] ?? 'Y').toUpperCase()
  const userAvatar = localAvatar ?? profile?.avatar_url ?? undefined
  const syntheticSidebarChats = useMemo<Chat[]>(
    () =>
      Object.values(syntheticDirectChats)
        .map((chat) => {
          const latestMessage =
            syntheticDirectMessages[chat.id]?.[0] ??
            chat.initialMessages?.[0] ??
            null

          return {
            id: chat.id,
            name: chat.name,
            avatar: chat.avatarUrl ?? '',
            lastMessage:
              latestMessage?.content ??
              (latestMessage?.type === 'image'
                ? 'Photo'
                : latestMessage?.type === 'file'
                  ? 'File'
                  : latestMessage?.type === 'voice'
                    ? 'Voice note'
                    : chat.status),
            timestamp: latestMessage?.created_at ?? new Date().toISOString(),
            unread: unreadCounts[chat.id] ?? 0,
            isGroup: false,
            isOnline: chat.isOnline ?? false,
            subPlan: chat.subPlan ?? null,
            isVerified: chat.isVerified ?? false,
          }
        })
        .sort(
          (a, b) =>
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
        ),
    [syntheticDirectChats, syntheticDirectMessages, unreadCounts],
  )

  const backendDirectChats = useMemo<Chat[]>(
    () => {
      const myId = profile?.id
      if (!myId) return []
      return (directConversations ?? []).map((conv: any) => {
        const other =
          conv.user_one_id === myId ? conv.user_two : conv.user_one
        const isOnline = other?.id ? onlineUsers.has(other.id) : false
        const name = other?.username ?? 'Unknown'
        const last = Array.isArray(conv.last_message) ? conv.last_message[0] : null
        const lastType = last?.type ?? 'text'
        const mediaLabel =
          lastType === 'image' ? '📷 Photo' :
          lastType === 'video' ? '🎥 Video' :
          lastType === 'voice' ? '🎤 Voice note' :
          lastType === 'file' ? '📎 File' : null
        const lastContent = mediaLabel ?? (typeof last?.content === 'string' ? last.content.trim() : '')
        const lastPrefix =
          last?.sender_id && last.sender_id === myId ? 'You' : (name || 'User')
        const lastLine = lastContent ? (mediaLabel ? `${lastPrefix}: ${mediaLabel}` : `${lastPrefix}: ${lastContent}`) : ''
        return {
          id: conv.id,
          name,
          avatar: other?.avatar_url ?? '',
          lastMessage: lastLine,
          timestamp: last?.created_at ?? conv.created_at ?? new Date().toISOString(),
          unread: unreadCounts[conv.id] ?? conv.unread_count ?? 0,
          isGroup: false,
          isOnline,
          subPlan: other?.sub_plan ?? null,
          isVerified: other?.is_verified ?? false,
          bannerUrl: other?.banner ?? null,
        }
      })
    },
    [directConversations, onlineUsers, profile?.id, unreadCounts],
  )

  const directSidebarChats = backendDirectChats

  const activeNav: WorkspaceNavTarget | null =
    activeSurface === 'personal-notes' ? 'notes'
    : activeSurface === 'personal-tasks' ? 'tasks'
    : activeSurface === 'personal-goals' ? 'goals'
    : null

  const router = useRouter()

  const handleAvatarClick = () => {
    router.push('/settings/profile')
  }

  const openDirectChat = useCallback(async (conversation: string | FeedDirectConversationTarget) => {
    const conversationId =
      typeof conversation === 'string' ? conversation : conversation.id

    if (typeof conversation !== 'string') {
      if (!conversation.targetUserId) {
        toast.error('This feed user is not linked to a real account yet.')
        return
      }

      try {
        const realConversation = await createDirectConversation.mutateAsync(conversation.targetUserId)
        setActiveDirectChat(realConversation.id)
        setActiveSurface('direct')
        setWorkspaceMode('direct')
        setActiveView('chat')
        setShowDirectProfile(false)
        setUnreadCounts((prev) => ({ ...prev, [realConversation.id]: 0 }))
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Could not start direct message')
      }
      return
    }

    setActiveDirectChat(conversationId)
    setActiveSurface('direct')
    setWorkspaceMode('direct')
    setActiveView('chat')
    setShowDirectProfile(false)
    setUnreadCounts((prev) => ({ ...prev, [conversationId]: 0 }))
  }, [createDirectConversation, setActiveView])

  const handleSyntheticSendMessage = useCallback(
    (conversationId: string, content: string, type = 'text', replyToId?: string, fileUrl?: string) => {
      const existingMessages = syntheticDirectMessages[conversationId] ?? []
      const replySource = replyToId
        ? existingMessages.find((message) => message.id === replyToId) ?? null
        : null
      const senderId = profile?.id ?? 'local-user'
      const normalizedType =
        type === 'image' || type === 'file' || type === 'voice' ? type : 'text'
      const nextMessage: ChatMessage = {
        id: `${conversationId}-local-${Date.now()}`,
        conversation_id: conversationId,
        sender_id: senderId,
        content: content || null,
        type: normalizedType,
        file_url: fileUrl ?? null,
        metadata: { synthetic: true },
        status: 'read',
        reactions: [],
        reply_to: replySource
          ? {
              id: replySource.id,
              content: replySource.content,
              sender: {
                id: replySource.sender.id,
                username: replySource.sender.username,
              },
            }
          : null,
        created_at: new Date().toISOString(),
        sender: {
          id: senderId,
          username: profile?.username ?? 'You',
          avatar_url: userAvatar ?? null,
          sub_plan: profile?.sub_plan ?? null,
        },
      }

      setSyntheticDirectMessages((prev) => ({
        ...prev,
        [conversationId]: [nextMessage, ...(prev[conversationId] ?? [])],
      }))
    },
    [profile?.id, profile?.sub_plan, profile?.username, syntheticDirectMessages, userAvatar],
  )

  const activeDirectMessages = activeSyntheticChat
    ? (syntheticDirectMessages[activeSyntheticChat.id] ??
      activeSyntheticChat.initialMessages ??
      [])
    : []

  function openChannelSurface(channelId: string, groupId?: string) {
    const channel = getMockChannel(channelId, workspaceChannels)
    if (!channel) return
    setActiveChannelId(channel.id)
    setActiveGroupId(groupId ?? channel.groups[0]?.id ?? activeGroupId)
    setWorkspaceMode('channels')
    setActiveSurface('channel')
    setActiveView('chat')
    setChannelTab('feed')
    setChannelFeedClosed(false)
    setShowDirectProfile(false)
  }

  function handleModeChange(mode: WorkspaceMode) {
    setWorkspaceMode(mode)
    setActiveView('chat')
    setShowDirectProfile(false)
    if (mode === 'channels') {
      const nextChannelId = activeChannelId || workspaceChannels[0]?.id
      if (nextChannelId) openChannelSurface(nextChannelId)
    } else setActiveSurface('direct')
  }

  function handleNavItem(tab: WorkspaceNavTarget) {
    setActiveView('chat')
    setShowDirectProfile(false)
    if (tab === 'notes') setActiveSurface('personal-notes')
    if (tab === 'tasks') setActiveSurface('personal-tasks')
    if (tab === 'goals') setActiveSurface('personal-goals')
  }

  async function handleCreateChannel(values: CreateEntityValues) {
    const channel = await createChannel.mutateAsync({
      name: values.name,
      description: values.description || undefined,
      access_type: values.access_type,
    })

    let avatarUrl = channel.avatar_url ?? null
    let bannerUrl = channel.banner_url ?? null

    if (values.avatarFile) {
      const { publicUrl } = await filesApi.uploadChannelLogo(channel.id, values.avatarFile)
      avatarUrl = versionedAssetUrl(publicUrl)
    }

    if (values.bannerFile) {
      const { publicUrl } = await filesApi.uploadChannelBanner(channel.id, values.bannerFile)
      bannerUrl = versionedAssetUrl(publicUrl)
    }

    if (avatarUrl || bannerUrl) {
      await updateChannel.mutateAsync({
        id: channel.id,
        data: {
          ...(avatarUrl ? { avatar_url: avatarUrl } : {}),
          ...(bannerUrl ? { banner_url: bannerUrl } : {}),
        },
      })
      setChannelAssets((prev) => ({ ...prev, [channel.id]: { avatar: avatarUrl, banner: bannerUrl } }))
    }

    const channelWithAssets: BackendChannel = {
      ...channel,
      avatar_url: avatarUrl,
      banner_url: bannerUrl,
    }
    const nextChannel = toWorkspaceChannel(channelWithAssets, workspaceChannels.length, channelGroupsById)
    setActiveChannelId(nextChannel.id)
    setActiveGroupId(nextChannel.groups[0]?.id ?? '')
    setWorkspaceMode('channels')
    setActiveSurface('channel')
    setActiveView('chat')
    setChannelTab('feed')
    setWorkspaceCollapsed(false)
    setShowDirectProfile(false)
  }

  function handleGroupUpdated(groupId: string, updates: Partial<MockChannelGroup>) {
    if (!activeChannelId) return
    const baseGroups = mergedGroupsById[activeChannelId] ?? []
    setChannelGroupsById((prev) => ({
      ...prev,
      [activeChannelId]: baseGroups.map((g) => g.id === groupId ? { ...g, ...updates } : g),
    }))
  }

  function handleCreateGroup(values: CreateEntityValues) {
    if (!activeChannel) return
    createGroup.mutate(
      {
        name: values.name,
        description: values.description || undefined,
        group_type: values.group_type ?? 'text',
        access_type: values.access_type ?? 'PUBLIC',
      },
      {
        onSuccess: (group) => {
          const newGroup = backendGroupToMock(group)
          queryClient.setQueryData<BackendGroup[]>(GROUP_KEYS.byChannel(activeChannel.id), (prev = []) => {
            if (prev.some((existing) => existing.id === group.id)) return prev
            return [...prev, group]
          })
          if (!(newGroup.kind === 'voice' && voiceRef.current.currentGroupId)) {
            setActiveGroupId(newGroup.id)
            setActiveSurface('channel')
            setChannelTab('feed')
          }
        },
      },
    )
  }

  const activeDirectOther = (() => {
    if (!activeIsRealDirect) return null
    const myId = profile?.id
    const conv = (directConversations ?? []).find((c: any) => c.id === activeDirectChat)
    if (!conv) return null
    return conv.user_one_id === myId ? conv.user_two : conv.user_one
  })()
  const activeDirectOtherIsOnline = activeDirectOther?.id ? onlineUsers.has(activeDirectOther.id) : false

  useEffect(() => {
    if (!visibleDirectConversationId || !profile?.id) return
    setUnreadCounts((prev) =>
      prev[visibleDirectConversationId] ? { ...prev, [visibleDirectConversationId]: 0 } : prev,
    )

    const unreadIncoming = activeDirectRealMessages.filter(
      (message) => message.sender_id !== profile.id && message.status !== 'read',
    )
    if (!unreadIncoming.length) return

    queryClient.setQueryData<ChatMessage[]>(DIRECT_KEYS.messages(visibleDirectConversationId), (old = []) =>
      old.map((message) =>
        message.sender_id !== profile.id && message.status !== 'read'
          ? { ...message, status: 'read' }
          : message,
      ),
    )

    getSocket().then((socket) => {
      unreadIncoming.forEach((message) => {
        socket.emit('markDirectRead', {
          conversationId: visibleDirectConversationId,
          messageId: message.id,
        })
      })
    })
  }, [activeDirectRealMessages, profile?.id, queryClient, visibleDirectConversationId])

  const directFeedContent = activeDirectChat ? (
      <ChatWindow
        key={activeDirectChat}
        activeChat={activeDirectChat}
        chatOverride={
          activeSyntheticChat
            ? {
                avatarUrl: activeSyntheticChat.avatarUrl,
                isOnline: activeSyntheticChat.isOnline,
                subPlan: activeSyntheticChat.subPlan,
                isVerified: activeSyntheticChat.isVerified,
                name: activeSyntheticChat.name,
                subtitle: activeSyntheticChat.status,
              }
            : activeDirectOther
              ? {
                  avatarUrl: activeDirectOther.avatar_url ?? null,
                  isOnline: activeDirectOtherIsOnline,
                  subPlan: (activeDirectOther as any).sub_plan ?? null,
                  isVerified: (activeDirectOther as any).is_verified ?? false,
                  name: activeDirectOther.username ?? 'Direct message',
                  subtitle: activeDirectOtherIsOnline ? 'Online' : 'Offline',
                }
              : undefined
        }
        messages={activeIsRealDirect ? activeDirectRealMessages : activeDirectMessages}
        onSendMessage={(payload) => {
          if (!activeDirectChat) return
          if (activeIsRealDirect) {
            sendDirectMessage.mutate(payload)
            return
          }
          handleSyntheticSendMessage(
            activeDirectChat,
            payload.content ?? '',
            payload.type,
            payload.replyToId ?? undefined,
            payload.fileUrl ?? undefined,
          )
        }}
        onDelete={activeIsRealDirect ? async (messageId) => {
          const socket = await getSocket()
          socket.emit('deleteDirectMessage', { messageId, conversationId: activeDirectChat })
        } : undefined}
        onPin={activeIsRealDirect ? async (messageId) => {
          const socket = await getSocket()
          socket.emit('pinDirectMessage', { messageId, conversationId: activeDirectChat })
        } : undefined}
        conversations={(directConversations ?? []).filter((c: any) => c.id !== activeDirectChat).map((c: any) => {
          const myId = profile?.id
          const other = c.user_one_id === myId ? c.user_two : c.user_one
          return { id: c.id, name: other?.username ?? 'DM', avatarUrl: other?.avatar_url ?? null }
        })}
        onForwardMessage={activeIsRealDirect ? async (_msgId, content, toConversationId) => {
          const { directConversationsApi } = await import('@/lib/direct-conversations-api')
          await directConversationsApi.sendMessage(toConversationId, { content, isForwarded: true })
        } : undefined}
        onReact={(messageId, emoji) => {
          if (activeIsRealDirect) toggleDirectReaction.mutate({ messageId, emoji })
        }}
        onTyping={async (isTyping) => {
          if (!activeDirectChat || !activeIsRealDirect) return
          const socket = await getSocket()
          socket.emit('typing', { roomId: `dm_${activeDirectChat}`, isTyping })
        }}
        otherIsTyping={activeDirectChat ? (typingConversations[activeDirectChat] ?? false) : false}
        onProfileClick={() => setShowDirectProfile((v) => !v)}
        onVoiceCall={activeIsRealDirect && activeDirectOther ? () => startCall(
          activeDirectChat!,
          activeDirectOther.id,
          activeDirectOther.username ?? 'User',
          activeDirectOther.avatar_url ?? null,
          'audio',
        ) : undefined}
        onVideoCall={activeIsRealDirect && activeDirectOther ? () => startCall(
          activeDirectChat!,
          activeDirectOther.id,
          activeDirectOther.username ?? 'User',
          activeDirectOther.avatar_url ?? null,
          'video',
        ) : undefined}
        onMute={activeIsRealDirect && activeDirectOther ? async () => {
          await dmContactAction(activeDirectOther.id, 'mute', { is_muted: true })
          toast.success(`${activeDirectOther.username ?? 'User'} muted`)
        } : undefined}
        onArchive={activeIsRealDirect && activeDirectOther ? async () => {
          await dmContactAction(activeDirectOther.id, 'archive', { is_archived: true })
          toast.success('Conversation archived')
        } : undefined}
        onBlock={activeIsRealDirect && activeDirectOther ? async () => {
          await dmContactAction(activeDirectOther.id, 'block', { is_blocked: true })
          toast.success(`${activeDirectOther.username ?? 'User'} blocked`)
        } : undefined}
      />
    ) : (
    <div className="flex flex-1 items-center justify-center bg-sidebar p-6">
      <div className="flex w-full max-w-sm flex-col items-center text-center">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-3xl bg-muted">
          <MessageSquare className="h-5 w-5 text-foreground" />
        </div>
        <h2 className="text-[15px] font-semibold text-foreground">Select a direct message</h2>
        <p className="mt-2 text-[12px] leading-6 text-muted-foreground">
          Open a user from a channel feed to start a direct chat.
        </p>
      </div>
    </div>
  )

  function renderPersonalSurface() {
    const meta = PERSONAL_SURFACE_META[activeSurface as keyof typeof PERSONAL_SURFACE_META]
    const Icon = meta.icon
    return (
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden bg-background">
        <div className="border-b border-border bg-sidebar px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Icon className="h-[18px] w-[18px]" />
            </div>
            <div className="min-w-0">
              <p className="text-[13px] font-semibold">{meta.title}</p>
              <p className="text-[11px] text-muted-foreground">{meta.description}</p>
            </div>
          </div>
        </div>
        <div className="flex-1 overflow-hidden">
          {activeSurface === 'personal-notes' ? (
            <NotesPanel scopeKey="personal-notes" scopeLabel="you" scopeType="personal" />
          ) : activeSurface === 'personal-tasks' ? (
            <TasksPanel scopeKey="personal-tasks" scopeLabel="you" scopeType="personal" />
          ) : (
            <GoalsPanel scopeKey="personal-goals" scopeLabel="you" scopeType="personal" />
          )}
        </div>
      </div>
    )
  }

  useEffect(() => {
    const joinedGroupId = voice.joinedGroupId
    const participants = joinedGroupId ? (voice.participantsByGroup[joinedGroupId] ?? []) : []
    const joinedTimes = participants
      .map((participant) => participant.joinedAt)
      .filter((time): time is number => Number.isFinite(time) && time > 0)
    const callStartedAt = joinedTimes.length > 0 ? Math.min(...joinedTimes) : voice.joinedAt

    if (!voice.isJoined || !callStartedAt) {
      if (voiceElapsedRef.current) clearInterval(voiceElapsedRef.current)
      voiceElapsedRef.current = null
      setVoiceElapsed(null)
      return
    }
    const tick = () => {
      const s = Math.floor((Date.now() - callStartedAt) / 1000)
      const h = Math.floor(s / 3600)
      const m = Math.floor((s % 3600) / 60).toString().padStart(2, '0')
      const sec = (s % 60).toString().padStart(2, '0')
      setVoiceElapsed(h > 0 ? `${h}:${m}:${sec}` : `${m}:${sec}`)
    }
    tick()
    voiceElapsedRef.current = setInterval(tick, 1000)
    return () => {
      if (voiceElapsedRef.current) clearInterval(voiceElapsedRef.current)
      voiceElapsedRef.current = null
    }
  }, [voice.isJoined, voice.joinedAt, voice.joinedGroupId, voice.participantsByGroup])

  // Real-time join requests from private groups
  useEffect(() => {
    if (!profile?.id) return
    let mounted = true
    let s: Socket | null = null

    const onGroupJoinRequest = (payload: JoinRequestPayload) => {
      if (!mounted) return
      const joinRequestsKey = GROUP_KEYS.joinRequests(payload.groupId)
      queryClient.setQueryData<GroupJoinRequest[]>(joinRequestsKey, (prev = []) => [
        ...prev.filter((request) => request.id !== payload.requestId),
        {
          id: payload.requestId,
          status: 'PENDING',
          created_at: payload.createdAt,
          user: payload.user,
        },
      ])
      queryClient.invalidateQueries({ queryKey: joinRequestsKey })
      setPendingJoinRequests((prev) => ({
        ...prev,
        [payload.groupId]: [
          ...(prev[payload.groupId] ?? []).filter((r) => r.requestId !== payload.requestId),
          payload,
        ],
      }))

      const removeRequest = () => {
        setPendingJoinRequests((prev) => ({
          ...prev,
          [payload.groupId]: (prev[payload.groupId] ?? []).filter((r) => r.requestId !== payload.requestId),
        }))
        queryClient.setQueryData<GroupJoinRequest[]>(joinRequestsKey, (prev = []) =>
          prev.filter((request) => request.id !== payload.requestId),
        )
        queryClient.invalidateQueries({ queryKey: joinRequestsKey })
      }

      toast.custom(
        (t) => (
          <div className="flex w-80 items-start gap-3 rounded-2xl border border-border bg-popover p-4 shadow-xl">
            {payload.user?.avatar_url ? (
              <img src={payload.user.avatar_url} alt={payload.user.username ?? ''} className="h-9 w-9 shrink-0 rounded-full object-cover" />
            ) : (
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[13px] font-bold text-primary">
                {(payload.user?.username?.[0] ?? '?').toUpperCase()}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-[12px] font-semibold text-foreground">
                <span className="text-primary">@{payload.user?.username ?? 'Someone'}</span> wants to join
              </p>
              <p className="text-[11px] text-muted-foreground">#{payload.groupName}</p>
              <div className="mt-2.5 flex gap-2">
                <button
                  onClick={async () => {
                    toast.dismiss(t)
                    try {
                      await groupsApi.respondToJoinRequest(payload.groupId, payload.requestId, 'ACCEPTED')
                      removeRequest()
                      queryClient.invalidateQueries({ queryKey: GROUP_KEYS.members(payload.groupId) })
                      queryClient.invalidateQueries({ queryKey: GROUP_KEYS.messages(payload.groupId) })
                    } catch {}
                  }}
                  className="rounded-lg bg-primary px-3 py-1.5 text-[11px] font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
                >
                  Approve
                </button>
                <button
                  onClick={async () => {
                    toast.dismiss(t)
                    try {
                      await groupsApi.respondToJoinRequest(payload.groupId, payload.requestId, 'REJECTED')
                      removeRequest()
                    } catch {}
                  }}
                  className="rounded-lg bg-muted px-3 py-1.5 text-[11px] font-semibold text-foreground transition-colors hover:bg-accent"
                >
                  Deny
                </button>
              </div>
            </div>
          </div>
        ),
        { duration: 0, id: `join-request-${payload.requestId}` },
      )
    }

    const onGroupJoinAccepted = (payload: { groupId: string; channelId: string | null }) => {
      if (!mounted) return
      if (payload.channelId) {
        queryClient.invalidateQueries({ queryKey: GROUP_KEYS.byChannel(payload.channelId) })
      }
      if (!voiceRef.current.currentGroupId) {
        voiceRef.current.join(payload.groupId)
        toast.success('Accepted! Joining voice group...')
      } else {
        toast.success('Your request to join was accepted! Switch to the group when ready.')
      }
    }

    const onChannelJoinAccepted = (payload: { channelId: string }) => {
      if (!mounted) return
      queryClient.invalidateQueries({ queryKey: CHANNEL_KEYS.all })
      toast.success('Your request to join was accepted!')
    }

    const onChannelJoinRequest = (payload: ChannelJoinRequestPayload) => {
      if (!mounted) return
      queryClient.invalidateQueries({ queryKey: CHANNEL_MEMBER_KEYS.joinRequests(payload.channelId) })
      toast.custom(
        (t) => (
          <div className="flex w-80 items-start gap-3 rounded-2xl border border-border bg-popover p-4 shadow-xl">
            {payload.user?.avatar_url ? (
              <img src={payload.user.avatar_url} alt={payload.user.username ?? ''} className="h-9 w-9 shrink-0 rounded-full object-cover" />
            ) : (
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[13px] font-bold text-primary">
                {(payload.user?.username?.[0] ?? '?').toUpperCase()}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-[12px] font-semibold text-foreground">
                <span className="text-primary">@{payload.user?.username ?? 'Someone'}</span> wants to join
              </p>
              <p className="text-[11px] text-muted-foreground font-medium">{payload.channelName}</p>
              <p className="mt-1 text-[10px] text-muted-foreground">Manage in channel settings → Join Requests</p>
            </div>
          </div>
        ),
        { duration: 12000, id: `channel-join-request-${payload.requestId}` },
      )
    }

    const refreshChannelGroups = (channelId?: string | null) => {
      if (!mounted || !channelId) return
      queryClient.invalidateQueries({ queryKey: GROUP_KEYS.byChannel(channelId) })
      setChannelGroupsById((prev) => {
        if (!prev[channelId]) return prev
        const next = { ...prev }
        delete next[channelId]
        return next
      })
    }

    const onChannelGroupCreated = (payload: { channelId?: string; group?: BackendGroup }) => {
      const channelId = payload.channelId ?? payload.group?.channel_id
      if (channelId && payload.group) {
        queryClient.setQueryData<BackendGroup[]>(GROUP_KEYS.byChannel(channelId), (prev = []) => {
          if (prev.some((group) => group.id === payload.group!.id)) return prev
          return [...prev, payload.group!]
        })
      }
      refreshChannelGroups(channelId)
    }

    const onChannelGroupUpdated = (payload: { channelId?: string; group?: BackendGroup }) => {
      const channelId = payload.channelId ?? payload.group?.channel_id
      if (channelId && payload.group) {
        queryClient.setQueryData<BackendGroup[]>(GROUP_KEYS.byChannel(channelId), (prev = []) =>
          prev.map((group) => group.id === payload.group!.id ? { ...group, ...payload.group! } : group),
        )
      }
      refreshChannelGroups(channelId)
    }

    const onChannelGroupDeleted = (payload: { channelId?: string; groupId?: string }) => {
      if (payload.channelId && payload.groupId) {
        queryClient.setQueryData<BackendGroup[]>(GROUP_KEYS.byChannel(payload.channelId), (prev = []) =>
          prev.filter((group) => group.id !== payload.groupId),
        )
      }
      refreshChannelGroups(payload.channelId)
      if (payload.groupId && activeGroupId === payload.groupId) {
        setActiveGroupId('')
        setChannelTab('feed')
      }
      if (payload.groupId && activeVoiceGroupId === payload.groupId) {
        setActiveVoiceGroupId(null)
      }
    }

    getSocket().then((socket) => {
      if (!mounted) return
      s = socket
      s.on('groupJoinRequest', onGroupJoinRequest)
      s.on('channelJoinRequest', onChannelJoinRequest)
      s.on('groupJoinAccepted', onGroupJoinAccepted)
      s.on('channelJoinAccepted', onChannelJoinAccepted)
      s.on('channelGroupCreated', onChannelGroupCreated)
      s.on('channelGroupUpdated', onChannelGroupUpdated)
      s.on('channelGroupDeleted', onChannelGroupDeleted)
    })

    return () => {
      mounted = false
      s?.off('groupJoinRequest', onGroupJoinRequest)
      s?.off('channelJoinRequest', onChannelJoinRequest)
      s?.off('groupJoinAccepted', onGroupJoinAccepted)
      s?.off('channelJoinAccepted', onChannelJoinAccepted)
      s?.off('channelGroupCreated', onChannelGroupCreated)
      s?.off('channelGroupUpdated', onChannelGroupUpdated)
      s?.off('channelGroupDeleted', onChannelGroupDeleted)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id, activeGroupId, activeVoiceGroupId])

  const voiceProfileByUserId = useMemo(() => {
    const profiles = new Map<string, Partial<VoiceParticipant>>()
    const addUser = (user: any) => {
      if (!user?.id) return
      profiles.set(user.id, {
        bannerUrl: user.banner ?? user.bannerUrl ?? null,
        subPlan: user.sub_plan ?? user.subPlan ?? null,
        isVerified: user.is_verified ?? user.isVerified ?? null,
      })
    }
    if (profile) addUser(profile)
    activeChannelMembers.forEach((member) => addUser(member.user))
    activeGroupMembers.forEach((member) => addUser(member.user))
    voiceGroupMembers.forEach((member) => addUser(member.user))
    return profiles
  }, [activeChannelMembers, activeGroupMembers, profile, voiceGroupMembers])

  const voiceParticipants: Record<string, VoiceParticipant[]> = Object.fromEntries(
    Object.entries(voice.participantsByGroup).map(([groupId, participants]) => [
      groupId,
      participants.map((participant) => {
        const profileMeta = voiceProfileByUserId.get(participant.id)
        return {
          ...participant,
          ...profileMeta,
          bannerUrl: participant.bannerUrl ?? profileMeta?.bannerUrl ?? null,
          subPlan: participant.subPlan ?? profileMeta?.subPlan ?? null,
          isVerified: participant.isVerified ?? profileMeta?.isVerified ?? null,
          isSpeaking: participant.isSpeaking || webrtc.remoteSpeakingUserIds.has(participant.id),
        }
      }),
    ]),
  )

  const channelContent =
    activeChannel && activeGroup ? (
      activeGroup.kind === 'voice' ? (
        <div className="flex min-w-0 flex-1 overflow-hidden">
          <VoiceGroupView
            key={activeGroup.id}
            group={activeGroup}
            channelId={activeChannelId}
            participants={voice.participantsByGroup[activeGroup.id] ?? []}
            isJoined={voice.isJoined && voice.joinedGroupId === activeGroup.id}
            isMuted={voice.isMuted}
            joinedAt={voice.joinedAt}
            myId={profile?.id}
            onJoin={() => {
              setActiveVoiceGroupId(activeGroup.id)
              voice.join(activeGroup.id)
            }}
            onLeave={async () => {
              await voice.leave()
              setActiveVoiceGroupId(null)
              setVoiceProfileTarget(null)
            }}
            onToggleMute={voice.toggleMute}
            onViewProfile={(p) => setVoiceProfileTarget(p)}
            onKick={(userId) => voice.kick(userId)}
            onPlaySound={(sound) => voice.playSound(sound)}
            onSendVoiceInvite={(inviteeId) => voice.sendVoiceInvite(inviteeId, activeGroup.id, activeGroup.label)}
            soundboardUserId={voice.soundboardUserId}
            soundboardIntensity={voice.soundboardIntensity}
            deafened={deafened}
            onToggleDeafen={() => setDeafened((v) => !v)}
            remoteStreams={webrtc.remoteStreams}
            remoteScreenStreams={webrtc.remoteScreenStreams}
            addVideoTrack={webrtc.addVideoTrack}
            removeVideoTrack={webrtc.removeVideoTrack}
            onScreenShareToggle={webrtc.signalScreenShare}
            onCameraToggle={handleCameraToggle}
            onSwitchAudioInput={webrtc.switchAudioInput}
          />
          <FeedProfileSidebarDock
            open={!!voiceProfileTarget}
            width={320}
            onBack={() => setVoiceProfileTarget(null)}
          >
            {voiceProfileTarget && (
              <FeedMemberProfileView
                currentGroupLabel={activeGroup.label}
                isOwn={voiceProfileTarget.id === profile?.id}
                memberProfile={buildStandaloneFeedMemberProfile({
                  id: voiceProfileTarget.id,
                  avatarUrl: voiceProfileTarget.avatarUrl,
                  name: voiceProfileTarget.name,
                  handle: voiceProfileTarget.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
                  role: (() => {
                    const channelRole = voiceProfileTarget.id === profile?.id
                      ? getChannelRoleLabel(activeChannel?.role)
                      : getChannelRoleLabel(activeChannelMembers.find((m) => m.user?.id === voiceProfileTarget.id)?.role)
                    const groupRole = getChannelRoleLabel(
                      voiceGroupMembers.find((m) => m.user?.id === voiceProfileTarget.id)?.role,
                    )
                    return getEffectiveRole(channelRole, groupRole)
                  })(),
                })}
                messagePending={false}
                onBack={() => setVoiceProfileTarget(null)}
                onMessage={() => {}}
                posts={[]}
                showMessageAction={false}
              />
            )}
          </FeedProfileSidebarDock>
        </div>
      ) : channelFeedClosed ? (
        <WorkspaceEmptyState
          title="Group feed closed"
          subtitle="Select a group on the left to reopen feed."
        />
      ) : (
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          {(pendingJoinRequests[activeGroup.id] ?? []).length > 0 && (
            <div className="flex flex-col gap-0 border-b border-border bg-muted/30">
              {(pendingJoinRequests[activeGroup.id] ?? []).map((req) => (
                <div key={req.requestId} className="flex items-center gap-3 px-4 py-2.5">
                  {req.user?.avatar_url ? (
                    <img src={req.user.avatar_url} alt={req.user.username ?? ''} className="h-7 w-7 shrink-0 rounded-full object-cover" />
                  ) : (
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[11px] font-bold text-primary">
                      {(req.user?.username?.[0] ?? '?').toUpperCase()}
                    </div>
                  )}
                  <p className="min-w-0 flex-1 text-[12px] text-foreground">
                    <span className="font-semibold text-primary">@{req.user?.username ?? 'Someone'}</span>
                    <span className="text-muted-foreground"> wants to join </span>
                    <span className="font-medium">#{req.groupName}</span>
                  </p>
                  <div className="flex shrink-0 gap-1.5">
                    <button
                      onClick={async () => {
                        try {
                          await groupsApi.respondToJoinRequest(req.groupId, req.requestId, 'ACCEPTED')
                          setPendingJoinRequests((prev) => ({
                            ...prev,
                            [req.groupId]: (prev[req.groupId] ?? []).filter((r) => r.requestId !== req.requestId),
                          }))
                          queryClient.setQueryData<GroupJoinRequest[]>(GROUP_KEYS.joinRequests(req.groupId), (prev = []) =>
                            prev.filter((request) => request.id !== req.requestId),
                          )
                          queryClient.invalidateQueries({ queryKey: GROUP_KEYS.joinRequests(req.groupId) })
                          queryClient.invalidateQueries({ queryKey: GROUP_KEYS.members(req.groupId) })
                          queryClient.invalidateQueries({ queryKey: GROUP_KEYS.messages(req.groupId) })
                          toast.dismiss(`join-request-${req.requestId}`)
                        } catch {}
                      }}
                      className="rounded-md bg-primary px-2.5 py-1 text-[11px] font-semibold text-primary-foreground hover:bg-primary/90"
                    >
                      Approve
                    </button>
                    <button
                      onClick={async () => {
                        try {
                          await groupsApi.respondToJoinRequest(req.groupId, req.requestId, 'REJECTED')
                          setPendingJoinRequests((prev) => ({
                            ...prev,
                            [req.groupId]: (prev[req.groupId] ?? []).filter((r) => r.requestId !== req.requestId),
                          }))
                          queryClient.setQueryData<GroupJoinRequest[]>(GROUP_KEYS.joinRequests(req.groupId), (prev = []) =>
                            prev.filter((request) => request.id !== req.requestId),
                          )
                          queryClient.invalidateQueries({ queryKey: GROUP_KEYS.joinRequests(req.groupId) })
                          toast.dismiss(`join-request-${req.requestId}`)
                        } catch {}
                      }}
                      className="rounded-md bg-muted px-2.5 py-1 text-[11px] font-semibold text-foreground hover:bg-accent"
                    >
                      Deny
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        <MainArea
          activeChannel={activeChannel}
          activeGroup={activeGroup}
          activeTab={channelTab}
          onTabChange={(tab) => {
            setChannelTab(tab)
            if (tab === 'feed') setChannelFeedClosed(false)
          }}
        >
          <ChannelFeed
            channel={activeChannel}
            group={activeGroup}
            members={activeGroupMembers}
            myAvatarUrl={userAvatar}
            onOpenDirectConversation={openDirectChat}
            postsOverride={isRealGroupId ? groupPosts : undefined}
          onSendPost={async ({ content, fileUrl, replyToId, entityMentions, type, mime, duration, size }) => {
              if (!isRealGroupId) return
            await groupsApi.sendGroupMessage(activeGroup.id, {
              content,
              entityMentions,
              fileUrl,
              replyToId: replyToId ?? null,
              type,
              mime,
              duration,
              size,
            })
              queryClient.invalidateQueries({ queryKey: GROUP_KEYS.messages(activeGroup.id) })
            }}
            onToggleReaction={(postId, emoji) => {
              if (!isRealGroupId) return
              toggleGroupReaction.mutate({ messageId: postId, emoji })
            }}
            onTogglePin={async (postId) => {
              if (!isRealGroupId) return
              await groupsApi.toggleGroupMessagePin(postId)
            }}
            onDeletePost={async (postId) => {
              if (!isRealGroupId) return
              await groupsApi.deleteGroupMessage(postId)
            }}
            onCloseFeedRequest={() => setChannelFeedClosed(true)}
          />
        </MainArea>
        </div>
      )
    ) : null

  function normalizedUserLabel(user: any) {
    return user.fullname ?? user.full_name ?? user.username ?? 'Unknown'
  }

  const mutualFiltered = startDmQuery.trim()
    ? mutualFollowers.filter((u: any) =>
        String(u.username ?? '')
          .toLowerCase()
          .includes(startDmQuery.trim().toLowerCase()),
      )
    : mutualFollowers

  return (
    <>
      <div className="flex min-h-0 flex-1 overflow-hidden bg-background">
        {!hideRail ? (
          <IconRail
            activeView={activeView}
            onViewChange={setActiveView}
            onAvatarClick={handleAvatarClick}
            userInitial={userInitial}
            userAvatar={userAvatar}
            notificationCount={unreadNotificationCount}
          />
        ) : null}

        {activeView === 'discover-channels' ? (
          <DiscoverChannelsView
            onSelectChannel={(channelId) => {
              openChannelSurface(channelId)
              setActiveView('chat')
            }}
          />
        ) : activeView === 'store' ? (
          <StoreView />
        ) : activeView === 'add-friends' ? (
          <AddFriendsView />
        ) : activeView === 'notifications' ? (
          <NotificationsView onAcceptGroupInvitation={handleJoinVoiceGroup} />
        ) : activeView === 'game' ? (
          <PixelRoomGame />
        ) : (
          <>
            <WorkspaceSidebar
              activeChannelId={activeChannel?.id}
              activeChat={activeDirectChat ?? ''}
              channelAssets={channelAssets}
              channels={workspaceChannels}
              collapsed={workspaceCollapsed}
              mode={workspaceMode}
              storiesSlot={
                storyBubbles.length > 0 ? (
                  <StoriesStrip
                    bubbles={storyBubbles}
                    onAdd={() => setStoryUploadOpen(true)}
                    onOpen={(userId) => setStoryViewUserId(userId)}
                  />
                ) : null
              }
              onCreateChannel={handleCreateChannel}
              onModeChange={handleModeChange}
              onSearchChange={setSearchQuery}
              onSelectChannel={(channelId) => openChannelSurface(channelId)}
              onSelectChat={openDirectChat}
              syntheticDirectChats={directSidebarChats}
              onNewDirectMessage={() => setStartDmOpen(true)}
              onToggleCollapse={() => setWorkspaceCollapsed((prev) => !prev)}
              searchQuery={searchQuery}
              unreadCounts={unreadCounts}
              typingConversations={typingConversations}
            />

          <ChannelsPanel
            activeGroup={activeGroup?.id}
            channel={activeChannel}
            channelAvatarUrl={
              activeChannel
                ? (channelAssets[activeChannel.id]?.avatar ?? activeChannel.avatarUrl ?? null)
                : null
            }
            channelBannerUrl={
              activeChannel
                ? (channelAssets[activeChannel.id]?.banner ?? activeChannel.bannerUrl ?? null)
                : null
            }
            onAssetSave={handleChannelAssetSave}
            onChannelDeleted={() => {
              setActiveChannelId('')
              setActiveGroupId('')
              setActiveSurface('direct')
              setWorkspaceMode('direct')
            }}
            onCreateGroup={handleCreateGroup}
            onSelectGroup={(groupId) => {
              setActiveGroupId(groupId)
              setWorkspaceMode('channels')
              setActiveSurface('channel')
              setActiveView('chat')
              setChannelTab('feed')
              setChannelFeedClosed(false)
              setShowDirectProfile(false)
            }}
            visible={activeSurface === 'channel'}
            voiceParticipants={voiceParticipants}
            activeVoiceGroupId={activeVoiceGroupId}
            voiceIsMuted={voice.isMuted}
            voiceTimer={voiceElapsed}
            onVoiceLeave={async () => { await voice.leave(); setActiveVoiceGroupId(null) }}
            onVoiceToggleMute={voice.toggleMute}
            onVoiceReturn={(groupId) => {
              setActiveGroupId(groupId)
              setWorkspaceMode('channels')
              setActiveSurface('channel')
            }}
            onMoveVoiceParticipant={({ userId, fromGroupId, toGroupId }) => {
              void voice.moveUser(userId, fromGroupId, toGroupId)
            }}
            myId={profile?.id}
            onKickVoiceParticipant={(userId) => voice.kick(userId)}
            onMuteVoiceParticipant={(userId, _groupId, muted) => voice.muteUser(userId, muted)}
            onViewVoiceParticipantProfile={(p) => setVoiceProfileTarget(p as VoicePresenceUser)}
            soundboardUserId={voice.soundboardUserId}
            soundboardIntensity={voice.soundboardIntensity}
          />

            {activeSurface === 'channel'
              ? channelContent
              : activeSurface === 'direct'
                ? (
                  <div className="flex min-w-0 flex-1 overflow-hidden bg-background">
                    {dmCallStatus.state === 'active' && profile?.id &&
                     dmCallStatus.conversationId === activeDirectChat && !dmCallMinimized ? (
                      <DmCallWindow
                        roomId={dmCallStatus.roomId}
                        myId={profile.id}
                        peerId={dmCallStatus.peerId}
                        peerName={dmCallStatus.peerName}
                        peerAvatar={dmCallStatus.peerAvatar}
                        type={dmCallStatus.type}
                        mode="conversation"
                        onHangUp={hangUp}
                        onMinimize={() => setDmCallMinimized(true)}
                        onExpand={() => setDmCallMinimized(false)}
                      />
                    ) : directFeedContent}
                    <FeedProfileSidebarDock
                      open={showDirectProfile && !!activeDirectChat}
                      width={360}
                      onBack={() => setShowDirectProfile(false)}
                    >
                      {showDirectProfile && activeDirectChat ? (
                        <DirectProfileSidebar
                          userId={activeDirectOther?.id}
                          chatOverride={activeSyntheticChat
                            ? {
                                avatarUrl: activeSyntheticChat.avatarUrl,
                                isOnline: activeSyntheticChat.isOnline,
                                subPlan: activeSyntheticChat.subPlan,
                                isVerified: activeSyntheticChat.isVerified,
                                name: activeSyntheticChat.name,
                                subtitle: activeSyntheticChat.status,
                              }
                            : activeDirectOther
                              ? {
                                  avatarUrl: activeDirectOther.avatar_url ?? null,
                                  bannerUrl: (activeDirectOther as any).banner ?? null,
                                  isOnline: activeDirectOtherIsOnline,
                                  subPlan: (activeDirectOther as any).sub_plan ?? null,
                                  isVerified: (activeDirectOther as any).is_verified ?? false,
                                  name: activeDirectOther.username ?? 'Direct message',
                                  subtitle: activeDirectOtherIsOnline ? 'Online' : 'Offline',
                                }
                              : undefined}
                          onClose={() => setShowDirectProfile(false)}
                          onVoiceCall={activeIsRealDirect && activeDirectOther ? () => {
                            setShowDirectProfile(false)
                            startCall(activeDirectChat!, activeDirectOther.id, activeDirectOther.username ?? 'User', activeDirectOther.avatar_url ?? null, 'audio')
                          } : undefined}
                          onVideoCall={activeIsRealDirect && activeDirectOther ? () => {
                            setShowDirectProfile(false)
                            startCall(activeDirectChat!, activeDirectOther.id, activeDirectOther.username ?? 'User', activeDirectOther.avatar_url ?? null, 'video')
                          } : undefined}
                          onOpenPixelRoom={() => {
                            setShowDirectProfile(false)
                            setActiveView('game')
                          }}
                        />
                      ) : null}
                    </FeedProfileSidebarDock>
                  </div>
                )
                : renderPersonalSurface()}
          </>
        )}
      </div>

      {/* Persistent WebRTC audio — outside conditional so audio survives navigation */}
      {Array.from(webrtc.remoteStreams.entries()).map(([userId, stream]) => (
        <RemoteAudio key={userId} stream={stream} deafened={deafened} />
      ))}

      {storyViewUserId && storySlides.length > 0 && storyStartId && (
        <StoryViewer
          slides={storySlides}
          startId={storyStartId}
          onClose={() => setStoryViewUserId(null)}
          onView={(id) => recordView.mutate(id)}
          onDelete={(id) => {
            deleteStory.mutate(id)
            setStoryViewUserId(null)
          }}
        />
      )}

      <StoryUploadDialog
        open={storyUploadOpen}
        onOpenChange={setStoryUploadOpen}
        onSubmit={async (file, caption) => {
          await createStory.mutateAsync({ file, caption })
        }}
      />

      {/* DM call overlays */}
      {dmCallStatus.state === 'incoming' && (() => {
        const conv = (directConversations ?? []).find((c: any) =>
          c.user_one_id === dmCallStatus.callerId || c.user_two_id === dmCallStatus.callerId
        )
        const caller = conv
          ? (conv.user_one_id === dmCallStatus.callerId ? conv.user_one : conv.user_two)
          : null
        const callerName = caller?.username ?? 'Unknown'
        const callerAvatar = caller?.avatar_url ?? null
        return (
          <DmCallIncoming
            callerName={callerName}
            callerAvatar={callerAvatar}
            type={dmCallStatus.type}
            onAccept={() => acceptCall(
              dmCallStatus.conversationId,
              dmCallStatus.callerId,
              dmCallStatus.type,
              callerName,
              callerAvatar,
            )}
            onReject={() => rejectCall(dmCallStatus.conversationId, dmCallStatus.callerId)}
          />
        )
      })()}
      {dmCallStatus.state === 'outgoing' && (
        <DmCallOutgoing
          peerName={dmCallStatus.calleeName}
          peerAvatar={dmCallStatus.calleeAvatar}
          type={dmCallStatus.type}
          onCancel={hangUp}
        />
      )}
      {dmCallStatus.state === 'active' && profile?.id &&
       (dmCallMinimized || dmCallStatus.conversationId !== activeDirectChat) && (
        <DmCallWindow
          roomId={dmCallStatus.roomId}
          myId={profile.id}
          peerId={dmCallStatus.peerId}
          peerName={dmCallStatus.peerName}
          peerAvatar={dmCallStatus.peerAvatar}
          type={dmCallStatus.type}
          mode="pip"
          onHangUp={hangUp}
          onMinimize={() => setDmCallMinimized(true)}
          onExpand={() => {
            setDmCallMinimized(false)
            openDirectChat(dmCallStatus.conversationId)
          }}
        />
      )}

      <Dialog open={startDmOpen} onOpenChange={setStartDmOpen}>
        <DialogContent className="sm:max-w-[420px] p-0 overflow-hidden">
          <DialogHeader className="border-b border-border px-4 py-3">
            <DialogTitle className="text-[13px]">New message</DialogTitle>
          </DialogHeader>
          <div className="border-b border-border px-4 py-3">
            <Input
              value={startDmQuery}
              onChange={(e) => setStartDmQuery(e.target.value)}
              placeholder="Search mutual followers…"
              className="h-9 rounded-xl text-[12px]"
            />
            <p className="mt-1.5 text-[10px] text-muted-foreground">
              Only mutual followers can be messaged.
            </p>
          </div>
          <div className="max-h-[360px] overflow-y-auto px-2 py-2">
            {mutualFiltered.length === 0 ? (
              <p className="px-2 py-6 text-center text-[12px] text-muted-foreground">
                No mutual followers found
              </p>
            ) : (
              mutualFiltered.map((u: any) => (
                <button
                  key={u.id}
                  className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-accent"
                  onClick={async () => {
                    try {
                      const conv = await createDirectConversation.mutateAsync(u.id)
                      setStartDmOpen(false)
                      setStartDmQuery('')
                      openDirectChat(conv.id)
                    } catch (e) {
                      const msg = e instanceof Error ? e.message : 'Failed to start conversation'
                      // eslint-disable-next-line no-console
                      console.error(msg)
                    }
                  }}
                >
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/10 text-[12px] font-semibold text-primary">
                    {u.avatar_url ? (
                      <img src={u.avatar_url} alt={u.username ?? ''} className="h-full w-full object-cover" />
                    ) : (
                      (u.username?.[0] ?? '?').toUpperCase()
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium text-foreground">
                      {normalizedUserLabel(u)}
                    </p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      @{u.username}
                    </p>
                  </div>
                </button>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

function RemoteAudio({ stream, deafened }: { stream: MediaStream; deafened: boolean }) {
  const ref = useRef<HTMLAudioElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.srcObject = stream
    el.muted = deafened
    void el.play().catch(() => {})
    const onAddTrack = () => {
      el.srcObject = stream
      void el.play().catch(() => {})
    }
    stream.addEventListener('addtrack', onAddTrack)
    return () => stream.removeEventListener('addtrack', onAddTrack)
  }, [stream]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.muted = deafened
    if (!deafened) void el.play().catch(() => {})
  }, [deafened])
  return <audio ref={ref} autoPlay />
}

export default function ChatPage() {
  return <ChatPageContent lockedView="chat" hideRail />
}
