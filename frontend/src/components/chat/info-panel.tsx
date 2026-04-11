'use client';

import { motion } from 'framer-motion';
import { useState } from 'react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Phone, Video, Search, Bell, BellOff, Trash2, X, ShieldAlert, Star, ChevronRight } from 'lucide-react';
import { useConversations, getConvDisplayName, getDmContact } from '@/hooks/use-messaging';
import { useProfile, useContacts } from '@/hooks/use-user';

interface InfoPanelProps {
  activeChat: string;
  onClose?: () => void;
}

const MOCK_STARRED = [
  { id: '1', content: 'Check out this design walkthrough!', sender: 'Alice Johnson' },
  { id: '2', content: 'The design is looking really polished!', sender: 'Alice Johnson' },
];

const SHARED_MEDIA = [
  'https://images.unsplash.com/photo-1606348722273-d4fa5f00b4c5?w=150&h=150&fit=crop',
  'https://images.unsplash.com/photo-1502920917128-1aa500764cbd?w=150&h=150&fit=crop',
  'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=150&h=150&fit=crop',
  'https://images.unsplash.com/photo-1504681869696-d977e3a1a739?w=150&h=150&fit=crop',
  'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=150&h=150&fit=crop',
  'https://images.unsplash.com/photo-1470114716159-e389f8712fda?w=150&h=150&fit=crop',
];

export function InfoPanel({ activeChat, onClose }: InfoPanelProps) {
  const { data: profile } = useProfile();
  const { data: contacts = [] } = useContacts();
  const { data: conversations = [] } = useConversations();
  const conv = conversations.find((c) => c.id === activeChat);
  const [muted, setMuted] = useState(false);
  const [showAllStarred, setShowAllStarred] = useState(false);

  if (!conv) return null;

  const myId = profile?.id ?? '';
  const chatName = getConvDisplayName(conv, myId, contacts);
  const dmParticipant = getDmContact(conv, myId);
  const dmContact = contacts.find((c) => c.id === dmParticipant?.id) ?? null;
  const initials = chatName
    .split(' ')
    .map((word) => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <motion.div
      initial={{ opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 24 }}
      transition={{ duration: 0.22 }}
      className="w-72 border-l border-border flex flex-col h-full bg-background overflow-hidden flex-shrink-0"
    >
      {/* Header */}
      <div className="h-14 border-b border-border px-4 flex items-center justify-between bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 flex-shrink-0">
        <h3 className="font-semibold text-foreground text-sm">
          {conv.is_group ? 'Group Info' : 'Contact Info'}
        </h3>
        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Profile */}
        <div className="p-5 flex flex-col items-center border-b border-border">
          <div className="relative mb-3">
            <Avatar className="h-16 w-16">
              <AvatarFallback className="bg-primary text-primary-foreground text-xl">
                {initials}
              </AvatarFallback>
            </Avatar>
          </div>
          <h2 className="text-base font-semibold text-foreground">{chatName}</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {conv.is_group ? 'Group' : 'Direct message'}
          </p>
        </div>

        {/* Action Buttons 2x2 Grid */}
        <div className="p-4 border-b border-border">
          <div className="grid grid-cols-4 gap-2">
            {[
              { icon: Phone, label: 'Call' },
              { icon: Video, label: 'Video' },
              { icon: Search, label: 'Search' },
              { icon: muted ? BellOff : Bell, label: muted ? 'Unmute' : 'Mute', onClick: () => setMuted(!muted) },
            ].map(({ icon: Icon, label, onClick }) => (
              <button
                key={label}
                onClick={onClick}
                className={`flex flex-col items-center gap-1.5 py-3 rounded-xl transition-colors ${
                  label === 'Mute' && muted
                    ? 'bg-primary/10 text-primary'
                    : 'bg-muted hover:bg-accent text-foreground'
                }`}
              >
                <Icon className="h-4 w-4" />
                <span className="text-[10px] font-medium">{label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* About */}
        {!conv.is_group && dmContact?.phone_number && (
          <div className="px-4 py-3 border-b border-border">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Phone</p>
            <p className="text-sm text-foreground">{dmContact.phone_number}</p>
          </div>
        )}

        {/* Starred Messages */}
        <div className="px-4 py-3 border-b border-border">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Starred</p>
            <button
              onClick={() => setShowAllStarred(!showAllStarred)}
              className="text-[11px] text-primary hover:underline"
            >
              {showAllStarred ? 'Less' : 'See all'}
            </button>
          </div>
          <div className="space-y-2">
            {(showAllStarred ? MOCK_STARRED : MOCK_STARRED.slice(0, 1)).map((msg) => (
              <div key={msg.id} className="flex items-start gap-2 p-2 rounded-lg bg-muted hover:bg-accent transition-colors cursor-pointer">
                <Star className="h-3.5 w-3.5 text-amber-400 flex-shrink-0 mt-0.5 fill-amber-400" />
                <div className="min-w-0">
                  <p className="text-[11px] font-medium text-muted-foreground">{msg.sender}</p>
                  <p className="text-xs text-foreground truncate">{msg.content}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Shared Media */}
        <div className="px-4 py-3 border-b border-border">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Media</p>
            <button className="text-[11px] text-primary hover:underline flex items-center gap-0.5">
              All <ChevronRight className="h-3 w-3" />
            </button>
          </div>
          <div className="grid grid-cols-3 gap-1">
            {SHARED_MEDIA.map((url, i) => (
              <motion.div
                key={i}
                whileHover={{ scale: 1.04 }}
                className="aspect-square rounded-lg overflow-hidden cursor-pointer bg-muted"
              >
                <img src={url} alt="Shared media" className="h-full w-full object-cover" />
              </motion.div>
            ))}
          </div>
        </div>

        {/* Danger Zone */}
        <div className="px-4 py-3 space-y-1">
          <Button
            variant="ghost"
            className="w-full justify-start gap-2.5 text-destructive hover:text-destructive hover:bg-destructive/10 h-9 text-sm"
          >
            <Trash2 className="h-4 w-4" />
            Clear chat
          </Button>
          {!conv.is_group && (
            <Button
              variant="ghost"
              className="w-full justify-start gap-2.5 text-destructive hover:text-destructive hover:bg-destructive/10 h-9 text-sm"
            >
              <ShieldAlert className="h-4 w-4" />
              Block {chatName.split(' ')[0]}
            </Button>
          )}
          <Button
            variant="ghost"
            className="w-full justify-start gap-2.5 text-destructive hover:text-destructive hover:bg-destructive/10 h-9 text-sm"
          >
            <Trash2 className="h-4 w-4" />
            Delete chat
          </Button>
        </div>
      </div>
    </motion.div>
  );
}
