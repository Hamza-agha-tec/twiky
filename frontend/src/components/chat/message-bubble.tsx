'use client';

import { motion } from 'framer-motion';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Check, CheckCheck, Forward, Play } from 'lucide-react';
import { Message } from '@/lib/mock-data';
import { format } from 'date-fns';
import { useState, useEffect, useRef } from 'react';
import { MessageContextMenu } from './message-context-menu';

interface MessageBubbleProps {
  message: Message;
  showAvatar?: boolean;
}

export function MessageBubble({ message, showAvatar = true }: MessageBubbleProps) {
  const [showReactions, setShowReactions] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
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
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={`flex gap-2 ${message.isOwn ? 'justify-end' : 'justify-start'}`}
    >
      {!message.isOwn && (
        <div className="flex-shrink-0">
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

      <div className={`flex flex-col ${message.isOwn ? 'items-end' : 'items-start'}`}>
        {/* Reply Preview */}
        {message.reply && (
          <div className={`mb-2 text-xs px-3 py-2 rounded-lg border-l-2 ${
            message.isOwn
              ? 'border-primary/50 bg-primary/5 text-muted-foreground'
              : 'border-muted-foreground/50 bg-muted text-muted-foreground'
          }`}>
            <p className="font-medium text-foreground">{message.reply.senderName}</p>
            <p className="truncate">{message.reply.content}</p>
          </div>
        )}

        {/* Forwarded Indicator */}
        {message.isForwarded && (
          <div className="text-xs text-muted-foreground flex items-center gap-1 mb-1 px-2">
            <Forward className="h-3 w-3" />
            <span>Forwarded</span>
          </div>
        )}

        {/* Message Content */}
        <div
          ref={messageRef}
          className={`rounded-2xl px-4 py-2 max-w-sm relative group cursor-context-menu ${
            message.isOwn
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-foreground'
          }`}
          onMouseEnter={() => setShowReactions(true)}
          onMouseLeave={() => setShowReactions(false)}
          onContextMenu={handleContextMenu}
        >
          {/* Text Message */}
          {message.type === 'text' && (
            <p className="text-sm break-words whitespace-pre-wrap">{message.content}</p>
          )}

          {/* Image Message */}
          {message.type === 'image' && (
            <div className="max-w-xs">
              <img
                src={message.content}
                alt="Shared image"
                className="rounded-lg max-h-64 object-cover"
              />
            </div>
          )}

          {/* Video Message */}
          {message.type === 'video' && (
            <div className="max-w-sm">
              <div className="relative group/video overflow-hidden rounded-lg">
                <img
                  src={message.content}
                  alt="Video thumbnail"
                  className="rounded-lg max-h-72 w-full object-cover group-hover/video:scale-105 transition-transform duration-300"
                />
                {/* Gradient Overlay */}
                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/40 rounded-lg" />
                
                {/* Play Button */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <motion.button
                    whileHover={{ scale: 1.15 }}
                    whileTap={{ scale: 0.95 }}
                    className="p-3 bg-white/90 backdrop-blur-sm rounded-full shadow-lg hover:bg-white transition-all"
                  >
                    <Play className="h-7 w-7 text-black fill-black" />
                  </motion.button>
                </div>
                
                {/* Duration Badge */}
                {message.duration && (
                  <div className="absolute bottom-2 right-2 bg-black/75 backdrop-blur-sm text-white text-xs px-2.5 py-1 rounded-md font-medium">
                    {message.duration}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Voice Message */}
          {message.type === 'voice' && (
            <div className="flex items-center gap-3 min-w-48">
              <div className="flex gap-1">
                {[...Array(20)].map((_, i) => (
                  <motion.div
                    key={i}
                    className="h-1 w-1 rounded-full bg-current opacity-60"
                    animate={{ scaleY: [1, 2, 1] }}
                    transition={{
                      duration: 0.6,
                      repeat: Infinity,
                      delay: i * 0.05,
                    }}
                  />
                ))}
              </div>
              <span className="text-xs whitespace-nowrap">{message.content}</span>
            </div>
          )}

          {/* Edited Indicator */}
          {message.isEdited && (
            <p className="text-xs opacity-70 mt-1 ml-1">(edited)</p>
          )}
        </div>

        {/* Reactions */}
        {Object.keys(messageReactions).length > 0 && (
          <div className="flex gap-1 mt-1 flex-wrap">
            {Object.entries(messageReactions).map(([emoji, count], idx) => (
              <motion.div
                key={`reaction-${message.id}-${idx}`}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                whileHover={{ scale: 1.15 }}
                className="flex items-center gap-1 bg-muted rounded-full px-2 py-1 text-xs cursor-pointer hover:bg-muted/80 transition-colors"
              >
                <span>{emoji}</span>
                {count > 1 && <span>{count}</span>}
              </motion.div>
            ))}
          </div>
        )}

        {/* Footer with Timestamp and Read Status */}
        <div className="flex items-center gap-1 mt-1 px-2 text-xs text-muted-foreground">
          {isMounted && <span>{format(new Date(message.timestamp), 'HH:mm')}</span>}
          {message.isOwn && (
            <>
              {message.isRead ? (
                <CheckCheck className="h-3 w-3 text-blue-500" />
              ) : message.isDelivered ? (
                <Check className="h-3 w-3" />
              ) : null}
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
        />
      )}
    </motion.div>
  );
}
