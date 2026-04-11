'use client';

import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Edit, MessageCircle, Settings } from 'lucide-react';
import { chatsData, Chat } from '@/lib/mock-data';
import { ChatItem } from './chat-item';
import { ConversationContextMenu } from './conversation-context-menu';
import { ProfileSettings } from './profile-settings';
import { AddContactModal } from './add-contact-modal';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { ThemeBubble } from './theme-bubble';

interface SidebarProps {
  activeChat: string;
  onSelectChat: (id: string) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  selectedChats: string[];
  onSelectChats: (chats: string[]) => void;
  isOpen?: boolean;
}

type Filter = 'all' | 'unread' | 'groups' | 'direct';

const FILTER_TABS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'unread', label: 'Unread' },
  { id: 'groups', label: 'Groups' },
  { id: 'direct', label: 'Direct' },
];

interface ChatMeta {
  isPinned?: boolean;
  isMuted?: boolean;
  isFavorite?: boolean;
}

interface ContextMenuState {
  x: number;
  y: number;
  chat: Chat;
}

const ME_AVATAR = 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop';

export function Sidebar({
  activeChat,
  onSelectChat,
  searchQuery,
  onSearchChange,
  selectedChats,
  onSelectChats,
  isOpen = true,
}: SidebarProps) {
  const [filter, setFilter] = useState<Filter>('all');
  const [isMounted, setIsMounted] = useState(false);
  const [chatMeta, setChatMeta] = useState<Record<string, ChatMeta>>(() =>
    Object.fromEntries(chatsData.map((c) => [c.id, { isPinned: c.isPinned, isMuted: c.isMuted }]))
  );
  const [archived, setArchived] = useState<Set<string>>(new Set());
  const [deleted, setDeleted] = useState<Set<string>>(new Set());
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [showProfile, setShowProfile] = useState(false);
  const [showAddContact, setShowAddContact] = useState(false);

  useEffect(() => { setIsMounted(true); }, []);

  const filteredChats = useMemo(() => {
    let result = chatsData.filter((c) => !deleted.has(c.id) && !archived.has(c.id));

    if (filter === 'unread') result = result.filter((c) => c.unread > 0);
    else if (filter === 'groups') result = result.filter((c) => c.isGroup);
    else if (filter === 'direct') result = result.filter((c) => !c.isGroup);

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter((c) =>
        c.name.toLowerCase().includes(q) || c.lastMessage.toLowerCase().includes(q)
      );
    }

    // pinned first
    return result.sort((a, b) => {
      const aPinned = chatMeta[a.id]?.isPinned ? 1 : 0;
      const bPinned = chatMeta[b.id]?.isPinned ? 1 : 0;
      return bPinned - aPinned;
    });
  }, [filter, searchQuery, chatMeta, deleted, archived]);

  const unreadCount = chatsData.filter((c) => !deleted.has(c.id)).reduce((s, c) => s + c.unread, 0);

  const handleContextMenu = (e: React.MouseEvent, chat: Chat) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, chat });
  };

  const updateMeta = (id: string, patch: Partial<ChatMeta>) =>
    setChatMeta((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));

  return (
    <>
      <motion.div
        initial={{ width: isOpen ? 320 : 0 }}
        animate={{ width: isOpen ? 320 : 0 }}
        transition={{ duration: 0.3, ease: 'easeInOut' }}
        className="bg-background border-r border-border flex flex-col h-full overflow-hidden"
      >
        {/* Header */}
        <div className="p-4 border-b border-border flex-shrink-0">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-xl font-bold text-foreground">Messages</h1>
            <div className="flex items-center gap-2">
              <ThemeBubble />
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setShowAddContact(true)}>
                <Edit className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-9 h-9 bg-muted border-0 rounded-full text-sm"
            />
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="px-3 py-2 border-b border-border flex-shrink-0">
          <div className="flex gap-1">
            {FILTER_TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setFilter(tab.id)}
                className={`flex items-center gap-1 rounded-full text-xs h-7 px-3 whitespace-nowrap font-medium transition-colors ${
                  filter === tab.id
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                }`}
              >
                {tab.label}
                {tab.id === 'unread' && unreadCount > 0 && (
                  <span className={`text-[10px] font-bold rounded-full px-1 ${
                    filter === 'unread'
                      ? 'bg-primary-foreground/20 text-primary-foreground'
                      : 'bg-primary text-primary-foreground'
                  }`}>
                    {unreadCount}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Chat List */}
        <div className="flex-1 overflow-y-auto">
          {filteredChats.length > 0 ? (
            filteredChats.map((chat, index) => (
              <motion.div
                key={chat.id}
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.04 }}
                onContextMenu={(e) => handleContextMenu(e, chat)}
              >
                <ChatItem
                  chat={{ ...chat, isPinned: chatMeta[chat.id]?.isPinned, isMuted: chatMeta[chat.id]?.isMuted }}
                  isActive={activeChat === chat.id}
                  isFavorite={chatMeta[chat.id]?.isFavorite}
                  onClick={() => onSelectChat(chat.id)}
                />
              </motion.div>
            ))
          ) : (
            <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
              <MessageCircle className="h-10 w-10 mb-3 opacity-30" />
              <p className="text-sm">No chats found</p>
            </div>
          )}
        </div>

        {/* Profile Footer */}
        <div className="border-t border-border px-3 py-3 flex items-center gap-3 flex-shrink-0">
          <button
            onClick={() => setShowProfile(true)}
            className="flex items-center gap-3 flex-1 min-w-0 rounded-xl hover:bg-accent px-2 py-1.5 transition-colors text-left"
          >
            <div className="relative flex-shrink-0">
              <Avatar className="h-9 w-9">
                <AvatarImage src={ME_AVATAR} alt="You" />
                <AvatarFallback className="bg-primary text-primary-foreground text-sm">Y</AvatarFallback>
              </Avatar>
              <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-emerald-500 border-2 border-background" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground truncate">You</p>
              <p className="text-xs text-emerald-500 font-medium">Available</p>
            </div>
          </button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-full flex-shrink-0"
            onClick={() => setShowProfile(true)}
          >
            <Settings className="h-4 w-4 text-muted-foreground" />
          </Button>
        </div>
      </motion.div>

      {/* Conversation Context Menu */}
      <AnimatePresence>
        {contextMenu && (
          <ConversationContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            chatId={contextMenu.chat.id}
            isPinned={chatMeta[contextMenu.chat.id]?.isPinned}
            isMuted={chatMeta[contextMenu.chat.id]?.isMuted}
            isFavorite={chatMeta[contextMenu.chat.id]?.isFavorite}
            isGroup={contextMenu.chat.isGroup}
            onClose={() => setContextMenu(null)}
            onFavorite={() => updateMeta(contextMenu.chat.id, { isFavorite: !chatMeta[contextMenu.chat.id]?.isFavorite })}
            onArchive={() => setArchived((prev) => new Set([...prev, contextMenu.chat.id]))}
            onMute={() => updateMeta(contextMenu.chat.id, { isMuted: !chatMeta[contextMenu.chat.id]?.isMuted })}
            onPin={() => updateMeta(contextMenu.chat.id, { isPinned: !chatMeta[contextMenu.chat.id]?.isPinned })}
            onBlock={() => setDeleted((prev) => new Set([...prev, contextMenu.chat.id]))}
            onDelete={() => setDeleted((prev) => new Set([...prev, contextMenu.chat.id]))}
          />
        )}
      </AnimatePresence>

      {/* Profile Settings */}
      {isMounted && showProfile && (
        <ProfileSettings onClose={() => setShowProfile(false)} />
      )}

      {/* Add Contact */}
      {isMounted && showAddContact && (
        <AddContactModal onClose={() => setShowAddContact(false)} />
      )}
    </>
  );
}
