'use client'

import Image from 'next/image'
import {
  type ChangeEvent,
  KeyboardEvent,
  MouseEvent,
  ReactNode,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  ArrowLeft,
  Bookmark,
  Crown,
  Heart,
  ImagePlus,
  MessageSquare,
  MessageCircle,
  MoreHorizontal,
  Paperclip,
  Pin,
  PinOff,
  Plus,
  Reply,
  SendHorizontal,
  Share2,
  Shield,
  SmilePlus,
  Trash2,
  UserCheck,
  UserMinus,
  UserPlus,
  Users,
  X,
} from 'lucide-react'

import { FeedPostContextMenu } from '@/components/chat/feed-post-context-menu'
import { VerifiedBadge, isVerifiedAccountIdentity, isProPlan } from '@/components/chat/verified-badge'
import type { MockChannelGroup, WorkspaceChannel } from '@/components/chat/channels-panel'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Textarea } from '@/components/ui/textarea'
import { type ChatMessage } from '@/hooks/use-messaging'
import { useRemoveGroupMember, useUpdateGroupMemberRole } from '@/hooks/use-groups'
import { useProfile, usePrefetchUserProfile, useSendFollowRequest, useUserById, useUserFollowers, useUserFollowing, useUserPosts } from '@/hooks/use-user'
import { useAuth } from '@/context/AuthContext'
import { filesApi } from '@/lib/files-api'
import type { GroupMember, GroupMessageMention } from '@/lib/groups-api'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

interface FeedMedia {
  alt: string
  label: string
  src: string
}

const fallbackAvatar = '/placeholder-user.jpg'

function isProbablyImageUrl(url: string): boolean {
  try {
    const pathname = new URL(url, typeof window !== 'undefined' ? window.location.origin : 'http://localhost')
      .pathname.toLowerCase()
    return /\.(png|jpe?g|webp|gif|svg|avif|bmp|ico)$/i.test(pathname)
  } catch {
    return /\.(png|jpe?g|webp|gif|svg)(\?|$)/i.test(url)
  }
}

interface FeedReaction {
  emoji: string
  count: number
  mine: boolean
}

interface MentionOption {
  avatarUrl?: string | null
  entityId: string
  label: string
  role?: string
  type: 'user' | 'all'
}

interface MentionQuery {
  end: number
  query: string
  start: number
}

export interface FeedPost {
  id: string
  author: string
  authorId?: string
  authorAvatarUrl?: string | null
  authorIsVerified?: boolean
  authorIsPro?: boolean
  isSystem?: boolean
  role: string
  time: string
  body: string
  isOwn?: boolean
  media?: FeedMedia[]
  imageUrl?: string
  pinned?: boolean
  reactions: FeedReaction[]
  replyCount: number
  replyTo?: { author: string; body: string }
  tags?: string[]
}

function SystemFeedRow({ post }: { post: FeedPost }) {
  return (
    <div className="flex justify-center px-4 py-2">
      <div className="max-w-[80%] rounded-full border border-border/70 bg-muted/45 px-3 py-1.5 text-center">
        <p className="text-[12px] leading-5 text-muted-foreground">
          {post.body}
          <span className="ml-2 text-[10px] font-medium uppercase tracking-[0.06em] text-muted-foreground/70">
            {post.time}
          </span>
        </p>
      </div>
    </div>
  )
}

export interface FeedMemberProfile {
  id?: string
  accent: string
  avatarUrl: string | null
  bio: string
  email?: string | null
  focus: string
  followers: number
  following: number
  handle: string
  isPro?: boolean
  location: string
  name: string
  posts: number
  role: string
  status: string
  isVerified?: boolean
  websiteUrl?: string | null
  xUrl?: string | null
}

export interface FeedDirectConversationTarget {
  avatarUrl: string | null
  id: string
  initialMessages?: ChatMessage[]
  isOnline?: boolean
  isVerified?: boolean
  name: string
  status: string
}

const FEED_MEMBER_PROFILES: Record<string, Omit<FeedMemberProfile, 'avatarUrl' | 'name' | 'role'>> = {
  Amina: {
    accent: 'from-amber-500 via-orange-500 to-rose-500',
    bio: 'Keeps studio-wide priorities crisp, narrows scope quickly, and protects the product bar.',
    focus: 'Studio planning, release approval, and keeping the workspace readable.',
    followers: 1240,
    following: 89,
    handle: 'amina',
    location: 'Casablanca',
    posts: 156,
    status: 'Leading the current release',
  },
  Nora: {
    accent: 'from-violet-500 via-fuchsia-500 to-pink-500',
    bio: 'Pushes the experience toward clearer hierarchy, better writing, and more predictable interactions.',
    focus: 'User flows, feed readability, and product UX reviews.',
    followers: 820,
    following: 124,
    handle: 'nora',
    location: 'Rabat',
    posts: 94,
    status: 'Reviewing channel interaction patterns',
  },
  Omar: {
    accent: 'from-cyan-500 via-sky-500 to-blue-600',
    bio: 'Owns the shell implementation and keeps the direct-message surface fast and stable.',
    focus: 'Frontend delivery, component polish, and interaction cleanup.',
    followers: 645,
    following: 210,
    handle: 'omar',
    location: 'Casablanca',
    posts: 73,
    status: 'Shipping shell fixes',
  },
  Rayan: {
    accent: 'from-orange-500 via-amber-500 to-yellow-500',
    bio: 'Shapes the room system, progression hooks, and how profiles connect back into gameplay.',
    focus: 'Showroom roadmap, playtests, and profile-room planning.',
    followers: 930,
    following: 156,
    handle: 'rayan',
    location: 'Marrakesh',
    posts: 112,
    status: 'Planning the showroom rollout',
  },
  Sara: {
    accent: 'from-fuchsia-500 via-violet-500 to-indigo-600',
    bio: 'Drives interface critique, motion polish, and tighter visual systems across the app.',
    focus: 'Design reviews, typography, and interface density.',
    followers: 1080,
    following: 178,
    handle: 'sara',
    location: 'Tangier',
    posts: 138,
    status: 'Running the next critique pass',
  },
  'Studio Bot': {
    accent: 'from-slate-500 via-slate-600 to-slate-800',
    bio: 'Automated workspace assistant for launch checks, reminders, and coordination posts.',
    focus: 'Broadcast updates, reminders, and automated summaries.',
    followers: 450,
    following: 0,
    handle: 'studio-bot',
    location: 'System',
    posts: 2341,
    status: 'Online',
  },
  Zakaria: {
    accent: 'from-emerald-500 via-teal-500 to-cyan-600',
    bio: 'Owns launch coordination and clears the final blockers before changes go live.',
    focus: 'QA signoff, deployment timing, and release communication.',
    followers: 720,
    following: 93,
    handle: 'zakaria',
    location: 'Casablanca',
    posts: 88,
    status: 'Tracking go-live blockers',
  },
}

const QUICK_EMOJIS = ['👍', '❤️', '😂', '🔥', '🎉', '😮']
const ALL_EMOJIS = [
  '👍','❤️','😂','😮','😢','😡','🔥','🎉',
  '👀','✅','💯','🚀','⭐','💪','🙌','🤔',
  '👏','🙏','😍','🤣','😎','💀','🫡','🤯',
  '🥹','🫶','😤','🤝','👋','🎯','💡','🔔',
]

const ROLE_COLORS: Record<string, string> = {
  'Studio Lead':    'text-amber-500',
  'Automation':     'text-blue-400',
  'Release Manager':'text-emerald-500',
  'Design':         'text-fuchsia-500',
  'UX':             'text-violet-500',
  'Frontend':       'text-cyan-500',
  'Game Design':    'text-orange-400',
  'Voice':          'text-teal-500',
  'Admin':          'text-amber-500',
  'Member':         'text-primary',
}

function RoleBadge({ role, variant = 'feed' }: { role: string; variant?: 'feed' | 'profile' }) {
  const normalized = role.toLowerCase()
  const isOwner = normalized === 'owner'
  const isAdmin = normalized === 'admin'
  const iconSize = variant === 'profile' ? 'h-[9px] w-[9px]' : 'h-[8px] w-[8px]'
  const baseClass = variant === 'profile'
    ? 'inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.1em]'
    : 'inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.08em]'

  if (isOwner) {
    return (
      <span className={cn(baseClass, 'bg-amber-500/10 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400')}>
        <Crown className={cn(iconSize, 'fill-current')} strokeWidth={0} />
        {role}
      </span>
    )
  }

  if (isAdmin) {
    return (
      <span className={cn(baseClass, 'bg-violet-500/10 text-violet-600 dark:bg-violet-500/15 dark:text-violet-400')}>
        <Shield className={cn(iconSize, 'fill-current')} strokeWidth={0} />
        {role}
      </span>
    )
  }

  return (
    <span className={cn(baseClass, 'bg-muted text-muted-foreground')}>
      {role}
    </span>
  )
}

function normalizePersonName(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '')
}

function normalizeMentionName(value: string) {
  return value.trim().replace(/^@+/, '').toLowerCase()
}

function getMentionQuery(value: string, cursor: number): MentionQuery | null {
  const beforeCursor = value.slice(0, cursor)
  const match = beforeCursor.match(/(?:^|\s)@([a-zA-Z0-9_.-]*)$/)
  if (!match) return null

  return {
    end: cursor,
    query: match[1].toLowerCase(),
    start: cursor - match[1].length - 1,
  }
}

function extractMentionTargets(content: string, options: MentionOption[]): GroupMessageMention[] {
  const optionByLabel = new Map(options.map((option) => [normalizeMentionName(option.label), option]))
  const mentions = new Map<string, GroupMessageMention>()

  for (const match of content.matchAll(/(?:^|\s)@([a-zA-Z0-9_.-]+)/g)) {
    const option = optionByLabel.get(normalizeMentionName(match[1]))
    if (!option) continue

    const mention = { type: option.type, entityId: option.entityId }
    mentions.set(`${mention.type}:${mention.entityId}`, mention)
  }

  return Array.from(mentions.values())
}

function buildFeedMemberProfile(post: FeedPost, avatarUrl: string | null, handle?: string | null, id?: string): FeedMemberProfile {
  const defaults = FEED_MEMBER_PROFILES[post.author] ?? {
    accent: 'from-slate-500 via-slate-700 to-slate-900',
    bio: `${post.author} is active in ${post.role.toLowerCase()} work across this channel feed.`,
    focus: `Following up on ${post.role.toLowerCase()} updates inside the workspace.`,
    followers: 0,
    following: 0,
    handle: post.author.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    location: 'Workspace',
    posts: 0,
    status: 'Active in this channel',
  }

  return {
    ...defaults,
    id,
    avatarUrl,
    handle: handle ?? defaults.handle,
    name: post.author,
    role: post.role,
    isVerified: post.authorIsVerified ?? false,
    isPro: post.authorIsPro ?? false,
    websiteUrl: null,
    xUrl: null,
  }
}

export function buildStandaloneFeedMemberProfile({
  id,
  avatarUrl,
  handle,
  name,
  role = 'Member',
  status,
  isVerified = false,
}: {
  id?: string
  avatarUrl: string | null
  handle?: string | null
  name: string
  role?: string
  status?: string
  isVerified?: boolean
}): FeedMemberProfile {
  const defaults = FEED_MEMBER_PROFILES[name] ?? {
    accent: 'from-slate-500 via-slate-700 to-slate-900',
    bio: `${name} is active in ${role.toLowerCase()} work across direct and channel conversations.`,
    focus: `Following up on ${role.toLowerCase()} updates inside the workspace.`,
    followers: 0,
    following: 0,
    handle: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    location: 'Workspace',
    posts: 0,
    status: 'Active in chat',
  }

  return {
    ...defaults,
    id,
    avatarUrl,
    handle: handle ?? defaults.handle,
    name,
    role,
    status: status ?? defaults.status,
    isVerified,
    websiteUrl: null,
    xUrl: null,
  }
}

function normalizeExternalUrl(value?: string | null) {
  const trimmed = value?.trim()
  if (!trimmed) return null
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  return `https://${trimmed}`
}

function normalizeXUrl(value?: string | null) {
  const trimmed = value?.trim()
  if (!trimmed) return null
  if (/^https?:\/\//i.test(trimmed)) return trimmed

  const normalizedHandle = trimmed.replace(/^@+/, '').replace(/^x\.com\//i, '').replace(/^twitter\.com\//i, '')
  if (!normalizedHandle) return null
  return `https://x.com/${normalizedHandle}`
}

function displayExternalUrl(value: string) {
  return value.replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/\/$/, '')
}

function displayXHandle(value?: string | null) {
  const trimmed = value?.trim()
  if (!trimmed) return null
  if (/^https?:\/\//i.test(trimmed)) {
    return `@${trimmed
      .replace(/^https?:\/\//i, '')
      .replace(/^www\./i, '')
      .replace(/^(x\.com|twitter\.com)\//i, '')
      .replace(/\/.*$/, '')
      .replace(/^@+/, '')}`
  }

  return `@${trimmed
    .replace(/^@+/, '')
    .replace(/^x\.com\//i, '')
    .replace(/^twitter\.com\//i, '')}`
}

function resolveProfileDisplayName({
  fallback,
  fullname,
  username,
}: {
  fallback: string
  fullname?: string | null
  username?: string | null
}) {
  const cleanFullname = fullname?.trim()
  const cleanUsername = username?.trim()
  const cleanFallback = fallback.trim()

  if (cleanFullname && cleanFullname.toLowerCase() !== cleanUsername?.toLowerCase()) {
    return cleanFullname
  }

  if (cleanFallback && cleanFallback.toLowerCase() !== cleanUsername?.toLowerCase()) {
    return cleanFallback
  }

  return cleanFullname || cleanUsername || cleanFallback || 'User'
}

function createPixelRoomPreview() {
  const artwork = `<rect width='800' height='560' rx='38' fill='#0B1422'/><rect y='320' width='800' height='240' fill='#20384A'/><rect x='90' y='96' width='146' height='126' fill='#2D4B79'/><rect x='112' y='118' width='104' height='80' fill='#9EE6FF'/><rect x='298' y='84' width='118' height='92' fill='#F3B949'/><rect x='318' y='102' width='78' height='40' fill='#FFF0BF'/><rect x='112' y='372' width='264' height='88' fill='#4B6CB7'/><rect x='520' y='112' width='132' height='152' fill='#252F45'/><rect x='548' y='136' width='84' height='48' fill='#FFD369'/>`
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 800 560' fill='none'>${artwork}</svg>`
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`
}

const PIXEL_ROOM_PREVIEW_SRC = createPixelRoomPreview()

function escapeSvgText(value: string) {
  return value
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function createFeedArtwork({ title, subtitle, variant }: { title: string; subtitle: string; variant: 'board' | 'room' | 'studio' }) {
  const safeTitle = escapeSvgText(title)
  const safeSubtitle = escapeSvgText(subtitle)
  const artwork = variant === 'room'
    ? `<rect width='800' height='560' rx='38' fill='#0B1422'/><rect y='320' width='800' height='240' fill='#20384A'/><rect x='90' y='96' width='146' height='126' fill='#2D4B79'/><rect x='112' y='118' width='104' height='80' fill='#9EE6FF'/><rect x='298' y='84' width='118' height='92' fill='#F3B949'/><rect x='318' y='102' width='78' height='40' fill='#FFF0BF'/><rect x='112' y='372' width='264' height='88' fill='#4B6CB7'/><rect x='520' y='112' width='132' height='152' fill='#252F45'/><rect x='548' y='136' width='84' height='48' fill='#FFD369'/>`
    : variant === 'board'
    ? `<rect width='800' height='560' rx='38' fill='url(#bg)'/><rect x='54' y='52' width='178' height='456' rx='26' fill='#0F172A' fill-opacity='0.7'/><rect x='88' y='100' width='112' height='16' rx='8' fill='#9EE6FF'/><rect x='270' y='74' width='474' height='124' rx='26' fill='#F8FAFC'/><rect x='300' y='108' width='188' height='18' rx='9' fill='#0F172A' fill-opacity='0.82'/><rect x='270' y='226' width='224' height='230' rx='26' fill='#ECFEFF'/><rect x='522' y='226' width='222' height='104' rx='26' fill='#DBEAFE'/><rect x='522' y='352' width='222' height='104' rx='26' fill='#FDF2F8'/>`
    : `<rect width='800' height='560' rx='38' fill='url(#bg)'/><rect x='62' y='76' width='676' height='92' rx='26' fill='#0F172A' fill-opacity='0.62'/><rect x='92' y='108' width='164' height='18' rx='9' fill='#DBEAFE'/><rect x='62' y='208' width='204' height='276' rx='26' fill='#ECFEFF'/><rect x='298' y='208' width='204' height='276' rx='26' fill='#E0F2FE'/><rect x='534' y='208' width='204' height='276' rx='26' fill='#F8FAFC'/>`
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 800 560' fill='none'><defs><linearGradient id='bg' x1='0' x2='800' y1='0' y2='560' gradientUnits='userSpaceOnUse'><stop stop-color='#0F172A'/><stop offset='0.48' stop-color='#155E75'/><stop offset='1' stop-color='#38BDF8'/></linearGradient></defs>${artwork}<text x='60' y='504' fill='white' font-family='Arial, Helvetica, sans-serif' font-size='34' font-weight='700'>${safeTitle}</text><text x='60' y='536' fill='rgba(255,255,255,0.76)' font-family='Arial, Helvetica, sans-serif' font-size='19'>${safeSubtitle}</text></svg>`
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`
}

const FEED_MEDIA_LIBRARY = {
  releaseBoard: { alt: 'Studio release board', label: 'Release board', src: createFeedArtwork({ title: 'Release Sync', subtitle: 'Launch blockers and final checklist', variant: 'studio' }) },
  roomFrame:    { alt: 'Pixel room frame',     label: 'Pixel room',    src: createFeedArtwork({ title: 'Profile Room Frame', subtitle: 'Reserved shell for game mode', variant: 'room' }) },
  uiCritique:   { alt: 'UI critique board',    label: 'UI critique',   src: createFeedArtwork({ title: 'Compact Shell Review', subtitle: 'Tighter profile, settings, and feed', variant: 'board' }) },
} satisfies Record<string, FeedMedia>


function buildFallbackPosts(channel: WorkspaceChannel, group: MockChannelGroup): FeedPost[] {
  return [{
    id: `${group.id}-welcome`,
    author: 'Studio Bot',
    role: 'Automation',
    time: 'Now',
    body: group.label.toLowerCase() === 'general'
      ? `Welcome to ${channel.label}. Default group for broad coordination.`
      : `${group.label} group is ready. Use it for focused updates inside ${channel.label}.`,
    pinned: true,
    reactions: [{ emoji: '👋', count: 1, mine: false }],
    replyCount: 0,
  }]
}

function getSuggestedAttachment(channel: WorkspaceChannel, group: MockChannelGroup) {
  if (channel.id === 'game-room' || group.label.toLowerCase().includes('showroom')) return FEED_MEDIA_LIBRARY.roomFrame
  if (channel.id === 'design-lab') return FEED_MEDIA_LIBRARY.uiCritique
  return FEED_MEDIA_LIBRARY.releaseBoard
}

function EmojiPickerPopover({
  onSelect,
  trigger,
}: {
  onSelect: (emoji: string) => void
  trigger: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent className="w-64 p-2" align="start">
        <div className="grid grid-cols-8 gap-0.5">
          {ALL_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              onClick={() => { onSelect(emoji); setOpen(false) }}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-lg transition-colors hover:bg-accent"
            >
              {emoji}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}

function HoverActionBar({
  onQuickReact,
  onReply,
  onPin,
  onDelete,
  isPinned,
  isOwn,
}: {
  onQuickReact: (emoji: string) => void
  onReply: () => void
  onPin: () => void
  onDelete?: () => void
  isPinned?: boolean
  isOwn?: boolean
}) {
  return (
    <div className="absolute -top-5 right-3 z-10 flex items-center overflow-hidden rounded-xl border border-border bg-background shadow-lg">
      {QUICK_EMOJIS.map((emoji) => (
        <button
          key={emoji}
          onClick={() => onQuickReact(emoji)}
          className="flex h-8 w-8 items-center justify-center text-[16px] transition-colors hover:bg-accent"
        >
          {emoji}
        </button>
      ))}
      <div className="mx-1 h-5 w-px bg-border" />
      <button
        onClick={onReply}
        title="Reply"
        className="flex h-8 w-8 items-center justify-center text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      >
        <Reply className="h-3.5 w-3.5" />
      </button>
      <button
        onClick={onPin}
        title={isPinned ? 'Unpin' : 'Pin'}
        className="flex h-8 w-8 items-center justify-center text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      >
        {isPinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
      </button>
      {isOwn ? (
        <button
          onClick={onDelete}
          title="Delete"
          className="flex h-8 w-8 items-center justify-center text-muted-foreground transition-colors hover:bg-accent hover:text-destructive"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      ) : null}
      <EmojiPickerPopover
        onSelect={onQuickReact}
        trigger={
          <button
            title="More reactions"
            className="flex h-8 w-8 items-center justify-center text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <SmilePlus className="h-3.5 w-3.5" />
          </button>
        }
      />
    </div>
  )
}


function MessageRow({
  authorAvatarUrl,
  canMessageAuthor,
  memberProfile,
  messagePending,
  onMessageAuthor,
  post,
  isGrouped,
  myAvatarUrl,
  onReact,
  onReply,
  onPin,
  onDelete,
  onContextMenu,
}: {
  authorAvatarUrl?: string | null
  canMessageAuthor: boolean
  memberProfile: FeedMemberProfile
  messagePending: boolean
  onMessageAuthor: () => void
  post: FeedPost
  isGrouped: boolean
  myAvatarUrl?: string | null
  onReact: (emoji: string) => void
  onReply: () => void
  onPin: () => void
  onDelete: () => void
  onContextMenu: (e: MouseEvent) => void
}) {
  const [profileOpen, setProfileOpen] = useState(false)
  const [isFollowing, setIsFollowing] = useState(false)

  const prefetchUserProfile = usePrefetchUserProfile()
  // Only fetch when profile card is open — prefetch on hover so data is ready by click time
  const { data: realUser } = useUserById(profileOpen ? memberProfile.id : undefined)
  const { data: followersData } = useUserFollowers(profileOpen ? memberProfile.id : undefined)
  const { data: followingData } = useUserFollowing(profileOpen ? memberProfile.id : undefined)

  const resolvedProfile: FeedMemberProfile = {
    ...memberProfile,
    name: resolveProfileDisplayName({
      fallback: memberProfile.name,
      fullname: realUser?.fullname ?? realUser?.full_name,
      username: realUser?.username,
    }),
    handle: realUser?.username ?? memberProfile.handle,
    bio: realUser?.bio ?? memberProfile.bio,
    status: realUser?.status ?? memberProfile.status,
    avatarUrl: realUser?.avatar_url ?? memberProfile.avatarUrl,
    websiteUrl: realUser?.website_url ?? memberProfile.websiteUrl,
    xUrl: realUser?.x_url ?? memberProfile.xUrl,
    followers: followersData?.length ?? memberProfile.followers,
    following: followingData?.length ?? memberProfile.following,
    isVerified: isVerifiedAccountIdentity({
      email: realUser?.email,
      id: realUser?.id ?? memberProfile.id,
      is_verified: realUser?.is_verified,
      isVerified: memberProfile.isVerified,
      sub_plan: realUser?.sub_plan,
    }),
  }

  const roleColor = ROLE_COLORS[post.role] ?? 'text-primary'
  const initial = post.author[0].toUpperCase()
  const displayAvatar = post.isOwn
    ? (authorAvatarUrl ?? myAvatarUrl ?? resolvedProfile.avatarUrl ?? null)
    : (authorAvatarUrl ?? resolvedProfile.avatarUrl ?? null)

  function handleMessageClick() {
    onMessageAuthor()
    setProfileOpen(false)
  }

  function formatCount(n: number) {
    if (n >= 1000) return `${(n / 1000).toFixed(1)}K`
    return String(n)
  }

  return (
    <>
      <Popover open={profileOpen} onOpenChange={setProfileOpen}>
        <div
          className={cn(
            'group relative flex gap-3 px-4 transition-colors hover:bg-accent/20',
            isGrouped ? 'py-0.5' : 'mt-4 pt-1 pb-0.5',
          )}
          onContextMenu={onContextMenu}
        >
          <div className="mt-0.5 w-10 flex-shrink-0">
            <PopoverTrigger asChild>
              <button
                onMouseEnter={() => memberProfile.id && prefetchUserProfile(memberProfile.id)}
                className="flex h-10 w-10 cursor-pointer overflow-hidden rounded-full ring-2 ring-background focus:outline-none"
                aria-label={`Open ${post.author} actions`}
              >
                <img src={displayAvatar ?? undefined} alt={post.author} className="h-full w-full rounded-full object-cover" />
              </button>
            </PopoverTrigger>
          </div>

          <div className="min-w-0 flex-1">
            {!isGrouped ? (
              <div className="mb-0.5 flex items-baseline gap-2">
                <button
                  onMouseEnter={() => memberProfile.id && prefetchUserProfile(memberProfile.id)}
                  onClick={() => setProfileOpen(true)}
                  className={cn('inline-flex items-center gap-1 text-[14px] font-semibold leading-none hover:underline', roleColor)}
                >
                  {post.author}
                  {resolvedProfile.isVerified ? <VerifiedBadge size="xs" variant={isProPlan(realUser?.sub_plan) ? 'pro' : 'standard'} /> : null}
                </button>
                <RoleBadge role={post.role} />
                <span className="text-[11px] text-muted-foreground">{post.time}</span>
                {post.pinned ? <Pin className="h-3 w-3 text-primary" /> : null}
              </div>
            ) : null}

            {post.replyTo ? (
              <div className="mb-1 flex cursor-pointer items-center gap-2 opacity-70 transition-opacity hover:opacity-100">
                <div className="ml-2 h-3 w-3 flex-shrink-0 rounded-tl border-l-2 border-t-2 border-muted-foreground" />
                <span className="text-[11px] font-semibold text-muted-foreground">{post.replyTo.author}</span>
                <span className="truncate text-[11px] text-muted-foreground">{post.replyTo.body}</span>
              </div>
            ) : null}

            {post.body ? (
              <p className="text-[13.5px] leading-[1.55] text-foreground">{post.body}</p>
            ) : null}

            {(post.media?.length || post.imageUrl) ? (
              <div className={cn('mt-2 flex flex-wrap gap-2')}>
                {post.imageUrl ? (
                  isProbablyImageUrl(post.imageUrl) ? (
                    <img
                      src={post.imageUrl}
                      alt="Uploaded"
                      className="max-h-32 max-w-[200px] rounded-xl"
                    />
                  ) : (
                    <a
                      href={post.imageUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 rounded-xl border border-border bg-muted/50 px-3 py-2 text-[12px] font-medium text-primary hover:bg-muted"
                    >
                      <Paperclip className="h-4 w-4 shrink-0" />
                      Open attachment
                    </a>
                  )
                ) : null}
                {post.media?.map((media) => (
                  <div key={media.label} className="relative h-36 w-56 overflow-hidden rounded-xl border border-border">
                    <Image src={media.src} alt={media.alt} fill unoptimized sizes="300px" className="object-cover" />
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-3 py-2">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.07em] text-white/90">{media.label}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}

            {post.tags?.length ? (
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {post.tags.map((tag) => (
                  <span key={tag} className="rounded-full border border-border bg-background px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.07em] text-muted-foreground">
                    {tag}
                  </span>
                ))}
              </div>
            ) : null}

            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              {post.reactions.map((r) => (
                <motion.button
                  key={r.emoji}
                  whileTap={{ scale: 0.85 }}
                  onClick={() => onReact(r.emoji)}
                  className={cn(
                    'flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[13px] transition-colors',
                    r.mine
                      ? 'border-primary/40 bg-primary/10 text-primary'
                      : 'border-border bg-background hover:border-primary/30 hover:bg-primary/5',
                  )}
                >
                  {r.emoji}
                  <span className="text-[11px] font-semibold">{r.count}</span>
                </motion.button>
              ))}

              <EmojiPickerPopover
                onSelect={onReact}
                trigger={
                  <button className="flex items-center gap-1 rounded-full border border-dashed border-border px-2.5 py-1 text-[12px] text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:border-primary/30 hover:bg-primary/5 hover:text-primary">
                    <SmilePlus className="h-3.5 w-3.5" />
                  </button>
                }
              />

              {post.replyCount > 0 ? (
                <button
                  onClick={onReply}
                  className="flex items-center gap-1.5 rounded-full px-2 py-1 text-[11px] font-medium text-primary opacity-0 transition-opacity hover:underline group-hover:opacity-100"
                >
                  <Reply className="h-3.5 w-3.5" />
                  {post.replyCount} {post.replyCount === 1 ? 'reply' : 'replies'}
                </button>
              ) : null}
            </div>
          </div>

          <div className="absolute -top-5 right-3 z-10 hidden group-hover:block">
            <HoverActionBar
              onQuickReact={onReact}
              onReply={onReply}
              onPin={onPin}
              onDelete={onDelete}
              isPinned={post.pinned}
              isOwn={post.isOwn}
            />
          </div>
        </div>

        <PopoverContent
          side="right"
          align="start"
          sideOffset={8}
          className="w-[320px] overflow-hidden rounded-2xl border border-border/60 p-0 shadow-2xl"
        >
          {/* Gradient banner */}
          <div className={cn('h-[72px] w-full bg-gradient-to-r', resolvedProfile.accent)} />

          <div className="bg-popover px-4 pb-4">
            {/* Avatar row */}
            <div className="-mt-11 mb-3 flex items-end justify-between">
              <div className="relative">
                <div className="h-[80px] w-[80px] overflow-hidden rounded-full border-[5px] border-popover bg-muted shadow-sm">
                  {displayAvatar ? (
                    <img
                      src={displayAvatar ?? fallbackAvatar}
                      alt={post.author}
                      className="h-full w-full rounded-full object-cover"
                      onError={(e) => {
                        if (!e.currentTarget.src.endsWith(fallbackAvatar)) e.currentTarget.src = fallbackAvatar
                      }}
                    />
                  ) : (
                    <span className={cn(
                      'flex h-full w-full items-center justify-center text-[22px] font-black',
                      post.isOwn ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground',
                    )}>
                      {initial}
                    </span>
                  )}
                </div>
                <span className="absolute bottom-1 right-0.5 h-[14px] w-[14px] rounded-full border-[2.5px] border-popover bg-emerald-500" />
              </div>

              {!post.isOwn ? (
                <motion.div whileTap={{ scale: 0.96 }}>
                  <Button
                    size="sm"
                    className={cn(
                      'h-8 gap-1.5 rounded-[6px] px-4 text-[12px] font-semibold transition-all duration-150',
                      isFollowing
                        ? 'border border-border bg-transparent text-foreground hover:bg-muted/50'
                        : '',
                    )}
                    onClick={() => setIsFollowing((v) => !v)}
                  >
                    {isFollowing
                      ? <><UserCheck className="h-3.5 w-3.5" />Following</>
                      : <><UserPlus className="h-3.5 w-3.5" />Follow</>
                    }
                  </Button>
                </motion.div>
              ) : null}
            </div>

            {/* Identity */}
            <p className="text-[19px] font-black leading-none text-foreground">{resolvedProfile.name}</p>
            <p className="mt-1 text-[12px] text-muted-foreground">@{resolvedProfile.handle}</p>

            {/* Inner content card */}
            <div className="mt-3 rounded-lg bg-muted/50 px-3 py-3 space-y-3 text-[13px]">

              {/* Status */}
              <div className="flex items-center gap-2 text-foreground/80">
                <span className="h-[8px] w-[8px] flex-shrink-0 rounded-full bg-emerald-500" />
                {resolvedProfile.status}
              </div>

              {/* Stats */}
              {!post.isOwn ? (
                <>
                  <div className="h-px bg-border/40" />
                  <div className="flex items-center gap-5">
                    <div>
                      <p className="text-[15px] font-bold text-foreground">{formatCount(resolvedProfile.followers)}</p>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Followers</p>
                    </div>
                    <div>
                      <p className="text-[15px] font-bold text-foreground">{formatCount(resolvedProfile.following)}</p>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Following</p>
                    </div>
                    <div>
                      <p className="text-[15px] font-bold text-foreground">{formatCount(resolvedProfile.posts)}</p>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Posts</p>
                    </div>
                  </div>
                </>
              ) : null}

              <div className="h-px bg-border/40" />

              {/* About Me */}
              <div>
                <p className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">About Me</p>
                <p className="text-[12px] leading-[1.65] text-foreground/80">{resolvedProfile.bio}</p>
              </div>

              <div className="h-px bg-border/40" />

              {/* Role */}
              <div className="flex items-center">
                <span className={cn(
                  'inline-flex items-center gap-1.5 rounded-[5px] bg-background/70 px-2 py-1 text-[11px] font-semibold',
                  roleColor,
                )}>
                  <span className="h-2 w-2 rounded-full bg-current" />
                  {resolvedProfile.role}
                </span>
              </div>
            </div>

            {/* CTA */}
            {!post.isOwn ? (
              <Button
                className="mt-3 h-9 w-full rounded-[8px] text-[13px] font-semibold"
                onClick={handleMessageClick}
                disabled={messagePending}
              >
                <MessageSquare className="mr-2 h-4 w-4" />
                {messagePending ? 'Opening…' : 'Send Message'}
              </Button>
            ) : null}
          </div>
        </PopoverContent>
      </Popover>
    </>
  )
}

interface FeedProfileSelection {
  canMessage: boolean
  post: FeedPost
  profile: FeedMemberProfile
}

function formatCompactCount(value: number) {
  if (value >= 1000) return `${(value / 1000).toFixed(1)}K`
  return String(value)
}

function formatProfileTime(value: string) {
  const upper = value.toUpperCase()
  if (upper.includes(':')) return `${upper} TODAY`
  return upper
}

function formatUserPostTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'RECENTLY'

  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMinutes = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMinutes / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffMinutes < 1) return 'JUST NOW'
  if (diffMinutes < 60) return `${diffMinutes}M AGO`
  if (diffHours < 24) return `${diffHours}H AGO`
  if (diffDays < 7) return `${diffDays}D AGO`

  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }).toUpperCase()
}

export function FeedMemberProfileView({
  currentGroupLabel,
  isOwn,
  memberProfile,
  messagePending,
  onBack,
  onMessage,
  posts,
  showMessageAction = true,
}: {
  currentGroupLabel: string
  isOwn: boolean
  memberProfile: FeedMemberProfile
  messagePending: boolean
  onBack: () => void
  onMessage: () => void
  posts: FeedPost[]
  showMessageAction?: boolean
}) {
  const [activeTab, setActiveTab] = useState<'posts' | 'articles' | 'pixel-room' | 'saved'>('posts')
  const [followRequested, setFollowRequested] = useState(false)
  const [pixelRoomLiked, setPixelRoomLiked] = useState(false)
  const [followSheet, setFollowSheet] = useState<'followers' | 'following' | null>(null)
  const [viewingUser, setViewingUser] = useState<FeedMemberProfile | null>(null)

  const { user: authUser } = useAuth()
  const { data: currentUser } = useProfile()
  const { data: realUser } = useUserById(memberProfile.id)
  const { data: followersData } = useUserFollowers(memberProfile.id)
  const { data: followingData } = useUserFollowing(memberProfile.id)
  const sendFollowRequest = useSendFollowRequest()
  const prefetchUserProfile = usePrefetchUserProfile()
  const {
    data: backendPosts = [],
    isError: backendPostsError,
    isLoading: backendPostsLoading,
  } = useUserPosts(memberProfile.id)

  const resolvedProfile: FeedMemberProfile = {
    ...memberProfile,
    name: resolveProfileDisplayName({
      fallback: memberProfile.name,
      fullname: realUser?.fullname ?? realUser?.full_name,
      username: realUser?.username,
    }),
    handle: realUser?.username ?? memberProfile.handle,
    bio: realUser?.bio ?? memberProfile.bio,
    status: realUser?.status ?? memberProfile.status,
    avatarUrl: realUser?.avatar_url ?? memberProfile.avatarUrl,
    websiteUrl: realUser?.website_url ?? memberProfile.websiteUrl,
    xUrl: realUser?.x_url ?? memberProfile.xUrl,
    followers: followersData?.length ?? memberProfile.followers,
    following: followingData?.length ?? memberProfile.following,
    posts: memberProfile.id ? backendPosts.length : memberProfile.posts,
    isVerified: isVerifiedAccountIdentity(
      {
        email: realUser?.email,
        id: realUser?.id ?? memberProfile.id,
        is_verified: realUser?.is_verified,
        isVerified: memberProfile.isVerified,
        sub_plan: realUser?.sub_plan,
      },
      {
        email: currentUser?.email ?? authUser?.email,
        id: currentUser?.id,
        is_verified: currentUser?.is_verified,
        sub_plan: currentUser?.sub_plan,
      },
    ),
  }

  const bannerImage = realUser?.banner ?? null
  const avatarImage = resolvedProfile.avatarUrl ?? null
  const isProfilePro = isProPlan(realUser?.sub_plan)

  const fallbackPosts = posts.slice(0, 3)
  const profilePosts = memberProfile.id
    ? backendPosts.map((post) => ({
        id: post.id,
        author: realUser?.fullname || post.users?.username || resolvedProfile.name,
        authorId: post.user_id,
        body: post.caption ?? '',
        imageUrl: post.media_urls?.[0],
        media: post.media_urls?.[0]
          ? [{ alt: 'Post media', label: 'Post media', src: post.media_urls[0] }]
          : undefined,
        reactions: [],
        replyCount: 0,
        role: resolvedProfile.role,
        time: formatUserPostTime(post.created_at),
      }))
    : fallbackPosts

  const roleColor = ROLE_COLORS[resolvedProfile.role] ?? 'text-primary'
  const websiteHref = normalizeExternalUrl(resolvedProfile.websiteUrl)
  const xHref = normalizeXUrl(resolvedProfile.xUrl)
  const xHandle = displayXHandle(resolvedProfile.xUrl)
  const isAlreadyFollowing = Boolean(
    currentUser?.id &&
    followersData?.some((follower) => follower.follower_id === currentUser.id || follower.users?.id === currentUser.id),
  )
  const showFollowButton = Boolean(
    !isOwn &&
    showMessageAction &&
    currentUser?.id &&
    followersData &&
    memberProfile.id &&
    memberProfile.id !== currentUser?.id &&
    !isAlreadyFollowing &&
    !followRequested,
  )

  async function handleFollow() {
    if (!memberProfile.id) return
    try {
      await sendFollowRequest.mutateAsync(memberProfile.id)
      setFollowRequested(true)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not send follow request')
    }
  }

  if (viewingUser !== null) {
    return (
      <FeedMemberProfileView
        currentGroupLabel={currentGroupLabel}
        isOwn={false}
        memberProfile={viewingUser}
        messagePending={false}
        onBack={() => setViewingUser(null)}
        onMessage={() => {}}
        posts={[]}
        showMessageAction={showMessageAction}
      />
    )
  }

  if (followSheet !== null) {
    const title = followSheet === 'followers' ? 'Followers' : 'Following'
    const users = followSheet === 'followers'
      ? (followersData ?? []).map((r) => ({ id: r.follower_id, username: r.users?.username ?? 'Unknown', avatar_url: r.users?.avatar_url ?? null, bio: r.users?.bio ?? null, is_verified: r.users?.is_verified ?? false, sub_plan: r.users?.sub_plan ?? null }))
      : (followingData ?? []).map((r) => ({ id: r.following_id, username: r.users?.username ?? 'Unknown', avatar_url: r.users?.avatar_url ?? null, bio: r.users?.bio ?? null, is_verified: r.users?.is_verified ?? false, sub_plan: r.users?.sub_plan ?? null }))

    return (
      <div className="flex flex-1 flex-col overflow-y-auto bg-background text-foreground">
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <button
            type="button"
            onClick={() => setFollowSheet(null)}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <span className="text-[13px] font-semibold text-foreground">{title}</span>
          <span className="ml-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
            {users.length}
          </span>
        </div>

        {users.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-center text-muted-foreground">
            <Users className="mb-3 h-8 w-8 opacity-30" />
            <p className="text-[12px]">No {title.toLowerCase()} yet</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {users.map((u) => (
              <button
                key={u.id}
                type="button"
                onMouseEnter={() => prefetchUserProfile(u.id)}
                onClick={() => setViewingUser(buildStandaloneFeedMemberProfile({ id: u.id, avatarUrl: u.avatar_url, name: u.username, handle: u.username, isVerified: u.is_verified }))}
                className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-accent"
              >
                <div className="h-9 w-9 flex-shrink-0 overflow-hidden rounded-full bg-muted">
                  {u.avatar_url
                    ? <img src={u.avatar_url} alt={u.username} className="h-full w-full object-cover" />
                    : <span className="flex h-full w-full items-center justify-center text-[13px] font-bold text-muted-foreground">{u.username[0]?.toUpperCase()}</span>
                  }
                </div>
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1 truncate text-[12px] font-semibold text-foreground">
                    @{u.username}
                    {u.is_verified ? <VerifiedBadge size="xs" variant={isProPlan(u.sub_plan) ? 'pro' : 'standard'} /> : null}
                  </p>
                  {u.bio ? <p className="truncate text-[11px] text-muted-foreground">{u.bio}</p> : null}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-1 flex-col overflow-y-auto bg-background text-foreground">
      {/* Banner */}
      <div className="relative h-[118px] flex-shrink-0 overflow-hidden">
        {bannerImage
          ? <img src={bannerImage} alt="" className="h-full w-full object-cover" />
          : <div className={cn('absolute inset-0 bg-gradient-to-br', resolvedProfile.accent)} />
        }
        <div className="absolute inset-0 bg-gradient-to-b from-black/10 to-black/70" />
        <button
          type="button"
          onClick={onBack}
          className="absolute left-3 top-3 inline-flex h-7 items-center gap-1 rounded-full border border-white/20 bg-black/40 px-2.5 text-[10px] font-semibold text-white/90 backdrop-blur-sm transition-colors hover:bg-black/55"
        >
          <ArrowLeft className="h-3 w-3" />
          Back
        </button>
      </div>

      {/* Identity */}
      <motion.div
        className="px-4 pb-3"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05, duration: 0.3, ease: 'easeOut' }}
      >
        <div className="-mt-9 mb-2.5 flex items-end justify-between">
          <div className="relative">
            <Avatar className="h-[68px] w-[68px] overflow-hidden rounded-full border-[3px] border-sidebar bg-muted shadow-xl">
              <AvatarImage src={avatarImage ?? undefined} alt={resolvedProfile.name} className="h-full w-full rounded-full object-cover" />
              <AvatarFallback className="rounded-full bg-muted text-[18px] font-bold text-foreground">
                {resolvedProfile.name[0]?.toUpperCase() ?? 'U'}
              </AvatarFallback>
            </Avatar>
            <span className="absolute bottom-0.5 right-0.5 h-[12px] w-[12px] rounded-full border-2 border-sidebar bg-emerald-400" />
          </div>

          {!isOwn && showMessageAction ? (
            <div className="flex items-center gap-2 pb-0.5">
              <button
                type="button"
                onClick={onMessage}
                disabled={messagePending}
                className="inline-flex h-7 items-center gap-1.5 rounded-md border border-border bg-transparent px-3 text-[11px] font-medium text-muted-foreground transition-colors hover:border-border/60 hover:text-foreground disabled:opacity-50"
              >
                <MessageSquare className="h-3 w-3" />
                {messagePending ? 'Opening…' : 'Message'}
              </button>
              {showFollowButton ? (
                <button
                  type="button"
                  onClick={() => void handleFollow()}
                  disabled={sendFollowRequest.isPending}
                  className="inline-flex h-7 items-center gap-1.5 rounded-md bg-foreground px-3 text-[11px] font-medium text-background transition-colors hover:bg-foreground/90 disabled:opacity-60"
                >
                  <UserPlus className="h-3 w-3" />
                  {sendFollowRequest.isPending ? 'Sending...' : 'Follow'}
                </button>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-[19px] font-black leading-none tracking-tight text-foreground">{resolvedProfile.name}</h1>
          {resolvedProfile.isVerified ? <VerifiedBadge size="sm" variant={isProfilePro ? 'pro' : 'standard'} /> : null}
          <RoleBadge role={resolvedProfile.role} variant="profile" />
        </div>
        <p className="mt-0.5 text-[11px] text-muted-foreground">@{resolvedProfile.handle}</p>
        <div className="mt-2 flex items-center gap-3.5 text-[11px]">
          <button
            onClick={() => setFollowSheet('followers')}
            className="group text-left hover:opacity-75 transition-opacity"
          >
            <span className="font-bold text-foreground">{formatCompactCount(resolvedProfile.followers)}</span>
            {' '}<span className="text-muted-foreground group-hover:text-foreground transition-colors">Followers</span>
          </button>
          <button
            onClick={() => setFollowSheet('following')}
            className="group text-left hover:opacity-75 transition-opacity"
          >
            <span className="font-bold text-foreground">{formatCompactCount(resolvedProfile.following)}</span>
            {' '}<span className="text-muted-foreground group-hover:text-foreground transition-colors">Following</span>
          </button>
        </div>
      </motion.div>

      <motion.div
        className="mx-4 h-px bg-border"
        initial={{ scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ delay: 0.12, duration: 0.3 }}
        style={{ originX: 0 }}
      />

      {/* About */}
      <motion.div
        className="px-4 py-3"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.14, duration: 0.28, ease: 'easeOut' }}
      >
        <p className="mb-1.5 text-[9px] font-bold uppercase tracking-[0.14em] text-muted-foreground">About</p>
        <p className="text-[11.5px] leading-[1.65] text-foreground">{resolvedProfile.bio}</p>
        <div className="mt-2.5 space-y-1.5 text-[11px] text-muted-foreground">
          {xHref && xHandle ? (
            <a
              href={xHref}
              target="_blank"
              rel="noreferrer"
              className="flex min-w-0 items-center gap-1.5 text-foreground/80 transition-colors hover:text-foreground"
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" className="flex-shrink-0">
                <path d="M18.244 2H21l-6.02 6.879L22 22h-5.49l-4.3-7.98L5.23 22H2.47l6.44-7.36L2 2h5.63l3.89 7.27L18.244 2Zm-.96 18h1.52L6.8 3.9H5.17l12.114 16.1Z" />
              </svg>
              <span className="truncate">{xHandle}</span>
            </a>
          ) : null}
          {websiteHref ? (
            <a
              href={websiteHref}
              target="_blank"
              rel="noreferrer"
              className="flex min-w-0 items-center gap-1.5 text-primary/80 transition-colors hover:text-primary"
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="flex-shrink-0">
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
              </svg>
              <span className="truncate">{displayExternalUrl(websiteHref)}</span>
            </a>
          ) : null}
        </div>
      </motion.div>

      <div className="mx-4 h-px bg-border" />

      {/* Tabs */}
      <motion.div
        className="px-4 pt-3 pb-2.5"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.22, duration: 0.26, ease: 'easeOut' }}
      >
        <div className="flex items-center gap-0.5 rounded-xl border border-border bg-card p-1">
          {([
            { id: 'posts' as const, label: 'Posts' },
            { id: 'pixel-room' as const, label: 'Pixel Room' },
            { id: 'articles' as const, label: 'Articles' },
            { id: 'saved' as const, label: 'Saved' },
          ]).map((tab) => {
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'flex-1 rounded-lg py-1.5 text-[9.5px] font-semibold transition-colors',
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                )}
              >
                {tab.label}
              </button>
            )
          })}
        </div>
      </motion.div>

      {/* Tab content */}
      <div className="flex-1 px-4 pb-4">
        <AnimatePresence mode="wait">
        {activeTab === 'posts' ? (
          <motion.div
            key="posts"
            className="space-y-2"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
          >
            {backendPostsLoading ? (
              <div className="rounded-xl border border-border bg-card p-3 text-[11px] text-muted-foreground">
                Loading posts...
              </div>
            ) : backendPostsError ? (
              <div className="rounded-xl border border-border bg-card p-3 text-[11px] text-muted-foreground">
                Posts could not be loaded.
              </div>
            ) : profilePosts.length === 0 ? (
              <div className="rounded-xl border border-border bg-card p-3 text-[11px] text-muted-foreground">
                No posts yet.
              </div>
            ) : profilePosts.map((post, idx) => {
              const reactionsCount = post.reactions.reduce((t, r) => t + r.count, 0)
              const shareCount = Math.max(1, Math.round((reactionsCount + post.replyCount) / 3))
              const mediaSource = post.media?.[0]?.src ?? post.imageUrl

              return (
                <motion.article
                  key={post.id}
                  className="overflow-hidden rounded-xl border border-border bg-card transition-colors hover:border-border/60"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.07, duration: 0.22, ease: 'easeOut' }}
                  whileHover={{ scale: 1.012 }}
                >
                  <div className="p-2.5 pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2">
                        <Avatar className="h-6 w-6 flex-shrink-0 rounded-full border border-border bg-muted">
                          <AvatarImage src={avatarImage ?? undefined} alt={resolvedProfile.name} className="h-full w-full rounded-full object-cover" />
                          <AvatarFallback className="rounded-full bg-muted text-[9px] font-bold text-foreground">
                            {resolvedProfile.name[0]?.toUpperCase() ?? 'U'}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="text-[11px] font-semibold leading-none text-foreground">
                            {resolvedProfile.name}{' '}
                            <span className="font-normal text-muted-foreground">posted</span>
                          </p>
                          <p className="mt-0.5 text-[9px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                            {formatProfileTime(post.time)}
                          </p>
                        </div>
                      </div>
                      <button type="button" className="text-muted-foreground transition-colors hover:text-foreground">
                        <MoreHorizontal className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <p className="mt-1.5 text-[11px] leading-[1.6] text-foreground">{post.body}</p>
                  </div>

                  {mediaSource ? (
                    <div className="mx-2.5 mb-2 overflow-hidden rounded-[8px] border border-border">
                      <div className="relative h-[84px] w-full">
                        <Image src={mediaSource} alt={post.media?.[0]?.alt ?? 'Post media'} fill unoptimized sizes="340px" className="object-cover" />
                      </div>
                    </div>
                  ) : !memberProfile.id ? (
                    <div className="mx-2.5 mb-2 overflow-hidden rounded-[8px]">
                      <div className={cn('flex h-[72px] items-end bg-gradient-to-br p-2.5 opacity-80', resolvedProfile.accent)}>
                        <p className="text-[11px] font-black leading-snug text-white line-clamp-2">{resolvedProfile.focus}</p>
                      </div>
                    </div>
                  ) : null}

                  <div className="flex items-center gap-3 border-t border-border px-2.5 py-1.5 text-[10px] text-muted-foreground">
                    <button type="button" className="inline-flex items-center gap-1 transition-colors hover:text-foreground">
                      <Heart className="h-3 w-3" />{reactionsCount}
                    </button>
                    <button type="button" className="inline-flex items-center gap-1 transition-colors hover:text-foreground">
                      <MessageCircle className="h-3 w-3" />{post.replyCount}
                    </button>
                    <button type="button" className="inline-flex items-center gap-1 transition-colors hover:text-foreground">
                      <Share2 className="h-3 w-3" />{shareCount}
                    </button>
                    <button type="button" className="ml-auto inline-flex items-center gap-1 transition-colors hover:text-foreground">
                      <Bookmark className="h-3 w-3" />Save
                    </button>
                  </div>
                </motion.article>
              )
            })}
          </motion.div>
        ) : activeTab === 'pixel-room' ? (
          <motion.div
            key="pixel-room"
            className="space-y-2.5"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
          >
            <div className="relative overflow-hidden rounded-2xl border border-border bg-card">
              <img
                src={PIXEL_ROOM_PREVIEW_SRC}
                alt={`${resolvedProfile.name}'s Pixel Room`}
                className="h-32 w-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
              <div className="absolute bottom-2.5 left-3 right-3 flex items-end justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-[12px] font-bold text-white">{resolvedProfile.name}&apos;s Room</p>
                  <p className="text-[10px] text-white/70">Pixel World · preview</p>
                </div>
                <span className="rounded-full bg-white/15 px-2 py-0.5 text-[9px] font-semibold text-white backdrop-blur-sm">
                  Open soon
                </span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-1.5">
              {[
                { label: 'Furniture', value: '—' },
                { label: 'Visitors', value: formatCompactCount(resolvedProfile.followers) },
                { label: 'Style', value: 'Loft' },
              ].map(({ label, value }) => (
                <div key={label} className="rounded-lg border border-border bg-card/70 px-2 py-1.5 text-center">
                  <p className="text-[12px] font-bold leading-none text-foreground">{value}</p>
                  <p className="mt-0.5 text-[9px] text-muted-foreground">{label}</p>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                className="h-8 flex-1 rounded-lg bg-primary px-3 text-[11px] font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
              >
                Enter Room
              </button>
              <button
                type="button"
                onClick={() => setPixelRoomLiked((liked) => !liked)}
                aria-pressed={pixelRoomLiked}
                className={cn(
                  'flex h-8 w-9 items-center justify-center rounded-lg border transition-colors',
                  pixelRoomLiked
                    ? 'border-rose-400/30 bg-rose-500/10 text-rose-500'
                    : 'border-border bg-card text-muted-foreground hover:text-foreground',
                )}
              >
                <Heart className={cn('h-3.5 w-3.5', pixelRoomLiked && 'fill-current')} />
              </button>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key={activeTab}
            className="rounded-xl border border-border bg-card p-3.5"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
          >
            <p className="text-[12px] font-semibold text-foreground">
              {activeTab === 'articles' ? 'Articles' : 'Saved'}
            </p>
            <p className="mt-1.5 text-[11px] leading-[1.75] text-muted-foreground">
              {activeTab === 'articles'
                  ? resolvedProfile.bio
                  : 'Pinned references and useful items will appear here.'}
            </p>
          </motion.div>
        )}
        </AnimatePresence>
      </div>
    </div>
  )
}

function FeedProfileRow({
  authorAvatarUrl,
  memberProfile,
  onOpenProfile,
  post,
  isGrouped,
  myAvatarUrl,
  isMentioned,
  onReact,
  onReply,
  onPin,
  onDelete,
  onContextMenu,
}: {
  authorAvatarUrl?: string | null
  memberProfile: FeedMemberProfile
  onOpenProfile: () => void
  post: FeedPost
  isGrouped: boolean
  myAvatarUrl?: string | null
  isMentioned?: boolean
  onReact: (emoji: string) => void
  onReply: () => void
  onPin: () => void
  onDelete: () => void
  onContextMenu: (e: MouseEvent) => void
}) {
  const prefetchUserProfile = usePrefetchUserProfile()
  const roleColor = ROLE_COLORS[post.role] ?? 'text-primary'
  const displayAvatar = post.isOwn
    ? (authorAvatarUrl ?? myAvatarUrl ?? memberProfile.avatarUrl ?? null)
    : (authorAvatarUrl ?? memberProfile.avatarUrl ?? null)

  const handlePrefetch = () => {
    if (memberProfile.id) prefetchUserProfile(memberProfile.id)
  }

  return (
    <div
      className={cn(
        'group relative flex gap-3 px-4 transition-colors hover:bg-accent/20',
        isGrouped ? 'py-0.5' : 'mt-4 pt-1 pb-0.5',
        isMentioned && 'bg-amber-500/10 border-l-2 border-amber-400',
      )}
      onContextMenu={onContextMenu}
    >
      <div className="mt-0.5 w-10 flex-shrink-0">
        <button
          type="button"
          onMouseEnter={handlePrefetch}
          onClick={onOpenProfile}
          className="flex h-10 w-10 cursor-pointer overflow-hidden rounded-full ring-2 ring-background focus:outline-none"
          aria-label={`Open ${post.author} profile`}
        >
          <img
            src={displayAvatar ?? fallbackAvatar}
            alt={post.author}
            className="h-full w-full object-cover"
            onError={(e) => {
              if (!e.currentTarget.src.endsWith(fallbackAvatar)) e.currentTarget.src = fallbackAvatar
            }}
          />
        </button>
      </div>

      <div className="min-w-0 flex-1">
        {!isGrouped ? (
          <div className="mb-0.5 flex items-baseline gap-2">
            <button
              type="button"
              onMouseEnter={handlePrefetch}
              onClick={onOpenProfile}
              className={cn('inline-flex items-center gap-1 text-[14px] font-semibold leading-none hover:underline', roleColor)}
            >
              {post.author}
              {memberProfile.isVerified ? <VerifiedBadge size="xs" variant={memberProfile.isPro ? 'pro' : 'standard'} /> : null}
            </button>
            <RoleBadge role={post.role} />
            <span className="text-[11px] text-muted-foreground">{post.time}</span>
            {post.pinned ? <Pin className="h-3 w-3 text-primary" /> : null}
          </div>
        ) : null}

        {post.replyTo ? (
          <div className="mb-1 flex cursor-pointer items-center gap-2 opacity-70 transition-opacity hover:opacity-100">
            <div className="ml-2 h-3 w-3 flex-shrink-0 rounded-tl border-l-2 border-t-2 border-muted-foreground" />
            <span className="text-[11px] font-semibold text-muted-foreground">{post.replyTo.author}</span>
            <span className="truncate text-[11px] text-muted-foreground">{post.replyTo.body}</span>
          </div>
        ) : null}

        {post.body ? (
          <p className="text-[13.5px] leading-[1.55] text-foreground">{post.body}</p>
        ) : null}

        {(post.media?.length || post.imageUrl) ? (
          <div className="mt-2 flex flex-wrap gap-2">
            {post.imageUrl ? (
              isProbablyImageUrl(post.imageUrl) ? (
                <img
                  src={post.imageUrl}
                  alt="Uploaded"
                  className="max-h-32 max-w-[200px] rounded-xl"
                />
              ) : (
                <a
                  href={post.imageUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-xl border border-border bg-muted/50 px-3 py-2 text-[12px] font-medium text-primary hover:bg-muted"
                >
                  <Paperclip className="h-4 w-4 shrink-0" />
                  Open attachment
                </a>
              )
            ) : null}
            {post.media?.map((media) => (
              <div key={media.label} className="relative h-36 w-56 overflow-hidden rounded-xl border border-border">
                <Image src={media.src} alt={media.alt} fill unoptimized sizes="300px" className="object-cover" />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-3 py-2">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.07em] text-white/90">{media.label}</p>
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {post.tags?.length ? (
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {post.tags.map((tag) => (
              <span key={tag} className="rounded-full border border-border bg-background px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.07em] text-muted-foreground">
                {tag}
              </span>
            ))}
          </div>
        ) : null}

        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          {post.reactions.map((r) => (
            <motion.button
              key={r.emoji}
              whileTap={{ scale: 0.85 }}
              onClick={() => onReact(r.emoji)}
              className={cn(
                'flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[13px] transition-colors',
                r.mine
                  ? 'border-primary/40 bg-primary/10 text-primary'
                  : 'border-border bg-background hover:border-primary/30 hover:bg-primary/5',
              )}
            >
              {r.emoji}
              <span className="text-[11px] font-semibold">{r.count}</span>
            </motion.button>
          ))}

          <EmojiPickerPopover
            onSelect={onReact}
            trigger={
              <button className="flex items-center gap-1 rounded-full border border-dashed border-border px-2.5 py-1 text-[12px] text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:border-primary/30 hover:bg-primary/5 hover:text-primary">
                <SmilePlus className="h-3.5 w-3.5" />
              </button>
            }
          />

          {post.replyCount > 0 ? (
            <button
              onClick={onReply}
              className="flex items-center gap-1.5 rounded-full px-2 py-1 text-[11px] font-medium text-primary opacity-0 transition-opacity hover:underline group-hover:opacity-100"
            >
              <Reply className="h-3.5 w-3.5" />
              {post.replyCount} {post.replyCount === 1 ? 'reply' : 'replies'}
            </button>
          ) : null}
        </div>
      </div>

      <div className="absolute -top-5 right-3 z-10 hidden group-hover:block">
        <HoverActionBar
          onQuickReact={onReact}
          onReply={onReply}
          onPin={onPin}
          onDelete={onDelete}
          isPinned={post.pinned}
          isOwn={post.isOwn}
        />
      </div>
    </div>
  )
}

export function ChannelFeed({
  channel,
  group,
  members = [],
  myAvatarUrl,
  postsOverride,
  onSendPost,
  sendingPost = false,
  onOpenDirectConversation,
  onProfilePanelWidthChange,
  onProfileSidebarContentChange,
  onProfileCloseRequestChange,
}: {
  channel: WorkspaceChannel
  group: MockChannelGroup
  members?: GroupMember[]
  myAvatarUrl?: string | null
  postsOverride?: FeedPost[]
  onSendPost?: (input: { content: string; fileUrl?: string; replyToId?: string; entityMentions?: GroupMessageMention[] }) => Promise<void>
  sendingPost?: boolean
  onOpenDirectConversation?: (conversation: string | FeedDirectConversationTarget) => void
  onProfilePanelWidthChange?: (width: number) => void
  onProfileSidebarContentChange?: (content: ReactNode | null) => void
  onProfileCloseRequestChange?: (closeFn: (() => void) | null) => void
}) {
  const [postsByGroup, setPostsByGroup] = useState<Record<string, FeedPost[]>>({})
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [draftImages, setDraftImages] = useState<Record<string, string>>({})
  const [draftAttachments, setDraftAttachments] = useState<Record<string, FeedMedia>>({})
  const [replyingTo, setReplyingTo] = useState<FeedPost | null>(null)
  const [contextMenu, setContextMenu] = useState<{ postId: string; x: number; y: number } | null>(null)
  const [selectedProfile, setSelectedProfile] = useState<FeedProfileSelection | null>(null)
  const [mentionCursorByGroup, setMentionCursorByGroup] = useState<Record<string, number>>({})
  const [activeMentionIndex, setActiveMentionIndex] = useState(0)

  const removeMember = useRemoveGroupMember(group.id)
  const updateMemberRole = useUpdateGroupMemberRole(group.id)

  const { user: authUser } = useAuth()
  const { data: profile } = useProfile()
  const currentIdentity = {
    email: profile?.email ?? authUser?.email,
    id: profile?.id,
    is_verified: profile?.is_verified,
    sub_plan: profile?.sub_plan,
  }
  const currentIsVerified = isVerifiedAccountIdentity(currentIdentity)

  const useBackendUpload = Boolean(onSendPost)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const genericFileInputRef = useRef<HTMLInputElement>(null)
  const feedScrollRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const blobUrlsRef = useRef<string[]>([])
  const previousGroupIdRef = useRef<string | null>(null)

  const [postUploading, setPostUploading] = useState(false)
  const [pendingImageFile, setPendingImageFile] = useState<File | null>(null)
  const [pendingGenericFile, setPendingGenericFile] = useState<File | null>(null)

  const posts = postsByGroup[group.id] ?? postsOverride ?? buildFallbackPosts(channel, group)
  const latestPostId = posts.at(-1)?.id
  const draft = drafts[group.id] ?? ''
  const mentionCursor = mentionCursorByGroup[group.id] ?? draft.length
  const draftImage = draftImages[group.id]
  const draftAttachment = draftAttachments[group.id]
  const selectedPost = contextMenu ? posts.find((p) => p.id === contextMenu.postId) ?? null : null
  const profilePanelWidth = selectedProfile ? 360 : 0
  const profilePosts = selectedProfile
    ? Object.values({ ...postsByGroup, [group.id]: posts })
        .flat()
        .filter((post) => post.author === selectedProfile.profile.name)
        .map((post) => ({
          ...post,
          authorIsVerified: post.authorIsVerified || selectedProfile.profile.isVerified,
        }))
        .slice()
        .reverse()
    : []
  const mentionOptions = useMemo<MentionOption[]>(() => {
    const seen = new Set<string>()
    const userOptions = members
      .filter((member) => member.user?.id)
      .map((member) => {
        const label = member.user.username?.trim() || `user-${member.user.id.slice(0, 8)}`
        return {
          avatarUrl: member.user.avatar_url,
          entityId: member.user.id,
          label,
          role: member.role,
          type: 'user' as const,
        }
      })
      .filter((option) => {
        const key = normalizeMentionName(option.label)
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })

    return [
      { entityId: group.id, label: 'all', role: `${members.length} members`, type: 'all' as const },
      ...userOptions,
    ]
  }, [group.id, members])
  const mentionQuery = getMentionQuery(draft, mentionCursor)
  const filteredMentionOptions = mentionQuery
    ? mentionOptions
        .filter((option) => normalizeMentionName(option.label).includes(mentionQuery.query))
        .slice(0, 8)
    : []
  const showMentionMenu = !!mentionQuery && filteredMentionOptions.length > 0

  useEffect(() => {
    return () => {
      blobUrlsRef.current.forEach((u) => URL.revokeObjectURL(u))
      blobUrlsRef.current = []
    }
  }, [])

  useEffect(() => {
    setSelectedProfile(null)
  }, [group.id])

  useEffect(() => {
    if (!postsOverride) return
    setPostsByGroup((prev) => ({ ...prev, [group.id]: postsOverride }))
  }, [group.id, postsOverride])

  useLayoutEffect(() => {
    if (!posts.length) return

    const groupChanged = previousGroupIdRef.current !== group.id
    previousGroupIdRef.current = group.id

    const scrollToLatest = (behavior: ScrollBehavior) => {
      const scroller = feedScrollRef.current
      if (!scroller) return
      scroller.scrollTo({ top: scroller.scrollHeight, behavior })
    }

    const frameId = requestAnimationFrame(() => scrollToLatest(groupChanged ? 'auto' : 'smooth'))
    const timeoutId = window.setTimeout(() => scrollToLatest('auto'), 120)

    return () => {
      cancelAnimationFrame(frameId)
      window.clearTimeout(timeoutId)
    }
  }, [group.id, latestPostId, posts.length])

  useEffect(() => {
    setActiveMentionIndex(0)
  }, [group.id, mentionQuery?.query])

  useEffect(() => {
    onProfilePanelWidthChange?.(profilePanelWidth)
  }, [onProfilePanelWidthChange, profilePanelWidth])

  useEffect(() => {
    return () => onProfilePanelWidthChange?.(0)
  }, [onProfilePanelWidthChange])

  useEffect(() => {
    if (!selectedProfile) {
      onProfileSidebarContentChange?.(null)
      return
    }
    onProfileSidebarContentChange?.(
      <FeedMemberProfileView
        currentGroupLabel={group.kind === 'voice' ? group.label : `#${group.label}`}
        isOwn={!!selectedProfile.post.isOwn}
        memberProfile={selectedProfile.profile}
        messagePending={false}
        onBack={() => setSelectedProfile(null)}
        onMessage={() => handleMessageAuthor(selectedProfile.post, selectedProfile.profile)}
        posts={profilePosts}
      />,
    )
  }, [
    group.kind,
    group.label,
    onProfileSidebarContentChange,
    profilePosts,
    selectedProfile,
  ])

  useEffect(() => {
    return () => onProfileSidebarContentChange?.(null)
  }, [onProfileSidebarContentChange])

  useEffect(() => {
    onProfileCloseRequestChange?.(selectedProfile ? () => setSelectedProfile(null) : null)
  }, [onProfileCloseRequestChange, selectedProfile])

  useEffect(() => {
    return () => onProfileCloseRequestChange?.(null)
  }, [onProfileCloseRequestChange])

  function getAuthorContext(post: FeedPost) {
    if (post.isOwn) {
      return {
        canMessage: false,
        profile: buildFeedMemberProfile(
          { ...post, authorIsVerified: post.authorIsVerified || currentIsVerified, authorIsPro: post.authorIsPro || isProPlan(profile?.sub_plan) },
          post.authorAvatarUrl ?? myAvatarUrl ?? profile?.avatar_url ?? null,
          profile?.username ?? 'you',
          profile?.id,
        ),
      }
    }

    return {
      canMessage: true,
      profile: buildFeedMemberProfile(
        post,
        post.authorAvatarUrl ?? null,
        undefined,
        post.authorId,
      ),
    }
  }

  function buildSyntheticConversationTarget(post: FeedPost, memberProfile: FeedMemberProfile): FeedDirectConversationTarget {
    const conversationId = `feed-dm-${normalizePersonName(memberProfile.name)}`
    const senderId = `feed-user-${normalizePersonName(memberProfile.name)}`
    const authorMessage = post.body.trim() || `Continuing the thread from #${group.label}.`

    return {
      avatarUrl: memberProfile.avatarUrl,
      id: conversationId,
      initialMessages: [
        {
          id: `${conversationId}-intro`,
          conversation_id: conversationId,
          sender_id: senderId,
          content: authorMessage,
          type: 'text',
          file_url: null,
          metadata: {
            sourceGroupId: group.id,
            sourcePostId: post.id,
            synthetic: true,
          },
          status: 'read',
          reactions: [],
          reply_to: null,
          created_at: new Date().toISOString(),
          sender: {
            id: senderId,
            username: memberProfile.name,
            avatar_url: memberProfile.avatarUrl,
            is_verified: memberProfile.isVerified ?? false,
          },
        },
      ],
      isOnline: true,
      isVerified: memberProfile.isVerified ?? false,
      name: memberProfile.name,
      status: memberProfile.status,
    }
  }

  function handleMessageAuthor(post: FeedPost, memberProfile: FeedMemberProfile) {
    onOpenDirectConversation?.(buildSyntheticConversationTarget(post, memberProfile))
  }

  function setDraft(value: string) {
    setDrafts((prev) => ({ ...prev, [group.id]: value }))
  }

  function setMentionCursor(cursor: number) {
    setMentionCursorByGroup((prev) => ({ ...prev, [group.id]: cursor }))
  }

  function syncMentionCursor() {
    setMentionCursor(textareaRef.current?.selectionStart ?? draft.length)
  }

  function insertMention(option: MentionOption) {
    if (!mentionQuery) return

    const insertion = `@${option.label} `
    const next = `${draft.slice(0, mentionQuery.start)}${insertion}${draft.slice(mentionQuery.end)}`
    const nextCursor = mentionQuery.start + insertion.length

    setDraft(next)
    setMentionCursor(nextCursor)
    setActiveMentionIndex(0)

    requestAnimationFrame(() => {
      textareaRef.current?.focus()
      textareaRef.current?.setSelectionRange(nextCursor, nextCursor)
    })
  }

  function setDraftImage(url?: string) {
    setDraftImages((prev) => {
      const copy = { ...prev }
      if (url) copy[group.id] = url
      else delete copy[group.id]
      return copy
    })
  }

  function setAttachment(next?: FeedMedia) {
    setDraftAttachments((prev) => {
      const copy = { ...prev }
      if (next) copy[group.id] = next
      else delete copy[group.id]
      return copy
    })
  }

  function updatePosts(updater: (current: FeedPost[]) => FeedPost[]) {
    setPostsByGroup((prev) => {
      const current = prev[group.id] ?? buildFallbackPosts(channel, group)
      return { ...prev, [group.id]: updater(current) }
    })
  }

  function revokeBlob(url?: string) {
    if (url?.startsWith('blob:')) URL.revokeObjectURL(url)
  }

  function handleImageFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setPendingGenericFile(null)
    setAttachment(undefined)
    setPendingImageFile(file)
    const url = URL.createObjectURL(file)
    blobUrlsRef.current.push(url)
    setDraftImage(url)
  }

  function handleGenericFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (draftImage) {
      revokeBlob(draftImage)
      setDraftImage(undefined)
    }
    setPendingImageFile(null)
    setAttachment(undefined)
    setPendingGenericFile(file)
  }

  function clearQueuedImage() {
    revokeBlob(draftImage)
    setDraftImage(undefined)
    setPendingImageFile(null)
  }

  function clearQueuedGeneric() {
    setPendingGenericFile(null)
  }

  async function sendDraft() {
    const body = draft.trim()
    const hasQueuedFile = !!(pendingImageFile || pendingGenericFile)
    if (!body && !draftImage && !draftAttachment && !hasQueuedFile) return

    if (onSendPost) {
      if (!hasQueuedFile && !body) return
      const entityMentions = extractMentionTargets(body, mentionOptions)
      setPostUploading(true)
      try {
        let fileUrl: string | undefined
        if (pendingImageFile) {
          const { publicUrl } = await filesApi.uploadGroupExtra(group.id, pendingImageFile)
          fileUrl = publicUrl
        } else if (pendingGenericFile) {
          const { publicUrl } = await filesApi.uploadGroupExtra(group.id, pendingGenericFile)
          fileUrl = publicUrl
        }
        await onSendPost({
          content: body,
          entityMentions,
          fileUrl,
          replyToId: replyingTo?.id,
        })
        setDraft('')
        setMentionCursor(0)
        clearQueuedImage()
        clearQueuedGeneric()
        setReplyingTo(null)
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to send')
      } finally {
        setPostUploading(false)
      }
      return
    }

    const post: FeedPost = {
      id: `${group.id}-${Date.now()}`,
      author: 'You',
      role: 'Member',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      body,
      isOwn: true,
      imageUrl: draftImage,
      media: draftAttachment ? [draftAttachment] : undefined,
      reactions: [],
      replyCount: 0,
      replyTo: replyingTo
        ? { author: replyingTo.author, body: replyingTo.body.slice(0, 60) + (replyingTo.body.length > 60 ? '…' : '') }
        : undefined,
    }

    updatePosts((current) => {
      const nextCurrent = replyingTo
        ? current.map((item) =>
            item.id === replyingTo.id
              ? { ...item, replyCount: item.replyCount + 1 }
              : item,
          )
        : current

      return [...nextCurrent, post]
    })
    setDraft('')
    setMentionCursor(0)
    setDraftImage(undefined)
    setAttachment(undefined)
    setReplyingTo(null)
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (showMentionMenu) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setActiveMentionIndex((current) => (current + 1) % filteredMentionOptions.length)
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setActiveMentionIndex((current) => (
          current - 1 + filteredMentionOptions.length
        ) % filteredMentionOptions.length)
        return
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault()
        insertMention(filteredMentionOptions[activeMentionIndex] ?? filteredMentionOptions[0])
        return
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        setMentionCursor(0)
        return
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void sendDraft()
    }
  }

  function handleReact(postId: string, emoji: string) {
    updatePosts((current) =>
      current.map((post) => {
        if (post.id !== postId) return post
        const existing = post.reactions.find((r) => r.emoji === emoji)
        if (existing) {
          if (existing.mine) {
            const next = post.reactions
              .map((r) => r.emoji === emoji ? { ...r, count: r.count - 1, mine: false } : r)
              .filter((r) => r.count > 0)
            return { ...post, reactions: next }
          } else {
            return {
              ...post,
              reactions: post.reactions.map((r) =>
                r.emoji === emoji ? { ...r, count: r.count + 1, mine: true } : r,
              ),
            }
          }
        }
        return { ...post, reactions: [...post.reactions, { emoji, count: 1, mine: true }] }
      }),
    )
  }

  function handleTogglePin(postId: string) {
    updatePosts((current) =>
      current.map((p) => (p.id === postId ? { ...p, pinned: !p.pinned } : p)),
    )
  }

  function handleDelete(postId: string) {
    updatePosts((current) => current.filter((p) => p.id !== postId))
  }

  async function handleCopy(post: FeedPost) {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(`${post.author}: ${post.body}`)
    }
  }

  function openContextMenu(e: MouseEvent, postId: string) {
    e.preventDefault()
    setContextMenu({ postId, x: e.clientX, y: e.clientY })
  }

  const canSend = !!(
    draft.trim() ||
    draftImage ||
    draftAttachment ||
    pendingImageFile ||
    pendingGenericFile
  )

  return (
    <div className="flex flex-1 overflow-hidden bg-background">
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
      {/* Messages list */}
      <div ref={feedScrollRef} className="flex-1 overflow-y-auto py-2">
        <div className="pb-2">
          {/* Date separator */}
          <div className="flex items-center gap-3 px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            <div className="h-px flex-1 bg-border" />
            Today
            <div className="h-px flex-1 bg-border" />
          </div>

          {posts.map((post, index) => {
            const prevPost = index > 0 ? posts[index - 1] : null
            const isSystem = post.isSystem || (post.author === 'System' && post.role === 'Automation')
            const isGrouped = !!prevPost && !isSystem && !prevPost.isSystem && prevPost.author === post.author
            const authorContext = getAuthorContext(post)
            const myUsername = profile?.username
            const isMentioned = !post.isOwn && !!myUsername && !!post.body && (
              post.body.toLowerCase().includes(`@${myUsername.toLowerCase()}`) ||
              /(?:^|\s)@all\b/i.test(post.body)
            )

            if (isSystem) {
              return <SystemFeedRow key={post.id} post={post} />
            }

            return (
              <FeedProfileRow
                authorAvatarUrl={authorContext.profile.avatarUrl}
                key={post.id}
                memberProfile={authorContext.profile}
                onOpenProfile={() => {
                  setContextMenu(null)
                  setSelectedProfile({
                    canMessage: authorContext.canMessage,
                    post,
                    profile: authorContext.profile,
                  })
                }}
                post={post}
                isGrouped={isGrouped}
                myAvatarUrl={myAvatarUrl}
                isMentioned={isMentioned}
                onReact={(emoji) => handleReact(post.id, emoji)}
                onReply={() => {
                  setReplyingTo(post)
                  textareaRef.current?.focus()
                }}
                onPin={() => handleTogglePin(post.id)}
                onDelete={() => handleDelete(post.id)}
                onContextMenu={(e) => openContextMenu(e, post.id)}
              />
            )
          })}
        </div>
      </div>

      {/* Composer */}
      <div className="flex-shrink-0 border-t border-border bg-background px-4 py-3">
        <div className="mx-auto max-w-4xl">
          <div className="relative rounded-xl border border-border bg-sidebar/60 focus-within:border-primary/40 focus-within:ring-1 focus-within:ring-primary/20 transition-all">
            {/* Reply bar */}
            {replyingTo ? (
              <div className="flex items-center gap-2 border-b border-border/60 bg-background/40 px-3 py-1.5">
                <Reply className="h-3.5 w-3.5 flex-shrink-0 text-primary" />
                <span className="text-[11px] font-semibold text-primary">Replying to {replyingTo.author}</span>
                <span className="flex-1 truncate text-[11px] text-muted-foreground">{replyingTo.body}</span>
                <button
                  onClick={() => setReplyingTo(null)}
                  className="flex h-5 w-5 items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ) : null}

            {/* Image / attachment preview */}
            {(draftImage || pendingGenericFile || (!useBackendUpload && draftAttachment)) ? (
              <div className="flex items-center gap-3 border-b border-border/60 bg-background/40 px-3 py-2">
                {draftImage ? (
                  <div className="relative h-14 w-20 shrink-0 overflow-hidden rounded-lg border border-border">
                    <img src={draftImage} alt="Preview" className="h-full w-full object-cover" />
                    <button
                      type="button"
                      onClick={() => clearQueuedImage()}
                      className="absolute right-0.5 top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-black/70 text-white"
                    >
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </div>
                ) : null}
                {pendingGenericFile && !draftImage ? (
                  <div className="flex h-14 min-w-0 flex-1 items-center gap-2 rounded-lg border border-border bg-background/80 px-3">
                    <Paperclip className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[11px] font-medium text-foreground">{pendingGenericFile.name}</p>
                      <p className="text-[10px] text-muted-foreground">File attached</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => clearQueuedGeneric()}
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ) : null}
                {!useBackendUpload && draftAttachment ? (
                  <div className="relative h-14 w-20 shrink-0 overflow-hidden rounded-lg border border-border">
                    <Image src={draftAttachment.src} alt={draftAttachment.alt} fill unoptimized sizes="96px" className="object-cover" />
                    <button
                      type="button"
                      onClick={() => setAttachment(undefined)}
                      className="absolute right-0.5 top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-black/70 text-white"
                    >
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </div>
                ) : null}
                {draftImage || (!useBackendUpload && draftAttachment) ? (
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-medium text-foreground">
                      {draftImage ? 'Image attached' : draftAttachment?.label}
                    </p>
                    <p className="text-[10px] text-muted-foreground">Ready to send</p>
                  </div>
                ) : null}
              </div>
            ) : null}

            {/* Input row */}
            <div className="flex items-end gap-1 px-2 py-2">
              {/* Left actions */}
              <div className="flex items-center gap-0.5">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground"
                  onClick={() => imageInputRef.current?.click()}
                  title="Upload image"
                >
                  <ImagePlus className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className={cn(
                    'h-8 w-8 rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground',
                    (useBackendUpload ? pendingGenericFile : draftAttachment) && 'bg-primary/10 text-primary',
                  )}
                  onClick={() => {
                    if (useBackendUpload) {
                      if (pendingGenericFile) clearQueuedGeneric()
                      else genericFileInputRef.current?.click()
                    } else {
                      draftAttachment ? setAttachment(undefined) : setAttachment(getSuggestedAttachment(channel, group))
                    }
                  }}
                  title={useBackendUpload ? 'Attach file' : 'Attach mock media'}
                >
                  <Paperclip className="h-4 w-4" />
                </Button>
              </div>

              {/* Text input */}
              <div className="relative flex-1">
                {showMentionMenu ? (
                  <div className="absolute bottom-full left-0 z-30 mb-2 w-[min(22rem,calc(100vw-4rem))] overflow-hidden rounded-xl border border-border bg-popover p-1 shadow-xl">
                    {filteredMentionOptions.map((option, index) => {
                      const isActive = index === activeMentionIndex
                      const initials = option.label.slice(0, 2).toUpperCase()
                      return (
                        <button
                          key={`${option.type}:${option.entityId}`}
                          type="button"
                          onMouseDown={(event) => {
                            event.preventDefault()
                            insertMention(option)
                          }}
                          className={cn(
                            'flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left transition-colors',
                            isActive ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/70',
                          )}
                        >
                          {option.type === 'all' ? (
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                              <Users className="h-4 w-4" />
                            </span>
                          ) : (
                            <Avatar className="h-8 w-8 shrink-0 rounded-lg">
                              <AvatarImage src={option.avatarUrl ?? undefined} alt={option.label} />
                              <AvatarFallback className="rounded-lg text-[11px]">{initials}</AvatarFallback>
                            </Avatar>
                          )}
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[13px] font-semibold">@{option.label}</span>
                            <span className="block truncate text-[11px] text-muted-foreground">
                              {option.type === 'all' ? 'Notify everyone in this group' : option.role ?? 'Member'}
                            </span>
                          </span>
                        </button>
                      )
                    })}
                  </div>
                ) : null}
                <Textarea
                  ref={textareaRef}
                  value={draft}
                  onChange={(e) => {
                    setDraft(e.target.value)
                    setMentionCursor(e.target.selectionStart ?? e.target.value.length)
                  }}
                  onBlur={() => {
                    window.setTimeout(() => setMentionCursor(0), 100)
                  }}
                  onClick={syncMentionCursor}
                  onKeyDown={handleKeyDown}
                  onKeyUp={(event) => {
                    if (event.key !== 'Escape') syncMentionCursor()
                  }}
                  onSelect={syncMentionCursor}
                  placeholder={`Message ${group.kind === 'voice' ? group.label : `#${group.label}`}`}
                  rows={1}
                  className="max-h-40 min-h-[36px] w-full resize-none border-0 bg-transparent px-2 py-2 text-[13px] leading-[1.5] shadow-none focus-visible:ring-0"
                />
              </div>

              {/* Right actions */}
              <div className="flex items-center gap-0.5">
                <EmojiPickerPopover
                  onSelect={(emoji) => setDraft(draft + emoji)}
                  trigger={
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground"
                      title="Emoji"
                    >
                      <SmilePlus className="h-4 w-4" />
                    </Button>
                  }
                />
                <Button
                  type="button"
                  onClick={() => void sendDraft()}
                  disabled={!canSend || sendingPost || postUploading}
                  size="icon"
                  className="h-8 w-8 rounded-lg"
                >
                  <SendHorizontal className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleImageFile}
          />
          <input
            ref={genericFileInputRef}
            type="file"
            className="hidden"
            onChange={handleGenericFile}
          />

          <p className="mt-1 px-1 text-[10px] text-muted-foreground">
            Enter to send · Shift+Enter for new line · Right-click for more
          </p>
        </div>
      </div>

        {/* Context menu */}
        {contextMenu && selectedPost ? (
          <FeedPostContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            isPinned={selectedPost.pinned}
            isOwn={selectedPost.isOwn}
            hasMedia={!!(selectedPost.media?.length || selectedPost.imageUrl)}
            targetRole={selectedPost.role}
            viewerRole={channel.role}
            onClose={() => setContextMenu(null)}
            onReply={() => { setReplyingTo(selectedPost); textareaRef.current?.focus() }}
            onCopy={() => void handleCopy(selectedPost)}
            onTogglePin={() => handleTogglePin(selectedPost.id)}
            onDelete={() => handleDelete(selectedPost.id)}
            onKick={() => {
              const userId = selectedPost.authorId
              if (userId) {
                removeMember.mutate(userId)
              }
              updatePosts((current) => current.filter((p) => p.author !== selectedPost.author))
            }}
            onPromote={() => {
              const userId = selectedPost.authorId
              if (userId) {
                updateMemberRole.mutate({ user_id: userId, role: 'ADMIN' })
              }
              updatePosts((current) =>
                current.map((p) => p.author === selectedPost.author ? { ...p, role: 'Admin' } : p),
              )
            }}
            onDemote={() => {
              const userId = selectedPost.authorId
              if (userId) {
                updateMemberRole.mutate({ user_id: userId, role: 'MEMBER' })
              }
              updatePosts((current) =>
                current.map((p) => p.author === selectedPost.author ? { ...p, role: 'Member' } : p),
              )
            }}
          />
        ) : null}
      </div>

    </div>
  )
}
