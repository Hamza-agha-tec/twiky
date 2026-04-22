'use client'

import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Archive,
  Bell,
  BellOff,
  Globe,
  Hash,
  Lock,
  MoreHorizontal,
  Plus,
  Search,
  Trash2,
  Upload,
  Volume2,
} from 'lucide-react'
import { CreateEntityDialog } from '@/components/chat/create-entity-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { useUpdateChannel } from '@/hooks/use-channels'
import { useAddGroupMember, useGroupMembers, useDeleteGroup } from '@/hooks/use-groups'
import { useProfile, useUserFollowers } from '@/hooks/use-user'
import { filesApi } from '@/lib/files-api'
import { toast } from 'sonner'

export interface MockChannelGroup {
  id: string
  label: string
  description: string
  kind: 'text' | 'voice'
  membersLabel: string
  pinnedBy: string
  pinnedMessage: string
  unreadCount?: number
  hasUnread?: boolean
}

export interface WorkspaceChannel {
  id: string
  label: string
  description: string
  membersLabel: string
  groups: MockChannelGroup[]
  avatarUrl?: string
  bannerUrl?: string
}

interface BuildChannelGroupInput {
  channelId: string
  channelLabel: string
  label: string
  description?: string
  kind?: 'text' | 'voice'
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
}

interface ChannelsPanelProps {
  activeGroup?: string
  channel?: WorkspaceChannel | null
  channelAvatarUrl?: string | null
  onAssetSave?: (channelId: string, avatar: string | null, banner: string | null) => void
  onCreateGroup?: (values: { description: string; name: string }) => void
  onSelectGroup?: (groupId: string) => void
  visible?: boolean
}

const MEMBER_LABELS = ['26 online', '18 online', '12 online', '9 online', '6 online']

const CHANNEL_TONES = [
  'from-sky-500 via-cyan-500 to-blue-600',
  'from-emerald-500 via-teal-500 to-cyan-600',
  'from-orange-500 via-amber-500 to-yellow-500',
  'from-fuchsia-500 via-violet-500 to-indigo-600',
]

function toSlug(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'channel'
}

function getChannelTone(seed: string) {
  const index =
    seed.split('').reduce((total, char) => total + char.charCodeAt(0), 0) %
    CHANNEL_TONES.length
  return CHANNEL_TONES[index]
}

function getChannelMonogram(label: string) {
  const words = label.split(/\s+/).filter(Boolean)
  if (words.length >= 2) return `${words[0][0]}${words[1][0]}`.toUpperCase()
  return label.slice(0, 2).toUpperCase() || 'CH'
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
  }
}

export const MOCK_WORKSPACE_CHANNELS: WorkspaceChannel[] = [
  {
    ...buildWorkspaceChannel({
      id: 'twiky-studio',
      label: 'Twiky Studio',
      description: 'Main studio channel for broadcast updates, planning, and team-wide discussion.',
      index: 0,
    }),
    groups: [
      buildChannelGroup({
        channelId: 'twiky-studio',
        channelLabel: 'Twiky Studio',
        label: 'general',
        description: 'Default studio group for day-to-day updates and decisions that affect everyone.',
        membersLabel: '26 online',
        pinnedBy: 'Amina',
        pinnedMessage: 'Start broad studio updates here before splitting them into focused groups.',
        unreadCount: 2,
      }),
      buildChannelGroup({
        channelId: 'twiky-studio',
        channelLabel: 'Twiky Studio',
        label: 'announcements',
        description: 'Launch notes, milestones, and team-wide calls.',
        membersLabel: '26 online',
        pinnedBy: 'Amina',
        pinnedMessage: 'Major releases and leadership notes live here first.',
        unreadCount: 4,
      }),
      buildChannelGroup({
        channelId: 'twiky-studio',
        channelLabel: 'Twiky Studio',
        label: 'release-sync',
        description: 'Build status, QA signoff, and deployment coordination.',
        membersLabel: '14 online',
        pinnedBy: 'Zakaria',
        pinnedMessage: 'Keep release blockers and go-live decisions in this group.',
        hasUnread: true,
      }),
    ],
  },
  {
    ...buildWorkspaceChannel({
      id: 'design-lab',
      label: 'Design Lab',
      description: 'Design channel for critiques, component polish, and implementation handoff.',
      index: 1,
    }),
    groups: [
      buildChannelGroup({
        channelId: 'design-lab',
        channelLabel: 'Design Lab',
        label: 'general',
        description: 'Default design group for broad reviews before moving into narrower threads.',
        membersLabel: '18 online',
        pinnedBy: 'Sara',
        pinnedMessage: 'Use this group for shared design updates before opening focused discussions.',
      }),
      buildChannelGroup({
        channelId: 'design-lab',
        channelLabel: 'Design Lab',
        label: 'ui-critique',
        description: 'Interface review, spacing decisions, and motion polish.',
        membersLabel: '11 online',
        pinnedBy: 'Sara',
        pinnedMessage: 'Keep screenshots and action items tight and easy to scan.',
        unreadCount: 3,
      }),
      buildChannelGroup({
        channelId: 'design-lab',
        channelLabel: 'Design Lab',
        label: 'frontend-sync',
        description: 'Design-to-code handoff, component fixes, and polish requests.',
        membersLabel: '9 online',
        pinnedBy: 'Omar',
        pinnedMessage: 'Implementation notes should include exact surfaces and expected behavior.',
        hasUnread: true,
      }),
    ],
  },
  {
    ...buildWorkspaceChannel({
      id: 'game-room',
      label: 'Game Room',
      description: 'Gameplay channel for the future room system, playtests, and progression ideas.',
      index: 2,
    }),
    groups: [
      buildChannelGroup({
        channelId: 'game-room',
        channelLabel: 'Game Room',
        label: 'general',
        description: 'Default game group for high-level gameplay direction and room planning.',
        membersLabel: '12 online',
        pinnedBy: 'Rayan',
        pinnedMessage: 'Gameplay changes start in #general before they move into specialized groups.',
      }),
      buildChannelGroup({
        channelId: 'game-room',
        channelLabel: 'Game Room',
        label: 'showroom',
        description: 'Profile rooms, trophies, and decoration ideas for future rollout.',
        membersLabel: '8 online',
        pinnedBy: 'Rayan',
        pinnedMessage: 'Keep room concepts tied to profile surfaces and progression systems.',
        unreadCount: 2,
      }),
      buildChannelGroup({
        channelId: 'game-room',
        channelLabel: 'Game Room',
        label: 'playtests',
        description: 'Live test sessions and quick voice syncs.',
        kind: 'voice',
        membersLabel: '4 in voice',
        pinnedBy: 'Studio Bot',
        pinnedMessage: 'Drop notes back into #general after each test session.',
      }),
    ],
  },
]

export function getMockChannel(
  channelId: string,
  channels: WorkspaceChannel[] = MOCK_WORKSPACE_CHANNELS,
) {
  return channels.find((channel) => channel.id === channelId) ?? channels[0] ?? null
}

export function getMockGroup(
  channelId: string,
  groupId: string,
  channels: WorkspaceChannel[] = MOCK_WORKSPACE_CHANNELS,
) {
  const channel = getMockChannel(channelId, channels)
  if (!channel) return null
  return channel.groups.find((group) => group.id === groupId) ?? channel.groups[0] ?? null
}

function ChannelSettingsSheet({
  channel,
  open,
  onOpenChange,
  onSave,
  activeGroupId,
}: {
  channel: WorkspaceChannel
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave?: (avatarUrl: string | null, bannerUrl: string | null) => void
  activeGroupId?: string
}) {
  const [name, setName] = useState(channel.label)
  const [description, setDescription] = useState(channel.description)
  const [visibility, setVisibility] = useState<'public' | 'private'>('public')
  const [notifications, setNotifications] = useState(true)
  const [muteAll, setMuteAll] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const updateChannel = useUpdateChannel()
  const [bannerUrl, setBannerUrl] = useState<string | null>(channel.bannerUrl ?? null)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(channel.avatarUrl ?? null)
  const [bannerFile, setBannerFile] = useState<File | null>(null)
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [uploadingMedia, setUploadingMedia] = useState(false)
  const blobUrlsRef = useRef<string[]>([])
  const bannerRef = useRef<HTMLInputElement>(null)
  const avatarRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    return () => {
      blobUrlsRef.current.forEach((u) => URL.revokeObjectURL(u))
      blobUrlsRef.current = []
    }
  }, [])

  useEffect(() => {
    blobUrlsRef.current.forEach((u) => URL.revokeObjectURL(u))
    blobUrlsRef.current = []
    setName(channel.label)
    setDescription(channel.description)
    setVisibility('public')
    setNotifications(true)
    setMuteAll(false)
    setSaveError(null)
    setBannerUrl(channel.bannerUrl ?? null)
    setAvatarUrl(channel.avatarUrl ?? null)
    setBannerFile(null)
    setAvatarFile(null)
  }, [channel.avatarUrl, channel.bannerUrl, channel.description, channel.id, channel.label])

  function handleBannerChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const url = URL.createObjectURL(file)
    blobUrlsRef.current.push(url)
    setBannerFile(file)
    setBannerUrl(url)
  }

  function handleAvatarChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const url = URL.createObjectURL(file)
    blobUrlsRef.current.push(url)
    setAvatarFile(file)
    setAvatarUrl(url)
  }

  const tone = getChannelTone(channel.id)
  const monogram = getChannelMonogram(name || channel.label)

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[360px] overflow-y-auto p-0 sm:max-w-[360px]">
        <SheetHeader className="border-b border-border px-4 py-3">
          <SheetTitle className="text-[13px]">Channel Settings</SheetTitle>
        </SheetHeader>

        <div className="space-y-0 divide-y divide-border">
          {/* Banner + Avatar */}
          <div className="p-4 space-y-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Appearance
            </p>

            {/* Banner */}
            <div
              className="relative h-24 w-full cursor-pointer overflow-hidden rounded-2xl border border-border bg-muted"
              onClick={() => bannerRef.current?.click()}
            >
              {bannerUrl ? (
                <img src={bannerUrl} alt="Banner" className="h-full w-full object-cover" />
              ) : (
                <div className={cn('h-full w-full bg-gradient-to-br opacity-60', tone)} />
              )}
              <div className="absolute inset-0 flex items-center justify-center gap-1.5 bg-black/30 opacity-0 transition-opacity hover:opacity-100">
                <Upload className="h-4 w-4 text-white" />
                <span className="text-[11px] font-medium text-white">Upload banner</span>
              </div>
              <input ref={bannerRef} type="file" accept="image/*" className="hidden" onChange={handleBannerChange} />
            </div>

            {/* Avatar */}
            <div className="flex items-center gap-3">
              <div
                className="relative h-14 w-14 cursor-pointer flex-shrink-0 overflow-hidden rounded-2xl"
                onClick={() => avatarRef.current?.click()}
              >
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Avatar" className="h-full w-full object-cover" />
                ) : (
                  <div className={cn('flex h-full w-full items-center justify-center bg-gradient-to-br text-[14px] font-bold text-white', tone)}>
                    {monogram}
                  </div>
                )}
                <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity hover:opacity-100">
                  <Upload className="h-3.5 w-3.5 text-white" />
                </div>
                <input ref={avatarRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
              </div>
              <div>
                <p className="text-[12px] font-medium text-foreground">Channel avatar</p>
                <p className="text-[11px] text-muted-foreground">Click avatar to change. 256×256 min.</p>
              </div>
            </div>
          </div>

          {/* General */}
          <div className="p-4 space-y-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              General
            </p>
            <div className="space-y-1.5">
              <Label className="text-[11px]">Channel name</Label>
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
                className="min-h-[72px] rounded-xl text-[12px] leading-5"
              />
            </div>
          </div>

          {/* Access */}
          <div className="p-4 space-y-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Access
            </p>
            <div className="grid grid-cols-2 gap-2">
              {(['public', 'private'] as const).map((vis) => (
                <button
                  key={vis}
                  onClick={() => setVisibility(vis)}
                  className={cn(
                    'flex flex-col items-start gap-1.5 rounded-2xl border p-3 text-left transition-colors',
                    visibility === vis
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:bg-accent',
                  )}
                >
                  {vis === 'public' ? (
                    <Globe className="h-4 w-4 text-primary" />
                  ) : (
                    <Lock className="h-4 w-4 text-primary" />
                  )}
                  <span className="text-[11px] font-semibold capitalize text-foreground">{vis}</span>
                  <span className="text-[10px] leading-4 text-muted-foreground">
                    {vis === 'public' ? 'Anyone can find and join' : 'Invite-only access'}
                  </span>
                </button>
              ))}
            </div>
          </div>


          {/* Notifications */}
          <div className="p-4 space-y-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Notifications
            </p>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[12px] font-medium text-foreground">All notifications</p>
                <p className="text-[11px] text-muted-foreground">Get notified for every message</p>
              </div>
              <Switch checked={notifications} onCheckedChange={setNotifications} />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[12px] font-medium text-foreground">Mute channel</p>
                <p className="text-[11px] text-muted-foreground">Silence all activity here</p>
              </div>
              <Switch checked={muteAll} onCheckedChange={setMuteAll} />
            </div>
          </div>

          {/* Danger zone */}
          <div className="p-4 space-y-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-destructive">
              Danger zone
            </p>
            <div className="space-y-2">
              <button className="flex w-full items-center gap-2.5 rounded-2xl border border-border px-3 py-2.5 text-left transition-colors hover:bg-accent">
                <Archive className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-[12px] font-medium text-foreground">Archive channel</p>
                  <p className="text-[11px] text-muted-foreground">Read-only, hidden from sidebar</p>
                </div>
              </button>
              <button className="flex w-full items-center gap-2.5 rounded-2xl border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-left transition-colors hover:bg-destructive/10">
                <Trash2 className="h-4 w-4 text-destructive" />
                <div>
                  <p className="text-[12px] font-medium text-destructive">Delete channel</p>
                  <p className="text-[11px] text-muted-foreground">Permanently remove all data</p>
                </div>
              </button>
            </div>
          </div>

          {/* Save */}
          <div className="p-4 space-y-2">
            {saveError ? (
              <p className="text-[11px] text-destructive">{saveError}</p>
            ) : null}
            <Button
              className="w-full rounded-xl text-[12px]"
              disabled={updateChannel.isPending || uploadingMedia}
              onClick={async () => {
                setSaveError(null)
                setUploadingMedia(true)
                try {
                  let nextAvatar = avatarUrl
                  let nextBanner = bannerUrl
                  if (avatarFile) {
                    const { publicUrl } = await filesApi.uploadChannelLogo(channel.id, avatarFile)
                    nextAvatar = publicUrl
                  }
                  if (bannerFile) {
                    const { publicUrl } = await filesApi.uploadChannelBanner(channel.id, bannerFile)
                    nextBanner = publicUrl
                  }
                  const data: {
                    name: string
                    description?: string
                    access_type: 'PUBLIC' | 'PRIVATE'
                    avatar_url?: string
                    banner_url?: string
                  } = {
                    name: name.trim() || channel.label,
                    description: description.trim() || undefined,
                    access_type: visibility === 'private' ? 'PRIVATE' : 'PUBLIC',
                  }
                  if (nextAvatar?.startsWith('http')) data.avatar_url = nextAvatar
                  if (nextBanner?.startsWith('http')) data.banner_url = nextBanner
                  await updateChannel.mutateAsync({ id: channel.id, data })
                  blobUrlsRef.current.forEach((u) => URL.revokeObjectURL(u))
                  blobUrlsRef.current = []
                  setAvatarFile(null)
                  setBannerFile(null)
                  setAvatarUrl(nextAvatar?.startsWith('http') ? nextAvatar : null)
                  setBannerUrl(nextBanner?.startsWith('http') ? nextBanner : null)
                  onSave?.(
                    nextAvatar?.startsWith('http') ? nextAvatar : null,
                    nextBanner?.startsWith('http') ? nextBanner : null,
                  )
                  onOpenChange(false)
                } catch (err) {
                  const msg = err instanceof Error ? err.message : 'Failed to save'
                  setSaveError(msg)
                  toast.error(msg)
                } finally {
                  setUploadingMedia(false)
                }
              }}
            >
              {updateChannel.isPending || uploadingMedia ? 'Saving…' : 'Save changes'}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}

function GroupSettingsSheet({
  group,
  open,
  onOpenChange,
  channelId,
  onDeleted,
}: {
  group: MockChannelGroup
  open: boolean
  onOpenChange: (open: boolean) => void
  channelId?: string
  onDeleted?: () => void
}) {
  const [name, setName] = useState(group.label)
  const [description, setDescription] = useState(group.description)
  const [kind, setKind] = useState<'text' | 'voice'>(group.kind)
  const [notifications, setNotifications] = useState(true)
  const [mentionsOnly, setMentionsOnly] = useState(false)
  const [slowMode, setSlowMode] = useState(false)
  const [addMemberError, setAddMemberError] = useState<string | null>(null)
  const [memberSearch, setMemberSearch] = useState('')
  const addGroupMember = useAddGroupMember(group.id)
  const deleteGroup = useDeleteGroup(channelId ?? '')
  const { data: profile } = useProfile()
  const { data: followers = [] } = useUserFollowers(profile?.id)
  const { data: existingMembers = [] } = useGroupMembers(group.id)
  const existingMemberIds = new Set(existingMembers.filter((m) => m.user).map((m) => m.user.id))
  const memberSearchQuery = memberSearch.trim().toLowerCase()
  const searchedFollowers = memberSearchQuery
    ? followers.filter((f) => f.users.username?.toLowerCase().includes(memberSearchQuery))
    : []

  useEffect(() => {
    setName(group.label)
    setDescription(group.description)
    setKind(group.kind)
    setNotifications(true)
    setMentionsOnly(false)
    setSlowMode(false)
    setMemberSearch('')
    setAddMemberError(null)
  }, [group.description, group.id, group.kind, group.label])

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
                { value: 'voice', icon: Volume2, label: 'Voice', desc: 'Audio conversations' },
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

          {/* Add Members */}
          <div className="space-y-3 p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              Add Members
            </p>
            {addMemberError ? <p className="text-[11px] text-destructive">{addMemberError}</p> : null}
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={memberSearch}
                onChange={(e) => {
                  setMemberSearch(e.target.value)
                  setAddMemberError(null)
                }}
                placeholder="Search followers"
                className="h-9 rounded-xl pl-8 text-[12px]"
              />
            </div>
            <div className="space-y-1 max-h-52 overflow-y-auto">
              {!memberSearchQuery ? (
                <p className="py-1 text-[11px] text-muted-foreground">Search to find followers to add</p>
              ) : followers.length === 0 ? (
                <p className="py-1 text-[11px] text-muted-foreground">No followers to add</p>
              ) : searchedFollowers.length === 0 ? (
                <p className="py-1 text-[11px] text-muted-foreground">No matching followers</p>
              ) : searchedFollowers.map((f) => {
                const user = f.users
                const alreadyMember = existingMemberIds.has(user.id)
                return (
                  <div key={user.id} className="flex items-center gap-2.5 rounded-xl px-2 py-1.5 hover:bg-accent">
                    <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">
                      {user.avatar_url ? (
                        <img src={user.avatar_url} alt={user.username ?? 'User'} className="h-full w-full rounded-full object-cover" />
                      ) : (
                        user.username?.[0]?.toUpperCase() ?? '?'
                      )}
                    </div>
                    <p className="flex-1 truncate text-[12px] text-foreground">@{user.username}</p>
                    <button
                      disabled={alreadyMember || addGroupMember.isPending}
                      onClick={() => {
                        setAddMemberError(null)
                        addGroupMember.mutate(
                          { user_id: user.id },
                          { onError: (e) => setAddMemberError(e instanceof Error ? e.message : 'Failed') },
                        )
                      }}
                      className="rounded-lg border border-border px-2 py-0.5 text-[10px] font-semibold text-primary transition-colors hover:bg-primary/10 disabled:opacity-40"
                    >
                      {alreadyMember ? 'Added' : 'Add'}
                    </button>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Danger */}
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

          <div className="p-4">
            <Button className="w-full rounded-xl text-[12px]" onClick={() => onOpenChange(false)}>
              Done
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
  onAssetSave,
  onCreateGroup,
  onSelectGroup,
  visible = true,
}: ChannelsPanelProps) {
  const [showCreateGroup, setShowCreateGroup] = useState(false)
  const [channelSettingsOpen, setChannelSettingsOpen] = useState(false)
  const [groupSettingsTarget, setGroupSettingsTarget] = useState<MockChannelGroup | null>(null)

  if (!visible || !channel) return null

  const tone = getChannelTone(channel.id)
  const monogram = getChannelMonogram(channel.label)
  const displayAvatar = channelAvatarUrl ?? channel.avatarUrl ?? null

  return (
    <>
      <motion.div
        className="hidden h-full w-[216px] flex-shrink-0 flex-col border-r border-border bg-sidebar lg:flex"
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.28, ease: 'easeOut' }}
      >
        {/* Header */}
        <div className="border-b border-border px-3 py-3">
          <div className="flex items-center gap-2.5">
            <div
              className={cn(
                'flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-[10px] font-bold text-white shadow-sm',
                tone,
              )}
            >
              {displayAvatar ? (
                <img src={displayAvatar} alt={channel.label} className="h-full w-full rounded-xl object-cover" />
              ) : monogram}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[12.5px] font-semibold">{channel.label}</p>
              <p className="truncate text-[10px] text-muted-foreground">{channel.membersLabel}</p>
            </div>
            <div className="flex items-center gap-0.5">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 rounded-xl"
                onClick={() => setShowCreateGroup(true)}
              >
                <Plus className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 rounded-xl"
                onClick={() => setChannelSettingsOpen(true)}
              >
                <MoreHorizontal className="h-3.5 w-3.5" />
              </Button>
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
            {channel.groups.map((group, idx) => {
              const isActive = activeGroup === group.id
              const isDefault = group.label.toLowerCase() === 'general'
              const GroupIcon = group.kind === 'voice' ? Volume2 : Hash

              return (
                <motion.div
                  key={group.id}
                  className="group relative"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.05, duration: 0.2, ease: 'easeOut' }}
                >
                  <button
                    onClick={() => onSelectGroup?.(group.id)}
                    className={cn(
                      'relative flex w-full items-center gap-2 rounded-xl px-2.5 py-2 pr-9 text-left transition-all',
                      isActive
                        ? 'bg-primary/10 text-foreground'
                        : 'text-muted-foreground hover:bg-accent/70 hover:text-foreground',
                    )}
                  >
                    {isActive ? (
                      <span className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-primary" />
                    ) : null}

                    <GroupIcon
                      className={cn(
                        'h-3.5 w-3.5 flex-shrink-0',
                        isActive ? 'text-primary' : 'text-muted-foreground',
                      )}
                    />
                    <div className="flex min-w-0 flex-1 items-center gap-1.5">
                      <span className="truncate text-[12px] font-medium">{group.label}</span>
                      {isDefault ? (
                        <span className="rounded-full border border-border px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
                          Default
                        </span>
                      ) : null}
                      {group.unreadCount ? (
                        <span className="ml-auto rounded-full bg-primary px-1.5 py-0.5 text-[9px] font-bold text-primary-foreground">
                          {group.unreadCount}
                        </span>
                      ) : null}
                      {!group.unreadCount && group.hasUnread ? (
                        <span className="ml-auto h-1.5 w-1.5 rounded-full bg-primary" />
                      ) : null}
                    </div>
                  </button>

                  {/* Group 3-dot menu */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        className={cn(
                          'absolute right-1.5 top-1/2 z-10 -translate-y-1/2 flex h-6 w-6 items-center justify-center rounded-lg text-muted-foreground transition-all hover:bg-accent hover:text-foreground',
                          isActive ? 'opacity-75' : 'opacity-0 group-hover:opacity-100',
                        )}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <MoreHorizontal className="h-3.5 w-3.5" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuItem onClick={() => setGroupSettingsTarget(group)}>
                        Group settings
                      </DropdownMenuItem>
                      <DropdownMenuItem>Mark as read</DropdownMenuItem>
                      <DropdownMenuItem>Copy link</DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem>
                        {group.kind === 'voice' ? (
                          <><Hash className="mr-2 h-3.5 w-3.5" /> Convert to text</>
                        ) : (
                          <><Volume2 className="mr-2 h-3.5 w-3.5" /> Convert to voice</>
                        )}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="text-destructive focus:text-destructive">
                        Delete group
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </motion.div>
              )
            })}
          </div>
        </div>
      </motion.div>

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
        activeGroupId={activeGroup}
      />

      {groupSettingsTarget ? (
        <GroupSettingsSheet
          key={groupSettingsTarget.id}
          group={groupSettingsTarget}
          open={!!groupSettingsTarget}
          onOpenChange={(open) => { if (!open) setGroupSettingsTarget(null) }}
          channelId={channel.id}
          onDeleted={() => setGroupSettingsTarget(null)}
        />
      ) : null}
    </>
  )
}
