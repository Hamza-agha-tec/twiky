'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useState } from 'react';
import { Copy, Reply, Forward, Trash2, Pin } from 'lucide-react';

const EMOJI_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🔥', '👏', '😍'];

interface MessageContextMenuProps {
  x: number;
  y: number;
  onClose: () => void;
  onReact: (emoji: string) => void;
  onReply?: () => void;
  onDelete?: () => void;
}

export function MessageContextMenu({ x, y, onClose, onReact, onReply, onDelete }: MessageContextMenuProps) {
  const [showEmojis, setShowEmojis] = useState(false);

  const menuItems = [
    {
      icon: '😊',
      label: 'React',
      onClick: () => setShowEmojis(!showEmojis),
      isEmoji: true,
    },
    ...(onReply ? [{ icon: Reply, label: 'Reply', onClick: () => { onReply(); onClose(); } }] : []),
    { icon: Forward, label: 'Forward', onClick: onClose },
    { icon: Pin, label: 'Pin message', onClick: onClose },
    { icon: Copy, label: 'Copy', onClick: onClose },
    { icon: Trash2, label: 'Delete', onClick: () => { onDelete?.(); onClose(); }, danger: true },
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

      {showEmojis && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 6 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9 }}
          style={{ left: `${x}px`, top: `${Math.max(60, y - 60)}px` }}
          className="fixed z-50 bg-popover border border-border rounded-2xl shadow-xl p-2 flex gap-1"
        >
          {EMOJI_REACTIONS.map((emoji) => (
            <button
              key={emoji}
              onClick={() => { onReact(emoji); onClose(); }}
              className="text-xl w-9 h-9 flex items-center justify-center rounded-xl hover:bg-accent transition-colors"
            >
              {emoji}
            </button>
          ))}
        </motion.div>
      )}

      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 6 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.92 }}
        transition={{ duration: 0.12 }}
        style={{
          left: `${Math.min(x, window.innerWidth - 192)}px`,
          top: `${Math.min(y, window.innerHeight - 280)}px`,
        }}
        className="fixed z-50 bg-popover border border-border rounded-xl shadow-xl overflow-hidden min-w-44 py-1"
      >
        {menuItems.map((item, i) => {
          const isDanger = 'danger' in item && item.danger;
          return (
            <button
              key={i}
              onClick={item.onClick}
              className={`w-full px-3 py-2 flex items-center gap-3 text-sm transition-colors ${
                isDanger
                  ? 'text-destructive hover:bg-destructive/10'
                  : 'text-foreground hover:bg-accent'
              }`}
            >
              {item.isEmoji ? (
                <span className="text-base">{item.icon as string}</span>
              ) : (
                <item.icon className="h-4 w-4 flex-shrink-0" />
              )}
              <span>{item.label}</span>
            </button>
          );
        })}
      </motion.div>
    </AnimatePresence>
  );
}
