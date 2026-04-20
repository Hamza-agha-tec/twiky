'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { BookUser, ListTodo, MessageSquare, Sparkles, Store, Target } from 'lucide-react'

import {
  ChannelFeed,
  type FeedDirectConversationTarget,
} from '@/components/chat/channel-feed'
import {
  buildChannelGroup,
  buildWorkspaceChannel,
  ChannelsPanel,
  getMockChannel,
  getMockGroup,
  MOCK_WORKSPACE_CHANNELS,
  type WorkspaceChannel,
} from '@/components/chat/channels-panel'
import { ChatWindow } from '@/components/chat/chat-window'
import { DirectProfileSidebar } from '@/components/chat/direct-profile-sidebar'
import { FeedProfileSidebarDock } from '@/components/chat/feed-profile-sidebar-dock'
import { GoalsPanel } from '@/components/chat/goals-panel'
import { ActiveView, IconRail } from '@/components/chat/icon-rail'
import { MainArea, MainAreaTab } from '@/components/chat/main-area'
import { NotesPanel } from '@/components/chat/notes-panel'
import { SettingsView } from '@/components/chat/settings-view'
import { TasksPanel } from '@/components/chat/tasks-panel'
import {
  WorkspaceMode,
  WorkspaceNavTarget,
  WorkspaceSidebar,
} from '@/components/chat/workspace-sidebar'
import { type ChatMessage, useMessages } from '@/hooks/use-messaging'
import { useGlobalSocket, useSocket } from '@/hooks/use-socket'
import { useProfile } from '@/hooks/use-user'
import { type Chat } from '@/lib/mock-data'

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
  workspaceChannels: WorkspaceChannel[]
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
const ACTIVE_VIEWS = ['chat', 'settings', 'store'] as const

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
    if (Array.isArray(parsed.workspaceChannels)) {
      next.workspaceChannels = parsed.workspaceChannels as WorkspaceChannel[]
    }
    if (typeof parsed.workspaceCollapsed === 'boolean') {
      next.workspaceCollapsed = parsed.workspaceCollapsed
    }
    if (isOneOf(parsed.workspaceMode, WORKSPACE_MODES)) {
      next.workspaceMode = parsed.workspaceMode
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

const STORE_ITEMS = [
  { id: 'themes', label: 'Themes', description: 'Custom color schemes and visual styles', count: 24, tag: 'Popular', gradient: 'from-violet-500 via-purple-500 to-fuchsia-600' },
  { id: 'stickers', label: 'Sticker Packs', description: 'Expressive sticker sets for reactions', count: 48, tag: 'New', gradient: 'from-orange-500 via-amber-500 to-yellow-500' },
  { id: 'sounds', label: 'Sound Packs', description: 'Custom notification and UI sounds', count: 12, tag: null, gradient: 'from-emerald-500 via-teal-500 to-cyan-600' },
  { id: 'frames', label: 'Profile Frames', description: 'Animated borders for your avatar', count: 36, tag: 'Hot', gradient: 'from-pink-500 via-rose-500 to-red-500' },
  { id: 'rooms', label: 'Room Templates', description: 'Backgrounds and layouts for your profile room', count: 18, tag: 'Coming soon', gradient: 'from-cyan-500 via-sky-500 to-blue-600' },
  { id: 'badges', label: 'Badges', description: 'Collectible profile badges to show off', count: 60, tag: 'Exclusive', gradient: 'from-amber-500 via-orange-500 to-rose-500' },
] as const

function StoreView() {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-background">
      {/* Hero */}
      <div className="relative overflow-hidden border-b border-border bg-gradient-to-br from-primary/10 via-background to-background px-8 py-10">
        <div className="mx-auto max-w-3xl">
          <div className="flex items-center gap-2 text-primary">
            <Store className="h-5 w-5" />
            <span className="text-[11px] font-bold uppercase tracking-widest">Twiky Store</span>
          </div>
          <h1 className="mt-2 text-[28px] font-black tracking-tight text-foreground">Personalize your workspace</h1>
          <p className="mt-2 text-[14px] text-muted-foreground">Themes, stickers, frames, and more — make Twiky yours.</p>
        </div>
      </div>

      <div className="mx-auto w-full max-w-3xl px-8 py-8">
        <p className="mb-4 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Browse categories</p>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
          {STORE_ITEMS.map((item) => (
            <button
              key={item.id}
              className="group relative overflow-hidden rounded-2xl border border-border bg-card text-left transition-all hover:border-primary/30 hover:shadow-md"
            >
              <div className={`h-20 bg-gradient-to-br ${item.gradient} opacity-80`} />
              <div className="p-3">
                <div className="flex items-start justify-between gap-1">
                  <p className="text-[13px] font-bold text-foreground">{item.label}</p>
                  {item.tag ? (
                    <span className="flex-shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-primary">
                      {item.tag}
                    </span>
                  ) : null}
                </div>
                <p className="mt-0.5 text-[11px] text-muted-foreground">{item.description}</p>
                <p className="mt-2 text-[10px] font-semibold text-muted-foreground">{item.count} items</p>
              </div>
            </button>
          ))}
        </div>

        <div className="mt-10 rounded-2xl border border-primary/20 bg-primary/5 p-6 text-center">
          <Sparkles className="mx-auto h-8 w-8 text-primary" />
          <p className="mt-3 text-[15px] font-bold text-foreground">Twiky Premium unlocks everything</p>
          <p className="mt-1.5 text-[13px] text-muted-foreground">Get all themes, sticker packs, and exclusive frames — free forever for early members.</p>
          <button className="mt-4 inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-2.5 text-[13px] font-semibold text-primary-foreground transition-opacity hover:opacity-90">
            <Sparkles className="h-4 w-4" />
            Learn about Premium
          </button>
        </div>
      </div>
    </div>
  )
}

export default function ChatPage() {
  const [viewStateReady, setViewStateReady] = useState(false)
  const [activeDirectChat, setActiveDirectChat] = useState<string | null>(null)
  const [activeView, setActiveView] = useState<ActiveView>('chat')
  const [settingsSection, setSettingsSection] = useState<string>('account')
  const [localAvatar, setLocalAvatar] = useState<string | null>(() => {
    try { return localStorage.getItem('twiky-user-avatar') } catch { return null }
  })
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
  const [workspaceChannels, setWorkspaceChannels] = useState(MOCK_WORKSPACE_CHANNELS)
  const [activeChannelId, setActiveChannelId] = useState(MOCK_WORKSPACE_CHANNELS[0].id)
  const [activeGroupId, setActiveGroupId] = useState(MOCK_WORKSPACE_CHANNELS[0].groups[0].id)
  const [searchQuery, setSearchQuery] = useState('')
  const [showContactInfo, setShowContactInfo] = useState(false)
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({})
  const [channelAssets, setChannelAssets] = useState<Record<string, { avatar: string | null; banner: string | null }>>(() => {
    try {
      const result: Record<string, { avatar: string | null; banner: string | null }> = {}
      for (const ch of MOCK_WORKSPACE_CHANNELS) {
        const avatar = localStorage.getItem(`twiky-ch-avatar-${ch.id}`)
        const banner = localStorage.getItem(`twiky-ch-banner-${ch.id}`)
        if (avatar || banner) result[ch.id] = { avatar, banner }
      }
      return result
    } catch { return {} }
  })

  const { data: profile } = useProfile()
  const activeSyntheticChat = activeDirectChat ? (syntheticDirectChats[activeDirectChat] ?? null) : null
  const { data: messages = [] } = useMessages(activeSyntheticChat ? null : activeDirectChat)

  function handleChannelAssetSave(channelId: string, avatar: string | null, banner: string | null) {
    setChannelAssets((prev) => ({ ...prev, [channelId]: { avatar, banner } }))
  }

  const handleNewMessage = useCallback(
    (conversationId: string) => {
      setUnreadCounts((prev) => {
        if (conversationId === activeDirectChat) return prev
        return { ...prev, [conversationId]: (prev[conversationId] ?? 0) + 1 }
      })
    },
    [activeDirectChat],
  )

  const { sendMessage, sendTyping, otherIsTyping, reactToMessage, editMessage, deleteMessage } =
    useSocket(activeSyntheticChat ? null : activeDirectChat)

  useGlobalSocket(handleNewMessage)

  const activeChannel = useMemo(
    () => getMockChannel(activeChannelId, workspaceChannels),
    [activeChannelId, workspaceChannels],
  )

  const activeGroup = useMemo(
    () => getMockGroup(activeChannelId, activeGroupId, workspaceChannels),
    [activeChannelId, activeGroupId, workspaceChannels],
  )

  useEffect(() => {
    const persisted = readPersistedChatState()

    if (persisted.activeDirectChat !== undefined) setActiveDirectChat(persisted.activeDirectChat)
    if (persisted.activeView) setActiveView(persisted.activeView)
    if (persisted.settingsSection) setSettingsSection(persisted.settingsSection)
    if (persisted.activeSurface) setActiveSurface(persisted.activeSurface)
    if (persisted.syntheticDirectChats) setSyntheticDirectChats(persisted.syntheticDirectChats)
    if (persisted.syntheticDirectMessages) setSyntheticDirectMessages(persisted.syntheticDirectMessages)
    if (persisted.workspaceMode) setWorkspaceMode(persisted.workspaceMode)
    if (persisted.workspaceChannels?.length) setWorkspaceChannels(persisted.workspaceChannels)
    if (persisted.workspaceCollapsed !== undefined) setWorkspaceCollapsed(persisted.workspaceCollapsed)
    if (persisted.channelTab) setChannelTab(persisted.channelTab)
    if (persisted.activeChannelId) setActiveChannelId(persisted.activeChannelId)
    if (persisted.activeGroupId) setActiveGroupId(persisted.activeGroupId)

    setViewStateReady(true)
  }, [])

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
        syntheticDirectChats,
        syntheticDirectMessages,
        workspaceChannels,
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
    syntheticDirectChats,
    syntheticDirectMessages,
    viewStateReady,
    workspaceChannels,
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

  function handleAvatarClick() {
    setSettingsSection('profile')
    setActiveView('settings')
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
    setShowContactInfo(false)
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
        },
      }

      setSyntheticDirectMessages((prev) => ({
        ...prev,
        [conversationId]: [nextMessage, ...(prev[conversationId] ?? [])],
      }))
    },
    [profile?.id, profile?.username, syntheticDirectMessages, userAvatar],
  )

  const activeDirectMessages = activeSyntheticChat
    ? (syntheticDirectMessages[activeSyntheticChat.id] ??
      activeSyntheticChat.initialMessages ??
      [])
    : messages

  function openChannelSurface(channelId: string, groupId?: string) {
    const channel = getMockChannel(channelId, workspaceChannels)
    if (!channel) return
    setActiveChannelId(channel.id)
    setActiveGroupId(groupId ?? channel.groups[0]?.id ?? activeGroupId)
    setWorkspaceMode('channels')
    setActiveSurface('channel')
    setActiveView('chat')
    setChannelTab('feed')
    setShowContactInfo(false)
  }

  function handleModeChange(mode: WorkspaceMode) {
    setWorkspaceMode(mode)
    setActiveView('chat')
    setShowContactInfo(false)
    if (mode === 'channels') openChannelSurface(activeChannelId)
    else setActiveSurface('direct')
  }

  function handleNavItem(tab: WorkspaceNavTarget) {
    setActiveView('chat')
    setShowContactInfo(false)
    if (tab === 'notes') setActiveSurface('personal-notes')
    if (tab === 'tasks') setActiveSurface('personal-tasks')
    if (tab === 'goals') setActiveSurface('personal-goals')
  }

  function handleCreateChannel(values: { description: string; name: string }) {
    const existingIds = workspaceChannels.map((c) => c.id)
    const channelId = createUniqueId(toSlug(values.name), existingIds)
    const nextChannel = buildWorkspaceChannel({ id: channelId, label: values.name, description: values.description, index: workspaceChannels.length })
    setWorkspaceChannels((prev) => [...prev, nextChannel])
    setActiveChannelId(nextChannel.id)
    setActiveGroupId(nextChannel.groups[0].id)
    setWorkspaceMode('channels')
    setActiveSurface('channel')
    setActiveView('chat')
    setChannelTab('feed')
    setWorkspaceCollapsed(false)
    setShowContactInfo(false)
  }

  function handleCreateGroup(values: { description: string; name: string }) {
    if (!activeChannel) return
    const existingGroupIds = activeChannel.groups.map((g) => g.id)
    const baseGroupId = `${activeChannel.id}-${toSlug(values.name)}`
    const uniqueGroupId = createUniqueId(baseGroupId, existingGroupIds)
    const groupLabel = uniqueGroupId.replace(`${activeChannel.id}-`, '')
    const nextGroup = buildChannelGroup({
      channelId: activeChannel.id,
      channelLabel: activeChannel.label,
      label: groupLabel.replace(/-/g, ' '),
      description: values.description,
      membersLabel: activeChannel.membersLabel,
    })
    const normalizedGroup = { ...nextGroup, id: uniqueGroupId }
    setWorkspaceChannels((prev) =>
      prev.map((channel) =>
        channel.id === activeChannel.id
          ? { ...channel, groups: [...channel.groups, normalizedGroup] }
          : channel,
      ),
    )
    setActiveGroupId(normalizedGroup.id)
    setActiveSurface('channel')
    setChannelTab('feed')
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
                name: activeSyntheticChat.name,
                subtitle: activeSyntheticChat.status,
              }
            : undefined
        }
        messages={activeDirectMessages}
        onSendMessage={(content, type, replyToId, fileUrl) => {
          if (activeSyntheticChat) {
            handleSyntheticSendMessage(activeSyntheticChat.id, content, type, replyToId, fileUrl)
            return
          }

          if (!activeDirectChat) return
          sendMessage({ conversationId: activeDirectChat, content, type, replyToId, fileUrl })
        }}
        onTyping={
          activeSyntheticChat
            ? undefined
            : (isTyping) => {
                if (!activeDirectChat) return
                sendTyping(activeDirectChat, isTyping)
              }
        }
        otherIsTyping={activeSyntheticChat ? false : otherIsTyping}
        onReact={activeSyntheticChat ? undefined : reactToMessage}
        onEdit={activeSyntheticChat ? undefined : editMessage}
        onDelete={activeSyntheticChat ? undefined : deleteMessage}
        onProfileClick={() => setShowContactInfo((v) => !v)}
      />
    ) : (
    <div className="flex flex-1 items-center justify-center bg-sidebar p-6">
      <div className="flex w-full max-w-sm flex-col items-center text-center">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-3xl bg-muted">
          <MessageSquare className="h-5 w-5 text-foreground" />
        </div>
        <h2 className="text-[15px] font-semibold text-foreground">Select a direct message</h2>
        <p className="mt-2 text-[12px] leading-6 text-muted-foreground">
          Open a contact from the left sidebar to start chatting.
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

  const channelContent =
    activeChannel && activeGroup ? (
      <MainArea activeChannel={activeChannel} activeGroup={activeGroup} activeTab={channelTab} onTabChange={setChannelTab}>
        <ChannelFeed
          channel={activeChannel}
          group={activeGroup}
          myAvatarUrl={userAvatar}
          onOpenDirectConversation={openDirectChat}
        />
      </MainArea>
    ) : null

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <IconRail
        activeView={activeView}
        onViewChange={setActiveView}
        onAvatarClick={handleAvatarClick}
        userInitial={userInitial}
        userAvatar={userAvatar}
      />

      {activeView === 'settings' ? (
        <SettingsView
          initialSection={settingsSection}
          onAvatarChange={(url) => setLocalAvatar(url)}
          avatarUrl={userAvatar ?? null}
        />
      ) : activeView === 'store' ? (
        <StoreView />
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
            channelAvatarUrl={activeChannel ? (channelAssets[activeChannel.id]?.avatar ?? null) : null}
            onAssetSave={handleChannelAssetSave}
            onCreateGroup={handleCreateGroup}
            onSelectGroup={(groupId) => {
              setActiveGroupId(groupId)
              setWorkspaceMode('channels')
              setActiveSurface('channel')
              setActiveView('chat')
              setChannelTab('feed')
              setShowContactInfo(false)
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
                    open={showContactInfo && !!activeDirectChat}
                    width={360}
                    onBack={() => setShowContactInfo(false)}
                  >
                    {showContactInfo && activeDirectChat ? (
                      <DirectProfileSidebar
                        activeChat={activeDirectChat}
                        chatOverride={activeSyntheticChat
                          ? {
                              avatarUrl: activeSyntheticChat.avatarUrl,
                              isOnline: activeSyntheticChat.isOnline,
                              name: activeSyntheticChat.name,
                              subtitle: activeSyntheticChat.status,
                            }
                          : undefined}
                        onClose={() => setShowContactInfo(false)}
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
