'use client'

import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ArrowRight,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Compass,
  Filter,
  Globe,
  Hash,
  ListTodo,
  Lock,
  MessageSquare,
  MessagesSquare,
  NotebookPen,
  Plus,
  Search,
  Sparkles,
  Target,
  X,
} from 'lucide-react'

import { CreateEntityDialog, type CreateEntityValues } from '@/components/chat/create-entity-dialog'
import { type WorkspaceChannel } from '@/components/chat/channels-panel'
import { ConversationContextMenu } from '@/components/chat/conversation-context-menu'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useDiscoverChannels, useJoinChannel } from '@/hooks/use-channels'
import { Chat } from '@/lib/mock-data'
import { cn } from '@/lib/utils'

interface WorkspaceSidebarProps {
  activeChannelId?: string | null
  activeChat: string
  activeNav?: WorkspaceNavTarget | null
  channelAssets?: Record<string, { avatar: string | null }>
  channels?: WorkspaceChannel[]
  collapsed?: boolean
  mode: WorkspaceMode
  onCreateChannel?: (values: CreateEntityValues) => void
  onModeChange: (mode: WorkspaceMode) => void
  onNavItem?: (tab: WorkspaceNavTarget) => void
  onSearchChange: (query: string) => void
  onSelectChannel?: (channelId: string) => void
  onSelectChat: (id: string) => void
  onToggleCollapse?: () => void
  searchQuery: string
  syntheticDirectChats?: Chat[]
  unreadCounts?: Record<string, number>
}

export type WorkspaceMode = 'direct' | 'channels'
export type WorkspaceNavTarget = 'notes' | 'tasks' | 'goals'

interface ChatMeta {
  isFavorite?: boolean
  isMuted?: boolean
  isPinned?: boolean
}

interface ContextMenuState {
  x: number
  y: number
  chat: SidebarChat
}

type SidebarChat = Chat & { isSynthetic?: boolean }
type DiscoverFilter = 'all' | 'new' | 'detailed'

const PERSONAL_ITEMS: {
  id: WorkspaceNavTarget
  icon: typeof NotebookPen
  label: string
}[] = [
  { id: 'notes', icon: NotebookPen, label: 'My Notes' },
  { id: 'tasks', icon: ListTodo, label: 'My Tasks' },
  { id: 'goals', icon: Target, label: 'My Goals' },
]

const CHANNEL_TONES = [
  'from-sky-500 via-cyan-500 to-blue-600',
  'from-emerald-500 via-teal-500 to-cyan-600',
  'from-orange-500 via-amber-500 to-yellow-500',
  'from-fuchsia-500 via-violet-500 to-indigo-600',
]

const DISCOVER_FILTERS: {
  id: DiscoverFilter
  icon: typeof Sparkles
  label: string
}[] = [
  { id: 'all', icon: Sparkles, label: 'Suggested' },
  { id: 'new', icon: CalendarDays, label: 'New' },
  { id: 'detailed', icon: Filter, label: 'Detailed' },
]

function getChannelMonogram(label: string) {
  const words = label.split(/\s+/).filter(Boolean)

  if (words.length >= 2) {
    return `${words[0][0]}${words[1][0]}`.toUpperCase()
  }

  return label.slice(0, 2).toUpperCase() || 'CH'
}

function readChannelAvatar(channelId: string): string | null {
  if (typeof window === 'undefined') return null
  try { return localStorage.getItem(`twiky-ch-avatar-${channelId}`) } catch { return null }
}

function getChannelTone(seed: string) {
  const index =
    seed.split('').reduce((total, char) => total + char.charCodeAt(0), 0) %
    CHANNEL_TONES.length

  return CHANNEL_TONES[index]
}

function resolveConversationAvatar(_name: string, avatar?: string | null) {
  if (avatar && avatar.trim().length > 0) return avatar
  return ''
}

export function WorkspaceSidebar({
  activeChannelId = null,
  activeChat,
  activeNav = null,
  channelAssets = {},
  channels = [],
  collapsed = false,
  mode,
  onCreateChannel,
  onModeChange,
  onNavItem,
  onSearchChange,
  onSelectChannel,
  onSelectChat,
  onToggleCollapse,
  searchQuery,
  syntheticDirectChats = [],
  unreadCounts = {},
}: WorkspaceSidebarProps) {
  const [chatMeta, setChatMeta] = useState<Record<string, ChatMeta>>({})
  const [deleted, setDeleted] = useState<Set<string>>(new Set())
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)
  const [showCreateChannel, setShowCreateChannel] = useState(false)
  const [showDiscover, setShowDiscover] = useState(false)
  const [discoverQuery, setDiscoverQuery] = useState('')
  const [discoverFilter, setDiscoverFilter] = useState<DiscoverFilter>('all')

  const { data: discoverableChannels = [], isLoading: discoverLoading } = useDiscoverChannels()
  const joinChannel = useJoinChannel()

  const isSearching = searchQuery.trim().length > 0

  const directChats = useMemo<SidebarChat[]>(() => {
    const localChats = syntheticDirectChats
      .filter((chat) => !deleted.has(chat.id))
      .map((chat) => ({
        ...chat,
        avatar: resolveConversationAvatar(chat.name, chat.avatar),
        isPinned: chatMeta[chat.id]?.isPinned ?? chat.isPinned ?? false,
        isMuted: chatMeta[chat.id]?.isMuted ?? chat.isMuted ?? false,
        isSynthetic: true,
        unread: unreadCounts[chat.id] ?? chat.unread ?? 0,
      }))

    return localChats
      .filter((chat, index, items) => items.findIndex((candidate) => candidate.id === chat.id) === index)
      .sort((a, b) => {
        if (b.isPinned !== a.isPinned) return (b.isPinned ? 1 : 0) - (a.isPinned ? 1 : 0)
        return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      })
  }, [chatMeta, deleted, syntheticDirectChats, unreadCounts])

  const visibleDirectChats = useMemo(() => {
    if (!isSearching) return directChats
    const query = searchQuery.toLowerCase()
    return directChats.filter((chat) =>
      chat.name.toLowerCase().includes(query) ||
      chat.lastMessage.toLowerCase().includes(query),
    )
  }, [directChats, isSearching, searchQuery])

  const filteredDiscoverChannels = useMemo(() => {
    const query = discoverQuery.trim().toLowerCase()
    const thirtyDays = 30 * 24 * 60 * 60 * 1000
    const newestCreatedAt = discoverableChannels.reduce((latest, channel) => {
      const createdAt = new Date(channel.created_at).getTime()
      return Number.isFinite(createdAt) ? Math.max(latest, createdAt) : latest
    }, 0)

    return discoverableChannels.filter((channel) => {
      const description = channel.description ?? ''
      const createdAt = new Date(channel.created_at).getTime()
      const isNew =
        Number.isFinite(createdAt) &&
        newestCreatedAt > 0 &&
        newestCreatedAt - createdAt <= thirtyDays
      const hasDetails = description.trim().length > 0 || Boolean(channel.avatar_url || channel.banner_url)
      const matchesQuery =
        query.length === 0 ||
        channel.name.toLowerCase().includes(query) ||
        description.toLowerCase().includes(query)

      if (!matchesQuery) return false
      if (discoverFilter === 'new') return isNew
      if (discoverFilter === 'detailed') return hasDetails
      return true
    })
  }, [discoverFilter, discoverQuery, discoverableChannels])

  const discoverSearchActive = discoverQuery.trim().length > 0

  const handleContextMenu = (event: React.MouseEvent, chat: SidebarChat) => {
    event.preventDefault()
    setContextMenu({ x: event.clientX, y: event.clientY, chat })
  }

  const updateMeta = (id: string, patch: Partial<ChatMeta>) =>
    setChatMeta((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }))

  return (
    <>
      <div
        className={cn(
          'z-10 flex h-full flex-shrink-0 flex-col border-r border-border bg-sidebar transition-[width] duration-300',
          collapsed ? 'w-[78px]' : 'w-[248px]',
        )}
      >
        <div className="border-b border-border px-3 py-3">
          <div className={cn('flex items-center', collapsed ? 'justify-center' : 'justify-between')}>
            {!collapsed ? (
              <div>
                <p className="text-[12.5px] font-semibold">Workspace</p>
                <p className="text-[11px] text-muted-foreground">
                  Personal tools and channel navigation
                </p>
              </div>
            ) : null}

            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-xl"
              onClick={onToggleCollapse}
            >
              {collapsed ? (
                <ChevronRight className="h-4 w-4" />
              ) : (
                <ChevronLeft className="h-4 w-4" />
              )}
            </Button>
          </div>

          {!collapsed ? (
            <div className="relative mt-2">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                placeholder="Search everything…"
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                className="h-8 w-full rounded-xl border border-border bg-background pl-8 pr-3 text-[12px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
              />
            </div>
          ) : (
            <div className="flex justify-center mt-2">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-xl text-muted-foreground hover:bg-accent hover:text-foreground"
                onClick={onToggleCollapse}
                title="Search"
              >
                <Search className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>

        {!collapsed ? (
          <div className="border-b border-border px-3 py-3">
            <p className="mb-2 px-1.5 text-[10px] font-semibold uppercase tracking-[0.09em] text-muted-foreground">
              You
            </p>
            <div className="space-y-1">
              {PERSONAL_ITEMS.map(({ id, icon: Icon, label }) => {
                const isActive = activeNav === id

                return (
                  <button
                    key={id}
                    onClick={() => onNavItem?.(id)}
                    className={cn(
                      'flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-[12px] font-medium transition-colors',
                      isActive
                        ? 'bg-primary/10 text-primary'
                        : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {label}
                  </button>
                )
              })}
            </div>
          </div>
        ) : (
          <div className="border-b border-border px-2 py-2">
            <div className="flex flex-col items-center gap-2">
              {PERSONAL_ITEMS.map(({ id, icon: Icon }) => {
                const isActive = activeNav === id

                return (
                  <Button
                    key={id}
                    variant={isActive ? 'secondary' : 'ghost'}
                    size="icon"
                    className="h-9 w-9 rounded-xl"
                    onClick={() => onNavItem?.(id)}
                  >
                    <Icon className="h-4 w-4" />
                  </Button>
                )
              })}
            </div>
          </div>
        )}

        <div className="border-b border-border px-3 py-3">
          {!collapsed ? (
            <>
              <p className="mb-2 px-1.5 text-[10px] font-semibold uppercase tracking-[0.09em] text-muted-foreground">
                Browse
              </p>
              <Tabs value={mode} onValueChange={(value) => onModeChange(value as WorkspaceMode)}>
                <TabsList className="h-9 w-full rounded-xl bg-muted p-1">
                  <TabsTrigger value="direct" className="flex-1 rounded-lg text-[11px] font-semibold">
                    Direct
                  </TabsTrigger>
                  <TabsTrigger value="channels" className="flex-1 rounded-lg text-[11px] font-semibold">
                    Channels
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </>
          ) : (
            <div className="flex flex-col items-center gap-2">
              <Button
                variant={mode === 'direct' ? 'secondary' : 'ghost'}
                size="icon"
                className="h-9 w-9 rounded-xl"
                onClick={() => onModeChange('direct')}
              >
                <MessagesSquare className="h-4 w-4" />
              </Button>
              <Button
                variant={mode === 'channels' ? 'secondary' : 'ghost'}
                size="icon"
                className="h-9 w-9 rounded-xl"
                onClick={() => onModeChange('channels')}
              >
                <Hash className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>

        {mode === 'direct' && !collapsed ? (
          <>
            <div className="flex-1 overflow-y-auto px-2.5 py-2">
              {visibleDirectChats.length > 0 ? (
                visibleDirectChats.map((chat, index) => (
                  <motion.button
                    key={chat.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.02 }}
                    onClick={() => onSelectChat(chat.id)}
                    onContextMenu={(event) => handleContextMenu(event, chat)}
                    className={cn(
                      'mb-1 flex w-full items-start gap-2.5 rounded-xl px-2.5 py-2 text-left transition-colors',
                      activeChat === chat.id ? 'bg-primary/10' : 'hover:bg-accent',
                    )}
                  >
                    <div className="relative flex h-8 w-8 flex-shrink-0 items-center justify-center overflow-hidden rounded-xl bg-muted text-[12px] font-semibold text-foreground">
                      {chat.avatar ? (
                        <img src={chat.avatar} alt={chat.name} className="block h-full w-full object-cover object-center" />
                      ) : (
                        chat.name[0]?.toUpperCase() ?? '?'
                      )}
                      {chat.isOnline ? (
                        <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-sidebar bg-emerald-500" />
                      ) : null}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-[12px] font-medium text-foreground">
                          {chat.name}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {chat.timestamp
                            ? new Date(chat.timestamp).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })
                            : ''}
                        </span>
                      </div>
                      <div className="mt-0.5 flex items-center justify-between gap-2">
                        <span className="truncate text-[11px] text-muted-foreground">
                          {chat.lastMessage || 'No messages yet'}
                        </span>
                        {(unreadCounts[chat.id] ?? 0) > 0 ? (
                          <span className="rounded-full bg-primary px-1.5 py-0.5 text-[9px] font-bold text-primary-foreground">
                            {unreadCounts[chat.id]}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </motion.button>
                ))
              ) : (
                <div className="flex h-40 flex-col items-center justify-center text-center text-muted-foreground">
                  <MessageSquare className="mb-3 h-8 w-8 opacity-35" />
                  <p className="text-[12px]">
                    {isSearching ? 'No feed direct messages found' : 'Open a user from a channel feed'}
                  </p>
                </div>
              )}
            </div>
          </>
        ) : mode === 'channels' && !collapsed ? (
          <div className="flex-1 overflow-y-auto px-2.5 py-3">
            <div className="mb-2 flex items-center justify-between px-1.5">
              <p className="text-[10px] font-semibold uppercase tracking-[0.09em] text-muted-foreground">
                Channels
              </p>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-xl"
                  onClick={() => setShowDiscover(true)}
                  title="Discover channels"
                >
                  <Compass className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-xl"
                  onClick={() => setShowCreateChannel(true)}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="space-y-0.5">
              {channels.map((channel) => {
                const isActive = activeChannelId === channel.id
                const storedAvatar = channelAssets[channel.id]?.avatar ?? channel.avatarUrl ?? null

                return (
                  <button
                    key={channel.id}
                    onClick={() => onSelectChannel?.(channel.id)}
                    className={cn(
                      'flex w-full items-center gap-2 rounded-xl px-2 py-1.5 text-left transition-colors',
                      isActive
                        ? 'bg-primary/10 text-foreground'
                        : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                    )}
                  >
                    <div
                      className={cn(
                        'flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-lg bg-gradient-to-br text-[9px] font-bold text-white shadow-sm overflow-hidden',
                        getChannelTone(channel.id),
                        isActive && 'ring-2 ring-primary/20 ring-offset-1 ring-offset-sidebar',
                      )}
                    >
                      {storedAvatar ? (
                        <img src={storedAvatar} alt={channel.label} className="block h-full w-full object-cover object-center" />
                      ) : getChannelMonogram(channel.label)}
                    </div>
                    <span className="truncate text-[11px] font-medium text-foreground">
                      {channel.label}
                    </span>
                    {channel.access_type === 'PRIVATE' ? (
                      <Lock className="ml-auto h-3 w-3 flex-shrink-0 text-muted-foreground/60" />
                    ) : (
                      <Globe className="ml-auto h-3 w-3 flex-shrink-0 text-muted-foreground/40" />
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        ) : collapsed && mode === 'direct' ? (
          <div className="flex-1 overflow-y-auto px-2 py-2">
            <div className="flex flex-col items-center gap-2">
              {directChats.slice(0, 8).map((chat) => (
                <button
                  key={chat.id}
                  onClick={() => onSelectChat(chat.id)}
                  onContextMenu={(event) => handleContextMenu(event, chat)}
                  className={cn(
                    'relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl text-[12px] font-semibold transition-colors',
                    activeChat === chat.id
                      ? 'bg-primary/10 text-primary'
                      : 'bg-muted text-foreground hover:bg-accent',
                  )}
                >
                  {chat.avatar ? (
                    <img src={chat.avatar} alt={chat.name} className="block h-full w-full object-cover object-center" />
                  ) : (
                    chat.name[0]?.toUpperCase() ?? '?'
                  )}
                  {(unreadCounts[chat.id] ?? 0) > 0 ? (
                    <span className="absolute -right-1 -top-1 rounded-full bg-primary px-1 py-0.5 text-[9px] font-bold text-primary-foreground">
                      {Math.min(unreadCounts[chat.id], 9)}
                    </span>
                  ) : null}
                </button>
              ))}
            </div>
          </div>
        ) : collapsed && mode === 'channels' ? (
          <div className="flex-1 overflow-y-auto px-2 py-2">
            <div className="flex flex-col items-center gap-2">
              {channels.map((channel) => {
                const isActive = activeChannelId === channel.id
                const storedAvatar = channelAssets[channel.id]?.avatar ?? channel.avatarUrl ?? null

                return (
                  <button
                    key={channel.id}
                    onClick={() => onSelectChannel?.(channel.id)}
                    className={cn(
                      'flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br text-[10px] font-bold text-white shadow-sm transition-transform hover:scale-[1.02] overflow-hidden',
                      getChannelTone(channel.id),
                      isActive && 'ring-2 ring-primary/30 ring-offset-2 ring-offset-sidebar',
                    )}
                    title={channel.label}
                  >
                    {storedAvatar ? (
                      <img src={storedAvatar} alt={channel.label} className="block h-full w-full object-cover object-center" />
                    ) : getChannelMonogram(channel.label)}
                  </button>
                )
              })}

              <Button
                variant="ghost"
                size="icon"
                className="h-10 w-10 rounded-xl text-muted-foreground hover:bg-accent hover:text-foreground"
                onClick={() => setShowCreateChannel(true)}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex-1" />
        )}

        <div className="mt-auto" />
      </div>

      <AnimatePresence>
        {contextMenu ? (
          <ConversationContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            chatId={contextMenu.chat.id}
            isPinned={chatMeta[contextMenu.chat.id]?.isPinned}
            isMuted={chatMeta[contextMenu.chat.id]?.isMuted}
            isFavorite={chatMeta[contextMenu.chat.id]?.isFavorite}
            isGroup={false}
            onClose={() => setContextMenu(null)}
            onFavorite={() =>
              updateMeta(contextMenu.chat.id, {
                isFavorite: !chatMeta[contextMenu.chat.id]?.isFavorite,
              })
            }
            onArchive={() => {}}
            onMute={() =>
              updateMeta(contextMenu.chat.id, {
                isMuted: !chatMeta[contextMenu.chat.id]?.isMuted,
              })
            }
            onPin={() =>
              updateMeta(contextMenu.chat.id, {
                isPinned: !chatMeta[contextMenu.chat.id]?.isPinned,
              })
            }
            onBlock={() => setDeleted((prev) => new Set([...prev, contextMenu.chat.id]))}
            onDelete={() => setDeleted((prev) => new Set([...prev, contextMenu.chat.id]))}
          />
        ) : null}
      </AnimatePresence>

      <CreateEntityDialog
        open={showCreateChannel}
        onOpenChange={setShowCreateChannel}
        entityKind="channel"
        title="Create channel"
        description="Add a top-level channel with its own general group, feed, notes, tasks, and goals."
        nameLabel="Channel name"
        namePlaceholder="Creator Hub"
        descriptionLabel="What is this channel for?"
        descriptionPlaceholder="High-level updates, focused collaboration, and the groups that belong to this channel."
        submitLabel="Create channel"
        onSubmit={onCreateChannel ?? (() => {})}
      />

      <Sheet open={showDiscover} onOpenChange={setShowDiscover}>
        <SheetContent side="left" className="w-[380px] overflow-hidden p-0 sm:max-w-[380px]">
          <SheetHeader className="border-b border-border px-4 py-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <SheetTitle className="flex items-center gap-2 text-[14px]">
                  <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Compass className="h-4 w-4" />
                  </span>
                  Discover Channels
                </SheetTitle>
                <p className="mt-1 pl-10 text-[11px] text-muted-foreground">
                  Find public spaces to join and follow.
                </p>
              </div>
              <div className="rounded-full border border-border px-2 py-1 text-[10px] font-semibold text-muted-foreground">
                {discoverableChannels.length} open
              </div>
            </div>
          </SheetHeader>

          <div className="border-b border-border px-4 py-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                value={discoverQuery}
                onChange={(event) => setDiscoverQuery(event.target.value)}
                placeholder="Search channels"
                className="h-10 w-full rounded-xl border border-border bg-background pl-9 pr-9 text-[13px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
              />
              {discoverSearchActive ? (
                <button
                  type="button"
                  onClick={() => setDiscoverQuery('')}
                  className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground"
                  aria-label="Clear channel search"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </div>

            <div className="mt-3 flex gap-1.5 overflow-x-auto pb-0.5">
              {DISCOVER_FILTERS.map(({ id, icon: Icon, label }) => {
                const isActive = discoverFilter === id

                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setDiscoverFilter(id)}
                    className={cn(
                      'flex h-8 flex-shrink-0 items-center gap-1.5 rounded-xl border px-2.5 text-[11px] font-semibold transition-colors',
                      isActive
                        ? 'border-primary/30 bg-primary/10 text-primary'
                        : 'border-border bg-background text-muted-foreground hover:bg-accent hover:text-foreground',
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {label}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="flex h-[calc(100vh-169px)] flex-col gap-2 overflow-y-auto p-3">
            {discoverLoading ? (
              Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="rounded-2xl border border-border p-3">
                  <div className="flex items-start gap-3">
                    <div className="h-11 w-11 animate-pulse rounded-xl bg-muted" />
                    <div className="min-w-0 flex-1 space-y-2 pt-1">
                      <div className="h-3 w-28 animate-pulse rounded-full bg-muted" />
                      <div className="h-2.5 w-full animate-pulse rounded-full bg-muted" />
                      <div className="h-2.5 w-2/3 animate-pulse rounded-full bg-muted" />
                    </div>
                  </div>
                </div>
              ))
            ) : discoverableChannels.length === 0 ? (
              <div className="flex flex-col items-center py-12 text-center">
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-muted">
                  <Globe className="h-5 w-5 text-muted-foreground" />
                </div>
                <p className="text-[13px] font-semibold text-foreground">No public channels</p>
                <p className="mt-1 text-[11px] text-muted-foreground">You&apos;ve joined all available channels.</p>
              </div>
            ) : filteredDiscoverChannels.length === 0 ? (
              <div className="flex flex-col items-center py-12 text-center">
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-muted">
                  <Search className="h-5 w-5 text-muted-foreground" />
                </div>
                <p className="text-[13px] font-semibold text-foreground">No matches found</p>
                <p className="mt-1 max-w-[240px] text-[11px] text-muted-foreground">
                  Try a different search or switch filters to see more public channels.
                </p>
              </div>
            ) : (
              filteredDiscoverChannels.map((ch, index) => (
                <div
                  key={ch.id}
                  className="group rounded-2xl border border-border bg-background p-3 transition-colors hover:bg-accent/60"
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={cn(
                        'flex h-11 w-11 flex-shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br text-[11px] font-bold text-white shadow-sm',
                        getChannelTone(ch.id),
                      )}
                    >
                      {ch.avatar_url ? (
                        <img src={ch.avatar_url} alt={ch.name} className="block h-full w-full object-cover object-center" />
                      ) : (
                        getChannelMonogram(ch.name)
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-[13px] font-semibold text-foreground">{ch.name}</p>
                          <div className="mt-1 flex flex-wrap items-center gap-1.5">
                            <span className="inline-flex items-center gap-1 rounded-lg bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                              <Globe className="h-3 w-3" />
                              Public
                            </span>
                            {index < 3 ? (
                              <span className="inline-flex items-center gap-1 rounded-lg bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                                <Sparkles className="h-3 w-3" />
                                Pick
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </div>

                      <p className="mt-2 line-clamp-2 text-[11px] leading-4 text-muted-foreground">
                        {ch.description || 'A public channel ready for new conversations, updates, and shared posts.'}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={async () => {
                      try {
                        await joinChannel.mutateAsync(ch.id)
                        if (onSelectChannel) onSelectChannel(ch.id)
                        setShowDiscover(false)
                      } catch {}
                    }}
                    disabled={joinChannel.isPending}
                    className="mt-3 flex h-9 w-full items-center justify-center gap-1.5 rounded-xl bg-primary px-3 text-[12px] font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
                  >
                    Join
                    <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                  </button>
                </div>
              ))
            )}
          </div>
        </SheetContent>
      </Sheet>

    </>
  )
}
