'use client';

import { motion } from 'framer-motion';
import { useState, useEffect } from 'react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Pin, BellOff, Star } from 'lucide-react';
import { Chat } from '@/lib/mock-data';
import { format, isToday, isYesterday } from 'date-fns';
import { VerifiedBadge } from '@/components/chat/verified-badge';

interface ChatItemProps {
  chat: Chat;
  isActive: boolean;
  isFavorite?: boolean;
  isOnline?: boolean;
  onClick: () => void;
}

function getLabel(ts: string | number | Date): string {
  const date = new Date(ts);
  const ageMs = Date.now() - date.getTime();
  if (ageMs < 60_000) return 'now';
  if (isToday(date)) return format(date, 'HH:mm');
  if (isYesterday(date)) return 'Yesterday';
  return format(date, 'dd/MM/yyyy');
}

export function ChatItem({ chat, isActive, isFavorite, onClick, isOnline }: ChatItemProps) {
  const [label, setLabel] = useState<string>('');

  useEffect(() => {
    setLabel(getLabel(chat.timestamp));

    const ageMs = Date.now() - new Date(chat.timestamp).getTime();
    if (ageMs < 60_000) {
      // Switch from "now" to real time after the remaining ms
      const timer = setTimeout(() => setLabel(getLabel(chat.timestamp)), 60_000 - ageMs);
      return () => clearTimeout(timer);
    }
  }, [chat.timestamp]);

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
          <Avatar className="h-10 w-10">
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
              {chat.isVerified && (
                <VerifiedBadge size="xs" variant={chat.isPro ? 'pro' : 'standard'} />
              )}
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
            {label && (
              <span className="text-[11px] text-muted-foreground flex-shrink-0">
                {label}
              </span>
            )}
          </div>

          <div className="flex items-center justify-between gap-2">
            <p className={`text-xs truncate ${chat.unread > 0 ? 'text-foreground font-semibold' : 'text-muted-foreground font-normal'}`}>
              {chat.lastMessage || <span className="italic opacity-50">No messages yet</span>}
            </p>
            {chat.unread > 0 && (
              <span className="flex-shrink-0 min-w-[18px] h-[18px] px-1.5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center leading-none shadow-sm">
                {chat.unread > 99 ? '99+' : chat.unread}
              </span>
            )}
          </div>
        </div>
      </div>
    </motion.button>
  );
}
