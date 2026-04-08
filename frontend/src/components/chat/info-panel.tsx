'use client';

import { motion } from 'framer-motion';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Phone, Video, Trash2, Bell, X } from 'lucide-react';
import { chatsData } from '@/lib/mock-data';

interface InfoPanelProps {
  activeChat: string;
  onClose?: () => void;
}

export function InfoPanel({ activeChat, onClose }: InfoPanelProps) {
  const chat = chatsData.find((c) => c.id === activeChat);

  if (!chat) {
    return null;
  }

  const initials = chat.name
    .split(' ')
    .map((word) => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  // Mock shared media
  const sharedMedia = [
    {
      id: '1',
      type: 'image' as const,
      url: 'https://images.unsplash.com/photo-1606348722273-d4fa5f00b4c5?w=150&h=150&fit=crop',
    },
    {
      id: '2',
      type: 'image' as const,
      url: 'https://images.unsplash.com/photo-1502920917128-1aa500764cbd?w=150&h=150&fit=crop',
    },
    {
      id: '3',
      type: 'image' as const,
      url: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=150&h=150&fit=crop',
    },
    {
      id: '4',
      type: 'image' as const,
      url: 'https://images.unsplash.com/photo-1504681869696-d977e3a1a739?w=150&h=150&fit=crop',
    },
    {
      id: '5',
      type: 'image' as const,
      url: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=150&h=150&fit=crop',
    },
    {
      id: '6',
      type: 'image' as const,
      url: 'https://images.unsplash.com/photo-1470114716159-e389f8712fda?w=150&h=150&fit=crop',
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      className="flex-1 border-l border-border flex flex-col h-full bg-background overflow-hidden"
    >
      {/* Header */}
      <div className="h-16 border-b border-border px-6 flex items-center justify-between bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <h3 className="font-semibold text-foreground">Contact Info</h3>
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9"
          onClick={onClose}
        >
          <X className="h-5 w-5" />
        </Button>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Profile Section */}
        <div className="p-6 flex flex-col items-center border-b border-border">
          <Avatar className="h-16 w-16 mb-4">
            <AvatarImage src={chat.avatar} alt={chat.name} />
            <AvatarFallback className="bg-primary text-primary-foreground text-lg">
              {initials}
            </AvatarFallback>
          </Avatar>
          <h2 className="text-xl font-semibold text-foreground">{chat.name}</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {chat.isGroup ? `${Math.floor(Math.random() * 100) + 1} members` : 'Active now'}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="p-4 space-y-2">
          <Button variant="outline" className="w-full justify-start gap-3">
            <Phone className="h-4 w-4" />
            Call
          </Button>
          <Button variant="outline" className="w-full justify-start gap-3">
            <Video className="h-4 w-4" />
            Video Call
          </Button>
        </div>

        <Separator />

        {/* Mute Notifications */}
        <div className="p-4 space-y-3">
          <h4 className="text-sm font-medium text-foreground mb-3">Notifications</h4>
          <Button variant="ghost" className="w-full justify-start gap-3 text-muted-foreground">
            <Bell className="h-4 w-4" />
            Mute notifications
          </Button>
        </div>

        <Separator />

        {/* Shared Media */}
        <div className="p-4">
          <h4 className="text-sm font-medium text-foreground mb-3">Shared Media</h4>
          <div className="grid grid-cols-3 gap-2">
            {sharedMedia.map((media) => (
              <motion.div
                key={media.id}
                whileHover={{ scale: 1.05 }}
                className="aspect-square rounded-lg overflow-hidden cursor-pointer bg-muted"
              >
                <img
                  src={media.url}
                  alt="Shared media"
                  className="h-full w-full object-cover"
                />
              </motion.div>
            ))}
          </div>
        </div>

        <Separator />

        {/* About Section */}
        <div className="p-4">
          <h4 className="text-sm font-medium text-foreground mb-2">About</h4>
          <p className="text-sm text-muted-foreground">
            {chat.isGroup
              ? 'Group chat for discussing design and development ideas'
              : 'Product designer and coffee enthusiast ☕'}
          </p>
        </div>

        <Separator />

        {/* Danger Zone */}
        <div className="p-4 space-y-2">
          <Button
            variant="ghost"
            className="w-full justify-start gap-3 text-destructive hover:text-destructive hover:bg-destructive/10"
          >
            <Trash2 className="h-4 w-4" />
            Clear chat
          </Button>
          <Button
            variant="ghost"
            className="w-full justify-start gap-3 text-destructive hover:text-destructive hover:bg-destructive/10"
          >
            <Trash2 className="h-4 w-4" />
            Delete chat
          </Button>
        </div>
      </div>
    </motion.div>
  );
}
