'use client'

import { AnimatePresence, motion } from 'framer-motion'
import {
  Archive,
  Bell,
  BellOff,
  Pencil,
  Pin,
  PinOff,
  ShieldAlert,
  Star,
  Trash2,
} from 'lucide-react'

interface ConversationContextMenuProps {
  x: number
  y: number
  chatId: string
  isPinned?: boolean
  isMuted?: boolean
  isFavorite?: boolean
  isGroup?: boolean
  onClose: () => void
  onFavorite: () => void
  onArchive: () => void
  onMute: () => void
  onPin: () => void
  onBlock: () => void
  onDelete: () => void
  onEditContact?: () => void
}

export function ConversationContextMenu({
  x,
  y,
  isPinned,
  isMuted,
  isFavorite,
  isGroup,
  onClose,
  onFavorite,
  onArchive,
  onMute,
  onPin,
  onBlock,
  onDelete,
  onEditContact,
}: ConversationContextMenuProps) {
  const safeX = Math.min(x, window.innerWidth - 220)
  const safeY = Math.min(y, window.innerHeight - 340)

  const normalItems = [
    {
      icon: Star,
      label: isFavorite ? 'Remove favorite' : 'Add to favorites',
      onClick: onFavorite,
      active: isFavorite,
    },
    {
      icon: Archive,
      label: 'Archive',
      onClick: onArchive,
    },
    {
      icon: isMuted ? Bell : BellOff,
      label: isMuted ? 'Unmute' : 'Mute',
      onClick: onMute,
    },
    {
      icon: isPinned ? PinOff : Pin,
      label: isPinned ? 'Unpin' : 'Pin',
      onClick: onPin,
    },
  ]

  const dangerItems = [
    ...(!isGroup && onEditContact
      ? [{ icon: Pencil, label: 'Edit nickname', onClick: onEditContact }]
      : []),
    ...(!isGroup
      ? [{ icon: ShieldAlert, label: 'Block contact', onClick: onBlock }]
      : []),
    {
      icon: Trash2,
      label: isGroup ? 'Delete channel' : 'Delete conversation',
      onClick: onDelete,
    },
  ]

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-40"
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 6 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.92 }}
        transition={{ duration: 0.12 }}
        style={{ left: `${safeX}px`, top: `${safeY}px` }}
        className="fixed z-50 w-56 overflow-hidden rounded-2xl border border-border bg-sidebar py-1.5 shadow-xl"
      >
        {normalItems.map((item) => (
          <button
            key={item.label}
            onClick={() => {
              item.onClick()
              onClose()
            }}
            className={`flex w-full items-center gap-3 px-3 py-2.5 text-sm transition-colors hover:bg-accent ${
              item.active ? 'text-amber-500' : 'text-foreground'
            }`}
          >
            <item.icon className="h-4 w-4 flex-shrink-0" />
            <span>{item.label}</span>
          </button>
        ))}

        <div className="my-1 border-t border-border" />

        {dangerItems.map((item) => (
          <button
            key={item.label}
            onClick={() => {
              item.onClick()
              onClose()
            }}
            className="flex w-full items-center gap-3 px-3 py-2.5 text-sm text-destructive transition-colors hover:bg-destructive/10"
          >
            <item.icon className="h-4 w-4 flex-shrink-0" />
            <span>{item.label}</span>
          </button>
        ))}
      </motion.div>
    </AnimatePresence>
  )
}
