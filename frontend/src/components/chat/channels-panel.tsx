'use client'

import { useEffect, useState, type DragEvent } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Calendar,
  Check,
  Copy,
  Globe,
  Hash,
  Link,
  Lock,
  LockOpen,
  Bird ,
  Mic,
  MicOff,
  MoreHorizontal,
  PhoneOff,
  Plus,
  Search,
  Trash2,
  Popcorn,
  User,
  UserMinus,
  UserPlus,
  UserX,
  AudioLines  ,
  Gamepad2,
  X
} from 'lucide-react'
import { ChannelEventsDialog } from '@/components/chat/channel-events-dialog'
import { CreateEntityDialog, type CreateEntityValues } from '@/components/chat/create-entity-dialog'
import { UserAvatar } from '@/components/chat/user-avatar'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { ChannelSettingsSheet, type WorkspaceChannel as BaseWorkspaceChannel } from '@/components/chat/channel-settings-sheet'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import {
  useChannelInviteLink,
  useChannelMembers,
  useChannelJoinRequests,
} from '@/hooks/use-channels'
import { useGroupMembers, useDeleteGroup, useUpdateGroup, useGroupJoinRequests, useRespondToGroupJoinRequest, useRequestJoinGroup } from '@/hooks/use-groups'
import { useSendGroupInvitation } from '@/hooks/use-invitations'
import { useProfile, useUserFollowers } from '@/hooks/use-user'
import { toast } from 'sonner'
import { getChannelTone, getChannelMonogram } from '@/lib/channel-utils'

export interface MockChannelGroup {
  id: string
  label: string
  description: string
  kind: 'text' | 'board' | 'voice' | 'watch' | 'pixel-room'
  access_type?: 'PUBLIC' | 'PRIVATE'
  is_general?: boolean
  is_member?: boolean
  membersLabel: string
  pinnedBy: string
  pinnedMessage: string
  unreadCount?: number
  hasUnread?: boolean
  hasMention?: boolean
}

export interface WorkspaceChannel {
  id: string
  label: string
  description: string
  membersLabel: string
  groups: MockChannelGroup[]
  avatarUrl?: string
  bannerUrl?: string
  access_type: 'PUBLIC' | 'PRIVATE'
  role: 'OWNER' | 'ADMIN' | 'MEMBER'
  owner_id: string
  type: 'WORKSPACE' | 'NORMAL'
}

interface BuildChannelGroupInput {
  channelId: string
  channelLabel: string
  label: string
  description?: string
  kind?: 'text' | 'board' | 'voice' | 'watch' | 'pixel-room'
  membersLabel?: string
  pinnedBy?: string
  pinnedMessage?: string
  unreadCount?: number
  hasUnread?: boolean
}

interface BuildWorkspaceChannelInput {
  id: string
  label: string
  description?: string
  index?: number
  type?: 'NORMAL' | 'WORKSPACE'
}

export interface VoiceParticipant {
  id: string
  name: string
  avatarUrl: string | null
  bannerUrl?: string | null
  subPlan?: 'FREE' | 'PRO' | 'GEEK' | string | null
  isVerified?: boolean | null
  isMuted?: boolean
  isSpeaking?: boolean
  joinedAt?: number
}

function WatchGroupTimer({ sessionStartedAt }: { sessionStartedAt: number | null | undefined }) {
  const startMs = sessionStartedAt ?? 0
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    if (!startMs) return
    const tick = () => setElapsed(Math.floor((Date.now() - startMs) / 1000))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [startMs])

  if (!startMs) return null
  const h = Math.floor(elapsed / 3600)
  const m = Math.floor((elapsed % 3600) / 60).toString().padStart(2, '0')
  const s = (elapsed % 60).toString().padStart(2, '0')
  return (
    <span className="text-[9px] font-semibold tabular-nums" style={{ color: '#55FF55' }}>
      {h > 0 ? `${h}:${m}:${s}` : `${m}:${s}`}
    </span>
  )
}

function VoiceGroupTimer({ participants }: { participants: VoiceParticipant[] }) {
  const joinTimes = participants.map(p => p.joinedAt).filter((t): t is number => typeof t === 'number' && t > 0)
  const startMs = joinTimes.length > 0 ? Math.min(...joinTimes) : 0
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    if (!startMs) return
    const tick = () => setElapsed(Math.floor((Date.now() - startMs) / 1000))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [startMs])

  if (!startMs) return null
  const m = Math.floor(elapsed / 60).toString().padStart(2, '0')
  const s = (elapsed % 60).toString().padStart(2, '0')
  return (
    <span className="ml-auto text-[9px] font-semibold tabular-nums" style={{ color: '#55FF55' }}>
      {m}:{s}
    </span>
  )
}

function PixelRoomTimer({ startedAt }: { startedAt: number }) {
  const [elapsed, setElapsed] = useState(0)
  useEffect(() => {
    const tick = () => setElapsed(Math.floor((Date.now() - startedAt) / 1000))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [startedAt])
  const m = Math.floor(elapsed / 60).toString().padStart(2, '0')
  const s = (elapsed % 60).toString().padStart(2, '0')
  return (
    <span className="ml-auto text-[9px] font-semibold tabular-nums" style={{ color: '#55FF55' }}>
      {m}:{s}
    </span>
  )
}

interface ChannelsPanelProps {
  activeGroup?: string
  channel?: WorkspaceChannel | null
  channelAvatarUrl?: string | null
  channelBannerUrl?: string | null
  onAssetSave?: (channelId: string, avatar: string | null, banner: string | null) => void
  onChannelDeleted?: () => void
  onCreateGroup?: (values: CreateEntityValues) => void
  onGroupUpdated?: (groupId: string, updates: Partial<MockChannelGroup>) => void
  onSelectGroup?: (groupId: string) => void
  visible?: boolean
  voiceParticipants?: Record<string, VoiceParticipant[]>
  activeVoiceGroupId?: string | null
  voiceIsMuted?: boolean
  voiceTimer?: string | null
  onVoiceLeave?: () => void
  onVoiceToggleMute?: () => void
  onVoiceReturn?: (groupId: string) => void
  onMoveVoiceParticipant?: (move: { userId: string; fromGroupId: string; toGroupId: string }) => void
  myId?: string
  onKickVoiceParticipant?: (userId: string, groupId: string) => void
  onMuteVoiceParticipant?: (userId: string, groupId: string, muted: boolean) => void
  onViewVoiceParticipantProfile?: (participant: VoiceParticipant) => void
  soundboardUserId?: string | null
  soundboardIntensity?: number
  onlineUsers?: Set<string>
  watchParticipants?: Record<string, { userId: string; username: string; fullname?: string | null; avatarUrl?: string | null; bannerUrl?: string | null; subPlan?: string | null; isVerified?: boolean | null; isHost: boolean; joinedAt: number; isSpeaking?: boolean }[]>
  watchSessionStarts?: Record<string, number | null>
  activeWatchGroupId?: string | null
  onWatchLeave?: () => void
  onKickWatchParticipant?: (userId: string, groupId: string) => void
  onViewWatchParticipantProfile?: (participant: { userId: string; username: string; fullname?: string | null; avatarUrl?: string | null; bannerUrl?: string | null; subPlan?: string | null; isVerified?: boolean | null; isHost: boolean; joinedAt: number }) => void
  pixelParticipants?: Record<string, { userId: string; username: string; avatarUrl?: string | null; bannerUrl?: string | null; subPlan?: string | null; micMuted: boolean; isSpeaking: boolean }[]>
  pixelSessionStarts?: Record<string, number | null>
  activePixelGroupId?: string | null
}

const MEMBER_LABELS = ['26 online', '18 online', '12 online', '9 online', '6 online']
const VOICE_PARTICIPANT_DRAG_TYPE = 'application/x-twiky-voice-participant'

function toSlug(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'channel'
}

export function buildChannelGroup({
  channelId,
  channelLabel,
  label,
  description,
  kind = 'text',
  membersLabel = '8 online',
  pinnedBy = 'Studio Bot',
  pinnedMessage,
  unreadCount,
  hasUnread,
}: BuildChannelGroupInput): MockChannelGroup {
  const normalizedLabel = label.trim() || 'general'
  const isGeneral = normalizedLabel.toLowerCase() === 'general'

  return {
    id: isGeneral ? `${channelId}-general` : `${channelId}-${toSlug(normalizedLabel)}`,
    label: normalizedLabel,
    description:
      description?.trim() ||
      (isGeneral
        ? `Default group for ${channelLabel} updates, quick syncs, and daily coordination.`
        : `Focused group for ${normalizedLabel} inside ${channelLabel}.`),
    kind,
    membersLabel,
    pinnedBy,
    pinnedMessage:
      pinnedMessage ||
      (isGeneral
        ? `Start broad updates in #general before opening a narrower group in ${channelLabel}.`
        : `Keep ${normalizedLabel} updates here so ${channelLabel} stays organized.`),
    unreadCount,
    hasUnread,
  }
}

export function buildWorkspaceChannel({
  id,
  label,
  description,
  index = 0,
  type = 'NORMAL',
}: BuildWorkspaceChannelInput): WorkspaceChannel {
  const membersLabel = MEMBER_LABELS[index % MEMBER_LABELS.length]

  return {
    id,
    label,
    description:
      description?.trim() ||
      `${label} is the shared channel for updates, planning, and team coordination.`,
    membersLabel,
    groups: [
      buildChannelGroup({
        channelId: id,
        channelLabel: label,
        label: 'general',
        membersLabel,
      }),
    ],
    access_type: 'PUBLIC',
    role: 'MEMBER',
    owner_id: '',
    type,
  }
}

export function getMockChannel(
  channelId: string,
  channels: WorkspaceChannel[] = [],
) {
  return channels.find((channel) => channel.id === channelId) ?? channels[0] ?? null
}

export function getMockGroup(
  channelId: string,
  groupId: string,
  channels: WorkspaceChannel[] = [],
) {
  const channel = getMockChannel(channelId, channels)
  if (!channel) return null
  return channel.groups.find((group) => group.id === groupId) ?? channel.groups[0] ?? null
}

function InviteMembersDialog({
  group,
  channelId,
  open,
  onOpenChange,
  invitedIds,
  onInvited,
}: {
  group: MockChannelGroup
  channelId?: string
  open: boolean
  onOpenChange: (open: boolean) => void
  invitedIds: Set<string>
  onInvited: (userId: string) => void
}) {
  const [search, setSearch] = useState('')
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [sending, setSending] = useState<Set<string>>(new Set())
  const [copied, setCopied] = useState(false)
  const sendInvitation = useSendGroupInvitation()
  const { data: profile } = useProfile()
  const { data: followers = [] } = useUserFollowers(profile?.id)
  const { data: existingMembers = [] } = useGroupMembers(group.id)
  const existingMemberIds = new Set(existingMembers.filter((m) => m.user).map((m) => m.user.id))
  const { data: inviteLinkData } = useChannelInviteLink(channelId)

  const channelLink = inviteLinkData
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}${inviteLinkData.path}`
    : ''

  const query = search.trim().toLowerCase()
  const filtered = query
    ? followers.filter((f) => f.users.username?.toLowerCase().startsWith(query))
    : followers

  function handleCopy() {
    navigator.clipboard.writeText(channelLink).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) { setSearch(''); setInviteError(null); setSending(new Set()) } }}>
      <DialogContent className="flex max-h-[80vh] flex-col gap-0 overflow-hidden border-border p-0 sm:max-w-[400px]">
        <DialogHeader className="border-b border-border px-4 py-3">
          <DialogTitle className="text-[13px]">
            Invite to <span className="text-primary">#{group.label}</span>
          </DialogTitle>
        </DialogHeader>

        {/* Search */}
        <div className="border-b border-border px-4 py-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              autoFocus
              value={search}
              onChange={(e) => { setSearch(e.target.value); setInviteError(null) }}
              placeholder="Search friends…"
              className="h-9 rounded-xl pl-8 text-[12px]"
            />
          </div>
          {inviteError && <p className="mt-1.5 text-[11px] text-destructive">{inviteError}</p>}
        </div>

        {/* Friends list */}
        <div className="flex-1 overflow-y-auto px-2 py-2">
          {!query && followers.length === 0 ? (
            <p className="px-2 py-4 text-center text-[12px] text-muted-foreground">No friends yet</p>
          ) : filtered.length === 0 ? (
            <p className="px-2 py-4 text-center text-[12px] text-muted-foreground">No matches</p>
          ) : filtered.map((f) => {
            const user = f.users
            const alreadyMember = existingMemberIds.has(user.id)
            const alreadyInvited = invitedIds.has(user.id)
            const isSending = sending.has(user.id)
            return (
              <div key={user.id} className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-accent">
                <UserAvatar src={user.avatar_url} alt={user.username ?? ''} className="h-8 w-8 flex-shrink-0 rounded-full object-cover" />
                <p className="flex-1 truncate text-[13px] text-foreground">@{user.username}</p>
                <button
                  disabled={alreadyMember || alreadyInvited || isSending}
                  onClick={() => {
                    if (alreadyInvited || isSending) return
                    setSending((prev) => new Set([...prev, user.id]))
                    setInviteError(null)
                    sendInvitation.mutate(
                      { inviteeId: user.id, groupId: group.id },
                      {
                        onSuccess: () => {
                          onInvited(user.id)
                          setSending((prev) => { const next = new Set(prev); next.delete(user.id); return next })
                        },
                        onError: (e) => {
                          setSending((prev) => { const next = new Set(prev); next.delete(user.id); return next })
                          setInviteError(e instanceof Error ? e.message : 'Failed to send invite')
                        },
                      },
                    )
                  }}
                  className="rounded-lg border border-border px-2.5 py-1 text-[11px] font-semibold text-primary transition-colors hover:bg-primary/10 disabled:opacity-40"
                >
                  {alreadyMember ? 'Member' : alreadyInvited ? 'Invited' : isSending ? '…' : 'Invite'}
                </button>
              </div>
            )
          })}
        </div>

        {/* Channel invite link */}
        <div className="border-t border-border bg-muted/30 px-4 py-3 space-y-2">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Link className="h-3.5 w-3.5" />
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em]">Channel invite link</p>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2">
            <p className="flex-1 truncate text-[11px] text-muted-foreground">{channelLink}</p>
            <button
              onClick={handleCopy}
              className="flex flex-shrink-0 items-center gap-1 rounded-lg border border-border px-2 py-1 text-[10px] font-semibold text-foreground transition-colors hover:bg-accent"
            >
              {copied
                ? <><Check className="h-3 w-3 text-primary" /> Copied</>
                : <><Copy className="h-3 w-3" /> Copy</>}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function RequestJoinButton({
  groupId,
  groupLabel,
  hasRequested,
  isPending,
  onRequest,
}: {
  groupId: string
  groupLabel: string
  hasRequested: boolean
  isPending: boolean
  onRequest: () => void
}) {
  const [hovered, setHovered] = useState(false)

  return (
    <button
      disabled={hasRequested || isPending}
      onClick={onRequest}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={cn(
        'absolute right-1.5 top-1/2 z-10 -translate-y-1/2 flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[8.5px] font-semibold transition-all duration-200',
        hasRequested
          ? 'opacity-100 border border-border bg-muted/50 text-muted-foreground'
          : 'opacity-0 group-hover/row:opacity-100 border border-primary/25 bg-primary/5 text-primary hover:bg-primary/12 hover:border-primary/50',
      )}
    >
      <span className="relative h-2.5 w-2.5 flex-shrink-0 overflow-hidden">
        <AnimatePresence mode="wait" initial={false}>
          {hasRequested ? (
            <motion.span
              key="check"
              className="absolute inset-0 flex items-center justify-center"
              initial={{ y: 6, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -6, opacity: 0 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
            >
              <Check className="h-2.5 w-2.5" />
            </motion.span>
          ) : hovered ? (
            <motion.span
              key="open"
              className="absolute inset-0 flex items-center justify-center"
              initial={{ y: 8, opacity: 0, rotate: -15 }}
              animate={{ y: 0, opacity: 1, rotate: 0 }}
              exit={{ y: -8, opacity: 0, rotate: 15 }}
              transition={{ duration: 0.35, ease: [0.34, 1.56, 0.64, 1] }}
            >
              <LockOpen className="h-2.5 w-2.5" />
            </motion.span>
          ) : (
            <motion.span
              key="closed"
              className="absolute inset-0 flex items-center justify-center"
              initial={{ y: -8, opacity: 0, rotate: 15 }}
              animate={{ y: 0, opacity: 1, rotate: 0 }}
              exit={{ y: 8, opacity: 0, rotate: -15, scale: 0.7 }}
              transition={{ duration: 0.35, ease: [0.34, 1.56, 0.64, 1] }}
            >
              <Lock className="h-2.5 w-2.5" />
            </motion.span>
          )}
        </AnimatePresence>
      </span>
      {hasRequested ? 'Requested' : 'Request'}
    </button>
  )
}

function GroupPendingDot({ groupId }: { groupId: string }) {
  const { data } = useGroupJoinRequests(groupId)
  const requests = data ?? []
  if (!requests.length) return null
  return (
    <span className="flex h-3.5 min-w-[14px] items-center justify-center rounded-full bg-destructive text-[8px] font-bold text-white ring-1 ring-background">
      {requests.length > 9 ? '9+' : requests.length}
    </span>
  )
}

function GroupSettingsSheet({
  group,
  open,
  onOpenChange,
  channelId,
  onDeleted,
  onGroupUpdated,
}: {
  group: MockChannelGroup
  open: boolean
  onOpenChange: (open: boolean) => void
  channelId?: string
  onDeleted?: () => void
  onGroupUpdated?: (groupId: string, updates: Partial<MockChannelGroup>) => void
}) {
  const [name, setName] = useState(group.label)
  const [description, setDescription] = useState(group.description)
  const [kind, setKind] = useState<'text' | 'board' | 'voice' | 'watch' | 'pixel-room'>(group.kind)
  const [accessType, setAccessType] = useState<'PUBLIC' | 'PRIVATE'>(group.access_type ?? 'PUBLIC')
  const [notifications, setNotifications] = useState(true)
  const [mentionsOnly, setMentionsOnly] = useState(false)
  const [slowMode, setSlowMode] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const deleteGroup = useDeleteGroup(channelId ?? '')
  const updateGroup = useUpdateGroup(channelId ?? '')
  const { data: joinRequests = [] } = useGroupJoinRequests(accessType === 'PRIVATE' ? group.id : undefined)
  const respondToRequest = useRespondToGroupJoinRequest(group.id)

  useEffect(() => {
    setName(group.label)
    setDescription(group.description)
    setKind(group.kind)
    setAccessType(group.access_type ?? 'PUBLIC')
    setNotifications(true)
    setMentionsOnly(false)
    setSlowMode(false)
    setSaveError(null)
  }, [group.description, group.id, group.kind, group.label, group.access_type])

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[360px] overflow-y-auto p-0 sm:max-w-[360px]">
        <SheetHeader className="border-b border-border px-4 py-3">
          <SheetTitle className="text-[13px]">Group Settings</SheetTitle>
        </SheetHeader>  

        <div className="divide-y divide-border">
          {/* General */}
          <div className="space-y-3 p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              General
            </p>
            <div className="space-y-1.5">
              <Label className="text-[11px]">Group name</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="h-9 rounded-xl text-[12px]"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px]">Description</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="min-h-[60px] rounded-xl text-[12px] leading-5"
              />
            </div>
          </div>

          {/* Type */}
          <div className="space-y-3 p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Type
            </p>
            <div className="grid grid-cols-2 gap-2">
              {([
                { value: 'text', icon: Hash, label: 'Text', desc: 'Messages and threads' },
                { value: 'board', icon: Bird , label: 'Forum', desc: 'Forum-style topics' },
                { value: 'voice', icon: AudioLines  , label: 'Voice', desc: 'Audio conversations' },
                { value: 'watch', icon: Popcorn, label: 'Watch', desc: 'Watch together room' },
                { value: 'pixel-room', icon: Gamepad2, label: 'Pixel Room', desc: 'Shared pixel avatar room' },
              ] as const).map(({ value, icon: Icon, label, desc }) => (
                <button
                  key={value}
                  onClick={() => setKind(value)}
                  className={cn(
                    'flex flex-col items-start gap-1.5 rounded-2xl border p-3 text-left transition-colors',
                    kind === value
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:bg-accent',
                  )}
                >
                  <Icon className="h-4 w-4 text-primary" />
                  <span className="text-[11px] font-semibold text-foreground">{label}</span>
                  <span className="text-[10px] leading-4 text-muted-foreground">{desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Notifications */}
          <div className="space-y-3 p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Notifications
            </p>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[12px] font-medium text-foreground">All messages</p>
                <p className="text-[11px] text-muted-foreground">Notify for every new message</p>
              </div>
              <Switch checked={notifications} onCheckedChange={setNotifications} />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[12px] font-medium text-foreground">Mentions only</p>
                <p className="text-[11px] text-muted-foreground">Only notify when @mentioned</p>
              </div>
              <Switch checked={mentionsOnly} onCheckedChange={setMentionsOnly} />
            </div>
          </div>

          {/* Moderation */}
          <div className="space-y-3 p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Moderation
            </p>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[12px] font-medium text-foreground">Slow mode</p>
                <p className="text-[11px] text-muted-foreground">Limit posting frequency</p>
              </div>
              <Switch checked={slowMode} onCheckedChange={setSlowMode} />
            </div>
          </div>

          {/* Privacy */}
          <div className="space-y-3 p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Privacy
            </p>
            <div className="grid grid-cols-2 gap-2">
              {([
                { value: 'PUBLIC', icon: Globe, label: 'Public', desc: 'Anyone can join' },
                { value: 'PRIVATE', icon: Lock, label: 'Private', desc: 'Invite only' },
              ] as const).map(({ value, icon: Icon, label, desc }) => (
                <button
                  key={value}
                  onClick={() => setAccessType(value)}
                  className={cn(
                    'flex flex-col items-start gap-1.5 rounded-2xl border p-3 text-left transition-colors',
                    accessType === value
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:bg-accent',
                  )}
                >
                  <Icon className="h-4 w-4 text-primary" />
                  <span className="text-[11px] font-semibold text-foreground">{label}</span>
                  <span className="text-[10px] leading-4 text-muted-foreground">{desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Join Requests — private groups only */}
          {accessType === 'PRIVATE' && (
            <div className="space-y-3 p-4">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                  Join Requests
                </p>
                {joinRequests.length > 0 && (
                  <span className="rounded-full bg-primary px-1.5 py-0.5 text-[9px] font-bold text-primary-foreground">
                    {joinRequests.length}
                  </span>
                )}
              </div>
              {joinRequests.length === 0 ? (
                <p className="text-[11px] text-muted-foreground">No pending requests</p>
              ) : (
                <div className="space-y-2">
                  {joinRequests.map((req) => (
                    <div key={req.id} className="flex items-center gap-2.5 rounded-xl border border-border bg-card px-3 py-2">
                      <UserAvatar src={req.user.avatar_url} alt={req.user.username ?? ''} className="h-8 w-8 flex-shrink-0 rounded-full object-cover" />
                      <p className="flex-1 truncate text-[12px] text-foreground">@{req.user.username}</p>
                      <button
                        disabled={respondToRequest.isPending}
                        onClick={() => respondToRequest.mutate({ requestId: req.id, status: 'ACCEPTED' })}
                        className="rounded-lg bg-primary px-2 py-1 text-[10px] font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
                      >
                        Accept
                      </button>
                      <button
                        disabled={respondToRequest.isPending}
                        onClick={() => respondToRequest.mutate({ requestId: req.id, status: 'REJECTED' })}
                        className="rounded-lg border border-border px-2 py-1 text-[10px] font-medium text-muted-foreground hover:bg-accent disabled:opacity-50"
                      >
                        Decline
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Danger — hidden for #general */}
          {!group.is_general && (
            <div className="space-y-3 p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-destructive">
                Danger zone
              </p>
              <button
                disabled={deleteGroup.isPending}
                onClick={() => deleteGroup.mutate(group.id, { onSuccess: () => { onOpenChange(false); onDeleted?.() } })}
                className="flex w-full items-center gap-2.5 rounded-2xl border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-left transition-colors hover:bg-destructive/10 disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4 text-destructive" />
                <div>
                  <p className="text-[12px] font-medium text-destructive">
                    {deleteGroup.isPending ? 'Deleting…' : 'Delete group'}
                  </p>
                  <p className="text-[11px] text-muted-foreground">Remove group and all messages</p>
                </div>
              </button>
            </div>
          )}

          <div className="space-y-2 p-4">
            {saveError ? (
              <p className="text-[11px] text-destructive">{saveError}</p>
            ) : null}
            <Button
              className="w-full rounded-xl text-[12px]"
              disabled={updateGroup.isPending}
              onClick={async () => {
                setSaveError(null)
                try {
                  await updateGroup.mutateAsync({
                    groupId: group.id,
                    data: {
                      name: name.trim() || group.label,
                      description: description.trim() || undefined,
                      group_type: kind,
                      access_type: accessType,
                    },
                  })
                  onGroupUpdated?.(group.id, {
                    label: name.trim() || group.label,
                    description: description.trim(),
                    kind,
                    access_type: accessType,
                  })
                  onOpenChange(false)
                } catch (err) {
                  const msg = err instanceof Error ? err.message : 'Failed to save'
                  setSaveError(msg)
                  toast.error(msg)
                }
              }}
            >
              {updateGroup.isPending ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}

export function ChannelsPanel({
  activeGroup,
  channel,
  channelAvatarUrl,
  channelBannerUrl,
  onAssetSave,
  onChannelDeleted,
  onCreateGroup,
  onGroupUpdated,
  onSelectGroup,
  visible = true,
  voiceParticipants = {},
  activeVoiceGroupId,
  voiceIsMuted,
  voiceTimer,
  onVoiceLeave,
  onVoiceToggleMute,
  onVoiceReturn,
  onMoveVoiceParticipant,
  myId,
  onKickVoiceParticipant,
  onMuteVoiceParticipant,
  onViewVoiceParticipantProfile,
  soundboardUserId,
  soundboardIntensity = 0,
  onlineUsers = new Set(),
  watchParticipants = {},
  watchSessionStarts = {},
  activeWatchGroupId,
  onWatchLeave,
  onKickWatchParticipant,
  onViewWatchParticipantProfile,
  pixelParticipants = {},
  pixelSessionStarts = {},
  activePixelGroupId,
}: ChannelsPanelProps) {
  const [showCreateGroup, setShowCreateGroup] = useState(false)
  const [eventsOpen, setEventsOpen] = useState(false)
  const [channelSettingsOpen, setChannelSettingsOpen] = useState(false)
  const [groupSettingsTarget, setGroupSettingsTarget] = useState<MockChannelGroup | null>(null)
  const [inviteTarget, setInviteTarget] = useState<MockChannelGroup | null>(null)
  const [invitedByGroup, setInvitedByGroup] = useState<Record<string, Set<string>>>({})
  const [requestedGroups, setRequestedGroups] = useState<Set<string>>(new Set())
  const [dragOverVoiceGroupId, setDragOverVoiceGroupId] = useState<string | null>(null)
  const requestJoin = useRequestJoinGroup()
  const deleteGroup = useDeleteGroup(channel?.id ?? '')
  const { data: allMembers = [] } = useChannelMembers(channel?.id)
  const isAdminForNotif = channel?.role === 'OWNER' || channel?.role === 'ADMIN' || (!!myId && channel?.owner_id === myId)
  const { data: channelPendingRequests = [] } = useChannelJoinRequests(
    isAdminForNotif && channel?.access_type === 'PRIVATE' ? channel?.id : undefined,
  )

  if (!visible || !channel) return null

  const tone = getChannelTone(channel.id)
  const monogram = getChannelMonogram(channel.label)
  const displayAvatar = channelAvatarUrl ?? channel.avatarUrl ?? null
  const displayBanner = channelBannerUrl ?? channel.bannerUrl ?? null
  const canManage = channel.role === 'OWNER' || channel.role === 'ADMIN' || (!!myId && channel.owner_id === myId)
  const voiceGroups = channel.groups.filter((g) => g.kind === 'voice')

  function parseVoiceDrag(event: DragEvent<HTMLElement>) {
    const raw =
      event.dataTransfer.getData(VOICE_PARTICIPANT_DRAG_TYPE) ||
      event.dataTransfer.getData('text/plain')
    if (!raw) return null

    try {
      const payload = JSON.parse(raw) as Partial<{
        type: string
        userId: string
        fromGroupId: string
      }>
      if (
        payload.type === 'voice-participant' &&
        typeof payload.userId === 'string' &&
        typeof payload.fromGroupId === 'string'
      ) {
        return { userId: payload.userId, fromGroupId: payload.fromGroupId }
      }
    } catch {}

    return null
  }

  function handleVoiceParticipantDrop(event: DragEvent<HTMLElement>, toGroupId: string) {
    if (!canManage) return
    event.preventDefault()
    event.stopPropagation()
    setDragOverVoiceGroupId(null)
    const payload = parseVoiceDrag(event)
    if (!payload || payload.fromGroupId === toGroupId) return
    onMoveVoiceParticipant?.({
      userId: payload.userId,
      fromGroupId: payload.fromGroupId,
      toGroupId,
    })
  }

  return (
    <>
      <div
        className="flex h-full w-[216px] flex-shrink-0 flex-col border-r border-border bg-sidebar"
      >
        {/* Header */}
        <div className="relative h-[94px] overflow-hidden border-b border-border px-3">
          {displayBanner ? (
            <>
              <img
                src={displayBanner}
                alt={`${channel.label} banner`}
                className="absolute inset-0 h-full w-full object-cover [object-position:center_34%]"
              />
              <div className="absolute inset-0 bg-gradient-to-b from-black/10 via-background/35 to-background" />
            </>
          ) : (
            <div className={cn('absolute inset-0 bg-gradient-to-br opacity-15', tone)} />
          )}

          <div className="relative flex justify-end pt-2.5">
            <div className="flex items-center gap-0.5">
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  'h-7 w-7 rounded-xl',
                  displayBanner
                    ? 'bg-black/25 text-white hover:bg-black/40 hover:text-white'
                    : '',
                )}
                onClick={() => setEventsOpen(true)}
                title="Channel events"
              >
                <Calendar className="h-3.5 w-3.5" />
              </Button>
              {canManage ? (
                <>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={cn(
                      'h-7 w-7 rounded-xl',
                      displayBanner
                        ? 'bg-black/25 text-white hover:bg-black/40 hover:text-white'
                        : '',
                    )}
                    onClick={() => setShowCreateGroup(true)}
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={cn(
                      'h-7 w-7 rounded-xl',
                      displayBanner
                        ? 'bg-black/25 text-white hover:bg-black/40 hover:text-white'
                        : '',
                    )}
                    onClick={() => setChannelSettingsOpen(true)}
                  >
                    <div className="relative">
                      <MoreHorizontal className="h-3.5 w-3.5" />
                      {channelPendingRequests.length > 0 && (
                        <span className="absolute -right-1 -top-1 flex h-3.5 min-w-[14px] items-center justify-center rounded-full bg-destructive text-[8px] font-bold text-white ring-1 ring-background">
                          {channelPendingRequests.length > 9 ? '9+' : channelPendingRequests.length}
                        </span>
                      )}
                    </div>
                  </Button>
                </>
              ) : null}
            </div>
          </div>

          <div className="absolute inset-x-3 bottom-2 flex items-center gap-2.5">
            <div
              className={cn(
                'flex h-9 w-9 flex-shrink-0 items-center justify-center overflow-hidden rounded-xl border border-background/80 bg-gradient-to-br text-[10px] font-bold text-white shadow-sm',
                tone,
              )}
            >
              {displayAvatar ? (
                <img src={displayAvatar} alt={channel.label} className="h-full w-full object-cover" />
              ) : monogram}
            </div>
            <div className="min-w-0 flex-1">
              <p className={cn('truncate text-[12.5px] font-semibold', displayBanner ? 'text-white' : 'text-foreground')}>
                {channel.label}
              </p>
              <p className={cn('truncate text-[10px]', displayBanner ? 'text-white/80' : 'text-muted-foreground')}>
                {(() => {
                  const onlineCount = allMembers.filter(m => m.user?.id && onlineUsers.has(m.user.id)).length
                  if (onlineCount > 0) return `${onlineCount} online`
                  if (allMembers.length > 0) return `${allMembers.length} members`
                  return null
                })()}
              </p>
            </div>
          </div>
        </div>

        {/* Groups list */}
        <div className="flex-1 overflow-y-auto px-2 py-3">
          <div className="mb-2 px-2">
            <p className="text-[10px] font-semibold uppercase tracking-[0.09em] text-muted-foreground">
              Groups
            </p>
          </div>

          <div className="space-y-0.5">
            {(() => {
              const textGroups = channel.groups.filter((g) => g.kind === 'text')
              const boardGroups = channel.groups.filter((g) => g.kind === 'board')
              const watchGroups = channel.groups.filter((g) => g.kind === 'watch')
              const voiceGroups = channel.groups.filter((g) => g.kind === 'voice')
              const pixelGroups = channel.groups.filter((g) => g.kind === 'pixel-room')
              const sorted = [...textGroups, ...boardGroups, ...watchGroups, ...voiceGroups, ...pixelGroups]
              const boardStart = textGroups.length
              const watchStart = textGroups.length + boardGroups.length
              const voiceStart = textGroups.length + boardGroups.length + watchGroups.length
              return sorted.map((group, idx) => {
              const isActive = activeGroup === group.id
              const isDefault = group.label.toLowerCase() === 'general'
              const GroupIcon = group.kind === 'voice' ? AudioLines : group.kind === 'watch' ? Popcorn : group.kind === 'board' ? Bird : group.kind === 'pixel-room' ? Gamepad2 : Hash
              const isPrivate = group.access_type === 'PRIVATE'
              const hasRequested = requestedGroups.has(group.id)
              const memberCanRequest = !canManage && isPrivate && !group.is_member
              const participants = group.kind === 'voice' ? (voiceParticipants[group.id] ?? []) : []
              const watchPeople = group.kind === 'watch' ? (watchParticipants[group.id] ?? []) : []
              const pixelPeople = group.kind === 'pixel-room' ? (pixelParticipants[group.id] ?? []) : []

              const isFirstBoard = idx === boardStart && boardGroups.length > 0
              const isFirstWatch = idx === watchStart && watchGroups.length > 0
              const isFirstVoice = idx === voiceStart && voiceStart > 0 && voiceGroups.length > 0
              return (
                <div key={group.id}>
                {isFirstBoard && (
                  <div className="flex items-center gap-2 px-1 pb-1 pt-2">
                    <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/50">Twikies</span>
                    <div className="flex-1 border-t border-border/50" />
                  </div>
                )}
                {isFirstWatch && (
                  <div className="flex items-center gap-2 px-1 pb-1 pt-2">
                    <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/50">Watch</span>
                    <div className="flex-1 border-t border-border/50" />
                  </div>
                )}
                {isFirstVoice && (
                  <div className="flex items-center gap-2 px-1 pb-1 pt-2">
                    <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/50">Voice</span>
                    <div className="flex-1 border-t border-border/50" />
                  </div>
                )}
                <div
                  className=""
                  onDragOver={(event) => {
                    if (!canManage || group.kind !== 'voice') return
                    event.preventDefault()
                    event.dataTransfer.dropEffect = 'move'
                    setDragOverVoiceGroupId(group.id)
                  }}
                  onDragLeave={(event) => {
                    const nextTarget = event.relatedTarget
                    if (!(nextTarget instanceof Node) || !event.currentTarget.contains(nextTarget)) {
                      setDragOverVoiceGroupId(null)
                    }
                  }}
                  onDrop={(event) => {
                    if (group.kind === 'voice') handleVoiceParticipantDrop(event, group.id)
                  }}
                >
                  {/* Row — relative container so 3-dot stays within the button height */}
                  <div
                    className={cn(
                      'group/row relative rounded-xl',
                      canManage &&
                        group.kind === 'voice' &&
                        dragOverVoiceGroupId === group.id &&
                        'ring-1 ring-primary/60 ring-offset-1 ring-offset-sidebar',
                    )}
                    onDragOver={(event) => {
                      if (!canManage || group.kind !== 'voice') return
                      event.preventDefault()
                      event.dataTransfer.dropEffect = 'move'
                      setDragOverVoiceGroupId(group.id)
                    }}
                    onDragLeave={(event) => {
                      const nextTarget = event.relatedTarget
                      if (!(nextTarget instanceof Node) || !event.currentTarget.contains(nextTarget)) {
                        setDragOverVoiceGroupId(null)
                      }
                    }}
                    onDrop={(event) => {
                      if (group.kind === 'voice') handleVoiceParticipantDrop(event, group.id)
                    }}
                  >
                  <button
                    onClick={() => {
                      if (memberCanRequest) return
                      onSelectGroup?.(group.id)
                    }}
                    className={cn(
                      cn('relative flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left transition-all', canManage ? 'pr-9' : 'pr-8'),
                      isActive
                        ? 'bg-primary/10 text-foreground'
                        : memberCanRequest
                          ? 'cursor-default text-muted-foreground/50'
                          : 'text-muted-foreground hover:bg-accent/70 hover:text-foreground',
                    )}
                  >
                    <GroupIcon
                      className="h-3.5 w-3.5 flex-shrink-0"
                      style={{
                        color: group.kind === 'voice' && group.id === activeVoiceGroupId
                          ? '#55FF55'
                          : isActive ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))',
                      }}
                    />
                    <div className="flex min-w-0 flex-1 items-center gap-1.5">
                      <span className="truncate text-[12px] font-medium">{group.label}</span>
                      {isPrivate && (
                        <Lock className="h-2.5 w-2.5 flex-shrink-0 text-muted-foreground/60" />
                      )}
                      {isDefault ? (
                        <span className="rounded-full border border-border px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
                          Default
                        </span>
                      ) : null}
                      {group.kind !== 'voice' && (
                        <>
                          {group.hasMention ? (
                            <span className="ml-auto flex h-3.5 w-3.5 flex-shrink-0 items-center justify-center rounded-full bg-red-500 text-[8px] font-black text-white">
                              @
                            </span>
                          ) : group.unreadCount ? (
                            <span className="ml-auto flex h-3.5 min-w-[14px] flex-shrink-0 items-center justify-center rounded-full bg-red-500 px-1 text-[8px] font-bold text-white">
                              {group.unreadCount > 99 ? '99+' : group.unreadCount}
                            </span>
                          ) : group.hasUnread ? (
                            <span className="ml-auto h-1.5 w-1.5 rounded-full bg-red-500" />
                          ) : null}
                        </>
                      )}
                    </div>
                  </button>

                  {/* Request to join — non-admin members on private groups */}
                  {memberCanRequest && (
                    <RequestJoinButton
                      groupId={group.id}
                      groupLabel={group.label}
                      hasRequested={hasRequested}
                      isPending={requestJoin.isPending}
                      onRequest={() => {
                        if (hasRequested) return
                        requestJoin.mutate(group.id, {
                          onSuccess: () => {
                            setRequestedGroups((prev) => new Set([...prev, group.id]))
                            toast.success(`Request sent to join #${group.label}`)
                          },
                        })
                      }}
                    />
                  )}

                  {/* Pending requests dot — admins/owners only, private groups */}
                  {canManage && isPrivate && (
                    <div className="absolute right-8 top-1/2 z-10 -translate-y-1/2">
                      <GroupPendingDot groupId={group.id} />
                    </div>
                  )}

                  {/* Watch timer — shown on the group card while session is active */}
                  {group.kind === 'watch' && watchPeople.length > 0 && watchSessionStarts[group.id] && (
                    <span className={cn('absolute right-1.5 top-1/2 z-10 -translate-y-1/2 pointer-events-none transition-opacity duration-150', canManage && 'group-hover/row:opacity-0')}>
                      <WatchGroupTimer sessionStartedAt={watchSessionStarts[group.id]} />
                    </span>
                  )}

                  {/* Voice call timer — all users */}
                  {group.kind === 'voice' && participants.length > 0 && (
                    <span className={cn('absolute right-1.5 top-1/2 z-10 -translate-y-1/2 pointer-events-none transition-opacity duration-150', canManage && 'group-hover/row:opacity-0')}>
                      <VoiceGroupTimer participants={participants} />
                    </span>
                  )}

                  {/* Pixel room session timer */}
                  {group.kind === 'pixel-room' && pixelPeople.length > 0 && pixelSessionStarts[group.id] && (
                    <span className={cn('absolute right-1.5 top-1/2 z-10 -translate-y-1/2 pointer-events-none transition-opacity duration-150', canManage && 'group-hover/row:opacity-0')}>
                      <PixelRoomTimer startedAt={pixelSessionStarts[group.id]!} />
                    </span>
                  )}

                  {/* Group 3-dot menu — admins/owners only */}
                  {canManage ? (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        className={cn(
                          'absolute right-1.5 top-1/2 z-10 -translate-y-1/2 flex h-6 w-6 items-center justify-center rounded-lg text-muted-foreground transition-all hover:bg-accent hover:text-foreground',
                          'opacity-0 group-hover/row:opacity-100',
                        )}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <MoreHorizontal className="h-3.5 w-3.5" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48 bg-sidebar border-border">
                      <DropdownMenuItem onClick={() => setGroupSettingsTarget(group)}>
                        Group settings
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setInviteTarget(group)}>
                        <UserPlus className="mr-2 h-3.5 w-3.5" />
                        Invite members
                      </DropdownMenuItem>
                      <DropdownMenuItem>Mark as read</DropdownMenuItem>
                      {!group.is_general && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => deleteGroup.mutate(group.id, {
                              onSuccess: () => {
                                if (groupSettingsTarget?.id === group.id) setGroupSettingsTarget(null)
                              },
                            })}
                          >
                            Delete group
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                  ) : null}
                  </div>{/* end row */}

                  {/* Watch participants — same style as voice */}
                  {group.kind === 'watch' && watchPeople.length > 0 && (
                    <div className="ml-6 mb-1 space-y-0.5">
                      {watchPeople.map((p) => {
                        const isSelf = p.userId === myId
                        const hasGeekBanner = p.subPlan === 'GEEK' && Boolean(p.bannerUrl)
                        return (
                          <ContextMenu key={p.userId}>
                            <ContextMenuTrigger asChild>
                              <div
                                className={cn(
                                  'group/watch-participant relative flex min-h-7 items-center gap-2 overflow-hidden rounded-lg px-2 py-0.5',
                                  hasGeekBanner && 'transition-shadow duration-300 ease-out hover:shadow-[0_10px_22px_rgba(0,0,0,0.22)]',
                                  'hover:bg-accent/40 transition-colors',
                                )}
                              >
                                {hasGeekBanner ? (
                                  <>
                                    <img
                                      src={p.bannerUrl ?? ''}
                                      alt=""
                                      aria-hidden="true"
                                      draggable={false}
                                      className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-0 transition-opacity duration-300 group-hover/watch-participant:opacity-100"
                                    />
                                    <span className="pointer-events-none absolute inset-0 bg-gradient-to-r from-sidebar/95 via-sidebar/58 to-sidebar/18 opacity-0 transition-opacity duration-300 group-hover/watch-participant:opacity-100" />
                                    <span className="pointer-events-none absolute inset-y-0 left-0 w-16 bg-[linear-gradient(90deg,rgba(0,0,0,0.92)_0%,rgba(0,0,0,0.72)_34%,rgba(0,0,0,0.34)_68%,rgba(0,0,0,0)_100%)] opacity-0 shadow-[inset_18px_0_22px_rgba(0,0,0,0.86)] transition-opacity duration-300 group-hover/watch-participant:opacity-100" />
                                  </>
                                ) : null}
                                <div className={cn(
                                  'relative z-10 shrink-0 rounded-full transition-all duration-200',
                                  p.isSpeaking && 'ring-2 ring-green-500/80 ring-offset-1 ring-offset-sidebar',
                                )}>
                                  <UserAvatar src={p.avatarUrl} alt={p.username} className="h-5 w-5 rounded-full" />
                                </div>
                                <span className={cn(
                                  'relative z-10 min-w-0 flex-1 truncate text-[11px] font-medium transition-colors duration-300',
                                  isSelf ? 'text-foreground' : 'text-muted-foreground',
                                  hasGeekBanner && 'group-hover/watch-participant:text-white',
                                )}>
                                  {p.username}{isSelf ? ' (You)' : ''}
                                </span>
                              </div>
                            </ContextMenuTrigger>
                            <ContextMenuContent className="w-44 bg-sidebar border-border">
                              <ContextMenuItem onClick={() => onViewWatchParticipantProfile?.(p)}>
                                <User className="mr-2 h-3.5 w-3.5" />
                                View profile
                              </ContextMenuItem>
                              {!isSelf && !p.isHost && canManage && (
                                <>
                                  <ContextMenuSeparator />
                                  <ContextMenuItem
                                    className="text-destructive focus:text-destructive"
                                    onClick={() => onKickWatchParticipant?.(p.userId, group.id)}
                                  >
                                    <UserMinus className="mr-2 h-3.5 w-3.5" />
                                    Kick from watch
                                  </ContextMenuItem>
                                </>
                              )}
                            </ContextMenuContent>
                          </ContextMenu>
                        )
                      })}
                    </div>
                  )}

                  {/* Pixel room participants */}
                  {group.kind === 'pixel-room' && pixelPeople.length > 0 && (
                    <div className="ml-6 mb-1 space-y-0.5">
                      {pixelPeople.map((p) => {
                        const isSelf = p.userId === myId
                        const speaking = p.isSpeaking && !p.micMuted
                        const hasGeekBanner = p.subPlan === 'GEEK' && Boolean(p.bannerUrl)
                        const avatarActivity = speaking ? 0.65 : 0
                        return (
                          <div
                            key={p.userId}
                            className={cn(
                              'group/pixel-participant relative flex min-h-7 items-center gap-2 overflow-hidden rounded-lg px-2 py-0.5 hover:bg-accent/40 transition-colors',
                              hasGeekBanner && 'transition-shadow duration-300 ease-out hover:shadow-[0_10px_22px_rgba(0,0,0,0.22)]',
                            )}
                          >
                            {hasGeekBanner ? (
                              <>
                                <img
                                  src={p.bannerUrl ?? ''}
                                  alt=""
                                  aria-hidden="true"
                                  draggable={false}
                                  className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-0 transition-opacity duration-300 group-hover/pixel-participant:opacity-100"
                                />
                                <span className="pointer-events-none absolute inset-0 bg-gradient-to-r from-sidebar/95 via-sidebar/58 to-sidebar/18 opacity-0 transition-opacity duration-300 group-hover/pixel-participant:opacity-100" />
                                <span className="pointer-events-none absolute inset-y-0 left-0 w-16 bg-[linear-gradient(90deg,rgba(0,0,0,0.92)_0%,rgba(0,0,0,0.72)_34%,rgba(0,0,0,0.34)_68%,rgba(0,0,0,0)_100%)] opacity-0 shadow-[inset_18px_0_22px_rgba(0,0,0,0.86)] transition-opacity duration-300 group-hover/pixel-participant:opacity-100" />
                              </>
                            ) : null}
                            <div
                              className="relative z-10 flex-shrink-0 rounded-full transition-shadow duration-75"
                              style={avatarActivity > 0 ? {
                                outline: `${1 + avatarActivity * 2}px solid rgba(74,222,128,${0.5 + avatarActivity * 0.5})`,
                                boxShadow: `0 0 ${4 + avatarActivity * 12}px ${avatarActivity * 4}px rgba(74,222,128,${0.2 + avatarActivity * 0.6})`,
                              } : undefined}
                            >
                              <UserAvatar src={p.avatarUrl ?? null} alt={p.username} className="h-5 w-5 rounded-full object-cover" />
                              <span className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full border border-background bg-green-500" />
                            </div>
                            <span className="relative z-10 flex min-w-0 flex-1 items-center">
                              <span className={cn(
                                'truncate text-[11px] transition-colors duration-300',
                                p.micMuted ? 'text-muted-foreground/50' : 'text-muted-foreground',
                                hasGeekBanner && 'group-hover/pixel-participant:text-white',
                              )}>
                                {p.username}{isSelf ? ' (You)' : ''}
                              </span>
                            </span>
                            {p.micMuted && <MicOff className="relative z-10 ml-auto h-2.5 w-2.5 flex-shrink-0 text-muted-foreground/40" />}
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {/* Voice participants — Discord-style list below, outside the row div */}
                  {group.kind === 'voice' && participants.length > 0 && (
                    <div className="ml-6 mb-1 space-y-0.5">
                      {participants.map((p) => {
                        const isSelf = p.id === myId
                        const voiceActive = Boolean(p.isSpeaking && !p.isMuted)
                        const soundboardActive = soundboardUserId === p.id
                        const avatarActivity = soundboardActive ? soundboardIntensity : voiceActive ? 0.65 : 0
                        const hasGeekBanner = p.subPlan === 'GEEK' && Boolean(p.bannerUrl)
                        return (
                          <ContextMenu key={p.id}>
                            <ContextMenuTrigger asChild>
                              <div
                                draggable={canManage}
                                title={canManage ? 'Drag to move to another voice group' : undefined}
                                className={cn(
                                  'group/voice-participant relative flex min-h-7 items-center gap-2 overflow-hidden rounded-lg px-2 py-0.5',
                                  hasGeekBanner && 'transition-shadow duration-300 ease-out hover:shadow-[0_10px_22px_rgba(0,0,0,0.22)]',
                                  canManage && 'cursor-grab transition-colors hover:bg-accent/60 active:cursor-grabbing',
                                  !canManage && 'hover:bg-accent/40 transition-colors',
                                )}
                                onDragStart={(event) => {
                                  if (!canManage) return
                                  const payload = JSON.stringify({
                                    type: 'voice-participant',
                                    userId: p.id,
                                    fromGroupId: group.id,
                                  })
                                  event.dataTransfer.effectAllowed = 'move'
                                  event.dataTransfer.setData(VOICE_PARTICIPANT_DRAG_TYPE, payload)
                                  event.dataTransfer.setData('text/plain', payload)
                                }}
                                onDragEnd={() => setDragOverVoiceGroupId(null)}
                              >
                                {hasGeekBanner ? (
                                  <>
                                    <img
                                      src={p.bannerUrl ?? ''}
                                      alt=""
                                      aria-hidden="true"
                                      draggable={false}
                                      className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-0 transition-opacity duration-300 group-hover/voice-participant:opacity-100"
                                    />
                                    <span className="pointer-events-none absolute inset-0 bg-gradient-to-r from-sidebar/95 via-sidebar/58 to-sidebar/18 opacity-0 transition-opacity duration-300 group-hover/voice-participant:opacity-100" />
                                    <span className="pointer-events-none absolute inset-y-0 left-0 w-16 bg-[linear-gradient(90deg,rgba(0,0,0,0.92)_0%,rgba(0,0,0,0.72)_34%,rgba(0,0,0,0.34)_68%,rgba(0,0,0,0)_100%)] opacity-0 shadow-[inset_18px_0_22px_rgba(0,0,0,0.86)] transition-opacity duration-300 group-hover/voice-participant:opacity-100" />
                                  </>
                                ) : null}
                                <div
                                  className="relative z-10 flex-shrink-0 rounded-full transition-shadow duration-75"
                                  style={avatarActivity > 0 ? {
                                    outline: `${1 + avatarActivity * 2}px solid rgba(74,222,128,${0.5 + avatarActivity * 0.5})`,
                                    boxShadow: `0 0 ${4 + avatarActivity * 12}px ${avatarActivity * 4}px rgba(74,222,128,${0.2 + avatarActivity * 0.6})`,
                                  } : undefined}
                                >
                                  <UserAvatar src={p.avatarUrl} alt={p.name} className="h-5 w-5 rounded-full object-cover" />
                                  <span className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full border border-background bg-green-500" />
                                </div>
                                <span className="relative z-10 flex min-w-0 items-center gap-1.5">
                                  <span className={cn(
                                    'truncate text-[11px] transition-colors duration-300',
                                    p.isMuted ? 'text-muted-foreground/50' : 'text-muted-foreground',
                                    hasGeekBanner && 'group-hover/voice-participant:text-white',
                                  )}>
                                    {p.name}{isSelf ? ' (You)' : ''}
                                  </span>
                                </span>
                                {p.isMuted && <MicOff className="relative z-10 ml-auto h-2.5 w-2.5 flex-shrink-0 text-muted-foreground/40" />}
                              </div>
                            </ContextMenuTrigger>
                            <ContextMenuContent className="w-44 bg-sidebar border-border">
                              <ContextMenuItem onClick={() => onViewVoiceParticipantProfile?.(p)}>
                                <User className="mr-2 h-3.5 w-3.5" />
                                View profile
                              </ContextMenuItem>
                              {!isSelf && canManage && (
                                <>
                                  <ContextMenuSeparator />
                                  <ContextMenuItem onClick={() => onMuteVoiceParticipant?.(p.id, group.id, !p.isMuted)}>
                                    {p.isMuted
                                      ? <><Mic className="mr-2 h-3.5 w-3.5" />Unmute</>
                                      : <><MicOff className="mr-2 h-3.5 w-3.5" />Mute</>
                                    }
                                  </ContextMenuItem>
                                  <ContextMenuItem
                                    className="text-destructive focus:text-destructive"
                                    onClick={() => onKickVoiceParticipant?.(p.id, group.id)}
                                  >
                                    <UserMinus className="mr-2 h-3.5 w-3.5" />
                                    Kick from voice
                                  </ContextMenuItem>
                                </>
                              )}
                            </ContextMenuContent>
                          </ContextMenu>
                        )
                      })}
                    </div>
                  )}
                </div>
                </div>
              )
              })
            })()}
          </div>

        </div>


        {activeWatchGroupId && (
          <div className="flex-shrink-0 border-t border-border bg-sidebar p-2 shadow-sm">
            <div className="flex items-center gap-2 mb-2 px-1">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <div className="flex h-6 w-6 items-center justify-center rounded-md bg-white/8">
                  <Popcorn className="h-3.5 w-3.5 text-zinc-300" />
                </div>
                <div className="flex flex-col min-w-0">
                  <span className="text-[10px] font-bold text-zinc-300 uppercase tracking-wide">Watch Connected</span>
                  <span className="text-[11px] text-muted-foreground truncate font-medium">
                    {channel.groups.find(g => g.id === activeWatchGroupId)?.label || 'Watch Room'}
                  </span>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 rounded-lg hover:bg-destructive hover:text-white"
                onClick={() => onWatchLeave?.()}
                title="Disconnect from Watch"
              >
                <PhoneOff className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}

      </div>

      <ChannelEventsDialog
        open={eventsOpen}
        onOpenChange={setEventsOpen}
        channelId={channel.id}
        voiceGroups={voiceGroups}
        myId={myId}
        canManage={canManage}
      />

      <CreateEntityDialog
        open={showCreateGroup}
        onOpenChange={setShowCreateGroup}
        entityKind="group"
        contextLabel={channel.label}
        title={`Create group in ${channel.label}`}
        description="Add a new group under the current channel. The default general group stays at the top."
        nameLabel="Group name"
        namePlaceholder="Showroom updates"
        descriptionLabel="What is this group for?"
        descriptionPlaceholder="Focused updates, files, and follow-up discussion for this area."
        submitLabel="Create group"
        onSubmit={onCreateGroup ?? (() => {})}
      />

      <ChannelSettingsSheet
        key={channel.id}
        channel={channel}
        open={channelSettingsOpen}
        onOpenChange={setChannelSettingsOpen}
        onSave={(avatarUrl, bannerUrl) => onAssetSave?.(channel.id, avatarUrl, bannerUrl)}
        onDeleted={onChannelDeleted}
      />

      {groupSettingsTarget ? (
        <GroupSettingsSheet
          key={groupSettingsTarget.id}
          group={groupSettingsTarget}
          open={!!groupSettingsTarget}
          onOpenChange={(open) => { if (!open) setGroupSettingsTarget(null) }}
          channelId={channel.id}
          onDeleted={() => setGroupSettingsTarget(null)}
          onGroupUpdated={onGroupUpdated}
        />
      ) : null}

      {inviteTarget ? (
        <InviteMembersDialog
          key={inviteTarget.id}
          group={inviteTarget}
          channelId={channel.id}
          open={!!inviteTarget}
          onOpenChange={(open) => { if (!open) setInviteTarget(null) }}
          invitedIds={invitedByGroup[inviteTarget.id] ?? new Set()}
          onInvited={(userId) =>
            setInvitedByGroup((prev) => {
              const existing = prev[inviteTarget.id] ?? new Set<string>()
              return { ...prev, [inviteTarget.id]: new Set([...existing, userId]) }
            })
          }
        />
      ) : null}
    </>
  )
}
