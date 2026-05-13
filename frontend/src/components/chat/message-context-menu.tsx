'use client';

import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Copy, Forward, Pin, PinOff, Reply, SmilePlus, Trash2 } from 'lucide-react';
import { EmojiImg } from '@/components/chat/apple-text';
import EmojiPicker, { Theme, EmojiClickData, EmojiStyle } from 'emoji-picker-react';
import { useTheme } from 'next-themes';

const QUICK_EMOJIS: Array<{ char: string; unified: string }> = [
  { char: '👍', unified: '1f44d' },
  { char: '❤️', unified: '2764-fe0f' },
  { char: '😂', unified: '1f602' },
  { char: '🔥', unified: '1f525' },
  { char: '🎉', unified: '1f389' },
  { char: '😮', unified: '1f62e' },
];

const MENU_WIDTH = 192;
const PICKER_WIDTH = 350;
const PICKER_HEIGHT = 450;
const VIEWPORT_PADDING = 8;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function FloatingEmojiPicker({
  menuLeft,
  menuTop,
  onSelect,
}: {
  menuLeft: number;
  menuTop: number;
  onSelect: (emoji: string) => void;
}) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  const viewportWidth = typeof window === 'undefined' ? 1280 : window.innerWidth;
  const viewportHeight = typeof window === 'undefined' ? 800 : window.innerHeight;

  const spaceLeft = menuLeft - VIEWPORT_PADDING;
  const pickerLeft = spaceLeft >= PICKER_WIDTH
    ? menuLeft - PICKER_WIDTH - 8
    : clamp(menuLeft + MENU_WIDTH + 8, VIEWPORT_PADDING, viewportWidth - PICKER_WIDTH - VIEWPORT_PADDING);

  const pickerTop = clamp(menuTop, VIEWPORT_PADDING, viewportHeight - PICKER_HEIGHT - VIEWPORT_PADDING);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.92, y: 6 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.92 }}
      transition={{ duration: 0.12 }}
      style={{ left: pickerLeft, top: pickerTop, width: PICKER_WIDTH }}
      className="fixed z-[51] overflow-hidden rounded-2xl border border-border bg-sidebar shadow-xl"
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
  );
}

interface MessageContextMenuProps {
  x: number;
  y: number;
  isPinned?: boolean;
  isOwn?: boolean;
  onClose: () => void;
  onReact: (emoji: string) => void;
  onReply?: () => void;
  onPin?: () => void;
  onForward?: () => void;
  onCopy?: () => void;
  onDelete?: () => void;
}

export function MessageContextMenu({ x, y, isPinned, isOwn, onClose, onReact, onReply, onPin, onForward, onCopy, onDelete }: MessageContextMenuProps) {
  const [showPicker, setShowPicker] = useState(false);

  const viewportWidth = typeof window === 'undefined' ? MENU_WIDTH + VIEWPORT_PADDING * 2 : window.innerWidth;
  const viewportHeight = typeof window === 'undefined' ? 800 : window.innerHeight;

  const menuLeft = clamp(x, VIEWPORT_PADDING, Math.max(VIEWPORT_PADDING, viewportWidth - MENU_WIDTH - VIEWPORT_PADDING));
  const menuTop = clamp(y, VIEWPORT_PADDING, Math.max(VIEWPORT_PADDING, viewportHeight - 300 - VIEWPORT_PADDING));

  const menuItems = [
    ...(onReply ? [{ icon: Reply, label: 'Reply', onClick: () => { onReply(); onClose(); } }] : []),
    ...(onForward ? [{ icon: Forward, label: 'Forward', onClick: () => { onForward(); onClose(); } }] : []),
    ...(onPin ? [{ icon: isPinned ? PinOff : Pin, label: isPinned ? 'Unpin' : 'Pin', onClick: () => { onPin(); onClose(); } }] : []),
    ...(onCopy ? [{ icon: Copy, label: 'Copy', onClick: () => { onCopy(); onClose(); } }] : []),
    ...(onDelete ? [{ icon: Trash2, label: 'Delete', onClick: () => { onDelete(); onClose(); }, danger: true }] : []),
  ];

  return (
    <AnimatePresence>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-40"
      />

      {/* Floating emoji picker */}
      {showPicker && (
        <FloatingEmojiPicker
          menuLeft={menuLeft}
          menuTop={menuTop}
          onSelect={(emoji) => { onReact(emoji); onClose(); }}
        />
      )}

      {/* Context menu */}
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 6 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.92 }}
        transition={{ duration: 0.12 }}
        onClick={(e) => e.stopPropagation()}
        style={{ left: `${menuLeft}px`, top: `${menuTop}px` }}
        className="fixed z-50 w-48 overflow-hidden rounded-2xl border border-border bg-sidebar shadow-xl"
      >
        {/* Quick reaction row */}
        <div className="flex items-center justify-between px-2 py-2">
          {QUICK_EMOJIS.map(({ char, unified }) => (
            <button
              key={unified}
              type="button"
              onClick={() => { onReact(char); onClose(); }}
              className="flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-accent"
            >
              <EmojiImg value={char} unified={unified} size={22} />
            </button>
          ))}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setShowPicker(v => !v); }}
            className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-accent ${showPicker ? 'bg-accent text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
          >
            <SmilePlus className="h-4 w-4" />
          </button>
        </div>

        <div className="border-t border-border" />

        {/* Menu items */}
        <div className="py-1.5">
          {menuItems.map((item, i) => {
            const isDanger = 'danger' in item && item.danger;
            return (
              <button
                key={i}
                onClick={item.onClick}
                className={`w-full px-3 py-2.5 flex items-center gap-3 text-sm transition-colors ${
                  isDanger ? 'text-destructive hover:bg-destructive/10' : 'text-foreground hover:bg-accent'
                }`}
              >
                <item.icon className="h-4 w-4 flex-shrink-0" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
