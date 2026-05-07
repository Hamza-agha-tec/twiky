'use client';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { Plus } from 'lucide-react';

export interface StoryBubble {
  userId: string;
  username: string;
  avatar_url?: string | null;
  hasUnseen: boolean;
  hasStory: boolean;
  isOwn?: boolean;
}

interface StoriesStripProps {
  bubbles: StoryBubble[];
  onAdd: () => void;
  onOpen: (userId: string) => void;
}

function initials(name: string) {
  return name.slice(0, 2).toUpperCase();
}

export function StoriesStrip({ bubbles, onAdd, onOpen }: StoriesStripProps) {
  return (
    <div className="border-b border-border/60 px-2 py-2.5">
      <div className="mb-1.5 flex items-center justify-between px-1">
        <span className="text-[9.5px] font-semibold uppercase tracking-widest text-muted-foreground/70">
          Stories
        </span>
        <button
          type="button"
          onClick={onAdd}
          className="text-[9.5px] font-medium text-primary/80 hover:text-primary transition-colors"
        >
          Add
        </button>
      </div>

      <div className="flex gap-2.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {bubbles.map((b) => (
          <button
            key={b.userId}
            type="button"
            onClick={() => (b.isOwn && !b.hasStory ? onAdd() : onOpen(b.userId))}
            className="group flex shrink-0 flex-col items-center gap-1"
          >
            <div
              className={cn(
                'relative rounded-full p-[2px] transition-transform group-hover:scale-105',
                b.hasUnseen
                  ? 'bg-gradient-to-tr from-[#0080c8] via-[#38b6d8] to-[#92dce5]'
                  : b.hasStory
                    ? 'bg-muted-foreground/30'
                    : 'bg-border',
              )}
            >
              <div className="rounded-full bg-sidebar p-[1.5px]">
                <Avatar className="h-9 w-9">
                  <AvatarImage src={b.avatar_url ?? ''} alt={b.username} />
                  <AvatarFallback className="bg-primary/10 text-[10px] font-semibold text-primary">
                    {initials(b.username)}
                  </AvatarFallback>
                </Avatar>
              </div>

              {b.isOwn && !b.hasStory && (
                <span className="absolute -bottom-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-primary text-primary-foreground ring-[1.5px] ring-sidebar">
                  <Plus className="h-2 w-2" />
                </span>
              )}
            </div>

            <span className="w-12 truncate text-center text-[9px] leading-none text-muted-foreground group-hover:text-foreground transition-colors">
              {b.isOwn ? 'You' : b.username}
            </span>
          </button>
        ))}

        {bubbles.length === 0 && (
          <button
            type="button"
            onClick={onAdd}
            className="group flex shrink-0 flex-col items-center gap-1"
          >
            <div className="rounded-full bg-border p-[2px]">
              <div className="rounded-full bg-sidebar p-[1.5px]">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted">
                  <Plus className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
              </div>
            </div>
            <span className="text-[9px] text-muted-foreground">Add</span>
          </button>
        )}
      </div>
    </div>
  );
}
