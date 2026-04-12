'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { Copy, Forward, Pin, Reply, Trash2 } from 'lucide-react';
import { useState } from 'react';

const EMOJI_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🔥', '👏', '😍'];
const REACT_ICON = '😊';
const MENU_WIDTH = 192;
const MENU_HEIGHT = 280;
const EMOJI_MENU_WIDTH = 328;
const EMOJI_MENU_HEIGHT = 56;
const VIEWPORT_PADDING = 8;

interface MessageContextMenuProps {
  x: number;
  y: number;
  onClose: () => void;
  onReact: (emoji: string) => void;
  onReply?: () => void;
  onDelete?: () => void;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function MessageContextMenu({ x, y, onClose, onReact, onReply, onDelete }: MessageContextMenuProps) {
  const [showEmojis, setShowEmojis] = useState(false);
  const viewportWidth = typeof window === 'undefined' ? MENU_WIDTH + VIEWPORT_PADDING * 2 : window.innerWidth;
  const viewportHeight = typeof window === 'undefined' ? MENU_HEIGHT + VIEWPORT_PADDING * 2 : window.innerHeight;

  const menuLeft = clamp(
    x,
    VIEWPORT_PADDING,
    Math.max(VIEWPORT_PADDING, viewportWidth - MENU_WIDTH - VIEWPORT_PADDING),
  );
  const menuTop = clamp(
    y,
    VIEWPORT_PADDING,
    Math.max(VIEWPORT_PADDING, viewportHeight - MENU_HEIGHT - VIEWPORT_PADDING),
  );
  const emojiLeft = clamp(
    x - EMOJI_MENU_WIDTH / 2,
    VIEWPORT_PADDING,
    Math.max(VIEWPORT_PADDING, viewportWidth - EMOJI_MENU_WIDTH - VIEWPORT_PADDING),
  );
  const emojiTop = clamp(
    y - EMOJI_MENU_HEIGHT - 12,
    VIEWPORT_PADDING,
    Math.max(VIEWPORT_PADDING, viewportHeight - EMOJI_MENU_HEIGHT - VIEWPORT_PADDING),
  );

  const menuItems = [
    {
      icon: REACT_ICON,
      label: 'React',
      onClick: () => setShowEmojis(true),
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

      {showEmojis ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 6 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9 }}
          onClick={(e) => e.stopPropagation()}
          style={{ left: `${emojiLeft}px`, top: `${emojiTop}px` }}
          className="fixed z-50 bg-sidebar border border-border rounded-2xl shadow-xl p-2 flex gap-1"
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
      ) : (
        <motion.div
          initial={{ opacity: 0, scale: 0.92, y: 6 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.92 }}
          transition={{ duration: 0.12 }}
          onClick={(e) => e.stopPropagation()}
          style={{
            left: `${menuLeft}px`,
            top: `${menuTop}px`,
          }}
          className="fixed z-50 bg-sidebar border border-border rounded-xl shadow-xl overflow-hidden min-w-44 py-1"
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
      )}
    </AnimatePresence>
  );
}
