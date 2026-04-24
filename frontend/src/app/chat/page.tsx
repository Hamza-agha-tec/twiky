'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowRight, AtSign, Bell, BellRing, BookUser, CalendarDays, Check, Compass, Globe, Heart, ListTodo, Lock, MessageSquare, Search, Sparkles, Store, Target, UserPlus, Users, X } from 'lucide-react'

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
  type MockChannelGroup,
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
import type { CreateEntityValues } from '@/components/chat/create-entity-dialog'
import { useChannels, useCreateChannel, useDiscoverChannels, useJoinChannel, useRequestJoinChannel, useUpdateChannel } from '@/hooks/use-channels'
import { useChannelGroups, useCreateGroup, useGroupMembers, useGroupMessages, backendGroupToMock } from '@/hooks/use-groups'
import { groupsApi, type GroupMessage } from '@/lib/groups-api'
import { useQueryClient } from '@tanstack/react-query'
import { GROUP_KEYS } from '@/hooks/use-groups'
import type { FeedPost } from '@/components/chat/channel-feed'
import { type ChatMessage } from '@/hooks/use-messaging'
import { useProfile, useSearchUsers, useSendFollowRequest, useUserFollowing } from '@/hooks/use-user'
import { useNotifications, useMarkAllAsRead, useMarkAsRead } from '@/hooks/use-notifications'
import { usePendingInvitations, useRespondToInvitation } from '@/hooks/use-invitations'
import type { Invitation } from '@/lib/invitations-api'
import type { BackendChannel } from '@/lib/channel-api'
import { filesApi } from '@/lib/files-api'
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

const STORE_ITEMS = [
  { id: 'themes', label: 'Themes', description: 'Custom color schemes and visual styles', count: 24, tag: 'Popular', gradient: 'from-violet-500 via-purple-500 to-fuchsia-600' },
  { id: 'stickers', label: 'Sticker Packs', description: 'Expressive sticker sets for reactions', count: 48, tag: 'New', gradient: 'from-orange-500 via-amber-500 to-yellow-500' },
  { id: 'sounds', label: 'Sound Packs', description: 'Custom notification and UI sounds', count: 12, tag: null, gradient: 'from-emerald-500 via-teal-500 to-cyan-600' },
  { id: 'frames', label: 'Profile Frames', description: 'Animated borders for your avatar', count: 36, tag: 'Hot', gradient: 'from-pink-500 via-rose-500 to-red-500' },
  { id: 'rooms', label: 'Room Templates', description: 'Backgrounds and layouts for your profile room', count: 18, tag: 'Coming soon', gradient: 'from-cyan-500 via-sky-500 to-blue-600' },
  { id: 'badges', label: 'Badges', description: 'Collectible profile badges to show off', count: 60, tag: 'Exclusive', gradient: 'from-amber-500 via-orange-500 to-rose-500' },
] as const

function AddFriendsView() {
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [sent, setSent] = useState<Set<string>>(new Set())

  // debounce
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 400)
    return () => clearTimeout(t)
  }, [query])

  const { data: results = [], isFetching, isError } = useSearchUsers(debouncedQuery)
  const sendFollowRequest = useSendFollowRequest()
  const { data: profile } = useProfile()
  const { data: following = [] } = useUserFollowing(profile?.id)
  const followingIds = new Set(following.map((f) => f.following_id))

  async function handleSend(userId: string) {
    try {
      await sendFollowRequest.mutateAsync(userId)
      setSent((prev) => new Set([...prev, userId]))
    } catch {}
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-background">
      {/* Header */}
      <div className="border-b border-border bg-background px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
            <UserPlus className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h1 className="text-[15px] font-bold text-foreground">Add Friends</h1>
            <p className="text-[11px] text-muted-foreground">Search by username to follow people</p>
          </div>
        </div>
      </div>

      {/* Search bar */}
      <div className="border-b border-border bg-background px-6 py-3">
        <div className="relative mx-auto max-w-xl">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            autoFocus
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by username…"
            className="w-full rounded-xl border border-border bg-muted/50 py-2.5 pl-10 pr-9 text-[13px] text-foreground placeholder:text-muted-foreground focus:border-primary/40 focus:bg-background focus:outline-none focus:ring-1 focus:ring-primary/20"
          />
          {query && (
            <button onClick={() => { setQuery(''); setDebouncedQuery('') }} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      <div className="mx-auto w-full max-w-xl px-6 py-5">
        {debouncedQuery.trim() === '' ? (
          <div className="flex flex-col items-center py-16 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
              <Users className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-[14px] font-semibold text-foreground">Find people on Twiky</p>
            <p className="mt-1 text-[12px] text-muted-foreground">Type a username to get started.</p>
          </div>
        ) : isFetching ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3">
                <div className="h-11 w-11 animate-pulse rounded-xl bg-muted flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-28 animate-pulse rounded-full bg-muted" />
                  <div className="h-2.5 w-20 animate-pulse rounded-full bg-muted" />
                </div>
                <div className="h-8 w-20 animate-pulse rounded-xl bg-muted" />
              </div>
            ))}
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center py-16 text-center">
            <p className="text-[13px] font-medium text-destructive">Search failed. Try again.</p>
          </div>
        ) : results.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
              <Search className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-[14px] font-semibold text-foreground">No users found</p>
            <p className="mt-1 text-[12px] text-muted-foreground">Try a different username.</p>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="mb-3 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
              {results.length} result{results.length !== 1 ? 's' : ''}
            </p>
            {results.map((user) => {
              const isSelf = user.id === profile?.id
              const isAlreadyFriend = followingIds.has(user.id)
              const isSent = sent.has(user.id)
              const initial = (user.fullname ?? user.username ?? '?')[0].toUpperCase()
              return (
                <div
                  key={user.id}
                  className="group flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 transition-all hover:border-primary/20 hover:shadow-sm"
                >
                  {/* Avatar */}
                  <div className="relative flex-shrink-0">
                    {user.avatar_url ? (
                      <img src={user.avatar_url} alt={user.username} className="h-11 w-11 rounded-xl object-cover" />
                    ) : (
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/70 text-[14px] font-bold text-primary-foreground">
                        {initial}
                      </div>
                    )}
                    {isAlreadyFriend && (
                      <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 ring-2 ring-card">
                        <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} />
                      </span>
                    )}
                  </div>

                  {/* Info */}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-semibold text-foreground">{user.fullname ?? user.username}</p>
                    <p className="text-[11px] text-muted-foreground">@{user.username}</p>
                  </div>

                  {/* Action */}
                  {isSelf ? null : isAlreadyFriend ? (
                    <span className="flex items-center gap-1 rounded-xl bg-emerald-500/10 px-3 py-1.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                      <Check className="h-3 w-3" /> Following
                    </span>
                  ) : isSent ? (
                    <span className="flex items-center gap-1 rounded-xl bg-muted px-3 py-1.5 text-[11px] font-semibold text-muted-foreground">
                      <Check className="h-3 w-3" /> Sent
                    </span>
                  ) : (
                    <button
                      onClick={() => handleSend(user.id)}
                      disabled={sendFollowRequest.isPending}
                      className="flex items-center gap-1.5 rounded-xl bg-primary px-3 py-1.5 text-[11px] font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
                    >
                      <UserPlus className="h-3 w-3" /> Follow
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function notifIcon(type: string) {
  switch (type) {
    case 'FOLLOW': return { icon: UserPlus, bg: 'bg-blue-500', color: 'text-white' }
    case 'LIKE': return { icon: Heart, bg: 'bg-rose-500', color: 'text-white' }
    case 'MENTION': return { icon: AtSign, bg: 'bg-violet-500', color: 'text-white' }
    case 'INVITATION':
    case 'INVITATION_ACCEPTED': return { icon: Users, bg: 'bg-emerald-500', color: 'text-white' }
    case 'INVITATION_REJECTED': return { icon: X, bg: 'bg-muted', color: 'text-muted-foreground' }
    default: return { icon: BellRing, bg: 'bg-primary', color: 'text-primary-foreground' }
  }
}

function NotificationsView() {
  const { data: notifications = [], isLoading } = useNotifications()
  const { data: invitations = [] } = usePendingInvitations()
  const markAsRead = useMarkAsRead()
  const markAllAsRead = useMarkAllAsRead()
  const respondToInvitation = useRespondToInvitation()

  const nonMentionNotifications = useMemo(
    () => notifications.filter((n) => n.type !== 'MENTION'),
    [notifications],
  )
  const unreadCount = nonMentionNotifications.filter((n) => !n.is_read).length
  const followInvitations = invitations.filter((i) => i.entity_type === 'FOLLOW')
  const groupInvitations = invitations.filter((i) => i.entity_type === 'GROUP')
  const channelInvitations = invitations.filter((i) => i.entity_type === 'CHANNEL')
  const totalInvitations = invitations.length

  function formatTime(iso: string) {
    const d = new Date(iso)
    const diff = Date.now() - d.getTime()
    if (diff < 60000) return 'just now'
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m`
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`
    return d.toLocaleDateString('en', { month: 'short', day: 'numeric' })
  }

  function notificationLabel(type: string) {
    switch (type) {
      case 'FOLLOW': return 'started following you'
      case 'INVITATION': return 'sent you an invitation'
      case 'INVITATION_ACCEPTED': return 'accepted your invitation'
      case 'INVITATION_REJECTED': return 'declined your invitation'
      case 'LIKE': return 'liked your post'
      case 'MENTION': return 'mentioned you'
      default: return type.toLowerCase().replace(/_/g, ' ')
    }
  }

  function requestCopy(invitation: Invitation) {
    switch (invitation.entity_type) {
      case 'GROUP': return 'invited you to a group'
      case 'CHANNEL': return 'invited you to a channel'
      case 'FOLLOW': return 'wants to follow you'
      default: return 'sent you a request'
    }
  }

  function renderInvitationRow(invitation: Invitation) {
    const initial = invitation.inviter.username[0]?.toUpperCase() ?? '?'
    return (
      <div key={invitation.id} className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 transition-colors hover:bg-accent/50">
        <div className="relative flex-shrink-0">
          {invitation.inviter.avatar_url ? (
            <img src={invitation.inviter.avatar_url} alt={invitation.inviter.username} className="h-10 w-10 rounded-xl object-cover" />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted text-[12px] font-bold text-foreground">
              {initial}
            </div>
          )}
          <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary ring-2 ring-card">
            <UserPlus className="h-2.5 w-2.5 text-primary-foreground" />
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold text-foreground">@{invitation.inviter.username}</p>
          <p className="text-[12px] text-muted-foreground">{requestCopy(invitation)}</p>
        </div>
        <div className="flex flex-shrink-0 items-center gap-2">
          <button
            onClick={() => respondToInvitation.mutate({ invitationId: invitation.id, status: 'ACCEPTED' })}
            disabled={respondToInvitation.isPending}
            className="rounded-xl bg-primary px-3 py-1.5 text-[12px] font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            Accept
          </button>
          <button
            onClick={() => respondToInvitation.mutate({ invitationId: invitation.id, status: 'REJECTED' })}
            disabled={respondToInvitation.isPending}
            className="rounded-xl border border-border px-3 py-1.5 text-[12px] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
          >
            Decline
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-background">
      {/* Header */}
      <div className="border-b border-border bg-background px-6 py-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
              <Bell className="h-4 w-4 text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-[15px] font-bold text-foreground">Notifications</h1>
                {unreadCount > 0 && (
                  <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground">
                    {unreadCount}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground">Activity and requests</p>
            </div>
          </div>
          {unreadCount > 0 && (
            <button
              onClick={() => markAllAsRead.mutate()}
              disabled={markAllAsRead.isPending}
              className="flex h-8 items-center gap-1.5 rounded-xl border border-border px-3 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
            >
              <Check className="h-3 w-3" /> Mark all read
            </button>
          )}
        </div>
      </div>

      <div className="mx-auto w-full max-w-2xl px-5 py-5 space-y-6">
        {/* Invitations */}
        {totalInvitations > 0 && (
          <section>
            <div className="mb-3 flex items-center gap-2">
              <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Requests</span>
              <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold text-primary">{totalInvitations}</span>
            </div>
            <div className="space-y-2">
              {[
                { items: followInvitations },
                { items: groupInvitations },
                { items: channelInvitations },
              ].flatMap(({ items }) => items.map(renderInvitationRow))}
            </div>
          </section>
        )}

        {/* Activity */}
        <section>
          <div className="mb-3 flex items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Activity</span>
            {nonMentionNotifications.length > 0 && (
              <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">{nonMentionNotifications.length}</span>
            )}
          </div>

          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 rounded-2xl border border-border px-4 py-3">
                  <div className="h-10 w-10 animate-pulse rounded-xl bg-muted flex-shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 w-40 animate-pulse rounded-full bg-muted" />
                    <div className="h-2.5 w-20 animate-pulse rounded-full bg-muted" />
                  </div>
                </div>
              ))}
            </div>
          ) : nonMentionNotifications.length === 0 ? (
            <div className="flex flex-col items-center rounded-2xl border border-dashed border-border py-14 text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-muted">
                <Bell className="h-5 w-5 text-muted-foreground" />
              </div>
              <p className="text-[14px] font-semibold text-foreground">All caught up</p>
              <p className="mt-1 text-[12px] text-muted-foreground">Activity will appear here.</p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {nonMentionNotifications.map((notification) => {
                const { icon: Icon, bg, color } = notifIcon(notification.type)
                return (
                  <button
                    key={notification.id}
                    onClick={() => { if (!notification.is_read) markAsRead.mutate(notification.id) }}
                    className={`group flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-all hover:shadow-sm ${
                      !notification.is_read
                        ? 'border-primary/20 bg-primary/[0.03] hover:bg-primary/[0.06]'
                        : 'border-border bg-card hover:bg-accent/50'
                    }`}
                  >
                    {/* Avatar + type icon */}
                    <div className="relative flex-shrink-0">
                      {notification.actor.avatar_url ? (
                        <img src={notification.actor.avatar_url} alt={notification.actor.username} className="h-10 w-10 rounded-xl object-cover" />
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted text-[12px] font-bold text-foreground">
                          {notification.actor.username[0]?.toUpperCase() ?? '?'}
                        </div>
                      )}
                      <span className={`absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full ${bg} ring-2 ring-card`}>
                        <Icon className={`h-2.5 w-2.5 ${color}`} />
                      </span>
                    </div>

                    {/* Text */}
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] text-foreground">
                        <span className="font-semibold">@{notification.actor.username}</span>
                        {' '}<span className="text-muted-foreground">{notificationLabel(notification.type)}</span>
                      </p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground/60">{formatTime(notification.created_at)}</p>
                    </div>

                    {/* Unread dot */}
                    {!notification.is_read && (
                      <span className="h-2 w-2 flex-shrink-0 rounded-full bg-primary" />
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

type DiscoverFilter = 'all' | 'joined' | 'new' | 'private'

const DISCOVER_FILTERS: { id: DiscoverFilter; icon: typeof Sparkles; label: string }[] = [
  { id: 'all', icon: Sparkles, label: 'All' },
  { id: 'joined', icon: Check, label: 'Joined' },
  { id: 'new', icon: CalendarDays, label: 'New' },
  { id: 'private', icon: Lock, label: 'Private' },
]

const DISCOVER_CHANNEL_TONES = [
  'from-sky-500 via-cyan-500 to-blue-600',
  'from-emerald-500 via-teal-500 to-cyan-600',
  'from-orange-500 via-amber-500 to-yellow-500',
  'from-fuchsia-500 via-violet-500 to-indigo-600',
]

function getDiscoverChannelTone(seed: string) {
  const index =
    seed.split('').reduce((total, char) => total + char.charCodeAt(0), 0) %
    DISCOVER_CHANNEL_TONES.length
  return DISCOVER_CHANNEL_TONES[index]
}

function getDiscoverChannelMonogram(label: string) {
  const words = label.split(/\s+/).filter(Boolean)
  if (words.length >= 2) return `${words[0][0]}${words[1][0]}`.toUpperCase()
  return label.slice(0, 2).toUpperCase() || 'CH'
}

function ChannelPopupCard({
  ch,
  onClose,
  onSelectChannel,
  joinChannel,
  requestJoin,
}: {
  ch: NonNullable<ReturnType<typeof useDiscoverChannels>['data']>[number]
  onClose: () => void
  onSelectChannel?: (id: string) => void
  joinChannel: ReturnType<typeof useJoinChannel>
  requestJoin: ReturnType<typeof useRequestJoinChannel>
}) {
  const status = ch.membership_status ?? 'none'
  const isPrivate = ch.access_type === 'PRIVATE'
  const tone = getDiscoverChannelTone(ch.id)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-[340px] overflow-hidden rounded-[24px] border border-border bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Banner */}
        <div className={`relative h-[110px] w-full overflow-hidden bg-gradient-to-br ${tone}`}>
          {ch.banner_url && (
            <img src={ch.banner_url} alt="" className="absolute inset-0 h-full w-full object-cover object-center" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
          <button
            onClick={onClose}
            className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full bg-black/30 text-white/80 backdrop-blur-sm transition-colors hover:bg-black/50 hover:text-white"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Avatar */}
        <div className="relative -mt-7 flex px-5">
          <div className={`relative flex h-14 w-14 flex-shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br text-[13px] font-bold text-white shadow-lg ring-4 ring-card ${tone}`}>
            {ch.avatar_url ? (
              <img src={ch.avatar_url} alt={ch.name} className="block h-full w-full object-cover object-center" />
            ) : getDiscoverChannelMonogram(ch.name)}
          </div>
        </div>

        {/* Info */}
        <div className="px-5 pb-5 pt-2">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-[16px] font-bold text-foreground">{ch.name}</p>
              <div className="mt-0.5 flex items-center gap-1.5">
                {isPrivate ? (
                  <span className="inline-flex items-center gap-0.5 text-[11px] font-medium text-amber-600 dark:text-amber-400">
                    <Lock className="h-3 w-3" /> Private
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-0.5 text-[11px] font-medium text-muted-foreground">
                    <Globe className="h-3 w-3" /> Public
                  </span>
                )}
                {ch.member_count !== undefined && (
                  <>
                    <span className="text-muted-foreground/40">·</span>
                    <span className="inline-flex items-center gap-0.5 text-[11px] font-medium text-muted-foreground">
                      <Users className="h-3 w-3" /> {ch.member_count} {ch.member_count === 1 ? 'member' : 'members'}
                    </span>
                  </>
                )}
              </div>
            </div>
            {status === 'member' && (
              <span className="flex-shrink-0 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
                Joined
              </span>
            )}
            {status === 'requested' && (
              <span className="flex-shrink-0 rounded-full bg-blue-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-blue-600 dark:text-blue-400">
                Pending
              </span>
            )}
          </div>

          {ch.description ? (
            <p className="mt-3 text-[12.5px] leading-relaxed text-muted-foreground">{ch.description}</p>
          ) : (
            <p className="mt-3 text-[12.5px] italic text-muted-foreground/50">No description.</p>
          )}

          {/* Actions */}
          <div className="mt-4 flex gap-2">
            {status === 'member' ? (
              <button
                onClick={() => { onSelectChannel?.(ch.id); onClose() }}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-primary py-2 text-[13px] font-semibold text-primary-foreground transition-opacity hover:opacity-90"
              >
                Open channel <ArrowRight className="h-3.5 w-3.5" />
              </button>
            ) : status === 'requested' ? (
              <div className="flex flex-1 items-center justify-center rounded-xl border border-border bg-muted/60 py-2 text-[13px] font-semibold text-muted-foreground">
                Request sent
              </div>
            ) : isPrivate ? (
              <button
                onClick={async () => { try { await requestJoin.mutateAsync(ch.id); onClose() } catch {} }}
                disabled={requestJoin.isPending}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-amber-500/30 bg-amber-500/10 py-2 text-[13px] font-semibold text-amber-600 transition-colors hover:bg-amber-500/20 disabled:opacity-50 dark:text-amber-400"
              >
                <Lock className="h-3.5 w-3.5" /> Request access
              </button>
            ) : (
              <button
                onClick={async () => {
                  try { await joinChannel.mutateAsync(ch.id); onSelectChannel?.(ch.id); onClose() } catch {}
                }}
                disabled={joinChannel.isPending}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-primary py-2 text-[13px] font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                Join <ArrowRight className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function DiscoverChannelsView({ onSelectChannel }: { onSelectChannel?: (id: string) => void }) {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<DiscoverFilter>('all')
  const [popup, setPopup] = useState<string | null>(null)
  const { data: channels = [], isLoading } = useDiscoverChannels()
  const joinChannel = useJoinChannel()
  const requestJoin = useRequestJoinChannel()

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const thirtyDays = 30 * 24 * 60 * 60 * 1000
    const newestCreatedAt = channels.reduce((latest, ch) => {
      const t = new Date(ch.created_at).getTime()
      return Number.isFinite(t) ? Math.max(latest, t) : latest
    }, 0)
    return channels.filter((ch) => {
      const desc = ch.description ?? ''
      const createdAt = new Date(ch.created_at).getTime()
      const isNew =
        Number.isFinite(createdAt) &&
        newestCreatedAt > 0 &&
        newestCreatedAt - createdAt <= thirtyDays
      const matchesQuery =
        q.length === 0 ||
        ch.name.toLowerCase().includes(q) ||
        desc.toLowerCase().includes(q)
      if (!matchesQuery) return false
      if (filter === 'joined') return ch.membership_status === 'member'
      if (filter === 'new') return isNew
      if (filter === 'private') return ch.access_type === 'PRIVATE'
      return true
    })
  }, [channels, filter, query])

  const searchActive = query.trim().length > 0
  const popupChannel = popup ? channels.find((c) => c.id === popup) : null

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-background">
      {/* Header */}
      <div className="border-b border-border bg-background px-5 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Compass className="h-4 w-4 text-primary" />
            <span className="text-[13px] font-bold text-foreground">Browse Channels</span>
            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">{channels.length}</span>
          </div>
          <div className="flex items-center gap-1.5">
            {DISCOVER_FILTERS.map(({ id, icon: Icon, label }) => {
              const isActive = filter === id
              return (
                <button
                  key={id}
                  onClick={() => setFilter(id)}
                  className={`flex h-7 items-center gap-1 rounded-lg border px-2.5 text-[11px] font-semibold transition-colors ${
                    isActive
                      ? 'border-primary/30 bg-primary/10 text-primary'
                      : 'border-border bg-background text-muted-foreground hover:bg-accent hover:text-foreground'
                  }`}
                >
                  <Icon className="h-2.5 w-2.5" />
                  {label}
                </button>
              )
            })}
            <div className="relative ml-1">
              <Search className="absolute left-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search…"
                className="h-7 w-32 rounded-lg border border-border bg-muted/50 pl-7 pr-6 text-[12px] text-foreground placeholder:text-muted-foreground focus:border-primary/40 focus:bg-background focus:outline-none focus:ring-1 focus:ring-primary/20"
              />
              {searchActive && (
                <button onClick={() => setQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="p-4">
        {isLoading ? (
          <div className="grid grid-cols-4 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="overflow-hidden rounded-2xl border border-border bg-card">
                <div className="h-16 animate-pulse bg-muted" />
                <div className="space-y-2 p-3">
                  <div className="h-3 w-24 animate-pulse rounded-full bg-muted" />
                  <div className="h-2 w-32 animate-pulse rounded-full bg-muted" />
                  <div className="mt-3 h-7 w-full animate-pulse rounded-xl bg-muted" />
                </div>
              </div>
            ))}
          </div>
        ) : channels.length === 0 ? (
          <div className="flex flex-col items-center py-14 text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-muted">
              <Globe className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="text-[14px] font-semibold text-foreground">No channels yet</p>
            <p className="mt-1 text-[12px] text-muted-foreground">Create the first channel to get started.</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center py-14 text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-muted">
              <Search className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="text-[14px] font-semibold text-foreground">No matches</p>
            <p className="mt-1 text-[12px] text-muted-foreground">Try a different search or filter.</p>
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-3">
            {filtered.map((ch) => {
              const status = ch.membership_status ?? 'none'
              const isPrivate = ch.access_type === 'PRIVATE'
              const tone = getDiscoverChannelTone(ch.id)
              return (
                <div
                  key={ch.id}
                  className={`group overflow-hidden rounded-2xl border bg-card transition-all hover:shadow-md ${
                    status === 'member' ? 'border-primary/20' : 'border-border hover:border-primary/20'
                  }`}
                >
                  {/* Banner */}
                  <button
                    className={`relative h-16 w-full overflow-hidden bg-gradient-to-br ${tone}`}
                    onClick={() => setPopup(ch.id)}
                  >
                    {ch.banner_url && (
                      <img src={ch.banner_url} alt="" className="absolute inset-0 h-full w-full object-cover object-center" />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
                    {isPrivate && (
                      <span className="absolute right-2 top-2 flex items-center gap-0.5 rounded-full bg-black/40 px-1.5 py-0.5 text-[9px] font-semibold text-white/90 backdrop-blur-sm">
                        <Lock className="h-2.5 w-2.5" /> Private
                      </span>
                    )}
                    {status === 'member' && (
                      <span className="absolute right-2 top-2 flex items-center gap-0.5 rounded-full bg-emerald-500/90 px-1.5 py-0.5 text-[9px] font-semibold text-white">
                        <Check className="h-2.5 w-2.5" strokeWidth={3} /> Joined
                      </span>
                    )}
                  </button>

                  <div className="p-3">
                    {/* Avatar + name */}
                    <div className="flex items-start gap-2">
                      <div
                        className={`relative -mt-6 flex h-10 w-10 flex-shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br text-[10px] font-bold text-white shadow-md ring-2 ring-card ${tone}`}
                        onClick={() => setPopup(ch.id)}
                      >
                        {ch.avatar_url ? (
                          <img src={ch.avatar_url} alt={ch.name} className="block h-full w-full object-cover object-center" />
                        ) : getDiscoverChannelMonogram(ch.name)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <button
                          onClick={() => setPopup(ch.id)}
                          className="block w-full truncate text-left text-[13px] font-semibold text-foreground transition-colors hover:text-primary"
                        >
                          {ch.name}
                        </button>
                        {ch.member_count !== undefined && (
                          <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground/60">
                            <Users className="h-2.5 w-2.5" />{ch.member_count} members
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Description */}
                    {ch.description ? (
                      <p className="mt-2 line-clamp-2 text-[11px] leading-relaxed text-muted-foreground">{ch.description}</p>
                    ) : (
                      <p className="mt-2 text-[11px] italic text-muted-foreground/40">No description</p>
                    )}

                    {/* Action */}
                    <div className="mt-3">
                      {status === 'member' ? (
                        <button
                          onClick={() => onSelectChannel?.(ch.id)}
                          className="flex w-full items-center justify-center gap-1 rounded-xl border border-primary/30 bg-primary/10 py-1.5 text-[11px] font-semibold text-primary transition-colors hover:bg-primary/20"
                        >
                          Open <ArrowRight className="h-3 w-3" />
                        </button>
                      ) : status === 'requested' ? (
                        <div className="flex w-full items-center justify-center rounded-xl border border-border bg-muted/60 py-1.5 text-[11px] font-semibold text-muted-foreground">
                          Request sent
                        </div>
                      ) : isPrivate ? (
                        <button
                          onClick={async () => { try { await requestJoin.mutateAsync(ch.id) } catch {} }}
                          disabled={requestJoin.isPending}
                          className="flex w-full items-center justify-center gap-1 rounded-xl border border-amber-500/30 bg-amber-500/10 py-1.5 text-[11px] font-semibold text-amber-600 transition-colors hover:bg-amber-500/20 disabled:opacity-50 dark:text-amber-400"
                        >
                          <Lock className="h-3 w-3" /> Request
                        </button>
                      ) : (
                        <button
                          onClick={async () => {
                            try { await joinChannel.mutateAsync(ch.id); onSelectChannel?.(ch.id) } catch {}
                          }}
                          disabled={joinChannel.isPending}
                          className="flex w-full items-center justify-center gap-1 rounded-xl bg-primary py-1.5 text-[11px] font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
                        >
                          Join <ArrowRight className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Channel popup */}
      {popupChannel && (
        <ChannelPopupCard
          ch={popupChannel}
          onClose={() => setPopup(null)}
          onSelectChannel={onSelectChannel}
          joinChannel={joinChannel}
          requestJoin={requestJoin}
        />
      )}
    </div>
  )
}

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
  const [searchQuery, setSearchQuery] = useState('')
  const [showDirectProfile, setShowDirectProfile] = useState(false)
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({})
  const [channelAssets, setChannelAssets] = useState<Record<string, { avatar: string | null; banner: string | null }>>(() => {
    return {}
  })

  const queryClient = useQueryClient()
  const { data: profile } = useProfile()
  const { data: allNotifications = [] } = useNotifications()
  const unreadNotificationCount = allNotifications.filter((n) => !n.is_read && n.type !== 'MENTION').length
  const { data: backendChannels = [] } = useChannels()
  const createChannel = useCreateChannel()
  const updateChannel = useUpdateChannel()
  const { data: backendGroups = [] } = useChannelGroups(activeChannelId || undefined)
  const createGroup = useCreateGroup(activeChannelId)
  const isRealGroupId = /^[0-9a-f-]{36}$/i.test(activeGroupId)
  const { data: rawMessages } = useGroupMessages(isRealGroupId ? activeGroupId : undefined)
  const { data: activeGroupMembers = [] } = useGroupMembers(isRealGroupId ? activeGroupId : undefined)

  const groupMessageById = new Map((rawMessages ?? []).map((msg) => [msg.id, msg]))
  const groupMemberRoleByUserId = new Map(
    activeGroupMembers
      .filter((member) => member.user)
      .map((member) => [member.user.id, getChannelRoleLabel(member.role)]),
  )
  const groupReplyCounts = (rawMessages ?? []).reduce((counts, msg) => {
    if (!msg.reply_to_id) return counts
    counts.set(msg.reply_to_id, (counts.get(msg.reply_to_id) ?? 0) + 1)
    return counts
  }, new Map<string, number>())
  const groupPosts: FeedPost[] = (rawMessages ?? []).map((msg: GroupMessage) => {
    const isSystem = !msg.sender_id
    const replySource = msg.reply_to_id ? groupMessageById.get(msg.reply_to_id) : null
    const replyBody = replySource?.content?.trim()
      || (replySource?.file_url ? 'Attachment' : '')

    return {
      id: msg.id,
      author: isSystem ? 'System' : (msg.sender?.fullname ?? msg.sender?.full_name ?? msg.sender?.username ?? 'Unknown'),
      authorId: msg.sender_id,
      authorAvatarUrl: isSystem ? null : (msg.sender?.avatar_url ?? null),
      authorIsVerified: msg.sender?.sub_plan === 'PRO' || msg.sender?.sub_plan === 'GEEK',
      authorIsPro: msg.sender?.sub_plan === 'PRO' || msg.sender?.sub_plan === 'GEEK',
      isSystem,
      role: isSystem ? 'Automation' : (groupMemberRoleByUserId.get(msg.sender_id) ?? 'Member'),
      time: new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      body: msg.content,
      isOwn: msg.sender_id === profile?.id,
      imageUrl: msg.file_url ?? undefined,
      reactions: [],
      replyCount: groupReplyCounts.get(msg.id) ?? 0,
      replyTo: replySource
        ? {
            author: replySource.sender?.username ?? 'Unknown',
            body: replyBody.slice(0, 60) + (replyBody.length > 60 ? '...' : ''),
          }
        : undefined,
    }
  })
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
    if (persisted.activeView) setActiveView(persisted.activeView)
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

  function handleCreateGroup(values: CreateEntityValues) {
    if (!activeChannel) return
    createGroup.mutate(
      { name: values.name, description: values.description || undefined },
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

  const channelContent =
    activeChannel && activeGroup ? (
      <MainArea activeChannel={activeChannel} activeGroup={activeGroup} activeTab={channelTab} onTabChange={setChannelTab}>
        <ChannelFeed
          channel={activeChannel}
          group={activeGroup}
          members={activeGroupMembers}
          myAvatarUrl={userAvatar}
          onOpenDirectConversation={openDirectChat}
          postsOverride={isRealGroupId ? groupPosts : undefined}
          onSendPost={async ({ content, fileUrl, replyToId, entityMentions }) => {
            if (!isRealGroupId) return
            await groupsApi.sendGroupMessage(activeGroup.id, { content, entityMentions, fileUrl, replyToId: replyToId ?? null })
            queryClient.invalidateQueries({ queryKey: GROUP_KEYS.messages(activeGroup.id) })
          }}
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
        notificationCount={unreadNotificationCount}
      />

      {activeView === 'settings' ? (
        <SettingsView
          initialSection={settingsSection}
          onAvatarChange={(url) => setLocalAvatar(url)}
          avatarUrl={userAvatar ?? null}
        />
      ) : activeView === 'discover-channels' ? (
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
            onCreateGroup={handleCreateGroup}
            onSelectGroup={(groupId) => {
              setActiveGroupId(groupId)
              setWorkspaceMode('channels')
              setActiveSurface('channel')
              setActiveView('chat')
              setChannelTab('feed')
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
