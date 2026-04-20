'use client';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { Plus } from 'lucide-react';

export interface StoryItem {
  id: string;
  name: string;
  avatar?: string | null;
  label: string;
  isOwn?: boolean;
  hasStory?: boolean;
  hasUnseen?: boolean;
}

interface StoryStripProps {
  stories: StoryItem[];
  onAddStory: () => void;
  onOpenStory: (storyId: string) => void;
}

function getInitials(name: string) {
  return name
    .split(' ')
    .map((word) => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function StoryStrip({ stories, onAddStory, onOpenStory }: StoryStripProps) {
  return (
    <div className="border-b border-border/70 px-3 py-2.5">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Stories
        </p>
        <button
          type="button"
          onClick={onAddStory}
          className="text-[10px] font-medium text-primary transition-opacity hover:opacity-80"
        >
          Add
        </button>
      </div>

      <div className="flex gap-2.5 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {stories.map((story) => {
          const content = (
            <>
              <div
                className={cn(
                  'relative rounded-full p-[2px] transition-transform',
                  'group-hover:scale-[1.03]',
                  story.hasUnseen
                    ? 'bg-gradient-to-br from-sky-500 via-cyan-500 to-emerald-400'
                    : story.hasStory
                      ? 'bg-primary/35'
                      : 'bg-border'
                )}
              >
                <div className="rounded-full bg-sidebar p-[2px]">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={story.avatar ?? ''} alt={story.name} />
                    <AvatarFallback className="bg-primary text-primary-foreground text-xs font-medium">
                      {getInitials(story.name)}
                    </AvatarFallback>
                  </Avatar>
                </div>

                {story.isOwn && !story.hasStory && (
                  <span className="absolute bottom-0 right-0 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm ring-2 ring-sidebar">
                    <Plus className="h-2 w-2" />
                  </span>
                )}
              </div>

              <div className="space-y-0.5">
                <p className="line-clamp-1 text-[9px] font-medium leading-none text-foreground">
                  {story.name}
                </p>
                <p className="line-clamp-1 text-[8px] leading-none text-muted-foreground">
                  {story.label}
                </p>
              </div>
            </>
          );

          if (story.isOwn) {
            return (
              <button
                key={story.id}
                type="button"
                onClick={() => (story.hasStory ? onOpenStory(story.id) : onAddStory())}
                className={cn(
                  'group flex h-[76px] w-[56px] flex-shrink-0 flex-col items-center justify-start gap-1.5 text-center',
                  'cursor-pointer'
                )}
              >
                {content}
              </button>
            );
          }

          return (
            <button
              key={story.id}
              type="button"
              onClick={() => onOpenStory(story.id)}
              className="flex h-[76px] w-[56px] flex-shrink-0 flex-col items-center justify-start gap-1.5 text-center"
            >
              {content}
            </button>
          );
        })}
      </div>
    </div>
  );
}
