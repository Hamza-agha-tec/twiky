'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';
import { Copy, Reply, Forward, Trash2, Pin, Download } from 'lucide-react';

const EMOJI_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🔥', '👏', '😍'];

interface MessageContextMenuProps {
  x: number;
  y: number;
  onClose: () => void;
  onReact: (emoji: string) => void;
  onReply?: () => void;
  onDelete?: () => void;
}

export function MessageContextMenu({
  x,
  y,
  onClose,
  onReact,
  onReply,
  onDelete,
}: MessageContextMenuProps) {
  const [showEmojis, setShowEmojis] = useState(false);

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

      {/* Emoji Reactions */}
      {showEmojis && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.8, y: 10 }}
          style={{ left: `${x}px`, top: `${Math.max(60, y - 100)}px` }}
          className="fixed z-50 bg-background border border-border rounded-2xl shadow-lg p-2 flex gap-2"
        >
          {EMOJI_REACTIONS.map((emoji, idx) => (
            <motion.button
              key={`emoji-reaction-${idx}`}
              whileHover={{ scale: 1.3 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => {
                onReact(emoji);
                onClose();
              }}
              className="text-2xl hover:bg-accent rounded-lg p-1.5 transition-colors"
            >
              {emoji}
            </motion.button>
          ))}
        </motion.div>
      )}

      {/* Context Menu */}
      <motion.div
        initial={{ opacity: 0, scale: 0.8, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.8, y: 10 }}
        style={{ left: `${x}px`, top: `${y}px` }}
        className="fixed z-50 bg-background border border-border rounded-lg shadow-lg overflow-hidden min-w-48"
      >
        {/* React Option */}
        <motion.button
          whileHover={{ backgroundColor: 'var(--color-accent)' }}
          onClick={() => setShowEmojis(!showEmojis)}
          className="w-full px-4 py-3 flex items-center gap-3 text-sm hover:bg-accent transition-colors border-b border-border"
        >
          <span className="text-lg">😊</span>
          <span>React</span>
        </motion.button>

        {/* Reply Option */}
        {onReply && (
          <motion.button
            whileHover={{ backgroundColor: 'var(--color-accent)' }}
            onClick={() => {
              onReply();
              onClose();
            }}
            className="w-full px-4 py-3 flex items-center gap-3 text-sm hover:bg-accent transition-colors border-b border-border"
          >
            <Reply className="h-4 w-4" />
            <span>Reply</span>
          </motion.button>
        )}

        {/* Forward Option */}
        <motion.button
          whileHover={{ backgroundColor: 'var(--color-accent)' }}
          onClick={onClose}
          className="w-full px-4 py-3 flex items-center gap-3 text-sm hover:bg-accent transition-colors border-b border-border"
        >
          <Forward className="h-4 w-4" />
          <span>Forward</span>
        </motion.button>

        {/* Copy Option */}
        <motion.button
          whileHover={{ backgroundColor: 'var(--color-accent)' }}
          onClick={onClose}
          className="w-full px-4 py-3 flex items-center gap-3 text-sm hover:bg-accent transition-colors border-b border-border"
        >
          <Copy className="h-4 w-4" />
          <span>Copy</span>
        </motion.button>

        {/* Download Option */}
        <motion.button
          whileHover={{ backgroundColor: 'var(--color-accent)' }}
          onClick={onClose}
          className="w-full px-4 py-3 flex items-center gap-3 text-sm hover:bg-accent transition-colors border-b border-border"
        >
          <Download className="h-4 w-4" />
          <span>Download</span>
        </motion.button>

        {/* Delete Option */}
        {onDelete && (
          <motion.button
            whileHover={{ backgroundColor: 'var(--color-destructive)' }}
            onClick={() => {
              onDelete();
              onClose();
            }}
            className="w-full px-4 py-3 flex items-center gap-3 text-sm text-destructive hover:bg-destructive/10 transition-colors"
          >
            <Trash2 className="h-4 w-4" />
            <span>Delete</span>
          </motion.button>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
