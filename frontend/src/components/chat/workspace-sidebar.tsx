'use client'

import { useCallback, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ChevronLeft,
  ChevronRight,
  ContactRound,
  Hash,
  ListTodo,
  MessageSquare,
  MessagesSquare,
  NotebookPen,
  Plus,
  Search,
  Target,
} from 'lucide-react'

import { CreateEntityDialog } from '@/components/chat/create-entity-dialog'
import { type WorkspaceChannel } from '@/components/chat/channels-panel'
import { ConversationContextMenu } from '@/components/chat/conversation-context-menu'
import { EditContactModal } from '@/components/chat/edit-contact-modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  type Conversation,
  getConvDisplayName,
  getConversationAvatar,
  useConversations,
  useCreateConversation,
} from '@/hooks/use-messaging'
import { useContacts, useProfile } from '@/hooks/use-user'
import { useOnlineUsers } from '@/hooks/use-socket'
import { Chat } from '@/lib/mock-data'
import { getMockUserAvatar } from '@/lib/mock-users'
import { cn } from '@/lib/utils'

interface WorkspaceSidebarProps {
  activeChannelId?: string | null
  activeChat: string
  activeNav?: WorkspaceNavTarget | null
  channelAssets?: Record<string, { avatar: string | null }>
  channels?: WorkspaceChannel[]
  collapsed?: boolean
  mode: WorkspaceMode
  onCreateChannel?: (values: { description: string; name: string }) => void
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

type ReactionPreviewMessage =
  | (NonNullable<Conversation['last_message']> & {
      _reactionPreview?: {
        emoji?: string
        messageSenderId: string
        messageType: string
        reactorId: string
      }
    })
  | null

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

function resolveConversationAvatar(name: string, avatar?: string | null) {
  if (avatar && avatar.trim().length > 0) return avatar
  return getMockUserAvatar(name)
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
  const [editContact, setEditContact] = useState<{ id: string; nickname: string } | null>(null)

  const { data: profile } = useProfile()
  const { data: contacts = [] } = useContacts()
  const { data: conversations = [], isLoading: convsLoading } = useConversations()
  const createConversation = useCreateConversation()
  const onlineUsers = useOnlineUsers()

  const isSearching = searchQuery.trim().length > 0

  const filteredContacts = useMemo(() => {
    if (!isSearching) return []
    const query = searchQuery.toLowerCase()
    return contacts.filter((contact) =>
      (contact.nickname ?? contact.username ?? '').toLowerCase().includes(query) ||
      (contact.phone_number ?? '').includes(query),
    )
  }, [contacts, isSearching, searchQuery])

  async function handleContactClick(contactId: string) {
    const existing = conversations.find(
      (conversation) =>
        !conversation.is_group &&
        conversation.participants.some((participant) => participant.user.id === contactId),
    )

    if (existing) {
      onSelectChat(existing.id)
      onSearchChange('')
      return
    }

    createConversation.mutate(
      { participantIds: [contactId] },
      {
        onSuccess: (conversation) => {
          onSelectChat(conversation.id)
          onSearchChange('')
        },
      },
    )
  }

  const formatLastMessage = useCallback((
    message: ReactionPreviewMessage,
    myId: string,
    participants?: { user: { id: string; username: string } }[],
  ): string => {
    if (!message) return ''

    if (message._reactionPreview) {
      const { emoji, reactorId, messageType, messageSenderId } = message._reactionPreview
      if (!emoji) return ''

      const reactorIsMe = reactorId === myId
      const messageIsMine = messageSenderId === myId
      const reactorUsername = participants?.find(
        (participant) => participant.user.id === reactorId,
      )?.user.username
      const who = reactorIsMe ? 'You' : (reactorUsername ?? 'Someone')
      const target = messageIsMine ? 'your' : 'their'
      const contentLabel =
        messageType === 'image'
          ? `${target} photo`
          : messageType === 'voice'
            ? `${target} voice note`
            : messageType === 'file'
              ? `${target} file`
              : 'a message'

      return `${who} reacted ${emoji} to ${contentLabel}`
    }

    const isOwn = message.sender?.id === myId
    const prefix = isOwn ? 'You: ' : ''

    if (message.type === 'image') return `${prefix}Photo`
    if (message.type === 'file') return `${prefix}File`
    if (message.type === 'voice') return `${prefix}Voice note`

    return `${prefix}${message.content ?? ''}`
  }, [])

  const directChats = useMemo<SidebarChat[]>(() => {
    const backendChats = conversations
      .filter((conversation) => !conversation.is_group && !deleted.has(conversation.id))
      .map((conversation) => {
        const participant = conversation.participants.find(
          (item) => item.user.id !== (profile?.id ?? ''),
        )?.user

        return {
          id: conversation.id,
          name: getConvDisplayName(conversation, profile?.id ?? '', contacts),
          avatar: resolveConversationAvatar(
            getConvDisplayName(conversation, profile?.id ?? '', contacts),
            getConversationAvatar(conversation, profile?.id ?? '', contacts),
          ),
          lastMessage: formatLastMessage(
            conversation.last_message,
            profile?.id ?? '',
            conversation.participants,
          ),
          timestamp: conversation.last_message_at ?? conversation.created_at,
          unread: unreadCounts[conversation.id] ?? 0,
          isGroup: false,
          isPinned: chatMeta[conversation.id]?.isPinned ?? false,
          isMuted: chatMeta[conversation.id]?.isMuted ?? false,
          isOnline: participant ? onlineUsers.has(participant.id) : false,
        } satisfies SidebarChat
      })

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

    return [...backendChats, ...localChats]
      .filter((chat, index, items) => items.findIndex((candidate) => candidate.id === chat.id) === index)
      .sort((a, b) => {
        if (b.isPinned !== a.isPinned) return (b.isPinned ? 1 : 0) - (a.isPinned ? 1 : 0)
        return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      })
  }, [
    chatMeta,
    contacts,
    conversations,
    deleted,
    formatLastMessage,
    onlineUsers,
    profile,
    syntheticDirectChats,
    unreadCounts,
  ])

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
            <Button
              variant="ghost"
              size="icon"
              className="mt-2 h-8 w-8 rounded-xl text-muted-foreground hover:bg-accent hover:text-foreground"
              onClick={onToggleCollapse}
              title="Search"
            >
              <Search className="h-4 w-4" />
            </Button>
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
            <div className="border-b border-border px-3 py-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search direct messages"
                  value={searchQuery}
                  onChange={(event) => onSearchChange(event.target.value)}
                  className="h-9 rounded-xl border-border bg-background pl-8 text-[12px]"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-2.5 py-2">
              {isSearching ? (
                filteredContacts.length > 0 ? (
                  <>
                    <p className="px-2 pb-2 pt-1 text-[10px] font-semibold uppercase tracking-[0.09em] text-muted-foreground">
                      Contacts
                    </p>
                    {filteredContacts.map((contact) => (
                      <button
                        key={contact.id}
                        onClick={() => handleContactClick(contact.id)}
                        disabled={createConversation.isPending}
                        className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-accent"
                      >
                        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-[12px] font-semibold text-primary">
                          {(contact.nickname ?? contact.username ?? '?')[0].toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[12px] font-medium text-foreground">
                            {contact.nickname ?? contact.username}
                          </p>
                          <p className="truncate text-[11px] text-muted-foreground">
                            {contact.phone_number}
                          </p>
                        </div>
                      </button>
                    ))}
                  </>
                ) : (
                  <div className="flex h-32 flex-col items-center justify-center text-center text-muted-foreground">
                    <ContactRound className="mb-2 h-7 w-7 opacity-40" />
                    <p className="text-[12px]">No matching contacts</p>
                  </div>
                )
              ) : convsLoading ? (
                <div className="space-y-1.5">
                  {[...Array(6)].map((_, index) => (
                    <div key={index} className="flex items-center gap-2.5 rounded-xl px-2.5 py-2">
                      <div className="h-8 w-8 animate-pulse rounded-xl bg-muted" />
                      <div className="flex-1 space-y-1.5">
                        <div className="h-2.5 w-1/2 animate-pulse rounded bg-muted" />
                        <div className="h-2 w-2/3 animate-pulse rounded bg-muted" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : directChats.length > 0 ? (
                directChats.map((chat, index) => (
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
                  <p className="text-[12px]">No direct messages yet</p>
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

            <div className="space-y-1.5">
              {channels.map((channel) => {
                const isActive = activeChannelId === channel.id
                const storedAvatar = channelAssets[channel.id]?.avatar ?? null

                return (
                  <button
                    key={channel.id}
                    onClick={() => onSelectChannel?.(channel.id)}
                    className={cn(
                      'flex w-full items-center gap-2.5 rounded-2xl px-2.5 py-2 text-left transition-colors',
                      isActive
                        ? 'bg-primary/10 text-foreground'
                        : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                    )}
                  >
                    <div
                      className={cn(
                        'flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-[10px] font-bold text-white shadow-sm overflow-hidden',
                        getChannelTone(channel.id),
                        isActive && 'ring-2 ring-primary/20 ring-offset-2 ring-offset-sidebar',
                      )}
                    >
                      {storedAvatar ? (
                        <img src={storedAvatar} alt={channel.label} className="block h-full w-full object-cover object-center" />
                      ) : getChannelMonogram(channel.label)}
                    </div>
                    <span className="truncate text-[12px] font-medium text-foreground">
                      {channel.label}
                    </span>
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
                const storedAvatar = channelAssets[channel.id]?.avatar ?? null

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
            onEditContact={() => {
              if (contextMenu.chat.isSynthetic) {
                setContextMenu(null)
                return
              }
              setEditContact({ id: contextMenu.chat.id, nickname: contextMenu.chat.name })
              setContextMenu(null)
            }}
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

      {editContact ? (
        <EditContactModal
          contactId={editContact.id}
          currentNickname={editContact.nickname}
          onClose={() => setEditContact(null)}
        />
      ) : null}
    </>
  )
}
