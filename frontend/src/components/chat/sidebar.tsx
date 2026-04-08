'use client';

import { useState, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useTheme } from 'next-themes';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Menu, Edit, MessageCircle, Sun, Moon } from 'lucide-react';
import { chatsData } from '@/lib/mock-data';
import { ChatItem } from './chat-item';
import { Badge } from '@/components/ui/badge';

interface SidebarProps {
  activeChat: string;
  onSelectChat: (id: string) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  selectedChats: string[];
  onSelectChats: (chats: string[]) => void;
  isOpen?: boolean;
}

export function Sidebar({
  activeChat,
  onSelectChat,
  searchQuery,
  onSearchChange,
  selectedChats,
  onSelectChats,
  isOpen = true,
}: SidebarProps) {
  const [filter, setFilter] = useState<'all' | 'unread' | 'groups' | 'direct'>('all');
  const { theme, setTheme } = useTheme();
  const [isMounted, setIsMounted] = useState(false);

  // Fix hydration issues
  useEffect(() => {
    setIsMounted(true);
  }, []);

  const filteredChats = useMemo(() => {
    let result = chatsData;

    if (filter === 'unread') {
      result = result.filter((chat) => chat.unread > 0);
    } else if (filter === 'groups') {
      result = result.filter((chat) => chat.isGroup);
    } else if (filter === 'direct') {
      result = result.filter((chat) => !chat.isGroup);
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter((chat) =>
        chat.name.toLowerCase().includes(query) ||
        chat.lastMessage.toLowerCase().includes(query)
      );
    }

    return result;
  }, [filter, searchQuery]);

  const unreadCount = chatsData.reduce((sum, chat) => sum + chat.unread, 0);

  return (
    <motion.div 
      initial={{ width: isOpen ? 320 : 0 }}
      animate={{ width: isOpen ? 320 : 0 }}
      transition={{ duration: 0.3, ease: 'easeInOut' }}
      className="bg-background border-r border-border flex flex-col h-full overflow-hidden"
    >
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-foreground">Chats</h1>
          <div className="flex gap-2">
            {isMounted && (
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9"
                  onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                >
                  {theme === 'dark' ? (
                    <Sun className="h-5 w-5 text-amber-500" />
                  ) : (
                    <Moon className="h-5 w-5 text-slate-600" />
                  )}
                </Button>
              </motion.div>
            )}
            <Button variant="ghost" size="icon" className="h-9 w-9">
              <Menu className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-9 w-9">
              <Edit className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search chats..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-10 h-10 bg-muted border-0 rounded-full"
          />
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="px-3 py-2 border-b border-border">
        <div className="flex gap-1 flex-wrap">
          {[
            { id: 'all' as const, label: 'All' },
            { id: 'unread' as const, label: 'Unread', badge: unreadCount },
          ].map((tab) => (
            <Button
              key={tab.id}
              variant={filter === tab.id ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setFilter(tab.id)}
              className="rounded-full text-xs h-7 px-3 whitespace-nowrap"
            >
              {tab.label}
              {tab.badge ? <Badge className="ml-1.5 h-4 min-w-4 rounded-full p-0 flex items-center justify-center text-xs">{tab.badge}</Badge> : null}
            </Button>
          ))}
        </div>
      </div>

      {/* Chat List */}
      <div className="flex-1 overflow-y-auto">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2 }}
        >
          {filteredChats.length > 0 ? (
            filteredChats.map((chat, index) => (
              <motion.div
                key={chat.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <ChatItem
                  chat={chat}
                  isActive={activeChat === chat.id}
                  onClick={() => onSelectChat(chat.id)}
                />
              </motion.div>
            ))
          ) : (
            <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
              <MessageCircle className="h-12 w-12 mb-4 opacity-50" />
              <p>No chats found</p>
            </div>
          )}
        </motion.div>
      </div>
    </motion.div>
  );
}
