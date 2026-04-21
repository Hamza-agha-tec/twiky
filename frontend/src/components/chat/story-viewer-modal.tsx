'use client';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ArrowLeft, ChevronLeft, ChevronRight, Eye } from 'lucide-react';

export interface StoryViewItem {
  id: string;
  name: string;
  avatar?: string | null;
  caption: string;
  label: string;
  themeClassName: string;
  audienceLabel: string;
  isOwn?: boolean;
}

interface StoryViewerScreenProps {
  stories: StoryViewItem[];
  activeStoryId: string | null;
  onSelectStory: (storyId: string) => void;
  onClose: () => void;
}

function getInitials(name: string) {
  return name
    .split(' ')
    .map((word) => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function StoryViewerScreen({
  stories,
  activeStoryId,
  onSelectStory,
  onClose,
}: StoryViewerScreenProps) {
  const activeIndex = stories.findIndex((story) => story.id === activeStoryId);
  const activeStory = activeIndex >= 0 ? stories[activeIndex] : null;

  if (!activeStory) return null;

  function goTo(offset: number) {
    const nextIndex = activeIndex + offset;
    if (nextIndex < 0 || nextIndex >= stories.length) return;
    onSelectStory(stories[nextIndex].id);
  }

  return (
    <div className="flex h-full min-w-0 flex-1 flex-col bg-sidebar">
      <div className="flex h-14 items-center justify-between border-b border-border px-4">
        <div className="flex min-w-0 items-center gap-2">
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={onClose}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">{activeStory.name}</p>
            <p className="text-xs text-muted-foreground">{activeStory.label}</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto bg-[radial-gradient(circle_at_top_left,rgba(148,163,184,0.14),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(14,165,233,0.08),transparent_24%)] p-4 lg:p-5">
        <div className="mx-auto grid max-w-6xl gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
          <section className="relative overflow-hidden rounded-[2rem] border border-border/70 bg-background shadow-[0_24px_80px_rgba(15,23,42,0.12)]">
            <div className={cn('absolute inset-0 opacity-95', activeStory.themeClassName)} />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.28),transparent_28%),radial-gradient(circle_at_bottom_right,rgba(15,23,42,0.28),transparent_26%)]" />
            <div className="absolute left-[-12%] top-[12%] h-56 w-56 rounded-full bg-white/10 blur-3xl" />
            <div className="absolute bottom-[-10%] right-[-8%] h-64 w-64 rounded-full bg-slate-950/15 blur-3xl" />

            <div className="relative flex min-h-[400px] flex-col p-4 sm:p-5 lg:min-h-[500px] lg:p-5">
              <div className="mb-3 flex gap-1.5">
                {stories.map((story) => (
                  <button
                    key={story.id}
                    type="button"
                    onClick={() => onSelectStory(story.id)}
                    className={cn(
                      'h-1.5 flex-1 rounded-full transition-opacity',
                      story.id === activeStory.id ? 'bg-white' : 'bg-white/35'
                    )}
                    aria-label={`Open ${story.name} story`}
                  />
                ))}
              </div>

              <div className="flex items-start justify-between gap-4">
                <div className="flex min-w-0 items-center gap-3 rounded-full bg-black/20 px-3 py-2 text-white backdrop-blur-sm">
                  <Avatar className="h-8 w-8 border border-white/25">
                    <AvatarImage src={activeStory.avatar ?? ''} alt={activeStory.name} />
                    <AvatarFallback className="bg-white/15 text-xs text-white">
                      {getInitials(activeStory.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold">{activeStory.name}</p>
                    <p className="text-[11px] text-white/75">{activeStory.label}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <div className="rounded-full bg-black/20 px-3 py-1.5 text-xs text-white/80 backdrop-blur-sm">
                    {activeStory.isOwn ? 'Your story' : activeStory.audienceLabel}
                  </div>
                  <div className="hidden rounded-full bg-black/20 px-3 py-1.5 text-xs text-white/80 backdrop-blur-sm sm:flex sm:items-center sm:gap-1.5">
                    <Eye className="h-3.5 w-3.5" />
                    {activeStory.isOwn ? 'Seen by followers' : 'Watching'}
                  </div>
                </div>
              </div>

              <div className="flex flex-1 items-center">
                <div className="max-w-3xl">
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.28em] text-white/70">
                    Story
                  </p>
                  <h2 className="text-2xl font-semibold leading-[1.02] tracking-tight text-white sm:text-3xl lg:text-[42px]">
                    {activeStory.caption}
                  </h2>
                </div>
              </div>

              <div className="flex items-end justify-between gap-4">
                <div className="max-w-md rounded-[1.2rem] bg-black/18 px-3.5 py-2 text-xs text-white/80 backdrop-blur-sm">
                  Move through stories from the side rail or use the controls below.
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    className="rounded-full border-0 bg-black/20 px-3.5 text-white shadow-none hover:bg-black/30"
                    onClick={() => goTo(-1)}
                    disabled={activeIndex === 0}
                  >
                    <ChevronLeft className="mr-1 h-4 w-4" />
                    Prev
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="rounded-full border-0 bg-black/20 px-3.5 text-white shadow-none hover:bg-black/30"
                    onClick={() => goTo(1)}
                    disabled={activeIndex === stories.length - 1}
                  >
                    Next
                    <ChevronRight className="ml-1 h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </section>

          <aside className="rounded-[2rem] border border-border/70 bg-background/90 shadow-[0_16px_48px_rgba(15,23,42,0.08)] backdrop-blur-sm">
            <div className="border-b border-border px-5 py-4">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">
                Up Next
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Jump between stories without leaving the screen.
              </p>
            </div>
            <div className="space-y-1 overflow-y-auto p-3">
              {stories.map((story) => (
                <button
                  key={story.id}
                  type="button"
                  onClick={() => onSelectStory(story.id)}
                  className={cn(
                    'flex min-h-[72px] w-full items-center gap-3 rounded-[1.35rem] px-3 py-3 text-left transition-colors',
                    story.id === activeStory.id
                      ? 'bg-accent'
                      : 'hover:bg-accent/70'
                  )}
                >
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={story.avatar ?? ''} alt={story.name} />
                    <AvatarFallback className="bg-primary text-primary-foreground text-xs font-medium">
                      {getInitials(story.name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium text-foreground">{story.name}</p>
                    <p className="truncate text-[11px] text-muted-foreground">{story.label}</p>
                  </div>
                </button>
              ))}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
