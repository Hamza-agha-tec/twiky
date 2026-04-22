'use client'

import { AnimatePresence, motion } from 'framer-motion'
import { Copy, ImageIcon, Pin, PinOff, Reply, Trash2 } from 'lucide-react'

interface FeedPostContextMenuProps {
  canModerate?: boolean
  hasMedia?: boolean
  isOwn?: boolean
  isPinned?: boolean
  onClose: () => void
  onCopy: () => void
  onDelete?: () => void
  onOpenMedia?: () => void
  onReply: () => void
  onTogglePin: () => void
  x: number
  y: number
}

const MENU_WIDTH = 224
const MENU_HEIGHT = 240
const VIEWPORT_PADDING = 8

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

export function FeedPostContextMenu({
  canModerate,
  hasMedia,
  isOwn,
  isPinned,
  onClose,
  onCopy,
  onDelete,
  onOpenMedia,
  onReply,
  onTogglePin,
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
      </motion.div>
    </AnimatePresence>
  )
}
