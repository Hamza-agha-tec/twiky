'use client'

import Image from 'next/image'
import { useRouter as useNextRouter } from 'next/navigation'
import {
  fetchPublicRoom,
  toggleRoomLike,
  type PublicRoomPayload,
} from '@/lib/rooms-api'
import type { PixelRoomState } from '@/components/game/game-data'

type PublicPixelRoomPayload = PublicRoomPayload<PixelRoomState>
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
  AudioLines,
  BarChart3,
  Bookmark,
  Crown,
  FileUp,
  Gamepad2,
  Heart,
  Mic,
  Square,
  MessageSquare,
  MessageCircle,
  MoreHorizontal,
  Paperclip,
  Pin,
  Play,
  PinOff,
  Plus,
  Reply,
  SendHorizontal,
  Share2,
  Shield,
  Trash2,
  UserCheck,
  UserMinus,
  UserPlus,
  Users,
  X,
} from 'lucide-react'

import { FeedPostContextMenu } from '@/components/chat/feed-post-context-menu'
import { HoverProfileCard } from '@/components/chat/hover-profile-card'
import { UserAvatar } from '@/components/chat/user-avatar'
import { VoiceMessagePlayer } from '@/components/chat/voice-message-player'
import { VideoPlayer } from '@/components/chat/video-player'
import { LinkPreviewCard, extractFirstUrl } from '@/components/chat/link-preview-card'
import { EmojiButton, GifButton, StickerButton, GiftButton } from '@/components/chat/media-picker'
import { AppleText, EmojiImg } from '@/components/chat/apple-text'
import { RichTextComposer, type RichTextComposerHandle } from './rich-text-composer'
import { VerifiedBadge, getVerifiedBadgeVariant, hasPremiumPlan, isVerifiedAccountIdentity } from '@/components/chat/verified-badge'
import { UserName } from '@/components/chat/user-name'
import type { NameEffect } from '@/lib/user-api'
import type { MockChannelGroup, WorkspaceChannel } from '@/components/chat/channels-panel'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Skeleton } from '@/components/ui/skeleton'
import { type ChatMessage } from '@/hooks/use-messaging'
import { useRemoveGroupMember, useUpdateGroupMemberRole } from '@/hooks/use-groups'
import { useProfile, useSendFollowRequest, useUserById, useUserFollowers, useUserFollowing, useUserPosts } from '@/hooks/use-user'
import { useOnlineUsers } from '@/hooks/use-socket'
import { useAuth } from '@/context/AuthContext'
import { useVoiceRoomLive } from '@/hooks/use-voice-room-live'
import { filesApi } from '@/lib/files-api'
import type { GroupMember, GroupMessageMention, LinkEmbed } from '@/lib/groups-api'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

interface FeedMedia {
  alt: string
  label: string
  src: string
}

export type FeedSubPlan = 'FREE' | 'PRO' | 'GEEK'
export type StoryRingState = 'none' | 'seen' | 'unseen'

const FEED_POLL_PREFIX = '__twiky_poll__:'

export interface FeedPollOption {
  id: string
  text: string
  voters?: string[]
  votes: number
  votedByMe?: boolean
}

export interface FeedPoll {
  allowMultiple?: boolean
  options: FeedPollOption[]
  question: string
}

function createPollPayload(question: string, optionTexts: string[], allowMultiple = false): FeedPoll {
  return {
    allowMultiple,
    question: question.trim(),
    options: optionTexts
      .map((text, index) => ({
        id: `option-${index + 1}`,
        text: text.trim(),
            voters: [],
            votes: 0,
            votedByMe: false,
      }))
      .filter((option) => option.text),
  }
}

export function encodeFeedPollPayload(poll: FeedPoll) {
  return `${FEED_POLL_PREFIX}${JSON.stringify(poll)}`
}

export function parseFeedPollPayload(value: string | null | undefined, currentUserId?: string | null): FeedPoll | null {
  if (!value?.startsWith(FEED_POLL_PREFIX)) return null

  try {
    const parsed = JSON.parse(value.slice(FEED_POLL_PREFIX.length)) as Partial<FeedPoll>
    const question = typeof parsed.question === 'string' ? parsed.question.trim() : ''
    const options = Array.isArray(parsed.options)
      ? parsed.options
          .map((option, index) => ({
            id: typeof option?.id === 'string' ? option.id : `option-${index + 1}`,
            text: typeof option?.text === 'string' ? option.text.trim() : '',
            voters: Array.isArray(option?.voters)
              ? option.voters.filter((id: unknown): id is string => typeof id === 'string')
              : [],
            votes: typeof option?.votes === 'number' && Number.isFinite(option.votes) ? Math.max(0, option.votes) : 0,
            votedByMe: Boolean(option?.votedByMe),
          }))
          .map((option) => ({
            ...option,
            votes: option.voters.length > 0 ? option.voters.length : option.votes,
            votedByMe: currentUserId ? option.voters.includes(currentUserId) : option.votedByMe,
          }))
          .filter((option) => option.text)
      : []

    if (!question || options.length < 2) return null
    return { allowMultiple: Boolean(parsed.allowMultiple), options, question }
  } catch {
    return null
  }
}

function isProbablyImageUrl(url: string): boolean {
  try {
    const pathname = new URL(url, typeof window !== 'undefined' ? window.location.origin : 'http://localhost')
      .pathname.toLowerCase()
    return /\.(png|jpe?g|webp|gif|svg|avif|bmp|ico)$/i.test(pathname)
  } catch {
    return /\.(png|jpe?g|webp|gif|svg)(\?|$)/i.test(url)
  }
}

function isProbablyAudioUrl(url: string): boolean {
  try {
    const pathname = new URL(url, typeof window !== 'undefined' ? window.location.origin : 'http://localhost')
      .pathname.toLowerCase()
    return /\.(wav|mp3|m4a|aac|ogg|webm)$/i.test(pathname)
  } catch {
    return /\.(wav|mp3|m4a|aac|ogg|webm)(\?|$)/i.test(url)
  }
}

function isProbablyVideoUrl(url: string): boolean {
  try {
    const pathname = new URL(url, typeof window !== 'undefined' ? window.location.origin : 'http://localhost')
      .pathname.toLowerCase()
    return /\.(mp4|webm|mov|avi|mkv|m4v)$/i.test(pathname)
  } catch {
    return /\.(mp4|webm|mov|avi|mkv|m4v)(\?|$)/i.test(url)
  }
}

function formatDuration(seconds?: number | null) {
  if (seconds === null || seconds === undefined) return null
  if (!Number.isFinite(seconds)) return null
  const total = Math.max(0, Math.floor(seconds))
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

interface FeedReaction {
  emoji: string
  count: number
  mine: boolean
  users?: Array<{ id: string; name: string }>
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
  authorSubPlan?: FeedSubPlan | null
  isSystem?: boolean
  role: string
  time: string
  body: string
  isOwn?: boolean
  media?: FeedMedia[]
  poll?: FeedPoll
  imageUrl?: string
  attachmentType?: 'voice' | 'image' | 'gif' | 'sticker' | 'file'
  attachmentMime?: string | null
  attachmentDuration?: number | null
  pinned?: boolean
  reactions: FeedReaction[]
  replyCount: number
  replyTo?: { author: string; body: string }
  tags?: string[]
  embeds?: LinkEmbed[]
}

function SystemFeedRow({ post }: { post: FeedPost }) {
  return (
    <div className="flex justify-center px-4 py-2">
      <div className="max-w-[80%] rounded-full border border-border/70 bg-muted/45 px-3 py-1.5 text-center">
        <div className="text-[12px] leading-5 text-muted-foreground flex items-center justify-center gap-2">
          {renderContent(post.body)}
          <span className="text-[10px] font-medium uppercase tracking-[0.06em] text-muted-foreground/70">
            {post.time}
          </span>
        </div>
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
  subPlan?: FeedSubPlan | null
  location: string
  name: string
  nameEffect?: string | null
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
  subPlan?: FeedSubPlan | null
  isVerified?: boolean
  name: string
  status: string
  targetUserId?: string
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


const ROLE_COLORS: Record<string, string> = {
  'Studio Lead':    'text-amber-500',
  'Automation':     'text-zinc-400',
  'Release Manager':'text-emerald-500',
  'Design':         'text-fuchsia-500',
  'UX':             'text-violet-500',
  'Frontend':       'text-zinc-300',
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
    subPlan: post.authorSubPlan ?? null,
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
  subPlan = null,
  followers,
  following,
  posts,
}: {
  id?: string
  avatarUrl: string | null
  handle?: string | null
  name: string
  role?: string
  status?: string
  isVerified?: boolean
  subPlan?: FeedSubPlan | null
  followers?: number
  following?: number
  posts?: number
}): FeedMemberProfile {
  const defaults = FEED_MEMBER_PROFILES[name] ?? {
    accent: 'from-slate-500 via-slate-700 to-slate-900',
    bio: `${name} is active in ${role.toLowerCase()} work across direct and channel conversations.`,
    focus: `Following up on ${role.toLowerCase()} updates inside the workspace.`,
    followers: followers ?? 0,
    following: following ?? 0,
    handle: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    location: 'Workspace',
    posts: posts ?? 0,
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
    followers: followers ?? defaults.followers,
    following: following ?? defaults.following,
    posts: posts ?? defaults.posts,
    isVerified,
    subPlan,
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

type StoredRoomPreview = {
  image: string
  savedAt: string
  username: string | null
  objectCount: number
}

function readStoredRoomPreview(userId?: string | null, username?: string | null): StoredRoomPreview | null {
  if (typeof window === 'undefined') return null

  const raw = (userId ? window.localStorage.getItem(`twiky-pixel-room-preview:${userId}`) : null)
    ?? (username ? window.localStorage.getItem(`twiky-pixel-room-preview:username:${username}`) : null)

  if (!raw) return null

  try {
    const parsed = JSON.parse(raw) as Partial<StoredRoomPreview>
    if (typeof parsed.image !== 'string') return null

    return {
      image: parsed.image,
      savedAt: typeof parsed.savedAt === 'string' ? parsed.savedAt : new Date().toISOString(),
      username: typeof parsed.username === 'string' ? parsed.username : null,
      objectCount: Number.isFinite(parsed.objectCount) ? Number(parsed.objectCount) : 0,
    }
  } catch {
    return null
  }
}

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
    body: group.kind === 'board'
      ? `Board is ready. Start topics, collect replies, and keep longer discussions organized inside ${channel.label}.`
      : group.label.toLowerCase() === 'general'
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


function emojiToUnified(emoji: string): string {
  return [...emoji].map(c => c.codePointAt(0)!.toString(16).toLowerCase()).join('-')
}

function renderContent(content: string, className?: string) {
  if (!content) return null
  if (content.startsWith('<') && content.endsWith('>')) {
    return (
      <div 
        className={cn("prose prose-sm dark:prose-invert max-w-none break-words", className)}
        dangerouslySetInnerHTML={{ __html: content }} 
      />
    )
  }
  return <AppleText text={content} className={cn("text-[13.5px] leading-[1.55] text-foreground", className)} />
}

function plainTextExcerpt(value: string | null | undefined, maxLength = 120) {
  const plain = (value ?? '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]*(>|$)/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim()

  if (!plain) return ''
  return plain.length > maxLength ? `${plain.slice(0, maxLength)}…` : plain
}

// ─── Forum Post Card (inline — avoids circular dep with message-bubble) ──────

interface ForumPostEmbedPayload { __twiky_type: 'forum_post'; title: string; content: string; imageUrl: string | null; groupName: string; url?: string | null }

function tryParseForumPost(body: string): ForumPostEmbedPayload | null {
  try {
    const p = JSON.parse(body)
    if (p?.__twiky_type === 'forum_post') return p as ForumPostEmbedPayload
  } catch { /* not JSON */ }
  return null
}

function ForumPostEmbed({ data }: { data: ForumPostEmbedPayload }) {
  const router = useNextRouter()
  const summary = plainTextExcerpt(data.content)
  function handleClick(e: React.MouseEvent) {
    e.stopPropagation()
    if (data.url) router.push(data.url)
  }
  return (
    <div
      onClick={data.url ? handleClick : undefined}
      className={cn(
        'mt-1 w-[260px] overflow-hidden rounded-xl border border-border/60 bg-muted/30 transition-colors hover:bg-muted/50',
        data.url && 'cursor-pointer',
      )}
    >
      {data.imageUrl && (
        <img src={data.imageUrl} alt="" className="h-[120px] w-full object-cover" />
      )}
      <div className="px-3 py-2.5 space-y-1.5">
        <p className="text-[11px] font-bold uppercase tracking-widest text-primary/70">#{data.groupName}</p>
        <p className="text-[13px] font-bold text-foreground leading-snug line-clamp-2">{data.title}</p>
        {summary && (
          <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-2">{summary}</p>
        )}
        <div className="pt-1 border-t border-border/40">
          <span className="text-[11px] font-semibold text-primary">See post →</span>
        </div>
      </div>
    </div>
  )
}

// ─── Voice Invite Card ───────────────────────────────────────────────────────

interface VoiceInviteEmbedPayload {
  __twiky_type: 'voice_invite'
  groupId: string
  groupName: string
  channelId?: string
  inviterName: string
  participants?: { id: string; name: string; avatarUrl: string | null }[]
}

function tryParseVoiceInvite(body: string): VoiceInviteEmbedPayload | null {
  try {
    const p = JSON.parse(body)
    if (p?.__twiky_type === 'voice_invite') return p as VoiceInviteEmbedPayload
  } catch { /* not JSON */ }
  return null
}

function VoiceInviteEmbed({ data }: { data: VoiceInviteEmbedPayload }) {
  const router = useNextRouter()
  const { participants: livePts, lastEvent } = useVoiceRoomLive(data.groupId)

  const isActive = livePts === null ? true : livePts.length > 0
  const displayPts = livePts ?? (data.participants ?? [])
  const shownPts = displayPts.slice(0, 5)
  const overflow = displayPts.length - shownPts.length

  function handleJoin(e: React.MouseEvent) {
    e.stopPropagation()
    if (!isActive) return
    if (data.channelId && data.groupId) {
      router.push(`/channels/${data.channelId}/group/${data.groupId}`)
    }
  }

  return (
    <div className={`mt-1 w-[268px] overflow-hidden rounded-2xl border shadow-xl transition-all duration-300 ${isActive ? 'border-zinc-800 bg-zinc-950 hover:border-zinc-700' : 'border-zinc-800/40 bg-zinc-950/50'}`}>
      <div className={`h-0.5 w-full bg-gradient-to-r ${isActive ? 'from-zinc-700 via-zinc-500 to-zinc-700' : 'from-zinc-800/60 via-zinc-700/60 to-zinc-800/60'}`} />
      <div className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="flex items-center gap-1.5">
              {isActive ? (
                <>
                  <span className="relative flex h-1.5 w-1.5 shrink-0">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-60" />
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-green-500" />
                  </span>
                  <span className="text-[9px] font-semibold uppercase tracking-widest text-green-500">Voice · Live</span>
                </>
              ) : (
                <>
                  <span className="relative inline-flex h-1.5 w-1.5 shrink-0 rounded-full bg-zinc-600" />
                  <span className="text-[9px] font-semibold uppercase tracking-widest text-zinc-600">Room Expired</span>
                </>
              )}
            </div>
            <p className={`text-[14px] font-bold leading-snug truncate ${isActive ? 'text-zinc-50' : 'text-zinc-500'}`}>{data.groupName}</p>
            {shownPts.length > 0 ? (
              <div className="flex items-center gap-1.5 pt-0.5">
                <div className="flex items-center">
                  {shownPts.map((p, i) => (
                    <div
                      key={p.id}
                      className="relative shrink-0"
                      style={{ marginLeft: i === 0 ? 0 : -6, zIndex: shownPts.length - i }}
                      title={p.name}
                    >
                      <div className={`flex h-5 w-5 items-center justify-center overflow-hidden rounded-full ring-2 ring-zinc-950 text-[8px] font-bold transition-all ${isActive ? 'bg-zinc-700 text-zinc-200' : 'bg-zinc-800/60 text-zinc-600'}`}>
                        {p.avatarUrl ? (
                          <img src={p.avatarUrl} alt={p.name} className={`block h-full w-full object-cover ${!isActive && 'opacity-30'}`} />
                        ) : (
                          p.name[0]?.toUpperCase() ?? '?'
                        )}
                      </div>
                    </div>
                  ))}
                  {overflow > 0 && <span className="ml-1 text-[9px] font-semibold text-zinc-500">+{overflow}</span>}
                </div>
                <span className="text-[10px] text-zinc-500">
                  {isActive ? `${displayPts.length} in call` : `${displayPts.length} were in call`}
                </span>
              </div>
            ) : (
              <p className="text-[10px] text-zinc-600">Shared by <span className="text-zinc-500">@{data.inviterName}</span></p>
            )}
          </div>
          <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border transition-all ${isActive ? 'bg-zinc-900 border-zinc-800 text-zinc-400' : 'bg-zinc-900/30 border-zinc-800/30 text-zinc-700'}`}>
            {isActive ? <AudioLines className="h-4 w-4 animate-pulse" /> : <AudioLines className="h-4 w-4 opacity-30" />}
          </div>
        </div>

        {lastEvent && isActive && (
          <div className="flex items-center gap-1.5 rounded-lg bg-zinc-900/60 px-2.5 py-1.5">
            <span className={`text-[9px] font-bold ${lastEvent.type === 'join' ? 'text-green-500' : 'text-zinc-500'}`}>
              {lastEvent.type === 'join' ? '↑' : '↓'}
            </span>
            <span className="truncate text-[11px] text-zinc-400">
              <span className="font-semibold text-zinc-300">{lastEvent.name}</span>
              {lastEvent.type === 'join' ? ' joined' : ' left'}
            </span>
          </div>
        )}

        {isActive ? (
          <button
            onClick={handleJoin}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-zinc-100 px-3 py-2 text-[11px] font-bold text-zinc-900 shadow-sm transition-all hover:bg-white active:scale-[0.98]"
          >
            <Play className="h-3 w-3 fill-current" />
            Join Voice Room
          </button>
        ) : (
          <div className="flex w-full items-center justify-center gap-2 rounded-xl bg-zinc-900/40 border border-zinc-800/30 px-3 py-2 text-[11px] font-medium text-zinc-600 cursor-not-allowed select-none">
            <AudioLines className="h-3 w-3 opacity-50" />
            Room no longer active
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Pixel Room Invite Card ─────────────────────────────────────────────────

interface PixelRoomInviteEmbedPayload {
  __twiky_type: 'pixel_room_invite'
  groupId: string
  groupName: string
  channelId: string
  inviterName: string
}

function tryParsePixelRoomInvite(body: string): PixelRoomInviteEmbedPayload | null {
  try {
    const p = JSON.parse(body)
    if (p?.__twiky_type === 'pixel_room_invite') return p as PixelRoomInviteEmbedPayload
  } catch { /* not JSON */ }
  return null
}

function PixelRoomInviteEmbed({ data }: { data: PixelRoomInviteEmbedPayload }) {
  const router = useNextRouter()
  function handleEnter(e: React.MouseEvent) {
    e.stopPropagation()
    router.push(`/channels/${data.channelId}/group/${data.groupId}`)
  }
  return (
    <div className="mt-1 w-[268px] overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950 shadow-xl transition-all duration-300 hover:border-zinc-700">
      <div className="h-0.5 w-full bg-gradient-to-r from-fuchsia-700 via-fuchsia-500 to-fuchsia-700" />
      <div className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="flex items-center gap-1.5">
              <span className="relative flex h-1.5 w-1.5 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-fuchsia-400 opacity-60" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-fuchsia-500" />
              </span>
              <span className="text-[9px] font-semibold uppercase tracking-widest text-fuchsia-400">Pixel Room</span>
            </div>
            <p className="text-[14px] font-bold leading-snug truncate text-zinc-50">{data.groupName}</p>
            <p className="text-[10px] text-zinc-600">
              Shared by <span className="text-zinc-500">@{data.inviterName}</span>
            </p>
          </div>
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-zinc-800 bg-zinc-900 text-fuchsia-400">
            <Gamepad2 className="h-4 w-4" />
          </div>
        </div>
        <button
          onClick={handleEnter}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-zinc-100 px-3 py-2 text-[11px] font-bold text-zinc-900 shadow-sm transition-all hover:bg-white active:scale-[0.98]"
        >
          <Play className="h-3 w-3 fill-current" />
          Enter Pixel Room
        </button>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────

function ReactionsBar({
  reactions,
  onReact,
}: {
  reactions: FeedReaction[]
  onReact: (emoji: string) => void
}) {
  if (!reactions || reactions.length === 0) return null

  return (
    <div className="flex flex-wrap items-center gap-1 mt-1">
      {reactions.map((reaction) => (
        <button
          key={reaction.emoji}
          type="button"
          onClick={() => onReact(reaction.emoji)}
          title={reaction.mine ? 'Remove reaction' : 'React'}
          className={cn(
            'group inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold transition-all duration-150 select-none',
            reaction.mine
              ? 'bg-primary/15 text-primary ring-1 ring-primary/40 hover:bg-primary/20'
              : 'bg-muted/60 text-muted-foreground ring-1 ring-border hover:bg-muted hover:text-foreground hover:ring-border/80',
          )}
        >
          <EmojiImg value={reaction.emoji} unified={emojiToUnified(reaction.emoji)} size={15} />
          <span className={cn('tabular-nums leading-none', reaction.mine ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground')}>
            {reaction.count}
          </span>
        </button>
      ))}
    </div>
  )
}

function FeedPollCard({
  poll,
  onVote,
}: {
  poll: FeedPoll
  onVote: (optionId: string) => void
}) {
  const totalVotes = poll.options.reduce((total, option) => total + option.votes, 0)

  return (
    <div className="mt-2 w-full max-w-md rounded-xl border border-border bg-background/70 p-3">
      <div className="mb-2 flex items-center gap-2">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <BarChart3 className="h-3.5 w-3.5" />
        </span>
        <p className="min-w-0 flex-1 text-[13px] font-semibold leading-snug text-foreground">
          {poll.question}
        </p>
      </div>

      <div className="space-y-1.5">
        {poll.options.map((option) => {
          const percent = totalVotes > 0 ? Math.round((option.votes / totalVotes) * 100) : 0

          return (
            <button
              key={option.id}
              type="button"
              onClick={() => onVote(option.id)}
              className={cn(
                'relative w-full overflow-hidden rounded-lg border px-3 py-2 text-left transition-colors',
                option.votedByMe
                  ? 'border-primary/50 bg-primary/10'
                  : 'border-border bg-muted/30 hover:bg-muted/55',
              )}
            >
              <span
                className="absolute inset-y-0 left-0 bg-primary/15 transition-[width]"
                style={{ width: `${percent}%` }}
              />
              <span className="relative flex items-center gap-2">
                <span
                  className={cn(
                    'h-3.5 w-3.5 shrink-0 rounded-full border',
                    option.votedByMe ? 'border-primary bg-primary shadow-inner' : 'border-muted-foreground/40',
                  )}
                />
                <span className="min-w-0 flex-1 truncate text-[12px] font-medium text-foreground">
                  {option.text}
                </span>
                <span className="shrink-0 text-[11px] font-semibold tabular-nums text-muted-foreground">
                  {percent}%
                </span>
              </span>
            </button>
          )
        })}
      </div>

      <p className="mt-2 text-[10px] text-muted-foreground">
        {totalVotes} {totalVotes === 1 ? 'vote' : 'votes'}{poll.allowMultiple ? ' · multiple choices' : ''}
      </p>
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
  onPollVote,
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
  onPollVote: (optionId: string) => void
  onReply: () => void
  onPin: () => void
  onDelete: () => void
  onContextMenu: (e: MouseEvent) => void
}) {
  const [profileOpen, setProfileOpen] = useState(false)
  const [isFollowing, setIsFollowing] = useState(false)
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null)

  const onlineUsers = useOnlineUsers()
  const isOnline = memberProfile.id ? onlineUsers.has(memberProfile.id) : false

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
      sub_plan: realUser?.sub_plan ?? memberProfile.subPlan ?? null,
    }),
    subPlan: realUser?.sub_plan ?? memberProfile.subPlan ?? null,
    nameEffect: realUser?.name_effect ?? memberProfile.nameEffect ?? null,
  }

  const roleColor = ROLE_COLORS[post.role] ?? 'text-primary'
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
            'group relative flex gap-3 px-4 py-0.5 transition-colors hover:bg-accent/20',
            !isGrouped && 'mt-3 pt-1',
          )}
          onContextMenu={onContextMenu}
        >
          {/* Avatar — always shown */}
          <div className="mt-0.5 w-9 flex-shrink-0">
            <PopoverTrigger asChild>
              <button
                className="flex h-9 w-9 cursor-pointer overflow-hidden rounded-full ring-2 ring-background focus:outline-none"
                aria-label={`Open ${post.author} actions`}
              >
                <UserAvatar src={displayAvatar} alt={post.author} className="h-full w-full rounded-full object-cover" />
              </button>
            </PopoverTrigger>
          </div>

          <div className="min-w-0 flex-1">
            {/* Name + time — always shown */}
            <div className="mb-0.5 flex items-baseline gap-2">
              <button
                onClick={() => setProfileOpen(true)}
                className={cn('inline-flex items-center gap-1 text-[14px] font-semibold leading-none hover:underline', roleColor)}
              >
                {post.author}
                {resolvedProfile.isVerified ? <VerifiedBadge size="xs" variant={getVerifiedBadgeVariant(resolvedProfile.subPlan)} /> : null}
              </button>
              <span className="text-[11px] text-muted-foreground">{post.time}</span>
              {post.pinned ? <Pin className="h-3 w-3 text-primary" /> : null}
            </div>

            {post.replyTo ? (
              <div className="mb-1 flex cursor-pointer items-center gap-2 opacity-70 transition-opacity hover:opacity-100">
                <div className="ml-2 h-3 w-3 flex-shrink-0 rounded-tl border-l-2 border-t-2 border-muted-foreground" />
                <span className="text-[11px] font-semibold text-muted-foreground">{post.replyTo.author}</span>
                <AppleText text={post.replyTo.body ?? ''} className="truncate text-[11px] text-muted-foreground" />
              </div>
            ) : null}

            {post.body ? (() => {
              const voiceInvite = tryParseVoiceInvite(post.body)
              if (voiceInvite) return <VoiceInviteEmbed data={voiceInvite} />
              const pixelInvite = tryParsePixelRoomInvite(post.body)
              if (pixelInvite) return <PixelRoomInviteEmbed data={pixelInvite} />
              const forumPost = tryParseForumPost(post.body)
              if (forumPost) return <ForumPostEmbed data={forumPost} />
              const firstUrl = extractFirstUrl(post.body)
              return (
                <>
                  {renderContent(post.body)}
                  {firstUrl && <LinkPreviewCard url={firstUrl} />}
                </>
              )
            })() : null}

            {post.embeds && post.embeds.length > 0
              ? post.embeds.map((emb, idx) => <LinkPreviewCard key={idx} url={emb.url} />)
              : null}

            {post.poll ? (
              <FeedPollCard poll={post.poll} onVote={onPollVote} />
            ) : null}

            {(post.media?.length || post.imageUrl) ? (
              <div className={cn('mt-2 flex flex-wrap gap-2')}>
                {post.imageUrl ? (
                  post.attachmentType === 'voice' || isProbablyAudioUrl(post.imageUrl) ? (
                    <VoiceMessagePlayer src={post.imageUrl} durationSeconds={post.attachmentDuration ?? undefined} />
                  ) : post.attachmentType === 'gif' || (isProbablyImageUrl(post.imageUrl) && post.attachmentMime === 'image/gif' && post.attachmentType !== 'image') ? (
                    <div className="relative inline-block">
                      <img
                        src={post.imageUrl}
                        alt="GIF"
                        className="max-h-52 max-w-[260px] rounded-lg object-contain"
                      />
                      <span className="absolute bottom-1.5 left-1.5 rounded bg-black/60 px-1 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">
                        GIF
                      </span>
                    </div>
                  ) : post.attachmentType === 'sticker' ? (
                    <img
                      src={post.imageUrl}
                      alt="Sticker"
                      className="h-28 w-28 object-contain"
                    />
                  ) : isProbablyImageUrl(post.imageUrl) ? (
                    <img
                      src={post.imageUrl}
                      alt="Uploaded"
                      className="max-h-56 max-w-[300px] cursor-pointer rounded-lg object-cover transition-opacity hover:opacity-90"
                      onClick={() => setLightboxSrc(post.imageUrl!)}
                    />
                  ) : post.attachmentMime?.startsWith('video/') || isProbablyVideoUrl(post.imageUrl) ? (
                    <VideoPlayer src={post.imageUrl} className="w-full max-w-[300px]" />
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
                  <div
                    key={media.label}
                    className="relative h-36 w-56 cursor-pointer overflow-hidden rounded-xl border border-border transition-opacity hover:opacity-90"
                    onClick={() => setLightboxSrc(media.src)}
                  >
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
              <ReactionsBar reactions={post.reactions} onReact={onReact} />

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
                  <UserAvatar src={displayAvatar} alt={post.author} className="h-full w-full rounded-full object-cover" />
                </div>
                {isOnline && <span className="absolute bottom-1 right-0.5 h-[14px] w-[14px] rounded-full border-[2.5px] border-popover bg-emerald-500" />}
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
            <UserName name={resolvedProfile.name} effect={resolvedProfile.nameEffect as NameEffect} subPlan={resolvedProfile.subPlan} className="text-[19px] font-black leading-none" />
            <p className="mt-1 text-[12px] text-muted-foreground">@{resolvedProfile.handle}</p>

            {/* Inner content card */}
            <div className="mt-3 rounded-lg bg-muted/50 px-3 py-3 space-y-3 text-[13px]">

              {/* Status */}
              <div className="flex items-center gap-2 text-foreground/80">
                <span className={cn('h-[8px] w-[8px] flex-shrink-0 rounded-full', isOnline ? 'bg-emerald-500' : 'bg-zinc-400')} />
                {isOnline ? (resolvedProfile.status || 'Online') : 'Offline'}
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
      {lightboxSrc && (
        <div
          className="fixed inset-0 z-[999] flex items-center justify-center bg-black/80 backdrop-blur-sm"
          onClick={() => setLightboxSrc(null)}
        >
          <div
            className="relative max-h-[85vh] max-w-4xl overflow-hidden rounded-2xl shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <img src={lightboxSrc} alt="Preview" className="max-h-[85vh] max-w-full object-contain" />
            <button
              onClick={() => setLightboxSrc(null)}
              className="absolute right-2 top-2 rounded-full bg-black/60 p-1.5 text-white hover:bg-black/80"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
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
  if (Number.isNaN(date.getTime())) return 'Today'
  const month = date.toLocaleDateString('en-US', { month: 'short' })
  const day = date.getDate()
  const time = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
  return `${month} ${day}, ${time}`
}

function FeedMemberProfileSkeleton({ onBack }: { onBack: () => void }) {
  return (
    <div className="flex flex-1 flex-col overflow-y-auto bg-background text-foreground" aria-busy="true">
      <div className="relative h-[118px] flex-shrink-0 overflow-hidden">
        <Skeleton className="absolute inset-0 h-full w-full rounded-none" />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-background/70" />
        <button
          type="button"
          onClick={onBack}
          className="absolute left-3 top-3 inline-flex h-7 items-center gap-1 rounded-full border border-white/20 bg-black/40 px-2.5 text-[10px] font-semibold text-white/90 backdrop-blur-sm transition-colors hover:bg-black/55"
        >
          <ArrowLeft className="h-3 w-3" />
          Back
        </button>
      </div>

      <div className="px-4 pb-3">
        <div className="-mt-9 mb-2.5 flex items-end justify-between">
          <Skeleton className="h-[68px] w-[68px] rounded-full border-[3px] border-sidebar" />
          <div className="flex items-center gap-2 pb-0.5">
            <Skeleton className="h-7 w-20 rounded-md" />
            <Skeleton className="h-7 w-16 rounded-md" />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-4 w-4 rounded-full" />
          <Skeleton className="h-4 w-14 rounded" />
        </div>
        <Skeleton className="mt-1.5 h-3 w-24" />
        <div className="mt-3 flex items-center gap-4">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-3 w-20" />
        </div>
      </div>

      <div className="mx-4 h-px bg-border" />

      <div className="px-4 py-3">
        <Skeleton className="mb-2 h-2.5 w-12" />
        <div className="space-y-1.5">
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-11/12" />
          <Skeleton className="h-3 w-2/3" />
        </div>
        <div className="mt-3 space-y-2">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-3 w-36" />
        </div>
      </div>

      <div className="mx-4 h-px bg-border" />

      <div className="px-4 pt-3 pb-2.5">
        <div className="grid grid-cols-4 gap-1 rounded-xl border border-border bg-card p-1">
          {[0, 1, 2, 3].map((item) => (
            <Skeleton key={item} className="h-7 rounded-lg" />
          ))}
        </div>
      </div>

      <div className="flex-1 space-y-2 px-4 pb-4">
        <FeedProfilePostsSkeleton />
      </div>
    </div>
  )
}

function FeedProfilePostsSkeleton() {
  return (
    <>
      {[0, 1, 2].map((item) => (
        <div key={item} className="overflow-hidden rounded-xl border border-border bg-card p-2.5">
          <div className="flex items-start justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <Skeleton className="h-6 w-6 flex-shrink-0 rounded-full" />
              <div className="space-y-1.5">
                <Skeleton className="h-3 w-28" />
                <Skeleton className="h-2.5 w-16" />
              </div>
            </div>
            <Skeleton className="h-4 w-4 rounded-full" />
          </div>
          <div className="mt-3 space-y-1.5">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-4/5" />
          </div>
          <Skeleton className="mt-3 h-[84px] w-full rounded-[8px]" />
          <div className="mt-3 flex items-center gap-3 border-t border-border pt-2">
            <Skeleton className="h-3 w-10" />
            <Skeleton className="h-3 w-10" />
            <Skeleton className="h-3 w-10" />
            <Skeleton className="ml-auto h-3 w-12" />
          </div>
        </div>
      ))}
    </>
  )
}

export function FeedMemberProfileView({
  currentGroupLabel,
  isOwn,
  memberProfile,
  messagePending,
  onBack,
  onMessage,
  onOpenStory,
  posts,
  showMessageAction = true,
  storyRingState = 'none',
  hideRole = false,
}: {
  currentGroupLabel: string
  isOwn: boolean
  memberProfile: FeedMemberProfile
  messagePending: boolean
  onBack: () => void
  onMessage: () => void
  onOpenStory?: (userId: string) => void
  posts: FeedPost[]
  showMessageAction?: boolean
  storyRingState?: StoryRingState
  hideRole?: boolean
}) {
  const [activeTab, setActiveTab] = useState<'posts' | 'articles' | 'pixel-room' | 'saved'>('pixel-room')
  const [followRequested, setFollowRequested] = useState(false)
  const [followSheet, setFollowSheet] = useState<'followers' | 'following' | null>(null)
  const [viewingUser, setViewingUser] = useState<FeedMemberProfile | null>(null)
  const [roomPreview, setRoomPreview] = useState<StoredRoomPreview | null>(null)
  const [roomPayload, setRoomPayload] = useState<PublicPixelRoomPayload | null>(null)
  const pixelRouter = useNextRouter()

  const { user: authUser } = useAuth()
  const { data: currentUser } = useProfile()
  const { data: realUser, isLoading: realUserLoading } = useUserById(memberProfile.id)
  const { data: followersData, isLoading: followersLoading } = useUserFollowers(memberProfile.id)
  const { data: followingData, isLoading: followingLoading } = useUserFollowing(memberProfile.id)
  const sendFollowRequest = useSendFollowRequest()
  const {
    data: backendPosts = [],
    isError: backendPostsError,
    isLoading: backendPostsLoading,
  } = useUserPosts(memberProfile.id)
  const isInitialProfileLoading = Boolean(
    memberProfile.id &&
      ((realUserLoading && !realUser) ||
        (followersLoading && !followersData) ||
        (followingLoading && !followingData) ||
        (backendPostsLoading && backendPosts.length === 0)),
  )

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
        sub_plan: realUser?.sub_plan ?? memberProfile.subPlan ?? null,
      },
      {
        email: currentUser?.email ?? authUser?.email,
        id: currentUser?.id,
        is_verified: currentUser?.is_verified,
        sub_plan: currentUser?.sub_plan,
      },
    ),
    subPlan: realUser?.sub_plan ?? memberProfile.subPlan ?? null,
    nameEffect: realUser?.name_effect ?? memberProfile.nameEffect ?? null,
  }

  const onlineUsers = useOnlineUsers()
  const isOnline = memberProfile.id ? onlineUsers.has(memberProfile.id) : false

  const bannerImage = realUser?.banner ?? null
  const avatarImage = resolvedProfile.avatarUrl ?? null
  const profileBadgeVariant = getVerifiedBadgeVariant(resolvedProfile.subPlan)
  const canOpenStory = storyRingState !== 'none' && Boolean(memberProfile.id && onOpenStory)

  const roomUsername = realUser?.username ?? resolvedProfile.handle

  useEffect(() => {
    const refreshRoomPreview = () => {
      setRoomPreview(readStoredRoomPreview(realUser?.id ?? memberProfile.id, realUser?.username ?? resolvedProfile.handle))
    }

    refreshRoomPreview()
    window.addEventListener('twiky-pixel-room-preview-saved', refreshRoomPreview)

    return () => window.removeEventListener('twiky-pixel-room-preview-saved', refreshRoomPreview)
  }, [memberProfile.id, realUser?.id, realUser?.username, resolvedProfile.handle])

  useEffect(() => {
    const uname = memberProfile.handle || null
    if (!uname) {
      setRoomPayload(null)
      return
    }
    let cancelled = false
    fetchPublicRoom<PixelRoomState>(uname)
      .then((res) => {
        if (!cancelled) setRoomPayload(res)
      })
      .catch(() => {
        if (!cancelled) setRoomPayload(null)
      })
    return () => {
      cancelled = true
    }
  }, [memberProfile.handle, memberProfile.id])

  const handleEnterPixelRoom = () => {
    if (!roomUsername) return
    onBack()
    pixelRouter.push(`/room/${roomUsername}`)
  }

  const handleTogglePixelRoomLike = async () => {
    if (!roomUsername) return
    try {
      const result = await toggleRoomLike(roomUsername)
      setRoomPayload((prev) =>
        prev ? { ...prev, hasLiked: result.liked, likeCount: result.likeCount } : prev,
      )
    } catch (err) {
      console.warn('[pixel-room] like failed', err)
    }
  }

  const pixelRoomLiked = roomPayload?.hasLiked ?? false

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
        onMessage={onMessage}
        posts={[]}
        showMessageAction={showMessageAction}
      />
    )
  }

  if (isInitialProfileLoading) {
    return <FeedMemberProfileSkeleton onBack={onBack} />
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
                onClick={() => setViewingUser(buildStandaloneFeedMemberProfile({ id: u.id, avatarUrl: u.avatar_url, name: u.username, handle: u.username, isVerified: Boolean(u.is_verified || hasPremiumPlan(u.sub_plan)), subPlan: u.sub_plan }))}
                className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-accent"
              >
                <UserAvatar src={u.avatar_url} alt={u.username} className="h-9 w-9 flex-shrink-0 rounded-full object-cover" />
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1 truncate text-[12px] font-semibold text-foreground">
                    @{u.username}
                    {(u.is_verified || hasPremiumPlan(u.sub_plan)) ? <VerifiedBadge size="xs" variant={getVerifiedBadgeVariant(u.sub_plan)} /> : null}
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
            <button
              type="button"
              disabled={!canOpenStory}
              onClick={() => {
                if (memberProfile.id) onOpenStory?.(memberProfile.id)
              }}
              className={cn(
                'rounded-full p-[2px] text-left',
                storyRingState === 'unseen' && 'bg-gradient-to-tr from-[#0080c8] via-[#38b6d8] to-[#92dce5]',
                storyRingState === 'seen' && 'bg-muted-foreground/35',
                storyRingState === 'none' && 'bg-transparent',
                canOpenStory && 'transition-transform hover:scale-[1.03]',
              )}
              aria-label={canOpenStory ? `Open ${resolvedProfile.name}'s story` : undefined}
            >
              <Avatar className="h-[68px] w-[68px] overflow-hidden rounded-full border-[3px] border-sidebar bg-muted shadow-xl">
                <AvatarImage src={avatarImage ?? undefined} alt={resolvedProfile.name} className="h-full w-full rounded-full object-cover" />
                <AvatarFallback className="rounded-full bg-muted text-[18px] font-bold text-foreground">
                  {resolvedProfile.name[0]?.toUpperCase() ?? 'U'}
                </AvatarFallback>
              </Avatar>
            </button>
            {isOnline && <span className="absolute bottom-0.5 right-0.5 h-[12px] w-[12px] rounded-full border-2 border-sidebar bg-emerald-400" />}
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
          <UserName name={resolvedProfile.name} effect={resolvedProfile.nameEffect as NameEffect} subPlan={resolvedProfile.subPlan} className="text-[19px] font-black leading-none tracking-tight" />
          {resolvedProfile.isVerified ? <VerifiedBadge size="sm" variant={profileBadgeVariant} /> : null}
          {!hideRole && <RoleBadge role={resolvedProfile.role} variant="profile" />}
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
            { id: 'pixel-room' as const, label: 'Pixel Room' },
            { id: 'posts' as const, label: 'Posts' },
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
              <FeedProfilePostsSkeleton />
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
                            <UserName name={resolvedProfile.name} effect={resolvedProfile.nameEffect as NameEffect} subPlan={resolvedProfile.subPlan} />{' '}
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
                    <AppleText text={post.body} className="mt-1.5 text-[11px] leading-[1.6] text-foreground" />
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
                src={roomPayload?.image ?? roomPreview?.image ?? PIXEL_ROOM_PREVIEW_SRC}
                alt={`${resolvedProfile.name}'s Pixel Room`}
                className="h-32 w-full object-cover [image-rendering:pixelated]"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
              <div className="absolute bottom-2.5 left-3 right-3 flex items-end justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-[12px] font-bold text-white">{resolvedProfile.name}&apos;s Room</p>
                  <p className="text-[10px] text-white/70">
                    {roomPayload?.image
                      ? 'Pixel World - live snapshot'
                      : roomPreview
                        ? 'Pixel World - saved preview'
                        : 'Pixel World - no saved room yet'}
                  </p>
                </div>
                <span className="rounded-full bg-white/15 px-2 py-0.5 text-[9px] font-semibold text-white backdrop-blur-sm">
                  {roomPayload ? `${roomPayload.likeCount} likes` : 'Preview only'}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-1.5">
              {[
                {
                  label: 'Objects',
                  value: roomPayload?.state?.objects
                    ? String(roomPayload.state.objects.length)
                    : roomPreview
                      ? String(roomPreview.objectCount)
                      : '-',
                },
                {
                  label: 'Visitors',
                  value: roomPayload ? formatCompactCount(roomPayload.visitorCount) : '-',
                },
                {
                  label: 'Likes',
                  value: roomPayload ? formatCompactCount(roomPayload.likeCount) : '-',
                },
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
                onClick={handleEnterPixelRoom}
                disabled={!roomUsername}
                className="h-8 flex-1 rounded-lg bg-primary px-3 text-[11px] font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Enter Room
              </button>
              {!roomPayload?.isOwn && (
                <button
                  type="button"
                  onClick={handleTogglePixelRoomLike}
                  disabled={!roomUsername}
                  aria-pressed={pixelRoomLiked}
                  className={cn(
                    'flex h-8 w-9 items-center justify-center rounded-lg border transition-colors disabled:cursor-not-allowed disabled:opacity-50',
                    pixelRoomLiked
                      ? 'border-rose-400/30 bg-rose-500/10 text-rose-500'
                      : 'border-border bg-card text-muted-foreground hover:text-foreground',
                  )}
                >
                  <Heart className={cn('h-3.5 w-3.5', pixelRoomLiked && 'fill-current')} />
                </button>
              )}
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
  mentionRef,
  post,
  isGrouped,
  myAvatarUrl,
  isMentioned,
  onReact,
  onPollVote,
  onReply,
  onPin,
  onDelete,
  onContextMenu,
  onMessage,
  onViewProfile,
}: {
  authorAvatarUrl?: string | null
  memberProfile: FeedMemberProfile
  mentionRef?: (el: HTMLDivElement | null) => void
  post: FeedPost
  isGrouped: boolean
  myAvatarUrl?: string | null
  isMentioned?: boolean
  onReact: (emoji: string) => void
  onPollVote: (optionId: string) => void
  onReply: () => void
  onPin: () => void
  onDelete: () => void
  onContextMenu: (e: MouseEvent) => void
  onMessage?: () => void
  onViewProfile?: () => void
}) {
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null)
  const avatarRef = useRef<HTMLDivElement>(null)
  const roleColor = ROLE_COLORS[post.role] ?? 'text-primary'
  const displayAvatar = post.isOwn
    ? (authorAvatarUrl ?? myAvatarUrl ?? memberProfile.avatarUrl ?? null)
    : (authorAvatarUrl ?? memberProfile.avatarUrl ?? null)

  return (
    <>
    <div
      ref={mentionRef}
      data-post-id={post.id}
      className={cn(
        'group relative flex gap-3 px-4 transition-colors hover:bg-accent/20',
        'mt-2 py-0.5',
        isMentioned && 'border-l-2 border-primary bg-primary/[0.06]',
      )}
      onContextMenu={onContextMenu}
    >
      <div className="mt-0.5 w-9 flex-shrink-0">
        <HoverProfileCard
          userId={memberProfile.id ?? ''}
          onMessage={post.isOwn ? undefined : (onMessage ? () => onMessage() : undefined)}
          onViewProfile={onViewProfile ? () => onViewProfile() : undefined}
          hideMessage={post.isOwn}
          side="right"
        >
          <div ref={avatarRef} className="flex h-9 w-9 overflow-hidden rounded-full ring-2 ring-background">
            <UserAvatar src={displayAvatar} alt={post.author} className="h-full w-full object-cover" />
          </div>
        </HoverProfileCard>
      </div>

      <div className="min-w-0 flex-1">
        <div className="mb-0.5 flex items-center gap-2">
          <HoverProfileCard userId={memberProfile.id ?? ''} onMessage={post.isOwn ? undefined : (onMessage ? () => onMessage() : undefined)} onViewProfile={onViewProfile ? () => onViewProfile() : undefined} hideMessage={post.isOwn} side="right" anchorRef={avatarRef}>
            <span className={cn('inline-flex cursor-default items-center gap-1 text-[14px] font-semibold leading-none', roleColor)}>
              {post.author}
              {memberProfile.isVerified ? <VerifiedBadge size="xs" variant={getVerifiedBadgeVariant(memberProfile.subPlan)} /> : null}
            </span>
          </HoverProfileCard>
          <span className="text-[11px] text-muted-foreground">{post.time}</span>
          {post.pinned ? <Pin className="h-3 w-3 text-primary" /> : null}
        </div>

        {post.replyTo ? (
          <div className="mb-1 flex cursor-pointer items-center gap-2 opacity-70 transition-opacity hover:opacity-100">
            <div className="ml-2 h-3 w-3 flex-shrink-0 rounded-tl border-l-2 border-t-2 border-muted-foreground" />
            <span className="text-[11px] font-semibold text-muted-foreground">{post.replyTo.author}</span>
            <span className="truncate text-[11px] text-muted-foreground">{post.replyTo.body}</span>
          </div>
        ) : null}

        {post.body ? (() => {
          const voiceInvite = tryParseVoiceInvite(post.body)
          if (voiceInvite) return <VoiceInviteEmbed data={voiceInvite} />
          const pixelInvite = tryParsePixelRoomInvite(post.body)
          if (pixelInvite) return <PixelRoomInviteEmbed data={pixelInvite} />
          const forumPost = tryParseForumPost(post.body)
          if (forumPost) return <ForumPostEmbed data={forumPost} />
          const firstUrl = extractFirstUrl(post.body)
          return (
            <>
              {renderContent(post.body)}
              {firstUrl && <LinkPreviewCard url={firstUrl} />}
            </>
          )
        })() : null}

        {post.poll ? (
          <FeedPollCard poll={post.poll} onVote={onPollVote} />
        ) : null}

        {(post.media?.length || post.imageUrl) ? (
          <div className="mt-2 flex flex-wrap gap-2">
            {post.imageUrl ? (
              post.attachmentType === 'voice' || isProbablyAudioUrl(post.imageUrl) ? (
                <VoiceMessagePlayer src={post.imageUrl} durationSeconds={post.attachmentDuration ?? undefined} />
              ) : post.attachmentType === 'gif' || (isProbablyImageUrl(post.imageUrl) && post.attachmentMime === 'image/gif' && post.attachmentType !== 'image') ? (
                <div className="relative inline-block">
                  <img
                    src={post.imageUrl}
                    alt="GIF"
                    className="max-h-52 max-w-[260px] rounded-lg object-contain"
                  />
                  <span className="absolute bottom-1.5 left-1.5 rounded bg-black/60 px-1 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">
                    GIF
                  </span>
                </div>
              ) : post.attachmentType === 'sticker' ? (
                <img
                  src={post.imageUrl}
                  alt="Sticker"
                  className="h-28 w-28 object-contain"
                />
              ) : isProbablyImageUrl(post.imageUrl) ? (
                <img
                  src={post.imageUrl}
                  alt="Uploaded"
                  className="max-h-56 max-w-[300px] cursor-pointer rounded-lg object-cover transition-opacity hover:opacity-90"
                  onClick={() => setLightboxSrc(post.imageUrl!)}
                />
              ) : post.attachmentMime?.startsWith('video/') || isProbablyVideoUrl(post.imageUrl) ? (
                <VideoPlayer src={post.imageUrl} className="w-full max-w-[300px]" />
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
              <div
                key={media.label}
                className="relative h-36 w-56 cursor-pointer overflow-hidden rounded-xl border border-border transition-opacity hover:opacity-90"
                onClick={() => setLightboxSrc(media.src)}
              >
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
          <ReactionsBar reactions={post.reactions} onReact={onReact} />

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

    </div>
      {lightboxSrc && (
        <div
          className="fixed inset-0 z-[999] flex items-center justify-center bg-black/80 backdrop-blur-sm"
          onClick={() => setLightboxSrc(null)}
        >
          <div
            className="relative max-h-[85vh] max-w-4xl overflow-hidden rounded-2xl shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <img src={lightboxSrc} alt="Preview" className="max-h-[85vh] max-w-full object-contain" />
            <button
              onClick={() => setLightboxSrc(null)}
              className="absolute right-2 top-2 rounded-full bg-black/60 p-1.5 text-white hover:bg-black/80"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </>
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
  onOpenUserStories,
  getUserStoryRingState,
  onProfilePanelWidthChange,
  onProfileSidebarContentChange,
  onProfileCloseRequestChange,
  onCloseFeedRequest,
  onToggleReaction,
  onPollVote,
  onTogglePin,
  onDeletePost,
}: {
  channel: WorkspaceChannel
  group: MockChannelGroup
  members?: GroupMember[]
  myAvatarUrl?: string | null
  postsOverride?: FeedPost[]
  onSendPost?: (input: {
    content: string
    fileUrl?: string
    replyToId?: string
    entityMentions?: GroupMessageMention[]
    type?: 'voice' | 'image' | 'gif' | 'sticker' | 'file'
    mime?: string
    duration?: number
    size?: number
  }) => Promise<void>
  sendingPost?: boolean
  onOpenDirectConversation?: (conversation: string | FeedDirectConversationTarget) => void
  onOpenUserStories?: (userId: string) => void
  getUserStoryRingState?: (userId: string) => StoryRingState
  onProfilePanelWidthChange?: (width: number) => void
  onProfileSidebarContentChange?: (content: ReactNode | null) => void
  onProfileCloseRequestChange?: (closeFn: (() => void) | null) => void
  onCloseFeedRequest?: () => void
  onToggleReaction?: (postId: string, emoji: string) => Promise<void> | void
  onPollVote?: (postId: string, optionId: string) => Promise<void> | void
  onTogglePin?: (postId: string) => Promise<void> | void
  onDeletePost?: (postId: string) => Promise<void> | void
}) {
  const [postsByGroup, setPostsByGroup] = useState<Record<string, FeedPost[]>>({})
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [draftImages, setDraftImages] = useState<Record<string, string>>({})
  const [draftAttachments, setDraftAttachments] = useState<Record<string, FeedMedia>>({})
  const [replyingTo, setReplyingTo] = useState<FeedPost | null>(null)
  const [contextMenu, setContextMenu] = useState<{ postId: string; x: number; y: number } | null>(null)
  const [selectedProfile, setSelectedProfile] = useState<FeedProfileSelection | null>(null)
  const [pinnedBarDismissed, setPinnedBarDismissed] = useState(false)
  const [unseenMentionIds, setUnseenMentionIds] = useState<Set<string>>(new Set())
  const mentionRefs = useRef<Map<string, HTMLDivElement>>(new Map())
  const mentionObserverRef = useRef<IntersectionObserver | null>(null)

  function seenStorageKey() { return `twiky-seen-mentions:${group.id}` }
  function getPersistedSeen(): Set<string> {
    try { return new Set(JSON.parse(localStorage.getItem(seenStorageKey()) ?? '[]')) }
    catch { return new Set() }
  }
  function persistSeen(ids: Set<string>) {
    try { localStorage.setItem(seenStorageKey(), JSON.stringify([...ids])) }
    catch {}
  }

  // Reset per-group state when switching groups
  useEffect(() => {
    setPinnedBarDismissed(false)
    setUnseenMentionIds(new Set())
    mentionRefs.current.clear()
    mentionObserverRef.current?.disconnect()
  }, [group.id])

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
  const textareaRef = useRef<RichTextComposerHandle>(null)
  const blobUrlsRef = useRef<string[]>([])
  const previousGroupIdRef = useRef<string | null>(null)

  const [postUploading, setPostUploading] = useState(false)
  const [pendingImageFile, setPendingImageFile] = useState<File | null>(null)
  const [pendingGenericFile, setPendingGenericFile] = useState<File | null>(null)
  const [voiceRecording, setVoiceRecording] = useState(false)
  const [voiceUploading, setVoiceUploading] = useState(false)
  const [voiceSeconds, setVoiceSeconds] = useState(0)
  const [actionMenuOpen, setActionMenuOpen] = useState(false)
  const [pollModalOpen, setPollModalOpen] = useState(false)
  const [pollQuestion, setPollQuestion] = useState('')
  const [pollOptions, setPollOptions] = useState(['', ''])
  const [pollAllowMultiple, setPollAllowMultiple] = useState(false)
  const voiceStopRef = useRef<(() => Promise<void>) | null>(null)

  const [mentionCursor, setMentionCursor] = useState(0)
  const [activeMentionIndex, setActiveMentionIndex] = useState(0)
  const [mentionIndex, setMentionIndex] = useState(0)
  const showMentionMenu = mentionCursor > 0

  const posts = postsByGroup[group.id] ?? postsOverride ?? buildFallbackPosts(channel, group)
  const latestPostId = posts.at(-1)?.id
  const draft = drafts[group.id] ?? ''
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
    const t1 = window.setTimeout(() => scrollToLatest('auto'), 120)
    const t2 = window.setTimeout(() => scrollToLatest('auto'), 400)

    return () => {
      cancelAnimationFrame(frameId)
      window.clearTimeout(t1)
      window.clearTimeout(t2)
    }
  }, [group.id, latestPostId, posts.length])


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
        currentGroupLabel={group.kind === 'voice' ? group.label : group.kind === 'board' ? `Board: ${group.label}` : `#${group.label}`}
        isOwn={!!selectedProfile.post.isOwn}
        memberProfile={selectedProfile.profile}
        messagePending={false}
        onBack={() => setSelectedProfile(null)}
        onMessage={() => handleMessageAuthor(selectedProfile.post, selectedProfile.profile)}
        onOpenStory={onOpenUserStories}
        posts={profilePosts}
        storyRingState={selectedProfile.profile.id ? getUserStoryRingState?.(selectedProfile.profile.id) ?? 'none' : 'none'}
      />,
    )
  }, [
    group.kind,
    group.label,
    onProfileSidebarContentChange,
    onOpenUserStories,
    profilePosts,
    selectedProfile,
    getUserStoryRingState,
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

  useEffect(() => {
    function handleEscapeClose(event: globalThis.KeyboardEvent) {
      if (event.key !== 'Escape') return

      const target = event.target as HTMLElement | null
      const tag = target?.tagName
      const isTypingTarget =
        !!target &&
        (target.isContentEditable || tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT')
      if (isTypingTarget) return

      if (contextMenu) {
        event.preventDefault()
        setContextMenu(null)
        return
      }

      if (selectedProfile) {
        event.preventDefault()
        setSelectedProfile(null)
        return
      }

      if (onCloseFeedRequest) {
        event.preventDefault()
        onCloseFeedRequest()
      }
    }

    window.addEventListener('keydown', handleEscapeClose)
    return () => window.removeEventListener('keydown', handleEscapeClose)
  }, [contextMenu, onCloseFeedRequest, selectedProfile])

  function getAuthorContext(post: FeedPost) {
    if (post.isOwn) {
      return {
        canMessage: false,
        profile: buildFeedMemberProfile(
          { ...post, authorIsVerified: post.authorIsVerified || currentIsVerified, authorSubPlan: post.authorSubPlan ?? profile?.sub_plan },
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
            sub_plan: memberProfile.subPlan ?? null,
          },
        },
      ],
      isOnline: true,
      subPlan: memberProfile.subPlan ?? null,
      isVerified: memberProfile.isVerified ?? false,
      name: memberProfile.name,
      status: memberProfile.status,
      targetUserId: memberProfile.id,
    }
  }

  function handleMessageAuthor(post: FeedPost, memberProfile: FeedMemberProfile) {
    onOpenDirectConversation?.(buildSyntheticConversationTarget(post, memberProfile))
  }

  function setDraft(value: string) {
    setDrafts((prev) => ({ ...prev, [group.id]: value }))
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
      const current = prev[group.id] ?? postsOverride ?? buildFallbackPosts(channel, group)
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

  function resetPollModal() {
    setPollQuestion('')
    setPollOptions(['', ''])
    setPollAllowMultiple(false)
  }

  function openPollModal() {
    setActionMenuOpen(false)
    setPollModalOpen(true)
  }

  async function createPoll() {
    const question = pollQuestion.trim()
    const options = pollOptions.map((option) => option.trim()).filter(Boolean)

    if (!question) {
      toast.error('Add a poll question')
      return
    }

    if (options.length < 2) {
      toast.error('Add at least two poll options')
      return
    }

    const poll = createPollPayload(question, options.slice(0, 6), pollAllowMultiple)

    if (onSendPost) {
      setPostUploading(true)
      try {
        await onSendPost({
          content: encodeFeedPollPayload(poll),
          entityMentions: [],
          replyToId: replyingTo?.id,
        })
        setReplyingTo(null)
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to create poll')
        return
      } finally {
        setPostUploading(false)
      }
    } else {
      const post: FeedPost = {
        id: `${group.id}-poll-${Date.now()}`,
        author: 'You',
        role: channel.role ? channel.role.charAt(0).toUpperCase() + channel.role.slice(1).toLowerCase() : 'Member',
        time: formatUserPostTime(new Date().toISOString()),
        body: '',
        isOwn: true,
        poll,
        reactions: [],
        replyCount: 0,
        replyTo: replyingTo
          ? { author: replyingTo.author, body: replyingTo.body.slice(0, 60) + (replyingTo.body.length > 60 ? '...' : '') }
          : undefined,
      }
      updatePosts((current) => [...current, post])
      setReplyingTo(null)
    }

    resetPollModal()
    setPollModalOpen(false)
  }

  async function sendDraft() {
    const body = draft.trim()
    const text = textareaRef.current?.getText() || ''
    const hasQueuedFile = !!(pendingImageFile || pendingGenericFile)
    if (!body && !draftImage && !draftAttachment && !hasQueuedFile) return

    if (onSendPost) {
      if (!hasQueuedFile && !body) return
      const entityMentions = extractMentionTargets(text, mentionOptions)
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
          mime: pendingGenericFile?.type || pendingImageFile?.type || undefined,
        })
        setDraft('')
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
      role: channel.role ? channel.role.charAt(0).toUpperCase() + channel.role.slice(1).toLowerCase() : 'Member',
      time: formatUserPostTime(new Date().toISOString()),
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
    setDraftImage(undefined)
    setAttachment(undefined)
    setReplyingTo(null)
  }

  function isSafari() {
    if (typeof navigator === 'undefined') return false
    const ua = navigator.userAgent.toLowerCase()
    return ua.includes('safari') && !ua.includes('chrome') && !ua.includes('chromium') && !ua.includes('android')
  }

  function encodeWav(samples: Float32Array[], sampleRate: number) {
    const totalLength = samples.reduce((t, arr) => t + arr.length, 0)
    const buffer = new ArrayBuffer(44 + totalLength * 2)
    const view = new DataView(buffer)
    let offset = 0

    function writeString(str: string) {
      for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i))
      offset += str.length
    }

    writeString('RIFF')
    view.setUint32(offset, 36 + totalLength * 2, true); offset += 4
    writeString('WAVE')
    writeString('fmt ')
    view.setUint32(offset, 16, true); offset += 4 // PCM
    view.setUint16(offset, 1, true); offset += 2 // PCM
    view.setUint16(offset, 1, true); offset += 2 // mono
    view.setUint32(offset, sampleRate, true); offset += 4
    view.setUint32(offset, sampleRate * 2, true); offset += 4
    view.setUint16(offset, 2, true); offset += 2
    view.setUint16(offset, 16, true); offset += 2
    writeString('data')
    view.setUint32(offset, totalLength * 2, true); offset += 4

    let writeIndex = offset
    for (const chunk of samples) {
      for (let i = 0; i < chunk.length; i++) {
        const s = Math.max(-1, Math.min(1, chunk[i]))
        view.setInt16(writeIndex, s < 0 ? s * 0x8000 : s * 0x7fff, true)
        writeIndex += 2
      }
    }

    return new Blob([buffer], { type: 'audio/wav' })
  }

  async function startVoiceRecording() {
    if (voiceRecording || voiceUploading) return

    setContextMenu(null)
    setSelectedProfile(null)
    setReplyingTo(null)
    if (draftImage) clearQueuedImage()
    if (pendingGenericFile) clearQueuedGeneric()
    if (!useBackendUpload && draftAttachment) setAttachment(undefined)

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    const startedAt = Date.now()
    setVoiceSeconds(0)
    setVoiceRecording(true)

    const timer = window.setInterval(() => {
      setVoiceSeconds(Math.floor((Date.now() - startedAt) / 1000))
    }, 250)

    if (!isSafari() && typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
      const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' })
      const chunks: BlobPart[] = []
      recorder.ondataavailable = (e) => { if (e.data?.size) chunks.push(e.data) }
      recorder.start()

      voiceStopRef.current = async () => {
        await new Promise<void>((resolve) => {
          recorder.onstop = () => resolve()
          recorder.stop()
        })
        window.clearInterval(timer)
        stream.getTracks().forEach((t) => t.stop())

        const blob = new Blob(chunks, { type: 'audio/webm' })
        const duration = Math.max(0, Math.floor((Date.now() - startedAt) / 1000))
        await uploadAndSendVoice(blob, 'audio/webm', duration)
      }
      return
    }

    const AudioCtx =
      window.AudioContext ||
      (window as Window & typeof globalThis & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AudioCtx) {
      stream.getTracks().forEach((t) => t.stop())
      setVoiceRecording(false)
      toast.error('Audio recording is not supported in this browser')
      return
    }
    const ctx: AudioContext = new AudioCtx()
    const source = ctx.createMediaStreamSource(stream)
    const processor = ctx.createScriptProcessor(4096, 1, 1)
    const chunks: Float32Array[] = []
    processor.onaudioprocess = (e) => {
      const input = e.inputBuffer.getChannelData(0)
      chunks.push(new Float32Array(input))
    }
    source.connect(processor)
    processor.connect(ctx.destination)

    voiceStopRef.current = async () => {
      window.clearInterval(timer)
      setVoiceRecording(false)
      try {
        processor.disconnect()
        source.disconnect()
      } catch {}
      try { ctx.close() } catch {}
      stream.getTracks().forEach((t) => t.stop())

      const duration = Math.max(0, Math.floor((Date.now() - startedAt) / 1000))
      const wav = encodeWav(chunks, ctx.sampleRate || 44100)
      await uploadAndSendVoice(wav, 'audio/wav', duration)
    }
  }

  async function stopVoiceRecording() {
    if (!voiceRecording) return
    const stop = voiceStopRef.current
    voiceStopRef.current = null
    setVoiceRecording(false)
    if (!stop) return
    await stop()
  }

  async function uploadAndSendVoice(blob: Blob, mime: string, durationSeconds: number) {
    if (!useBackendUpload || !onSendPost) return
    setVoiceUploading(true)
    try {
      const ext = mime.includes('wav') ? 'wav' : 'webm'
      const file = new File([blob], `voice-${Date.now()}.${ext}`, { type: mime })
      const { publicUrl } = await filesApi.uploadGroupExtra(group.id, file)
      await onSendPost({
        content: '',
        fileUrl: publicUrl,
        entityMentions: [],
        replyToId: undefined,
        type: 'voice',
        mime,
        duration: durationSeconds,
        size: file.size,
      })
    } finally {
      setVoiceUploading(false)
      setVoiceSeconds(0)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent | globalThis.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void sendDraft()
    }
  }

  function handleReact(postId: string, emoji: string) {
    updatePosts((current) =>
      current.map((post) => {
        if (post.id !== postId) return post

        const clickedReaction = post.reactions.find((r) => r.emoji === emoji)

        // Toggle off if already reacted with this emoji
        if (clickedReaction?.mine) {
          return {
            ...post,
            reactions: post.reactions
              .map((r) => r.emoji === emoji ? { ...r, count: r.count - 1, mine: false } : r)
              .filter((r) => r.count > 0),
          }
        }

        // Remove user's previous reaction on this message (one reaction per user)
        const stripped = post.reactions
          .map((r) => r.mine ? { ...r, count: r.count - 1, mine: false } : r)
          .filter((r) => r.count > 0)

        if (clickedReaction) {
          return {
            ...post,
            reactions: stripped.map((r) =>
              r.emoji === emoji ? { ...r, count: r.count + 1, mine: true } : r,
            ),
          }
        }

        return { ...post, reactions: [...stripped, { emoji, count: 1, mine: true }] }
      }),
    )
    if (onToggleReaction) void onToggleReaction(postId, emoji)
  }

  function handlePollVote(postId: string, optionId: string) {
    updatePosts((current) =>
      current.map((post) => {
        if (post.id !== postId || !post.poll) return post

        const selected = post.poll.options.find((option) => option.id === optionId)
        if (!selected) return post
        const removingVote = Boolean(selected.votedByMe)

        return {
          ...post,
          poll: {
            ...post.poll,
            options: post.poll.options.map((option) => {
              if (post.poll?.allowMultiple) {
                if (option.id !== optionId) return option
                const voters = option.votedByMe
                  ? option.voters?.filter((id) => id !== (profile?.id ?? 'me')) ?? []
                  : [...(option.voters ?? []), profile?.id ?? 'me']
                return {
                  ...option,
                  voters,
                  votedByMe: !option.votedByMe,
                  votes: voters.length,
                }
              }

              if (option.id === optionId) {
                const currentUserId = profile?.id ?? 'me'
                const voters = removingVote
                  ? option.voters?.filter((id) => id !== currentUserId) ?? []
                  : Array.from(new Set([...(option.voters ?? []), currentUserId]))
                return {
                  ...option,
                  voters,
                  votedByMe: !removingVote,
                  votes: voters.length,
                }
              }

              if (option.votedByMe && !removingVote) {
                const voters = option.voters?.filter((id) => id !== (profile?.id ?? 'me')) ?? []
                return {
                  ...option,
                  voters,
                  votedByMe: false,
                  votes: voters.length,
                }
              }

              return option
            }),
          },
        }
      }),
    )
    if (onPollVote) void onPollVote(postId, optionId)
  }

  function handleTogglePin(postId: string) {
    updatePosts((current) =>
      current.map((p) => (p.id === postId ? { ...p, pinned: !p.pinned } : p)),
    )
    if (onTogglePin) {
      void Promise.resolve(onTogglePin(postId)).catch((err) => {
        // revert on failure
        updatePosts((current) =>
          current.map((p) => (p.id === postId ? { ...p, pinned: !p.pinned } : p)),
        )
        toast.error(err instanceof Error ? err.message : 'Could not update pin')
      })
    }
  }

  function handleDelete(postId: string) {
    if (onDeletePost) {
      void Promise.resolve(onDeletePost(postId)).catch((err) => {
        toast.error(err instanceof Error ? err.message : 'Could not delete post')
      })
      return
    }

    updatePosts((current) => current.filter((p) => p.id !== postId))
  }

  async function handleCopy(post: FeedPost) {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      const text = post.body.replace(/<[^>]*>/g, '')
      await navigator.clipboard.writeText(`${post.author}: ${text}`)
    }
  }

  function openContextMenu(e: MouseEvent, postId: string) {
    e.preventDefault()
    setContextMenu({ postId, x: e.clientX, y: e.clientY })
  }

  const canSend = useMemo(() => {
    if (draftImage || draftAttachment || pendingImageFile || pendingGenericFile) return true
    if (!draft || draft === '<p></p>') return false
    const stripped = draft.replace(/<[^>]*>/g, '').trim()
    return stripped.length > 0 || draft.includes('<img') || draft.includes('data-type="mention"') || draft.includes('class="mention"')
  }, [draft, draftImage, draftAttachment, pendingImageFile, pendingGenericFile])

  const myUsername = profile?.username
  const pinnedPosts = posts.filter(p => p.pinned && !p.isSystem)
  const latestPin = pinnedPosts[pinnedPosts.length - 1] ?? null
  const mentionedPosts = posts.filter(p =>
    !p.isOwn && !p.isSystem && p.role !== 'Automation' && !!myUsername && !!p.body && (
      p.body.toLowerCase().includes(`@${myUsername.toLowerCase()}`) ||
      /(?:^|\s)@all\b/i.test(p.body)
    )
  )

  // Sync unseen set — exclude already-seen from localStorage
  useEffect(() => {
    if (mentionedPosts.length === 0) return
    const alreadySeen = getPersistedSeen()
    setUnseenMentionIds(prev => {
      const next = new Set(prev)
      let changed = false
      mentionedPosts.forEach(p => {
        if (!alreadySeen.has(p.id) && !next.has(p.id)) {
          next.add(p.id)
          changed = true
        }
      })
      return changed ? next : prev
    })
  }, [mentionedPosts.map(p => p.id).join(',')])  // eslint-disable-line react-hooks/exhaustive-deps

  // IntersectionObserver — mark mention as seen when scrolled into view, persist to localStorage
  useEffect(() => {
    mentionObserverRef.current?.disconnect()
    if (mentionRefs.current.size === 0) return

    const observer = new IntersectionObserver(
      (entries) => {
        const newlySeen: string[] = []
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const id = (entry.target as HTMLElement).dataset.postId
            if (id) newlySeen.push(id)
          }
        })
        if (newlySeen.length === 0) return
        setUnseenMentionIds(prev => {
          const next = new Set(prev)
          newlySeen.forEach(id => next.delete(id))
          if (next.size === prev.size) return prev
          // Persist the newly-seen IDs
          const allSeen = getPersistedSeen()
          newlySeen.forEach(id => allSeen.add(id))
          persistSeen(allSeen)
          return next
        })
      },
      { threshold: 0.6 },
    )

    mentionRefs.current.forEach(el => observer.observe(el))
    mentionObserverRef.current = observer
    return () => observer.disconnect()
  }, [mentionedPosts.map(p => p.id).join(',')])  // eslint-disable-line react-hooks/exhaustive-deps

  const unseenMentions = mentionedPosts.filter(p => unseenMentionIds.has(p.id))

  function jumpToMention(dir: 1 | -1 = 1) {
    if (unseenMentions.length === 0) return
    const next = (mentionIndex + dir + unseenMentions.length) % unseenMentions.length
    setMentionIndex(next)
    const el = mentionRefs.current.get(unseenMentions[next].id)
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  function scrollToPinnedMessage(postId: string) {
    const el = feedScrollRef.current?.querySelector(`[data-post-id="${postId}"]`)
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  return (
    <div className="flex flex-1 overflow-hidden bg-background">
      <div className="relative flex min-w-0 flex-1 flex-col overflow-hidden">

      {/* Pinned message bar */}
      {latestPin && !pinnedBarDismissed && (
        <div className="flex items-center gap-2 border-b border-border bg-muted/40 px-4 py-1.5 text-[12px]">
          <Pin className="h-3 w-3 shrink-0 text-primary" />
          <button
            type="button"
            onClick={() => scrollToPinnedMessage(latestPin.id)}
            className="min-w-0 flex-1 truncate text-left font-medium text-foreground hover:underline"
          >
            <span className="text-muted-foreground mr-1">{latestPin.author}:</span>
            {latestPin.body || 'Attachment'}
          </button>
          {pinnedPosts.length > 1 && (
            <span className="shrink-0 text-[10px] text-muted-foreground">{pinnedPosts.length} pinned</span>
          )}
          <button
            type="button"
            onClick={() => setPinnedBarDismissed(true)}
            className="shrink-0 rounded p-0.5 text-muted-foreground hover:text-foreground"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      )}

      {/* Discord-style mention jump button — hides when all mentions seen */}
      {unseenMentions.length > 0 && (
        <div className="absolute bottom-20 right-4 z-20 flex items-center overflow-hidden rounded-full bg-primary shadow-xl">
          <button
            type="button"
            onClick={() => jumpToMention(-1)}
            className="px-2 py-1.5 text-[12px] font-bold text-primary-foreground transition-colors hover:bg-white/15"
            title="Previous mention"
          >↑</button>
          <button
            type="button"
            onClick={() => jumpToMention(1)}
            className="flex items-center gap-1 border-x border-white/20 px-2.5 py-1.5 text-primary-foreground transition-colors hover:bg-white/15"
          >
            <span className="text-[12px] font-bold">@</span>
            <span className="text-[11px] font-semibold">{unseenMentions.length}</span>
          </button>
          <button
            type="button"
            onClick={() => jumpToMention(1)}
            className="px-2 py-1.5 text-[12px] font-bold text-primary-foreground transition-colors hover:bg-white/15"
            title="Next mention"
          >↓</button>
        </div>
      )}

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
            const isMentioned = !post.isOwn && !post.isSystem && post.role !== 'Automation' && !!myUsername && !!post.body && (
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
                mentionRef={isMentioned ? (el) => { if (el) mentionRefs.current.set(post.id, el); else mentionRefs.current.delete(post.id) } : undefined}
                post={post}
                isGrouped={isGrouped}
                myAvatarUrl={myAvatarUrl}
                isMentioned={isMentioned}
                onReact={(emoji) => handleReact(post.id, emoji)}
                onPollVote={(optionId) => handlePollVote(post.id, optionId)}
                onReply={() => {
                  setReplyingTo(post)
                  textareaRef.current?.focus()
                }}
                onPin={() => handleTogglePin(post.id)}
                onDelete={() => handleDelete(post.id)}
                onContextMenu={(e) => openContextMenu(e, post.id)}
                onMessage={() => handleMessageAuthor(post, authorContext.profile)}
                onViewProfile={() => {
                  setContextMenu(null)
                  setSelectedProfile({ canMessage: authorContext.canMessage, post, profile: authorContext.profile })
                }}
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
                <AppleText text={replyingTo.body ?? ''} className="flex-1 truncate text-[11px] text-muted-foreground" />
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
                  pendingGenericFile.type.startsWith('video/') ? (
                    <div className="relative h-14 w-20 shrink-0 overflow-hidden rounded-lg border border-border bg-black">
                      <video
                        src={URL.createObjectURL(pendingGenericFile)}
                        className="h-full w-full object-cover"
                        muted
                        preload="metadata"
                        onLoadedMetadata={e => { e.currentTarget.currentTime = 0.1 }}
                      />
                      <button
                        type="button"
                        onClick={() => clearQueuedGeneric()}
                        className="absolute right-0.5 top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-black/70 text-white"
                      >
                        <X className="h-2.5 w-2.5" />
                      </button>
                    </div>
                  ) : (
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
                  )
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
                {(draftImage || (!useBackendUpload && draftAttachment) || pendingGenericFile?.type.startsWith('video/')) ? (
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-medium text-foreground">
                      {draftImage ? 'Image attached' : pendingGenericFile?.type.startsWith('video/') ? 'Video attached' : draftAttachment?.label}
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
                  disabled={postUploading || sendingPost || voiceUploading}
                  className={cn(
                    'h-8 w-8 rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground',
                    voiceRecording && 'bg-primary/10 text-primary',
                  )}
                  onClick={() => {
                    if (voiceRecording) {
                      void stopVoiceRecording()
                    } else {
                      void startVoiceRecording()
                    }
                  }}
                  title={voiceRecording ? 'Stop recording' : 'Record voice'}
                >
                  {voiceRecording ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                </Button>
                <Popover open={actionMenuOpen} onOpenChange={setActionMenuOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      disabled={postUploading || sendingPost || voiceUploading}
                      className={cn(
                        'h-8 w-8 rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground',
                        (useBackendUpload ? pendingGenericFile : draftAttachment) && 'bg-primary/10 text-primary',
                      )}
                      title="Add"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent side="top" align="start" className="w-48 p-1.5 bg-sidebar border-border">
                    <button
                      type="button"
                      onClick={() => {
                        setActionMenuOpen(false)
                        if (useBackendUpload) {
                          if (pendingGenericFile) clearQueuedGeneric()
                          else genericFileInputRef.current?.click()
                        } else if (draftAttachment) {
                          setAttachment(undefined)
                        } else {
                          setAttachment(getSuggestedAttachment(channel, group))
                        }
                      }}
                      className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[12px] font-medium text-foreground hover:bg-accent"
                    >
                      <FileUp className="h-4 w-4 text-muted-foreground" />
                      Attach file
                    </button>
                    <button
                      type="button"
                      onClick={openPollModal}
                      className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[12px] font-medium text-foreground hover:bg-accent"
                    >
                      <BarChart3 className="h-4 w-4 text-muted-foreground" />
                      Create poll
                    </button>
                  </PopoverContent>
                </Popover>
              </div>

              {/* Text input */}
              <div className="relative flex-1">
                {voiceRecording ? (
                  <div className="mb-2 flex items-center justify-between rounded-xl border border-primary/20 bg-primary/5 px-3 py-2 text-[11px]">
                    <div className="flex items-center gap-2 text-primary">
                      <span className="h-2 w-2 animate-pulse rounded-full bg-primary" />
                      Recording… {voiceSeconds}s
                    </div>
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-foreground"
                      onClick={() => void stopVoiceRecording()}
                    >
                      Stop
                    </button>
                  </div>
                ) : null}
                <RichTextComposer
                  ref={textareaRef}
                  value={draft}
                  onChange={(val) => {
                    setDraft(val)
                  }}
                  onKeyDown={handleKeyDown}
                  placeholder={group.kind === 'board' ? `Start a topic in ${group.label}` : `Message ${group.kind === 'voice' ? group.label : `#${group.label}`}`}
                  channelId={channel.id}
                  className="max-h-40 min-h-[36px] w-full border-0 bg-transparent px-2 py-2 text-[13px] leading-[1.5] overflow-y-auto"
                />
              </div>

              {/* Right actions */}
              <div className="flex items-center gap-0.5">
                <GifButton
                  onGifSelect={(url) => onSendPost?.({ content: '', fileUrl: url, type: 'gif', mime: 'image/gif', entityMentions: [] })}
                />
                <StickerButton
                  onStickerSelect={(url) => onSendPost?.({ content: '', fileUrl: url, type: 'sticker', mime: 'image/gif', entityMentions: [] })}
                />
                <GiftButton />
                <EmojiButton onEmojiSelect={(unified) => textareaRef.current?.insertEmoji(unified)} />
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
            ref={genericFileInputRef}
            type="file"
            className="hidden"
            onChange={handleGenericFile}
          />


        </div>
      </div>

      <AnimatePresence>
        {pollModalOpen ? (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/45 backdrop-blur-sm"
              onClick={() => setPollModalOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 12 }}
              transition={{ duration: 0.14 }}
              className="fixed left-1/2 top-1/2 z-50 w-[min(92vw,420px)] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-xl border border-border bg-sidebar shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <BarChart3 className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold text-foreground">Create poll</p>
                    <p className="text-[11px] text-muted-foreground">Ask the group to vote</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setPollModalOpen(false)}
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-3 px-4 py-4">
                <label className="block">
                  <span className="mb-1 block text-[11px] font-semibold text-muted-foreground">Question</span>
                  <input
                    value={pollQuestion}
                    onChange={(event) => setPollQuestion(event.target.value)}
                    placeholder="What should we decide?"
                    className="h-9 w-full rounded-lg border border-border bg-background px-3 text-[13px] text-foreground outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-primary/50"
                  />
                </label>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-muted-foreground">Options</span>
                    <button
                      type="button"
                      disabled={pollOptions.length >= 6}
                      onClick={() => setPollOptions((current) => [...current, ''])}
                      className="text-[11px] font-semibold text-primary disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Add option
                    </button>
                  </div>

                  {pollOptions.map((option, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <input
                        value={option}
                        onChange={(event) =>
                          setPollOptions((current) =>
                            current.map((item, itemIndex) => itemIndex === index ? event.target.value : item),
                          )
                        }
                        placeholder={`Option ${index + 1}`}
                        className="h-9 min-w-0 flex-1 rounded-lg border border-border bg-background px-3 text-[13px] text-foreground outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-primary/50"
                      />
                      <button
                        type="button"
                        disabled={pollOptions.length <= 2}
                        onClick={() => setPollOptions((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>

                <label className="flex items-center justify-between rounded-lg border border-border bg-background/60 px-3 py-2">
                  <span className="text-[12px] font-medium text-foreground">Allow multiple choices</span>
                  <input
                    type="checkbox"
                    checked={pollAllowMultiple}
                    onChange={(event) => setPollAllowMultiple(event.target.checked)}
                    className="h-4 w-4 accent-primary"
                  />
                </label>
              </div>

              <div className="flex justify-end gap-2 border-t border-border px-4 py-3">
                <Button
                  type="button"
                  variant="ghost"
                  className="h-8 rounded-lg px-3 text-[12px]"
                  onClick={() => setPollModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  className="h-8 rounded-lg px-3 text-[12px]"
                  disabled={postUploading || sendingPost}
                  onClick={() => void createPoll()}
                >
                  Create poll
                </Button>
              </div>
            </motion.div>
          </>
        ) : null}
      </AnimatePresence>

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
            onReact={(emoji) => handleReact(selectedPost.id, emoji)}
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
