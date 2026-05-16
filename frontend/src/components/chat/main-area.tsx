'use client'

import { cloneElement, isValidElement, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Hash,
  ListTodo,
  MessagesSquare,
  NotebookPen,
  Search,
  Target,
  Tv,
  Users,
  Volume2,
  X,
} from 'lucide-react'

import { GoalsPanel } from '@/components/chat/goals-panel'
import type { MockChannelGroup, WorkspaceChannel } from '@/components/chat/channels-panel'
import { buildStandaloneFeedMemberProfile, FeedMemberProfileView } from '@/components/chat/channel-feed'
import { FeedProfileSidebarDock } from '@/components/chat/feed-profile-sidebar-dock'
import { HoverProfileCard } from '@/components/chat/hover-profile-card'
import { NotesPanel } from '@/components/chat/notes-panel'
import { TasksPanel } from '@/components/chat/tasks-panel'
import { UserAvatar } from '@/components/chat/user-avatar'
import { useProfile } from '@/hooks/use-user'
import { cn } from '@/lib/utils'

export type MainAreaTab = 'feed' | 'notes' | 'tasks' | 'goals'

interface GroupMember {
  user: {
    id: string
    username: string | null
    avatar_url?: string | null
    full_name?: string | null
    banner?: string | null
    sub_plan?: string | null
  }
  role?: string
}

// Samples the average RGB from the left edge of a loaded image.
// Returns null if CORS blocks access.
function sampleLeftEdgeColor(img: HTMLImageElement): string | null {
  try {
    const off = document.createElement('canvas')
    off.width = 24
    off.height = Math.max(1, img.naturalHeight || 40)
    const ctx = off.getContext('2d')
    if (!ctx) return null
    ctx.drawImage(img, 0, 0, 24, off.height)
    const px = ctx.getImageData(0, 0, 24, off.height).data
    let r = 0, g = 0, b = 0, n = 0
    for (let i = 0; i < px.length; i += 4) {
      if (px[i + 3] < 10) continue
      r += px[i]; g += px[i + 1]; b += px[i + 2]; n++
    }
    if (!n) return null
    return `${Math.round(r / n)},${Math.round(g / n)},${Math.round(b / n)}`
  } catch {
    return null
  }
}

// Renders the banner background for a member row.
// GIF behaviour: always animating behind a canvas.
// On hover the canvas fades out → live GIF shows.
// On mouseout we capture the current frame into the canvas → paused-in-place.
// Glow colour is sampled from the banner's left-edge pixels on load.
function MemberBannerRow({
  member,
  isOnline,
  children,
}: {
  member: GroupMember
  isOnline: boolean
  children: React.ReactNode
}) {
  const { user } = member
  const isPremium = user.sub_plan === 'PRO' || user.sub_plan === 'GEEK'
  const hasBanner = !!user.banner && isPremium
  const isGif = hasBanner && user.banner!.toLowerCase().includes('.gif')

  const imgRef = useRef<HTMLImageElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const staticImgRef = useRef<HTMLImageElement>(null)

  const captureFrame = () => {
    const img = imgRef.current
    const canvas = canvasRef.current
    if (!img || !canvas || !img.complete || !img.naturalWidth) return
    canvas.width = img.naturalWidth
    canvas.height = img.naturalHeight
    const ctx = canvas.getContext('2d')
    ctx?.drawImage(img, 0, 0)
  }

  if (!hasBanner) {
    return (
      <div
        className={cn(
          'flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-accent/60 transition-colors',
          !isOnline && 'opacity-60',
        )}
      >
        {children}
      </div>
    )
  }

  // Layout math: px-2(8) + w-9(36) + gap-2.5(10) = 54px avatar zone
  const AVATAR_WIDTH = 54

  return (
    <div
      className="group relative cursor-pointer rounded-lg"
      style={{
        overflow: 'hidden',
        borderRadius: '0.5rem',
        WebkitMaskImage: '-webkit-radial-gradient(white, white)',
        transform: 'translateZ(0)',
      }}
      onMouseLeave={captureFrame}
    >
      {/* Banner image — full width, behind everything */}
      <div className="absolute inset-0 z-0 rounded-lg overflow-hidden">
        {isGif ? (
          <>
            <img
              ref={imgRef}
              src={user.banner!}
              alt=""
              crossOrigin="anonymous"
              className="absolute inset-0 h-full w-full object-cover object-left"
              onLoad={captureFrame}
            />
            <canvas
              ref={canvasRef}
              className="absolute inset-0 h-full w-full object-cover transition-opacity duration-200 group-hover:opacity-0"
            />
          </>
        ) : (
          <img
            ref={staticImgRef}
            src={user.banner!}
            alt=""
            crossOrigin="anonymous"
            className="absolute inset-0 h-full w-full object-cover object-left"
            onLoad={() => {}}
          />
        )}
        {/* Top/bottom vignette */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent pointer-events-none" />
      </div>

      {/* Black shadow — solid on left, fades at 40% */}
      <div
        className="absolute top-0 bottom-0 left-0 z-[1] pointer-events-none"
        style={{
          width: '40%',
          background: 'linear-gradient(to right, rgba(0,0,0,0.97) 0%, rgba(0,0,0,0.9) 30%, rgba(0,0,0,0.5) 65%, transparent 100%)',
        }}
      />

      {/* Content — above glow and banner */}
      <div
        className={cn(
          'relative z-10 flex items-center gap-2.5 px-2 py-[2px] hover:bg-white/5 transition-colors',
          !isOnline && 'opacity-75',
        )}
      >
        {children}
      </div>
    </div>
  )
}

interface MainAreaProps {
  activeChannel: WorkspaceChannel
  activeGroup: MockChannelGroup
  children: React.ReactNode
  onTabChange?: (tab: MainAreaTab) => void
  activeTab: MainAreaTab
  members?: GroupMember[]
  onlineUsers?: Set<string>
  onMemberMessage?: (userId: string) => void
}

const CHANNEL_TABS = [
  { id: 'feed' as const,  label: 'Feed',  icon: Hash },
  { id: 'notes' as const, label: 'Notes', icon: NotebookPen },
  { id: 'tasks' as const, label: 'Tasks', icon: ListTodo },
  { id: 'goals' as const, label: 'Goals', icon: Target },
]

export function MainArea({
  activeChannel,
  activeGroup,
  children,
  onTabChange,
  activeTab,
  members = [],
  onlineUsers = new Set(),
  onMemberMessage,
}: MainAreaProps) {
  const { data: currentUser } = useProfile()
  const [memberProfileTarget, setMemberProfileTarget] = useState<GroupMember | null>(null)
  const [feedProfilePanelWidth, setFeedProfilePanelWidth] = useState(0)
  const [closeFeedProfile, setCloseFeedProfile] = useState<(() => void) | null>(null)
  const [feedProfileSidebarContent, setFeedProfileSidebarContent] = useState<React.ReactNode | null>(null)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [membersOpen, setMembersOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const GroupIcon = activeGroup.kind === 'voice' ? Volume2 : activeGroup.kind === 'watch' ? Tv : activeGroup.kind === 'board' ? MessagesSquare : Hash
  const groupScopeLabel = activeGroup.kind === 'board' ? `Board: ${activeGroup.label}` : activeGroup.label
  const feedChild = isValidElement(children)
    ? cloneElement(children as any, {
      onProfilePanelWidthChange: setFeedProfilePanelWidth,
      onProfileSidebarContentChange: setFeedProfileSidebarContent,
      onProfileCloseRequestChange: (closeFn: (() => void) | null) => {
        setCloseFeedProfile(() => closeFn)
      },
    })
    : children

  const channelMonogram = activeChannel.label.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || 'CH'

  useEffect(() => {
    if (searchOpen) inputRef.current?.focus()
  }, [searchOpen])

  function closeSearch() {
    setSearchOpen(false)
    setSearchQuery('')
  }

  const onlineMembers = members.filter((m) => m.user?.id && onlineUsers.has(m.user.id))
  const offlineMembers = members.filter((m) => !m.user?.id || !onlineUsers.has(m.user.id))

  const header = (
    <div className="flex h-[52px] flex-shrink-0 items-center border-b border-border bg-sidebar px-4">
      {/* Left: group icon + name */}
      <div className="flex items-center gap-2">
        <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <GroupIcon className="h-3.5 w-3.5" />
        </div>
        <p className="text-[13px] font-semibold text-foreground">{groupScopeLabel}</p>
      </div>

      {/* Center: channel avatar + name */}
      <div className="flex flex-1 items-center justify-center gap-1.5">
        <div className="flex h-5 w-5 flex-shrink-0 items-center justify-center overflow-hidden rounded-md bg-primary/10 text-[8px] font-bold text-primary">
          {activeChannel.avatarUrl
            ? <img src={activeChannel.avatarUrl} alt={activeChannel.label} className="h-full w-full object-cover" />
            : channelMonogram
          }
        </div>
        <p className="text-[11px] font-semibold text-foreground">{activeChannel.label}</p>
      </div>

      {/* Right: members toggle + animated search */}
      <div className="flex items-center gap-1">
        {/* Members icon */}
        <button
          onClick={() => setMembersOpen((v) => !v)}
          className={cn(
            'flex h-7 w-7 items-center justify-center rounded-lg transition-colors',
            membersOpen
              ? 'bg-primary/15 text-primary'
              : 'text-muted-foreground hover:bg-accent hover:text-foreground',
          )}
          title="Members"
        >
          <Users className="h-3.5 w-3.5" />
        </button>

        {/* Search — icon that expands */}
        <div className="flex items-center">
          <AnimatePresence initial={false} mode="wait">
            {searchOpen ? (
              <motion.div
                key="search-open"
                className="flex items-center overflow-hidden"
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: 192, opacity: 1 }}
                exit={{ width: 0, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 420, damping: 32, mass: 0.7 }}
              >
                <div className="relative flex w-full items-center">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
                  <input
                    ref={inputRef}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Escape' && closeSearch()}
                    placeholder="Search in group…"
                    className={cn(
                      'h-7 w-full rounded-lg border border-primary/40 bg-primary/5 pl-7 pr-7 text-[12px] text-foreground placeholder:text-muted-foreground',
                      'focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary',
                    )}
                  />
                  <button
                    onClick={closeSearch}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              </motion.div>
            ) : (
              <motion.button
                key="search-icon"
                initial={{ opacity: 0, scale: 0.7 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.7 }}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                onClick={() => setSearchOpen(true)}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                title="Search"
              >
                <Search className="h-3.5 w-3.5" />
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )

  return (
    <div className="flex min-w-0 flex-1 overflow-hidden bg-background">
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {header}
        <div className="flex min-h-0 flex-1 overflow-hidden">
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            {activeTab === 'feed' ? feedChild : null}
            {activeTab === 'notes' ? (
              <NotesPanel scopeKey={activeGroup.id} scopeLabel={groupScopeLabel} scopeType="group" />
            ) : null}
            {activeTab === 'tasks' ? (
              <TasksPanel scopeKey={activeGroup.id} scopeLabel={groupScopeLabel} scopeType="group" />
            ) : null}
            {activeTab === 'goals' ? (
              <GoalsPanel scopeKey={activeGroup.id} scopeLabel={groupScopeLabel} scopeType="group" />
            ) : null}
          </div>

          {/* Members panel — lives below the top nav, not alongside it */}
          <AnimatePresence initial={false}>
            {membersOpen && (
              <motion.div
                key="members-panel"
                className="flex w-[256px] flex-shrink-0 flex-col border-l border-border bg-sidebar overflow-hidden"
                initial={{ width: 0, opacity: 0 }}
                animate={{ width: 256, opacity: 1 }}
                exit={{ width: 0, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 380, damping: 36, mass: 0.8 }}
              >
                <div className="flex h-[52px] flex-shrink-0 items-center justify-between border-b border-border px-3">
                  <p className="text-[12px] font-semibold text-foreground">Members</p>
                  <span className="rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
                    {members.length}
                  </span>
                </div>

                <div className="flex-1 overflow-y-auto px-2 py-3 space-y-4">
                  {/* Online */}
                  {onlineMembers.length > 0 && (
                    <div>
                      <p className="mb-1.5 px-1 text-[9.5px] font-bold uppercase tracking-[0.1em] text-muted-foreground/60">
                        Online — {onlineMembers.length}
                      </p>
                      <div className="space-y-0.5">
                        {onlineMembers.map((m) => (
                          <MemberBannerRow key={m.user.id} member={m} isOnline>
                            <HoverProfileCard
                              userId={m.user.id}
                              isOnline
                              role={m.role}
                              side="left"
                              hideMessage={m.user.id === currentUser?.id}
                              onMessage={m.user.id !== currentUser?.id ? onMemberMessage : undefined}
                              onViewProfile={() => setMemberProfileTarget(m)}
                            >
                              <div className="relative flex-shrink-0 cursor-pointer">
                                <UserAvatar
                                  src={m.user.avatar_url}
                                  alt={m.user.username || 'User'}
                                  className="h-8 w-8 rounded-full object-cover"
                                />
                                <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-sidebar bg-green-500" />
                              </div>
                            </HoverProfileCard>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-[12px] font-medium text-foreground">
                                {m.user.full_name || m.user.username}
                              </p>
                              {m.role && m.role !== 'MEMBER' && (
                                <p className="truncate text-[10px] capitalize text-muted-foreground">
                                  {m.role.toLowerCase()}
                                </p>
                              )}
                            </div>
                          </MemberBannerRow>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Offline */}
                  {offlineMembers.length > 0 && (
                    <div>
                      <p className="mb-1.5 px-1 text-[9.5px] font-bold uppercase tracking-[0.1em] text-muted-foreground/60">
                        Offline — {offlineMembers.length}
                      </p>
                      <div className="space-y-0.5">
                        {offlineMembers.map((m) => (
                          <MemberBannerRow key={m.user.id} member={m} isOnline={false}>
                            <HoverProfileCard
                              userId={m.user.id}
                              isOnline={false}
                              role={m.role}
                              side="left"
                              hideMessage={m.user.id === currentUser?.id}
                              onMessage={m.user.id !== currentUser?.id ? onMemberMessage : undefined}
                              onViewProfile={() => setMemberProfileTarget(m)}
                            >
                              <div className="relative flex-shrink-0 cursor-pointer">
                                <UserAvatar
                                  src={m.user.avatar_url}
                                  alt={m.user.username || 'User'}
                                  className="h-8 w-8 rounded-full object-cover grayscale"
                                />
                                <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-sidebar bg-muted-foreground/40" />
                              </div>
                            </HoverProfileCard>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-[12px] font-medium text-foreground">
                                {m.user.full_name || m.user.username}
                              </p>
                              {m.role && m.role !== 'MEMBER' && (
                                <p className="truncate text-[10px] capitalize text-muted-foreground">
                                  {m.role.toLowerCase()}
                                </p>
                              )}
                            </div>
                          </MemberBannerRow>
                        ))}
                      </div>
                    </div>
                  )}

                  {members.length === 0 && (
                    <p className="px-2 py-6 text-center text-[12px] text-muted-foreground">No members</p>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {activeTab === 'feed' ? (
        <FeedProfileSidebarDock
          open={feedProfilePanelWidth > 0}
          width={feedProfilePanelWidth}
          onBack={() => closeFeedProfile?.()}
        >
          {feedProfileSidebarContent}
        </FeedProfileSidebarDock>
      ) : null}

      <FeedProfileSidebarDock
        open={!!memberProfileTarget}
        width={320}
        onBack={() => setMemberProfileTarget(null)}
      >
        {memberProfileTarget && (
          <FeedMemberProfileView
            currentGroupLabel={activeGroup.label}
            isOwn={memberProfileTarget.user.id === currentUser?.id}
            memberProfile={buildStandaloneFeedMemberProfile({
              id: memberProfileTarget.user.id,
              avatarUrl: memberProfileTarget.user.avatar_url ?? null,
              name: memberProfileTarget.user.full_name || memberProfileTarget.user.username || 'User',
              handle: memberProfileTarget.user.username || 'user',
              role: memberProfileTarget.role ?? 'Member',
            })}
            messagePending={false}
            onBack={() => setMemberProfileTarget(null)}
            onMessage={() => { onMemberMessage?.(memberProfileTarget.user.id); setMemberProfileTarget(null) }}
            showMessageAction={memberProfileTarget.user.id !== currentUser?.id}
            posts={[]}
          />
        )}
      </FeedProfileSidebarDock>

    </div>
  )
}
