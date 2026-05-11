'use client'

import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Copy, Crown, ImageIcon, Pin, PinOff, Reply, Shield, SmilePlus, Trash2, UserX } from 'lucide-react'
import { EmojiImg } from '@/components/chat/apple-text'
import EmojiPicker, { Theme, EmojiClickData, EmojiStyle } from 'emoji-picker-react'
import { useTheme } from 'next-themes'

const QUICK_EMOJIS: Array<{ char: string; unified: string }> = [
  { char: '👍', unified: '1f44d' },
  { char: '❤️', unified: '2764-fe0f' },
  { char: '😂', unified: '1f602' },
  { char: '🔥', unified: '1f525' },
  { char: '🎉', unified: '1f389' },
  { char: '😮', unified: '1f62e' },
]

interface FeedPostContextMenuProps {
  canModerate?: boolean
  hasMedia?: boolean
  isOwn?: boolean
  isPinned?: boolean
  targetRole?: string
  viewerRole?: string
  onClose: () => void
  onCopy: () => void
  onDelete?: () => void
  onOpenMedia?: () => void
  onReact?: (emoji: string) => void
  onReply: () => void
  onTogglePin: () => void
  onKick?: () => void
  onPromote?: () => void
  onDemote?: () => void
  x: number
  y: number
}

const MENU_WIDTH = 224
const PICKER_WIDTH = 350
const PICKER_HEIGHT = 450
const VIEWPORT_PADDING = 8

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function FloatingEmojiPicker({
  menuLeft,
  menuTop,
  onSelect,
}: {
  menuLeft: number
  menuTop: number
  onSelect: (emoji: string) => void
}) {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  const viewportWidth = typeof window === 'undefined' ? 1280 : window.innerWidth
  const viewportHeight = typeof window === 'undefined' ? 800 : window.innerHeight

  // Place to the left if there's room, otherwise to the right
  const spaceLeft = menuLeft - VIEWPORT_PADDING
  const pickerLeft = spaceLeft >= PICKER_WIDTH
    ? menuLeft - PICKER_WIDTH - 8
    : clamp(menuLeft + MENU_WIDTH + 8, VIEWPORT_PADDING, viewportWidth - PICKER_WIDTH - VIEWPORT_PADDING)

  const pickerTop = clamp(menuTop, VIEWPORT_PADDING, viewportHeight - PICKER_HEIGHT - VIEWPORT_PADDING)

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.92, y: 6 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.92 }}
      transition={{ duration: 0.12 }}
      style={{ left: pickerLeft, top: pickerTop, width: PICKER_WIDTH }}
      className="fixed z-[1301] overflow-hidden rounded-2xl border border-border bg-sidebar shadow-xl"
    >
      <EmojiPicker
        onEmojiClick={(data: EmojiClickData) => onSelect(data.emoji)}
        theme={isDark ? Theme.DARK : Theme.LIGHT}
        emojiStyle={EmojiStyle.APPLE}
        skinTonesDisabled
        previewConfig={{ showPreview: false }}
        width={PICKER_WIDTH}
        height={PICKER_HEIGHT}
        style={{
          '--epr-bg-color': isDark ? 'var(--sidebar)' : 'var(--background)',
          '--epr-category-label-bg-color': isDark ? 'var(--sidebar)' : 'var(--muted)',
          '--epr-search-input-bg-color': isDark ? 'oklch(0.18 0.02 260)' : 'var(--muted)',
          '--epr-hover-bg-color': isDark ? 'oklch(0.22 0.02 260)' : 'var(--accent)',
          '--epr-focus-bg-color': isDark ? 'oklch(0.22 0.02 260)' : 'var(--accent)',
          '--epr-text-color': 'var(--foreground)',
          '--epr-search-border-color': 'var(--border)',
          '--epr-border-color': 'transparent',
          '--epr-highlight-color': 'var(--primary)',
          background: 'transparent',
          border: 'none',
          borderRadius: '0',
        } as React.CSSProperties}
      />
    </motion.div>
  )
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
  onReact,
  onReply,
  onTogglePin,
  onKick,
  onPromote,
  onDemote,
  x,
  y,
}: FeedPostContextMenuProps) {
  const [showPicker, setShowPicker] = useState(false)

  const viewportWidth = typeof window === 'undefined' ? MENU_WIDTH + VIEWPORT_PADDING * 2 : window.innerWidth
  const viewportHeight = typeof window === 'undefined' ? 800 : window.innerHeight

  const menuLeft = clamp(x, VIEWPORT_PADDING, Math.max(VIEWPORT_PADDING, viewportWidth - MENU_WIDTH - VIEWPORT_PADDING))
  const menuTop = clamp(y, VIEWPORT_PADDING, Math.max(VIEWPORT_PADDING, viewportHeight - 320 - VIEWPORT_PADDING))

  const viewer = viewerRole?.toUpperCase()
  const target = targetRole?.toLowerCase()
  const isViewerOwner = viewer === 'OWNER'
  const isViewerAdmin = viewer === 'ADMIN'
  const isTargetOwner = target === 'owner'
  const isTargetAdmin = target === 'admin'
  const isTargetMember = !isTargetOwner && !isTargetAdmin

  const showKickOwner = !isOwn && isViewerOwner && !isTargetOwner
  const showKickAdmin = !isOwn && isViewerAdmin && isTargetMember
  const showPromote = !isOwn && isViewerOwner && isTargetMember
  const showDemote = !isOwn && isViewerOwner && isTargetAdmin

  const hasModerationActions = showKickOwner || showKickAdmin || showPromote || showDemote

  const menuItems = [
    { icon: Reply, label: 'Reply in feed', onClick: onReply },
    { icon: isPinned ? PinOff : Pin, label: isPinned ? 'Unpin post' : 'Pin post', onClick: onTogglePin },
    { icon: Copy, label: 'Copy text', onClick: onCopy },
    ...(hasMedia && onOpenMedia ? [{ icon: ImageIcon, label: 'Open image', onClick: onOpenMedia }] : []),
  ]

  return (
    <AnimatePresence>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-[1290]"
      />

      {/* Floating emoji picker — rendered outside the menu */}
      {showPicker && onReact && (
        <FloatingEmojiPicker
          menuLeft={menuLeft}
          menuTop={menuTop}
          onSelect={(emoji) => { onReact(emoji); onClose() }}
        />
      )}

      {/* Context menu */}
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 6 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.92 }}
        transition={{ duration: 0.12 }}
        style={{ left: `${menuLeft}px`, top: `${menuTop}px` }}
        className="fixed z-[1300] w-56 overflow-hidden rounded-2xl border border-border bg-sidebar shadow-xl"
      >
        {onReact && (
          <>
            <div className="flex items-center justify-between px-2 py-2">
              {QUICK_EMOJIS.map(({ char, unified }) => (
                <button
                  key={unified}
                  type="button"
                  onClick={() => { onReact(char); onClose() }}
                  className="flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-accent"
                >
                  <EmojiImg value={char} unified={unified} size={22} />
                </button>
              ))}
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setShowPicker(v => !v) }}
                className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-accent ${showPicker ? 'bg-accent text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
              >
                <SmilePlus className="h-4 w-4" />
              </button>
            </div>
            <div className="border-t border-border" />
          </>
        )}

        <div className="py-1.5">
          {menuItems.map((item) => (
            <button
              key={item.label}
              onClick={() => { item.onClick(); onClose() }}
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
                onClick={() => { onDelete(); onClose() }}
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
                  <span>Kick{showKickOwner ? ' (Owner)' : ' (Admin)'}</span>
                </button>
              ) : null}
            </>
          ) : null}
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
