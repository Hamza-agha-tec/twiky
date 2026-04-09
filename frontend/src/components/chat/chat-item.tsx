'use client';

import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Pin, BellOff, Star } from 'lucide-react';
import { Chat } from '@/lib/mock-data';
import { formatDistanceToNow } from 'date-fns';

interface ChatItemProps {
  chat: Chat;
  isActive: boolean;
  isFavorite?: boolean;
  onClick: () => void;
}

export function ChatItem({ chat, isActive, isFavorite, onClick }: ChatItemProps) {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const initials = chat.name
    .split(' ')
    .map((word) => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <motion.button
      onClick={onClick}
      className={`w-full px-4 py-3 transition-colors text-left ${
        isActive
          ? 'bg-primary/10 border-r-2 border-primary'
          : 'hover:bg-accent/50'
      }`}
      whileHover={{ x: 2 }}
      whileTap={{ scale: 0.98 }}
    >
      <div className="flex gap-3 items-center">
        {/* Avatar with online dot */}
        <div className="relative flex-shrink-0">
          <Avatar className="h-12 w-12">
            <AvatarImage src={chat.avatar} alt={chat.name} />
            <AvatarFallback className="bg-primary text-primary-foreground font-medium">
              {initials}
            </AvatarFallback>
          </Avatar>
          {chat.isOnline && !chat.isGroup && (
            <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-emerald-500 border-2 border-background ring-0" />
          )}
          {chat.isGroup && chat.isOnline && (
            <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-blue-500 border-2 border-background" />
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-0.5">
            <div className="flex items-center gap-1.5 min-w-0">
              <h3 className={`font-medium truncate text-sm ${isActive ? 'text-primary' : 'text-foreground'}`}>
                {chat.name}
              </h3>
              {isFavorite && (
                <Star className="h-3 w-3 text-amber-400 fill-amber-400 flex-shrink-0" />
              )}
              {chat.isPinned && (
                <Pin className="h-3 w-3 text-muted-foreground flex-shrink-0" />
              )}
              {chat.isMuted && (
                <BellOff className="h-3 w-3 text-muted-foreground flex-shrink-0" />
              )}
            </div>
            {isMounted && (
              <span className="text-[11px] text-muted-foreground flex-shrink-0">
                {formatDistanceToNow(new Date(chat.timestamp), { addSuffix: false })}
              </span>
            )}
          </div>

          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground truncate">
              {chat.lastMessage}
            </p>
            {chat.unread > 0 && (
              <Badge className="rounded-full h-5 min-w-5 flex items-center justify-center p-0 text-[10px] flex-shrink-0 bg-primary">
                {chat.unread > 99 ? '99+' : chat.unread}
              </Badge>
            )}
          </div>
        </div>
      </div>
    </motion.button>
  );
}
