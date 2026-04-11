'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Search, Phone, Video, MoreVertical, Pin, X } from 'lucide-react';
import type { Message } from '@/lib/mock-data';
import { MessageBubble } from './message-bubble';
import { Composer } from './composer';
import { format } from 'date-fns';
import { ChatMessage, useConversations } from '@/hooks/use-messaging';
import { useProfile } from '@/hooks/use-user';

interface ChatWindowProps {
  activeChat: string;
  messages?: ChatMessage[];
  onSendMessage?: (content: string, type?: Message['type'], reply?: ReplyTo) => void;
  onProfileClick?: () => void;
}

interface ReplyTo {
  senderName: string;
  content: string;
}

function toUiMessage(m: ChatMessage, myId: string): Message {
  return {
    id: m.id,
    senderId: m.sender_id,
    senderName: m.sender.username,
    avatar: m.sender.avatar_url ?? '',
    content: m.content ?? '',
    type: (m.type as Message['type']) ?? 'text',
    timestamp: m.created_at,
    isOwn: m.sender_id === myId,
    isRead: true,
    isDelivered: true,
  };
}

export function ChatWindow({ activeChat, messages: providedMessages = [], onSendMessage, onProfileClick }: ChatWindowProps) {
  const { data: profile } = useProfile();
  const { data: conversations = [] } = useConversations();
  const conv = conversations.find((c) => c.id === activeChat);
  const messages = providedMessages
    .slice()
    .reverse()
    .map((m) => toUiMessage(m, profile?.id ?? ''));
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [isTyping, setIsTyping] = useState(false);
  const [replyTo, setReplyTo] = useState<ReplyTo | null>(null);
  const [showPinned, setShowPinned] = useState(true);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeChat, messages]);

  // Reset reply & pinned on chat switch
  useEffect(() => {
    setReplyTo(null);
    setShowPinned(true);
  }, [activeChat]);

  const chatName = conv?.name ?? 'Chat';
  const initials = chatName
    .split(' ')
    .map((word: string) => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const groupedMessages = messages.reduce(
    (acc, message) => {
      const date = format(new Date(message.timestamp), 'yyyy-MM-dd');
      if (!acc[date]) acc[date] = [];
      acc[date].push(message);
      return acc;
    },
    {} as Record<string, typeof messages>
  );

  const getDayLabel = (dateStr: string) => {
    const date = new Date(dateStr);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (format(date, 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd')) return 'Today';
    if (format(date, 'yyyy-MM-dd') === format(yesterday, 'yyyy-MM-dd')) return 'Yesterday';
    return format(date, 'MMM d, yyyy');
  };

  const handleReply = (message: Message) => {
    setReplyTo({
      senderName: message.senderName,
      content: message.type === 'text' ? message.content : `[${message.type}]`,
    });
  };

  return (
    <div className="flex-1 flex flex-col bg-background h-full min-w-0">
      {/* Header */}
      <div className="h-14 border-b border-border px-4 flex items-center justify-between bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 flex-shrink-0">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onProfileClick}
            className="rounded-full hover:ring-2 ring-primary/40 transition-all flex-shrink-0"
          >
            <div className="relative">
              <Avatar className="h-9 w-9">
                <AvatarFallback className="bg-primary text-primary-foreground text-sm">
                  {initials}
                </AvatarFallback>
              </Avatar>
            </div>
          </motion.button>

          <div className="flex-1 min-w-0">
            <h2 className="font-semibold text-foreground text-sm leading-tight truncate">{chatName}</h2>
            <p className="text-xs text-muted-foreground">
              {conv?.is_group ? 'Group' : 'Direct message'}
            </p>
          </div>
        </div>

        <div className="flex gap-1 flex-shrink-0">
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
            <Search className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
            <Phone className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
            <Video className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
            <MoreVertical className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Pinned Message Banner */}
      <AnimatePresence>
        {false && showPinned && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden flex-shrink-0"
          >
            <div className="flex items-center gap-3 px-4 py-2 bg-primary/5 border-b border-primary/15">
              <Pin className="h-3.5 w-3.5 text-primary flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-semibold text-primary">Pinned Message</p>
                <p className="text-xs text-muted-foreground truncate" />
              </div>
              <button
                onClick={() => setShowPinned(false)}
                className="h-5 w-5 rounded-full flex items-center justify-center hover:bg-accent transition-colors flex-shrink-0"
              >
                <X className="h-3 w-3 text-muted-foreground" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {Object.entries(groupedMessages).map(([date, dayMessages]) => (
          <div key={date}>
            {/* Day Separator */}
            <div className="flex items-center gap-3 my-4">
              <div className="flex-1 h-px bg-border" />
              <span className="text-[11px] font-medium text-muted-foreground px-3 py-1 rounded-full bg-muted">
                {getDayLabel(date)}
              </span>
              <div className="flex-1 h-px bg-border" />
            </div>

            <div className="space-y-1.5">
              {dayMessages.map((message, index) => (
                <MessageBubble
                  key={message.id}
                  message={message}
                  showAvatar={
                    !message.isOwn &&
                    (index === 0 ||
                      dayMessages[index - 1].isOwn ||
                      dayMessages[index - 1].senderId !== message.senderId)
                  }
                  onReply={handleReply}
                />
              ))}
            </div>
          </div>
        ))}

        {/* Typing Indicator */}
        <AnimatePresence>
          {isTyping && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              className="flex gap-2 items-end"
            >
              <Avatar className="h-7 w-7 flex-shrink-0">
                <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                  {chatName[0]}
                </AvatarFallback>
              </Avatar>
              <div className="bg-muted rounded-2xl rounded-bl-sm px-4 py-3 flex gap-1 items-center">
                {[0, 0.15, 0.3].map((delay, i) => (
                  <motion.div
                    key={i}
                    className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50"
                    animate={{ y: [0, -5, 0] }}
                    transition={{ duration: 0.5, repeat: Infinity, delay }}
                  />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div ref={messagesEndRef} />
      </div>

      {/* Composer */}
      <Composer
        onTyping={setIsTyping}
        onSendMessage={(content, type) => {
          onSendMessage?.(content, type, replyTo ?? undefined);
          setReplyTo(null);
        }}
        replyTo={replyTo}
        onCancelReply={() => setReplyTo(null)}
      />
    </div>
  );
}
