'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Check, CheckCheck, Forward, Play, Pause } from 'lucide-react';
import { Message } from '@/lib/mock-data';
import { format } from 'date-fns';
import { useState, useEffect, useRef } from 'react';
import { MessageContextMenu } from './message-context-menu';

interface MessageBubbleProps {
  message: Message;
  showAvatar?: boolean;
  onReply?: (message: Message) => void;
  onDelete?: () => void;
  onReact?: (emoji: string) => void;
}

// Realistic waveform bar heights
const WAVEFORM = [30, 55, 40, 75, 60, 45, 85, 50, 65, 35, 70, 80, 45, 60, 40, 75, 55, 90, 35, 65, 50, 80, 45, 70, 55];

export function MessageBubble({ message, showAvatar = true, onReply, onDelete, onReact }: MessageBubbleProps) {
  const [isMounted, setIsMounted] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [messageReactions, setMessageReactions] = useState<Record<string, number>>(
    message.reactions?.reduce((acc, r) => ({ ...acc, [r.emoji]: r.count }), {}) || {}
  );
  const messageRef = useRef<HTMLDivElement>(null);

  const initials = message.senderName
    .split(' ')
    .map((word) => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY });
  };

  const handleAddReaction = (emoji: string) => {
    setMessageReactions((prev) => ({
      ...prev,
      [emoji]: (prev[emoji] || 0) + 1,
    }));
    onReact?.(emoji);
  };

  const handlePlayToggle = () => {
    setIsPlaying((p) => !p);
    if (!isPlaying) setTimeout(() => setIsPlaying(false), 3000);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18 }}
      className={`flex gap-2 group relative ${message.isOwn ? 'justify-end' : 'justify-start'}`}
    >
      {!message.isOwn && (
        <div className="flex-shrink-0 self-end">
          {showAvatar ? (
            <Avatar className="h-8 w-8">
              <AvatarImage src={message.avatar} alt={message.senderName} />
              <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                {initials}
              </AvatarFallback>
            </Avatar>
          ) : (
            <div className="h-8 w-8" />
          )}
        </div>
      )}

      <div className={`flex flex-col max-w-sm ${message.isOwn ? 'items-end' : 'items-start'}`}>
        {/* Reply Preview */}
        {message.reply && (
          <div className={`mb-1.5 text-xs px-3 py-2 rounded-xl border-l-2 max-w-xs ${
            message.isOwn
              ? 'border-primary/40 bg-primary/8 text-muted-foreground'
              : 'border-muted-foreground/30 bg-muted text-muted-foreground'
          }`}>
            <p className="font-semibold text-foreground text-[11px] mb-0.5">{message.reply.senderName}</p>
            <p className="truncate">{message.reply.content}</p>
          </div>
        )}

        {/* Forwarded Indicator */}
        {message.isForwarded && (
          <div className="text-[11px] text-muted-foreground flex items-center gap-1 mb-1 px-1">
            <Forward className="h-3 w-3" />
            <span>Forwarded</span>
          </div>
        )}

        {/* Message Content */}
        <div
          ref={messageRef}
          className={`rounded-2xl relative cursor-context-menu ${
            message.type === 'image' || message.type === 'video' ? 'p-0 overflow-hidden' : 'px-4 py-2.5'
          } ${
            message.isOwn
              ? 'bg-primary text-primary-foreground rounded-br-sm'
              : 'bg-muted text-foreground rounded-bl-sm'
          }`}
          onContextMenu={handleContextMenu}
        >
          {/* Text */}
          {message.type === 'text' && (
            <p className="text-sm break-words whitespace-pre-wrap leading-relaxed">{message.content}</p>
          )}

          {/* Image */}
          {message.type === 'image' && (
            <img
              src={message.content}
              alt="Shared image"
              className="max-w-xs max-h-64 object-cover block"
            />
          )}

          {/* Video */}
          {message.type === 'video' && (
            <div className="max-w-xs relative group/video overflow-hidden">
              <img
                src={message.content}
                alt="Video thumbnail"
                className="max-h-64 w-full object-cover group-hover/video:scale-105 transition-transform duration-300"
              />
              <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/50" />
              <div className="absolute inset-0 flex items-center justify-center">
                <motion.button
                  whileHover={{ scale: 1.12 }}
                  whileTap={{ scale: 0.92 }}
                  className="p-3 bg-white/90 backdrop-blur-sm rounded-full shadow-lg"
                >
                  <Play className="h-6 w-6 text-black fill-black" />
                </motion.button>
              </div>
              {message.duration && (
                <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-2 py-0.5 rounded font-medium">
                  {message.duration}
                </div>
              )}
            </div>
          )}

          {/* Voice Message */}
          {message.type === 'voice' && (
            <div className="flex items-center gap-3 min-w-[200px] py-0.5">
              <motion.button
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.92 }}
                onClick={handlePlayToggle}
                className={`h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                  message.isOwn ? 'bg-white/20 hover:bg-white/30' : 'bg-primary/15 hover:bg-primary/25'
                } transition-colors`}
              >
                {isPlaying ? (
                  <Pause className="h-3.5 w-3.5 fill-current" />
                ) : (
                  <Play className="h-3.5 w-3.5 fill-current ml-0.5" />
                )}
              </motion.button>

              {/* Waveform bars */}
              <div className="flex items-center gap-px h-8 flex-1">
                {WAVEFORM.map((h, i) => (
                  <motion.div
                    key={i}
                    className={`w-1 rounded-full flex-shrink-0 ${
                      message.isOwn ? 'bg-white/70' : 'bg-primary/60'
                    }`}
                    style={{ height: `${h}%` }}
                    animate={isPlaying ? {
                      scaleY: [1, 1.5 + Math.random(), 1],
                      opacity: [0.6, 1, 0.6],
                    } : { scaleY: 1, opacity: 0.7 }}
                    transition={isPlaying ? {
                      duration: 0.4 + Math.random() * 0.3,
                      repeat: Infinity,
                      delay: i * 0.02,
                    } : {}}
                  />
                ))}
              </div>

              <span className="text-xs whitespace-nowrap opacity-75">{message.content}</span>
            </div>
          )}

          {/* Edited */}
          {message.isEdited && (
            <p className="text-[10px] opacity-60 mt-0.5">(edited)</p>
          )}
        </div>

        {/* Reactions */}
        {Object.keys(messageReactions).length > 0 && (
          <div className={`flex gap-1 mt-1 flex-wrap ${message.isOwn ? 'justify-end' : 'justify-start'}`}>
            {Object.entries(messageReactions).map(([emoji, count], idx) => (
              <motion.button
                key={`${message.id}-r-${idx}`}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                whileHover={{ scale: 1.15 }}
                onClick={() => handleAddReaction(emoji)}
                className="flex items-center gap-1 bg-muted border border-border rounded-full px-2 py-0.5 text-xs hover:bg-accent transition-colors"
              >
                <span>{emoji}</span>
                {count > 1 && <span className="text-muted-foreground">{count}</span>}
              </motion.button>
            ))}
          </div>
        )}

        {/* Timestamp + Read Status */}
        <div className="flex items-center gap-1 mt-1 px-1 text-[11px] text-muted-foreground">
          {isMounted && <span>{format(new Date(message.timestamp), 'HH:mm')}</span>}
          {message.isOwn && (
            <>
              {message.isRead ? (
                <CheckCheck className="h-3 w-3 text-blue-500" />
              ) : message.isDelivered ? (
                <CheckCheck className="h-3 w-3 text-muted-foreground/60" />
              ) : (
                <Check className="h-3 w-3 text-muted-foreground/60" />
              )}
            </>
          )}
        </div>
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <MessageContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          onReact={handleAddReaction}
          onReply={onReply ? () => { onReply(message); setContextMenu(null); } : undefined}
          onDelete={onDelete ? () => { onDelete(); setContextMenu(null); } : undefined}
        />
      )}
    </motion.div>
  );
}
