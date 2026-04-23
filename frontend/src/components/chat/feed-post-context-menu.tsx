'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { Copy, Crown, ImageIcon, Pin, PinOff, Reply, Shield, Trash2, UserMinus, UserPlus, UserX } from 'lucide-react'

interface FeedPostContextMenuProps {
  canModerate?: boolean
  hasMedia?: boolean
  isOwn?: boolean
  isPinned?: boolean
  /** Role of the post author (e.g. 'Owner', 'Admin', 'Member') */
  targetRole?: string
  /** Role of the current viewer (e.g. 'OWNER', 'ADMIN', 'MEMBER') */
  viewerRole?: string
  onClose: () => void
  onCopy: () => void
  onDelete?: () => void
  onOpenMedia?: () => void
  onReply: () => void
  onTogglePin: () => void
  onKick?: () => void
  onPromote?: () => void
  onDemote?: () => void
  x: number
  y: number
}

const MENU_WIDTH = 224
const MENU_HEIGHT = 320
const VIEWPORT_PADDING = 8

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

export function FeedPostContextMenu({
  canModerate,
  hasMedia,
  isOwn,
  isPinned,
  targetRole,
  viewerRole,
  onClose,
  onCopy,
  onDelete,
  onOpenMedia,
  onReply,
  onTogglePin,
  onKick,
  onPromote,
  onDemote,
  x,
  y,
}: FeedPostContextMenuProps) {
  const viewportWidth =
    typeof window === 'undefined' ? MENU_WIDTH + VIEWPORT_PADDING * 2 : window.innerWidth
  const viewportHeight =
    typeof window === 'undefined' ? MENU_HEIGHT + VIEWPORT_PADDING * 2 : window.innerHeight

  const menuLeft = clamp(
    x,
    VIEWPORT_PADDING,
    Math.max(VIEWPORT_PADDING, viewportWidth - MENU_WIDTH - VIEWPORT_PADDING),
  )
  const menuTop = clamp(
    y,
    VIEWPORT_PADDING,
    Math.max(VIEWPORT_PADDING, viewportHeight - MENU_HEIGHT - VIEWPORT_PADDING),
  )

  const viewer = viewerRole?.toUpperCase()
  const target = targetRole?.toLowerCase()
  const isViewerOwner = viewer === 'OWNER'
  const isViewerAdmin = viewer === 'ADMIN'
  const isTargetOwner = target === 'owner'
  const isTargetAdmin = target === 'admin'
  const isTargetMember = !isTargetOwner && !isTargetAdmin

  // Owner can kick anyone (not self), promote members, demote admins
  // Admin can kick members only
  const showKickOwner = !isOwn && isViewerOwner && !isTargetOwner
  const showKickAdmin = !isOwn && isViewerAdmin && isTargetMember
  const showPromote = !isOwn && isViewerOwner && isTargetMember
  const showDemote = !isOwn && isViewerOwner && isTargetAdmin

  const hasModerationActions = showKickOwner || showKickAdmin || showPromote || showDemote

  const menuItems = [
    { icon: Reply, label: 'Reply in feed', onClick: onReply },
    {
      icon: isPinned ? PinOff : Pin,
      label: isPinned ? 'Unpin post' : 'Pin post',
      onClick: onTogglePin,
    },
    { icon: Copy, label: 'Copy text', onClick: onCopy },
    ...(hasMedia && onOpenMedia
      ? [{ icon: ImageIcon, label: 'Open image', onClick: onOpenMedia }]
      : []),
  ]

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-[1290]"
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 6 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.92 }}
        transition={{ duration: 0.12 }}
        style={{ left: `${menuLeft}px`, top: `${menuTop}px` }}
        className="fixed z-[1300] w-56 overflow-hidden rounded-2xl border border-border bg-sidebar py-1.5 shadow-xl"
      >
        {menuItems.map((item) => (
          <button
            key={item.label}
            onClick={() => {
              item.onClick()
              onClose()
            }}
            className="flex w-full items-center gap-3 px-3 py-2.5 text-sm text-foreground transition-colors hover:bg-accent"
          >
            <item.icon className="h-4 w-4 flex-shrink-0" />
            <span>{item.label}</span>
          </button>
        ))}

        {onDelete ? (
          <>
            <div className="my-1 border-t border-border" />
            <button
              onClick={() => {
                onDelete()
                onClose()
              }}
              className="flex w-full items-center gap-3 px-3 py-2.5 text-sm text-destructive transition-colors hover:bg-destructive/10"
            >
              <Trash2 className="h-4 w-4 flex-shrink-0" />
              <span>{isOwn || canModerate ? 'Delete post' : 'Hide locally'}</span>
            </button>
          </>
        ) : null}

        {hasModerationActions ? (
          <>
            <div className="my-1 border-t border-border" />

            {showPromote && onPromote ? (
              <button
                onClick={() => { onPromote(); onClose() }}
                className="flex w-full items-center gap-3 px-3 py-2.5 text-sm text-violet-600 dark:text-violet-400 transition-colors hover:bg-violet-500/10"
              >
                <Shield className="h-4 w-4 flex-shrink-0" />
                <span>Promote to Admin</span>
              </button>
            ) : null}

            {showDemote && onDemote ? (
              <button
                onClick={() => { onDemote(); onClose() }}
                className="flex w-full items-center gap-3 px-3 py-2.5 text-sm text-amber-600 dark:text-amber-400 transition-colors hover:bg-amber-500/10"
              >
                <Crown className="h-4 w-4 flex-shrink-0" />
                <span>Demote to Member</span>
              </button>
            ) : null}

            {(showKickOwner || showKickAdmin) && onKick ? (
              <button
                onClick={() => { onKick(); onClose() }}
                className="flex w-full items-center gap-3 px-3 py-2.5 text-sm text-destructive transition-colors hover:bg-destructive/10"
              >
                <UserX className="h-4 w-4 flex-shrink-0" />
                <span>
                  Kick{showKickOwner ? ' (Owner)' : ' (Admin)'}
                </span>
              </button>
            ) : null}
          </>
        ) : null}
      </motion.div>
    </AnimatePresence>
  )
}
