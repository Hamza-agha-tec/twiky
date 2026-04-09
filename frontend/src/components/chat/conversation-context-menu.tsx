'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { Star, Archive, BellOff, Bell, Pin, PinOff, ShieldAlert, Trash2 } from 'lucide-react';

interface ConversationContextMenuProps {
  x: number;
  y: number;
  chatId: string;
  isPinned?: boolean;
  isMuted?: boolean;
  isFavorite?: boolean;
  isGroup?: boolean;
  onClose: () => void;
  onFavorite: () => void;
  onArchive: () => void;
  onMute: () => void;
  onPin: () => void;
  onBlock: () => void;
  onDelete: () => void;
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
}: ConversationContextMenuProps) {
  const safeX = Math.min(x, window.innerWidth - 210);
  const safeY = Math.min(y, window.innerHeight - 320);

  const normalItems = [
    {
      icon: Star,
      label: isFavorite ? 'Remove from favorites' : 'Add to favorites',
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
  ];

  const dangerItems = [
    ...(!isGroup ? [{ icon: ShieldAlert, label: 'Block', onClick: onBlock }] : []),
    { icon: Trash2, label: 'Delete conversation', onClick: onDelete },
  ];

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
        className="fixed z-50 bg-popover border border-border rounded-xl shadow-xl overflow-hidden w-52 py-1"
      >
        {normalItems.map((item) => (
          <button
            key={item.label}
            onClick={() => { item.onClick(); onClose(); }}
            className={`w-full px-3 py-2 flex items-center gap-3 text-sm transition-colors hover:bg-accent ${
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
            onClick={() => { item.onClick(); onClose(); }}
            className="w-full px-3 py-2 flex items-center gap-3 text-sm text-destructive hover:bg-destructive/10 transition-colors"
          >
            <item.icon className="h-4 w-4 flex-shrink-0" />
            <span>{item.label}</span>
          </button>
        ))}
      </motion.div>
    </AnimatePresence>
  );
}
