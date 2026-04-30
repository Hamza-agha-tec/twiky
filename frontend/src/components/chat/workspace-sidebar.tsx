'use client'

import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ChevronLeft,
  ChevronRight,
  Globe,
  Hash,
  ListTodo,
  Lock,
  MessageSquare,
  MessagesSquare,
  NotebookPen,
  Plus,
  Search,
  Target,
} from 'lucide-react'

import { CreateEntityDialog, type CreateEntityValues } from '@/components/chat/create-entity-dialog'
import { type WorkspaceChannel } from '@/components/chat/channels-panel'
import { ConversationContextMenu } from '@/components/chat/conversation-context-menu'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
  onNewDirectMessage?: () => void
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

function formatUnreadCount(count: number) {
  if (count > 99) return '99+'
  return String(count)
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
  onNewDirectMessage,
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
          'z-10 flex h-full shrink-0 flex-col border-r border-border bg-sidebar transition-[width] duration-300',
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
              <div className="mb-2 flex items-center justify-between px-1.5">
                <p className="text-[10px] font-semibold uppercase tracking-[0.09em] text-muted-foreground">
                  Conversations
                </p>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-xl"
                  onClick={onNewDirectMessage}
                  disabled={!onNewDirectMessage}
                  title="New message"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              {visibleDirectChats.length > 0 ? (
                visibleDirectChats.map((chat, index) => {
                  const unread = unreadCounts[chat.id] ?? chat.unread ?? 0
                  const hasUnread = unread > 0

                  return (
                    <motion.button
                      key={chat.id}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.02 }}
                      onClick={() => onSelectChat(chat.id)}
                      onContextMenu={(event) => handleContextMenu(event, chat)}
                      className={cn(
                        'mb-1 flex w-full items-start gap-2.5 rounded-xl px-2.5 py-2 text-left transition-colors',
                        activeChat === chat.id
                          ? 'bg-primary/10'
                          : hasUnread
                            ? 'bg-accent/50 hover:bg-accent/75'
                            : 'hover:bg-accent',
                      )}
                    >
                      <div className="relative h-9 w-9 shrink-0">
                        <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-2xl bg-muted text-[12px] font-semibold text-foreground">
                          {chat.avatar ? (
                            <img src={chat.avatar} alt={chat.name} className="block h-full w-full object-cover object-center" />
                          ) : (
                            chat.name[0]?.toUpperCase() ?? '?'
                          )}
                        </div>
                        {chat.isOnline ? (
                          <span className="absolute -bottom-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-sidebar">
                            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 shadow-[0_0_0_2px_rgba(16,185,129,0.12),0_0_9px_rgba(16,185,129,0.55)] ring-1 ring-emerald-300/70" />
                          </span>
                        ) : null}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="flex min-w-0 items-center gap-1.5">
                            <span className={cn(
                              'truncate text-[12px] text-foreground',
                              hasUnread ? 'font-bold' : 'font-medium',
                            )}>
                              {chat.name}
                            </span>
                            {null}
                          </span>
                          <span className={cn(
                            'text-[10px]',
                            hasUnread ? 'font-semibold text-primary' : 'text-muted-foreground',
                          )}>
                            {chat.timestamp
                              ? new Date(chat.timestamp).toLocaleTimeString([], {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })
                              : ''}
                          </span>
                        </div>
                        <div className="mt-0.5 flex items-center justify-between gap-2">
                          <span className={cn(
                            'truncate text-[11px]',
                            hasUnread ? 'font-semibold text-foreground' : 'text-muted-foreground',
                          )}>
                            {chat.lastMessage || 'No messages yet'}
                          </span>
                          {hasUnread ? (
                            <span className="min-w-5 rounded-full bg-primary px-1.5 py-0.5 text-center text-[10px] font-bold leading-none text-primary-foreground shadow-sm">
                              {formatUnreadCount(unread)}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </motion.button>
                  )
                })
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
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-xl"
                onClick={() => setShowCreateChannel(true)}
              >
                <Plus className="h-4 w-4" />
              </Button>
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
                        'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-linear-to-br text-[10px] font-bold text-white shadow-sm overflow-hidden',
                        getChannelTone(channel.id),
                        isActive && 'ring-2 ring-primary/20 ring-offset-1 ring-offset-sidebar',
                      )}
                    >
                      {storedAvatar ? (
                        <img src={storedAvatar} alt={channel.label} className="block h-full w-full object-cover object-center" />
                      ) : getChannelMonogram(channel.label)}
                    </div>
                    <span className="truncate text-[12px] font-medium text-foreground">
                      {channel.label}
                    </span>
                    {channel.access_type === 'PRIVATE' ? (
                      <Lock className="ml-auto h-3 w-3 shrink-0 text-muted-foreground/60" />
                    ) : (
                      <Globe className="ml-auto h-3 w-3 shrink-0 text-muted-foreground/40" />
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        ) : collapsed && mode === 'direct' ? (
          <div className="flex-1 overflow-y-auto px-2 py-2">
            <div className="flex flex-col items-center gap-2">
              {directChats.slice(0, 8).map((chat) => {
                const unread = unreadCounts[chat.id] ?? chat.unread ?? 0
                const hasUnread = unread > 0

                return (
                  <button
                    key={chat.id}
                    onClick={() => onSelectChat(chat.id)}
                    onContextMenu={(event) => handleContextMenu(event, chat)}
                    className={cn(
                      'relative flex h-10 w-10 items-center justify-center rounded-xl text-[12px] font-semibold transition-colors',
                      activeChat === chat.id
                        ? 'bg-primary/10 text-primary'
                        : hasUnread
                          ? 'bg-accent text-foreground'
                          : 'bg-muted text-foreground hover:bg-accent',
                    )}
                    title={chat.name}
                  >
                    <span className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl">
                      {chat.avatar ? (
                        <img src={chat.avatar} alt={chat.name} className="block h-full w-full object-cover object-center" />
                      ) : (
                        chat.name[0]?.toUpperCase() ?? '?'
                      )}
                    </span>
                    {chat.isOnline ? (
                      <span className="absolute -bottom-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-sidebar">
                        <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 shadow-[0_0_0_2px_rgba(16,185,129,0.12),0_0_9px_rgba(16,185,129,0.55)] ring-1 ring-emerald-300/70" />
                      </span>
                    ) : null}
                    {hasUnread ? (
                      <span className="absolute -right-1.5 -top-1.5 min-w-4 rounded-full bg-primary px-1 py-0.5 text-center text-[9px] font-bold leading-none text-primary-foreground shadow-sm">
                        {unread > 9 ? '9+' : unread}
                      </span>
                    ) : null}
                  </button>
                )
              })}
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
                      'flex h-8 w-8 items-center justify-center rounded-lg bg-linear-to-br text-[10px] font-bold text-white shadow-sm transition-transform hover:scale-[1.02] overflow-hidden',
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

    </>
  )
}
