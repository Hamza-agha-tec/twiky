'use client';

import { useEffect, useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { ArrowLeft, Eye, Globe2, Lock, TimerReset, UserPlus2 } from 'lucide-react';

export const STORY_THEMES = [
  {
    id: 'sky',
    label: 'Sky',
    className: 'bg-gradient-to-br from-sky-500 via-cyan-500 to-blue-600',
  },
  {
    id: 'sunset',
    label: 'Sunset',
    className: 'bg-gradient-to-br from-orange-400 via-rose-500 to-fuchsia-600',
  },
  {
    id: 'forest',
    label: 'Forest',
    className: 'bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-600',
  },
  {
    id: 'midnight',
    label: 'Midnight',
    className: 'bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950',
  },
] as const;

const STORY_AUDIENCES = [
  { id: 'contacts', label: 'Contacts', icon: UserPlus2 },
  { id: 'close-friends', label: 'Close Friends', icon: Lock },
  { id: 'everyone', label: 'Everyone', icon: Globe2 },
] as const;

const STORY_DURATIONS = [6, 12, 24] as const;

type StoryThemeId = (typeof STORY_THEMES)[number]['id'];
type StoryAudience = (typeof STORY_AUDIENCES)[number]['id'];
type StoryDuration = (typeof STORY_DURATIONS)[number];

export interface StoryDraft {
  id: string;
  caption: string;
  themeId: StoryThemeId;
  audience: StoryAudience;
  durationHours: StoryDuration;
  createdAt: string;
}

export function getStoryThemeClass(themeId: StoryThemeId) {
  return STORY_THEMES.find((theme) => theme.id === themeId)?.className ?? STORY_THEMES[0].className;
}

interface AddStoryScreenProps {
  profileName: string;
  profileAvatar?: string | null;
  onSubmit: (story: StoryDraft) => void;
  onCancel: () => void;
}

function getInitials(name: string) {
  return name
    .split(' ')
    .map((word) => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function AddStoryScreen({
  profileName,
  profileAvatar,
  onSubmit,
  onCancel,
}: AddStoryScreenProps) {
  const [caption, setCaption] = useState('');
  const [themeId, setThemeId] = useState<StoryThemeId>('sky');
  const [audience, setAudience] = useState<StoryAudience>('contacts');
  const [durationHours, setDurationHours] = useState<StoryDuration>(24);

  useEffect(() => {
    setCaption('');
    setThemeId('sky');
    setAudience('contacts');
    setDurationHours(24);
  }, []);

  const activeTheme = STORY_THEMES.find((theme) => theme.id === themeId) ?? STORY_THEMES[0];

  function handleSubmit() {
    onSubmit({
      id: `story-${Date.now()}`,
      caption: caption.trim() || 'New story',
      themeId,
      audience,
      durationHours,
      createdAt: new Date().toISOString(),
    });
  }

  return (
    <div className="flex h-full min-w-0 flex-1 flex-col bg-sidebar">
      <div className="flex h-14 items-center justify-between border-b border-border px-4">
        <div className="flex min-w-0 items-center gap-2">
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={onCancel}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">Add story</p>
            <p className="text-xs text-muted-foreground">Post an update.</p>
          </div>
        </div>
        <Button onClick={handleSubmit} className="rounded-full px-5">
          Post story
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 lg:p-6">
        <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
          <div className="rounded-[1.75rem] border border-border bg-muted/30 p-4 lg:p-6">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Story Preview
                </p>
                <p className="mt-1 text-xs text-muted-foreground">Set the vibe before it goes live.</p>
              </div>
            </div>

            <div className="mx-auto flex max-w-[172px] justify-center rounded-[1.35rem] border border-border/70 bg-background/70 p-2 shadow-sm lg:max-w-[260px] lg:rounded-[1.8rem] lg:p-3">
              <div className={cn('relative aspect-[9/16] w-full overflow-hidden rounded-[1.15rem] p-3 text-white shadow-lg lg:rounded-[1.5rem] lg:p-4', activeTheme.className)}>
                <div className="absolute inset-0 bg-black/10" />
                <div className="relative flex h-full flex-col">
                  <div className="flex items-center gap-2.5">
                    <Avatar className="h-7 w-7 border border-white/20 lg:h-8 lg:w-8">
                      <AvatarImage src={profileAvatar ?? ''} alt={profileName} />
                      <AvatarFallback className="bg-white/15 text-xs text-white">
                        {getInitials(profileName)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-xs font-semibold lg:text-sm">{profileName}</p>
                      <p className="text-[10px] text-white/75 lg:text-xs">Just now</p>
                    </div>
                  </div>

                  <div className="flex flex-1 items-center justify-center px-1.5">
                    <p className="max-w-[145px] text-center text-lg font-semibold leading-tight tracking-tight lg:max-w-[200px] lg:text-[26px]">
                      {caption.trim() || 'Share a quick update'}
                    </p>
                  </div>

                  <div className="flex items-center justify-between rounded-full bg-black/20 px-2.5 py-1.5 text-[10px] text-white/80 backdrop-blur-sm lg:px-3 lg:py-2 lg:text-xs">
                    <span className="flex items-center gap-1.5">
                      <Eye className="h-3 w-3 lg:h-3.5 lg:w-3.5" />
                      {audience === 'close-friends' ? 'Close Friends' : audience === 'everyone' ? 'Everyone' : 'Contacts'}
                    </span>
                    <span>{durationHours}h</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-[1.75rem] border border-border bg-background p-4 lg:p-6">
            <div className="space-y-3 lg:space-y-4">
              <div className="space-y-1">
                <label htmlFor="story-caption" className="text-sm font-medium text-foreground">
                  Story text
                </label>
                <Textarea
                  id="story-caption"
                  value={caption}
                  onChange={(event) => setCaption(event.target.value.slice(0, 140))}
                  placeholder="What are you up to?"
                  className="min-h-20 resize-none rounded-2xl border-border bg-background lg:min-h-28"
                />
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Keep it short.</span>
                  <span>{caption.length}/140</span>
                </div>
              </div>

              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">Theme</p>
                <div className="grid grid-cols-4 gap-1 lg:gap-2">
                  {STORY_THEMES.map((theme) => (
                    <button
                      key={theme.id}
                      type="button"
                      onClick={() => setThemeId(theme.id)}
                      className={cn(
                        'rounded-lg border border-transparent p-0.5 transition-transform hover:scale-[1.02] lg:rounded-xl lg:p-1',
                        themeId === theme.id && 'border-primary bg-primary/5'
                      )}
                    >
                      <div className={cn('h-7 rounded-md lg:h-12 lg:rounded-lg', theme.className)} />
                      <p className="pt-1 text-[8px] font-medium leading-none text-foreground lg:pt-1.5 lg:text-[11px]">{theme.label}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">Audience</p>
                <div className="grid gap-1.5 sm:grid-cols-3 lg:gap-2">
                  {STORY_AUDIENCES.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setAudience(option.id)}
                      className={cn(
                        'flex w-full items-center gap-1.5 rounded-lg border px-2 py-1.5 text-left transition-colors lg:gap-2 lg:rounded-xl lg:px-3 lg:py-2.5',
                        audience === option.id
                          ? 'border-primary bg-primary/5'
                          : 'border-border bg-background hover:bg-accent'
                      )}
                    >
                      <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md bg-muted lg:h-8 lg:w-8 lg:rounded-lg">
                        <option.icon className="h-2.5 w-2.5 text-foreground lg:h-3.5 lg:w-3.5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] font-medium leading-none text-foreground lg:text-xs">{option.label}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1">
                <p className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <TimerReset className="h-4 w-4" />
                  Duration
                </p>
                <div className="flex gap-1.5 lg:gap-2">
                  {STORY_DURATIONS.map((duration) => (
                    <button
                      key={duration}
                      type="button"
                      onClick={() => setDurationHours(duration)}
                      className={cn(
                        'flex-1 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors lg:px-4 lg:py-2',
                        durationHours === duration
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-border bg-background text-foreground hover:bg-accent'
                      )}
                    >
                      {duration}h
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="mt-4 flex justify-end gap-2 lg:mt-5">
              <Button variant="ghost" className="rounded-full px-5" onClick={onCancel}>
                Cancel
              </Button>
              <Button onClick={handleSubmit} className="rounded-full px-5">
                Post story
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
