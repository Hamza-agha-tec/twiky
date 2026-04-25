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
import {
  WorkspaceMode,
  WorkspaceNavTarget,
  WorkspaceSidebar,
} from '@/components/chat/workspace-sidebar'
import type { CreateEntityValues } from '@/components/chat/create-entity-dialog'
import { useChannels, useCreateChannel, useUpdateChannel } from '@/hooks/use-channels'
import { useChannelGroups, useCreateGroup, useGroupMembers, useGroupMessages, backendGroupToMock } from '@/hooks/use-groups'
import { useToggleGroupMessageReaction } from '@/hooks/use-groups'
import { groupsApi, type GroupMessage } from '@/lib/groups-api'
import { useQueryClient } from '@tanstack/react-query'
import { GROUP_KEYS } from '@/hooks/use-groups'
import type { FeedPost } from '@/components/chat/channel-feed'
import { type ChatMessage } from '@/hooks/use-messaging'
import { useProfile } from '@/hooks/use-user'
import { useNotifications, useMarkAsRead } from '@/hooks/use-notifications'
import type { BackendChannel } from '@/lib/channel-api'
import { filesApi } from '@/lib/files-api'
import { type Chat } from '@/lib/mock-data'
import { useRouter } from 'next/navigation'

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
  channelGroupsById: Record<string, MockChannelGroup[]>
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
const ACTIVE_VIEWS = ['chat', 'discover-channels', 'settings', 'store', 'add-friends', 'notifications'] as const

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
    if (
      parsed.channelGroupsById &&
      typeof parsed.channelGroupsById === 'object' &&
      !Array.isArray(parsed.channelGroupsById)
    ) {
      next.channelGroupsById = parsed.channelGroupsById as Record<string, MockChannelGroup[]>
    }
    if (typeof parsed.settingsSection === 'string') next.settingsSection = parsed.settingsSection
    if (
      parsed.syntheticDirectChats &&
      typeof parsed.syntheticDirectChats === 'object' &&
      !Array.isArray(parsed.syntheticDirectChats)
    ) {
      next.syntheticDirectChats = parsed.syntheticDirectChats as Record<string, FeedDirectConversationTarget>
    }
    if (
      parsed.syntheticDirectMessages &&
      typeof parsed.syntheticDirectMessages === 'object' &&
      !Array.isArray(parsed.syntheticDirectMessages)
    ) {
      next.syntheticDirectMessages = parsed.syntheticDirectMessages as Record<string, ChatMessage[]>
    }
    if (typeof parsed.workspaceCollapsed === 'boolean') {
      next.workspaceCollapsed = parsed.workspaceCollapsed
    }
    if (isOneOf(parsed.workspaceMode, WORKSPACE_MODES)) {
      next.workspaceMode = parsed.workspaceMode
    }

    if (
      next.activeDirectChat &&
      !next.syntheticDirectChats?.[next.activeDirectChat]
    ) {
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
  const [voiceProfileTarget, setVoiceProfileTarget] = useState<VoicePresenceUser | null>(null)
  const [voiceElapsed, setVoiceElapsed] = useState<string | null>(null)
  const voiceElapsedRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [showDirectProfile, setShowDirectProfile] = useState(false)
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({})
  const [channelAssets, setChannelAssets] = useState<Record<string, { avatar: string | null; banner: string | null }>>(() => {
    return {}
  })

  const queryClient = useQueryClient()
  const { data: profile } = useProfile()

  const voiceMyInfo = profile
    ? { id: profile.id, name: profile.fullname ?? profile.username ?? 'You', avatarUrl: profile.avatar_url }
    : null
  const voice = useVoicePresence(voiceMyInfo)
  const { data: allNotifications = [] } = useNotifications()
  const unreadNotificationCount = allNotifications.filter((n) => !n.is_read && n.type !== 'MENTION').length
  const { data: backendChannels = [] } = useChannels()
  const createChannel = useCreateChannel()
  const updateChannel = useUpdateChannel()
  const { data: backendGroups = [] } = useChannelGroups(activeChannelId || undefined)
  const createGroup = useCreateGroup(activeChannelId)
  const isRealGroupId = /^[0-9a-f-]{36}$/i.test(activeGroupId)
  const { data: rawMessages } = useGroupMessages(isRealGroupId ? activeGroupId : undefined)
  const toggleGroupReaction = useToggleGroupMessageReaction(activeGroupId)
  const { data: activeGroupMembers = [] } = useGroupMembers(isRealGroupId ? activeGroupId : undefined)

  const groupPosts: FeedPost[] = useMemo(() => {
  const groupMessageById = new Map((rawMessages ?? []).map((msg) => [msg.id, msg]))
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
      role: isSystem ? 'Automation' : (groupMemberRoleByUserId.get(msg.sender_id) ?? 'Member'),
      time: new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      body: msg.content,
      isOwn: msg.sender_id === profile?.id,
      imageUrl: msg.file_url ?? undefined,
      attachmentType: (msg as any).type ?? undefined,
      attachmentMime: (msg as any).mime ?? undefined,
      attachmentDuration: (msg as any).duration ?? undefined,
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
  }, [rawMessages, activeGroupMembers, profile?.id])

  const activeSyntheticChat = activeDirectChat ? (syntheticDirectChats[activeDirectChat] ?? null) : null

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
        const wc = toWorkspaceChannel(channel, index, channelGroupsById)
        return {
          ...wc,
          groups: wc.groups.map((g) => ({
            ...g,
            hasMention: mentionedGroupIds.has(g.id),
          })),
        }
      }),
    [backendChannels, channelGroupsById, mentionedGroupIds],
  )

  // Sync real backend groups into channelGroupsById when they load
  useEffect(() => {
    if (!activeChannelId || backendGroups.length === 0) return;
    setChannelGroupsById((prev) => ({
      ...prev,
      [activeChannelId]: backendGroups.map(backendGroupToMock),
    }));
  }, [activeChannelId, backendGroups]);

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
    if (persisted.channelGroupsById) setChannelGroupsById(persisted.channelGroupsById)
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
        channelGroupsById,
        channelTab,
        settingsSection,
        syntheticDirectChats,
        syntheticDirectMessages,
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
    channelGroupsById,
    channelTab,
    settingsSection,
    syntheticDirectChats,
    syntheticDirectMessages,
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

  const activeNav: WorkspaceNavTarget | null =
    activeSurface === 'personal-notes' ? 'notes'
    : activeSurface === 'personal-tasks' ? 'tasks'
    : activeSurface === 'personal-goals' ? 'goals'
    : null

  const router = useRouter()

  const handleAvatarClick = () => {
    router.push('/settings/profile')
  }

  const openDirectChat = useCallback((conversation: string | FeedDirectConversationTarget) => {
    const conversationId =
      typeof conversation === 'string' ? conversation : conversation.id

    if (typeof conversation !== 'string') {
      setSyntheticDirectChats((prev) => ({
        ...prev,
        [conversation.id]: {
          ...(prev[conversation.id] ?? {}),
          ...conversation,
        },
      }))
      setSyntheticDirectMessages((prev) => {
        if (prev[conversation.id]?.length) return prev
        if (!conversation.initialMessages?.length) return prev
        return { ...prev, [conversation.id]: conversation.initialMessages }
      })
    }

    setActiveDirectChat(conversationId)
    setActiveSurface('direct')
    setWorkspaceMode('direct')
    setActiveView('chat')
    setShowDirectProfile(false)
    setUnreadCounts((prev) => ({ ...prev, [conversationId]: 0 }))
  }, [])

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
    setChannelGroupsById((prev) => {
      const groups = prev[activeChannelId] ?? []
      return {
        ...prev,
        [activeChannelId]: groups.map((g) => g.id === groupId ? { ...g, ...updates } : g),
      }
    })
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
          setChannelGroupsById((prev) => ({
            ...prev,
            [activeChannel.id]: [...(prev[activeChannel.id] ?? activeChannel.groups), newGroup],
          }))
          setActiveGroupId(newGroup.id)
          setActiveSurface('channel')
          setChannelTab('feed')
        },
      },
    )
  }

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
            : undefined
        }
        messages={activeDirectMessages}
        onSendMessage={(content, type, replyToId, fileUrl) => {
          if (!activeDirectChat) return
          handleSyntheticSendMessage(activeDirectChat, content, type, replyToId, fileUrl)
        }}
        otherIsTyping={false}
        onProfileClick={() => setShowDirectProfile((v) => !v)}
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
    if (!voice.isJoined || !voice.joinedAt) {
      if (voiceElapsedRef.current) clearInterval(voiceElapsedRef.current)
      setVoiceElapsed(null)
      return
    }
    const tick = () => {
      const s = Math.floor((Date.now() - voice.joinedAt) / 1000)
      const h = Math.floor(s / 3600)
      const m = Math.floor((s % 3600) / 60).toString().padStart(2, '0')
      const sec = (s % 60).toString().padStart(2, '0')
      setVoiceElapsed(h > 0 ? `${h}:${m}:${sec}` : `${m}:${sec}`)
    }
    tick()
    voiceElapsedRef.current = setInterval(tick, 1000)
    return () => { if (voiceElapsedRef.current) clearInterval(voiceElapsedRef.current) }
  }, [voice.isJoined, voice.joinedAt])

  const voiceParticipants: Record<string, VoiceParticipant[]> = activeVoiceGroupId && voice.participants.length > 0
    ? { [activeVoiceGroupId]: voice.participants }
    : {}

  const channelContent =
    activeChannel && activeGroup ? (
      activeGroup.kind === 'voice' ? (
        <div className="flex min-w-0 flex-1 overflow-hidden">
          <VoiceGroupView
            group={activeGroup}
            participants={voice.participants}
            isJoined={voice.isJoined}
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
                  role: 'Member',
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
            onCloseFeedRequest={() => setChannelFeedClosed(true)}
          />
        </MainArea>
      )
    ) : null

  return (
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
        <NotificationsView />
      ) : (
        <>
          <WorkspaceSidebar
            activeChannelId={activeChannel?.id}
            activeChat={activeDirectChat ?? ''}
            activeNav={activeNav}
            channelAssets={channelAssets}
            channels={workspaceChannels}
            collapsed={workspaceCollapsed}
            mode={workspaceMode}
            onCreateChannel={handleCreateChannel}
            onModeChange={handleModeChange}
            onNavItem={handleNavItem}
            onSearchChange={setSearchQuery}
            onSelectChannel={(channelId) => openChannelSurface(channelId)}
            onSelectChat={openDirectChat}
            syntheticDirectChats={syntheticSidebarChats}
            onToggleCollapse={() => setWorkspaceCollapsed((prev) => !prev)}
            searchQuery={searchQuery}
            unreadCounts={unreadCounts}
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
            onGroupUpdated={handleGroupUpdated}
            voiceParticipants={voiceParticipants}
            activeVoiceGroupId={activeVoiceGroupId}
            voiceIsMuted={voice.isMuted}
            voiceTimer={voiceElapsed}
            onVoiceLeave={async () => { await voice.leave(); setActiveVoiceGroupId(null) }}
            onVoiceToggleMute={voice.toggleMute}
            onVoiceReturn={(gid) => {
              setActiveGroupId(gid)
              setActiveSurface('channel')
              setWorkspaceMode('channels')
            }}
            onSelectGroup={(groupId) => {
              const group = workspaceChannels
                .flatMap((c) => c.groups)
                .find((g) => g.id === groupId)
              if (group?.kind === 'voice' && !voice.isJoined) {
                setActiveVoiceGroupId(groupId)
                voice.join(groupId)
              }
              setActiveGroupId(groupId)
              setWorkspaceMode('channels')
              setActiveSurface('channel')
              setActiveView('chat')
              setChannelTab('feed')
              setChannelFeedClosed(false)
              setShowDirectProfile(false)
            }}
            visible={activeSurface === 'channel'}
          />

          {activeSurface === 'channel'
            ? channelContent
            : activeSurface === 'direct'
              ? (
                <div className="flex min-w-0 flex-1 overflow-hidden bg-background">
                  {directFeedContent}
                  <FeedProfileSidebarDock
                    open={showDirectProfile && !!activeDirectChat}
                    width={360}
                    onBack={() => setShowDirectProfile(false)}
                  >
                    {showDirectProfile && activeDirectChat ? (
                      <DirectProfileSidebar
                        activeChat={activeDirectChat}
                        chatOverride={activeSyntheticChat
                          ? {
                              avatarUrl: activeSyntheticChat.avatarUrl,
                              isOnline: activeSyntheticChat.isOnline,
                              subPlan: activeSyntheticChat.subPlan,
                              isVerified: activeSyntheticChat.isVerified,
                              name: activeSyntheticChat.name,
                              subtitle: activeSyntheticChat.status,
                            }
                          : undefined}
                        onClose={() => setShowDirectProfile(false)}
                      />
                    ) : null}
                  </FeedProfileSidebarDock>
                </div>
              )
              : renderPersonalSurface()}
        </>
      )}
    </div>
  )
}

export default function ChatPage() {
  return <ChatPageContent lockedView="chat" hideRail />
}
