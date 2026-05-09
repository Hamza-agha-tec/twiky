'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { MessageCircle, User } from 'lucide-react'
import { useProfile, useUserById } from '@/hooks/use-user'
import { useOnlineUsers } from '@/hooks/use-socket'
import { VerifiedBadge, getVerifiedBadgeVariant } from '@/components/chat/verified-badge'
import { UserAvatar } from '@/components/chat/user-avatar'
import { cn } from '@/lib/utils'

interface HoverProfileCardProps {
  userId: string
  isOnline?: boolean
  role?: string
  children: React.ReactNode
  onMessage?: (userId: string) => void
  onViewProfile?: (userId: string) => void
  hideMessage?: boolean
  side?: 'left' | 'right' | 'top'
  anchorRef?: React.RefObject<HTMLElement>
}

const ROLE_COLORS: Record<string, string> = {
  OWNER: 'text-amber-400',
  ADMIN: 'text-blue-400',
}

const CARD_WIDTH = 200
const GAP = 6

function Card({
  userId,
  role,
  onMessage,
  onViewProfile,
  hideMessage,
  rect,
  side,
}: {
  userId: string
  role?: string
  onMessage?: (userId: string) => void
  onViewProfile?: (userId: string) => void
  hideMessage?: boolean
  rect: DOMRect
  side: 'left' | 'right' | 'top'
}) {
  const { data: profile, isLoading } = useUserById(userId)
  const { data: currentUser } = useProfile()
  const onlineUsers = useOnlineUsers()
  const isOnline = userId ? (userId === currentUser?.id || onlineUsers.has(userId)) : false

  const name = profile?.fullname ?? profile?.full_name ?? profile?.username ?? '—'
  const username = profile?.username
  const avatar = profile?.avatar_url ?? null
  const banner = profile?.banner ?? null
  const bio = profile?.bio ?? null
  const subPlan = profile?.sub_plan ?? null
  const isVerified = profile?.is_verified ?? false
  const showVerified = isVerified || subPlan === 'PRO' || subPlan === 'GEEK'
  const roleColor = role ? (ROLE_COLORS[role] ?? null) : null

  let left = 0
  let top = rect.top  // top-right of card aligns with avatar top

  if (side === 'left') {
    left = rect.left - CARD_WIDTH - GAP
  } else if (side === 'right') {
    left = rect.right + GAP
  } else {
    // top: center horizontally, appear above
    left = rect.left + rect.width / 2 - CARD_WIDTH / 2
    top = rect.top - GAP - 200
  }

  // clamp to viewport
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1200
  const vh = typeof window !== 'undefined' ? window.innerHeight : 800
  left = Math.max(8, Math.min(left, vw - CARD_WIDTH - 8))
  top  = Math.max(8, Math.min(top, vh - 220))

  return (
    <motion.div
      className="pointer-events-auto fixed z-[9999] overflow-hidden rounded-2xl border border-border/60 bg-sidebar/85 shadow-[0_16px_48px_rgba(0,0,0,0.35),0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur-2xl"
      style={{ left, top, width: CARD_WIDTH }}
      initial={{ opacity: 0, scale: 0.9, y: -6 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9, y: -6 }}
      transition={{ type: 'spring', stiffness: 460, damping: 30, mass: 0.65 }}
    >
      {/* Avatar row */}
      <div className="flex items-center gap-2.5 px-3 pt-3 pb-2">
        <div className="relative shrink-0">
          {isLoading ? (
            <div className="h-8 w-8 animate-pulse rounded-full bg-muted" />
          ) : (
            <>
              <UserAvatar src={avatar} alt={name} className="h-8 w-8 rounded-full object-cover" />
              <span className={cn('absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-sidebar', isOnline ? 'bg-green-500' : 'bg-muted-foreground/40')} />
            </>
          )}
        </div>
        <div className="min-w-0 flex-1">
          {isLoading ? (
            <div className="space-y-1">
              <div className="h-2.5 w-20 animate-pulse rounded bg-muted" />
              <div className="h-2 w-14 animate-pulse rounded bg-muted" />
            </div>
          ) : (
            <>
              <div className="flex items-center gap-1">
                <p className="truncate text-[12px] font-semibold text-foreground leading-tight">{name}</p>
                {showVerified && <VerifiedBadge size="xs" variant={getVerifiedBadgeVariant(subPlan)} />}
              </div>
              {username && <p className="truncate text-[10px] text-muted-foreground">@{username}</p>}
              {role && role !== 'MEMBER' && roleColor && (
                <p className={cn('text-[9px] font-semibold uppercase tracking-wide', roleColor)}>
                  {role.charAt(0) + role.slice(1).toLowerCase()}
                </p>
              )}
            </>
          )}
        </div>
      </div>

      {/* Status bubble */}
      {statusMsg && !isLoading && (
        <div className="mx-3 mb-2 flex items-center gap-1">
          <span className="h-1 w-1 rounded-full bg-muted/80 shrink-0" />
          <span className="h-1.5 w-1.5 rounded-full bg-muted/80 shrink-0" />
          <div className="rounded-xl bg-muted px-2 py-0.5 text-[10px] text-foreground/70 truncate">{statusMsg}</div>
        </div>
      )}

      {/* Bio */}
      {bio && !isLoading && (
        <p className="mx-3 mb-2 line-clamp-2 text-[10px] leading-[1.4] text-muted-foreground border-t border-border/40 pt-1.5">
          {bio}
        </p>
      )}

      {/* Action buttons */}
      <div className="flex gap-1.5 px-3 pb-3">
        {!hideMessage && onMessage && (
          <button onClick={() => onMessage(userId)} className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-border/60 bg-accent/60 py-1 text-[10px] font-semibold text-foreground transition-colors hover:bg-accent">
            <MessageCircle className="h-3 w-3" />
            Message
          </button>
        )}
        {onViewProfile && (
          <button onClick={() => onViewProfile(userId)} className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-border/60 bg-accent/60 py-1 text-[10px] font-semibold text-foreground transition-colors hover:bg-accent">
            <User className="h-3 w-3" />
            Profile
          </button>
        )}
      </div>
    </motion.div>
  )
}

export function HoverProfileCard({
  userId,
  role,
  children,
  onMessage,
  onViewProfile,
  hideMessage,
  side = 'left',
  anchorRef,
}: HoverProfileCardProps) {
  const [open, setOpen] = useState(false)
  const [rect, setRect] = useState<DOMRect | null>(null)
  const triggerRef = useRef<HTMLDivElement>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  function handleEnter() {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      const el = anchorRef?.current ?? triggerRef.current
      if (el) {
        setRect(el.getBoundingClientRect())
        setOpen(true)
      }
    }, 300)
  }

  function handleLeave() {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setOpen(false), 120)
  }

  function handleMessage(uid: string) {
    setOpen(false)
    onMessage?.(uid)
  }

  function handleViewProfile(uid: string) {
    setOpen(false)
    onViewProfile?.(uid)
  }

  return (
    <div
      ref={triggerRef}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
      className="flex-shrink-0"
    >
      {children}
      {mounted && rect && createPortal(
        <AnimatePresence>
          {open && (
            <div
              className="pointer-events-none fixed inset-0 z-[9998]"
              onMouseEnter={() => { if (timerRef.current) clearTimeout(timerRef.current); setOpen(true) }}
              onMouseLeave={handleLeave}
            >
              <Card
                userId={userId}
                role={role}
                onMessage={onMessage ? handleMessage : undefined}
                onViewProfile={onViewProfile ? handleViewProfile : undefined}
                hideMessage={hideMessage}
                rect={rect}
                side={side}
              />
            </div>
          )}
        </AnimatePresence>,
        document.body,
      )}
    </div>
  )
}
