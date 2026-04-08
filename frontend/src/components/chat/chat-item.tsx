'use client';

import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Pin, Zap } from 'lucide-react';
import { Chat } from '@/lib/mock-data';
import { formatDistanceToNow } from 'date-fns';

interface ChatItemProps {
  chat: Chat;
  isActive: boolean;
  onClick: () => void;
}

export function ChatItem({ chat, isActive, onClick }: ChatItemProps) {
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
      className={`w-full px-3 py-2 transition-colors ${
        isActive
          ? 'bg-primary/10 border-r-2 border-primary'
          : 'hover:bg-accent/50'
      }`}
      whileHover={{ x: 2 }}
      whileTap={{ scale: 0.98 }}
    >
      <div className="flex gap-3 items-start">
        <Avatar className="h-12 w-12 flex-shrink-0 mt-1">
          <AvatarImage src={chat.avatar} alt={chat.name} />
          <AvatarFallback className="bg-primary text-primary-foreground">
            {initials}
          </AvatarFallback>
        </Avatar>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-medium text-foreground truncate">{chat.name}</h3>
            {isMounted && (
              <span className="text-xs text-muted-foreground flex-shrink-0">
                {formatDistanceToNow(new Date(chat.timestamp), { addSuffix: false })}
              </span>
            )}
          </div>

          <p className="text-sm text-muted-foreground truncate">
            {chat.lastMessage}
          </p>

          <div className="flex gap-2 mt-2">
            {chat.isPinned && (
              <Pin className="h-3 w-3 text-muted-foreground" />
            )}
            {chat.isMuted && (
              <Zap className="h-3 w-3 text-muted-foreground" />
            )}
          </div>
        </div>

        {chat.unread > 0 && (
          <Badge className="rounded-full h-6 min-w-6 flex items-center justify-center p-0 flex-shrink-0">
            {chat.unread > 99 ? '99+' : chat.unread}
          </Badge>
        )}
      </div>
    </motion.button>
  );
}
