'use client';

import { useEffect, useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { Eye, Globe2, Lock, TimerReset, UserPlus2, X } from 'lucide-react';

const STORY_THEMES = [
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

interface AddStoryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profileName: string;
  profileAvatar?: string | null;
  onSubmit: (story: StoryDraft) => void;
}

function getInitials(name: string) {
  return name
    .split(' ')
    .map((word) => word[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function AddStoryModal({
  open,
  onOpenChange,
  profileName,
  profileAvatar,
  onSubmit,
}: AddStoryModalProps) {
  const [caption, setCaption] = useState('');
  const [themeId, setThemeId] = useState<StoryThemeId>('sky');
  const [audience, setAudience] = useState<StoryAudience>('contacts');
  const [durationHours, setDurationHours] = useState<StoryDuration>(24);

  useEffect(() => {
    if (!open) return;
    setCaption('');
    setThemeId('sky');
    setAudience('contacts');
    setDurationHours(24);
  }, [open]);

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
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-hidden border-border bg-sidebar p-0 sm:max-w-2xl" showCloseButton={false}>
        <div className="grid max-h-[85vh] md:grid-cols-[0.8fr_1.2fr]">
          <div className="border-b border-border bg-muted/30 p-4 md:border-r md:border-b-0 md:p-5">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Story Preview
                </p>
                <p className="mt-1 text-xs text-muted-foreground">Set the vibe before it goes live.</p>
              </div>
              <DialogClose asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
                  <X className="h-4 w-4" />
                </Button>
              </DialogClose>
            </div>

            <div className="mx-auto flex max-w-[190px] justify-center rounded-[1.4rem] border border-border/70 bg-background/70 p-2 shadow-sm">
              <div className={cn('relative aspect-[9/16] w-full overflow-hidden rounded-[1.2rem] p-3 text-white shadow-lg', activeTheme.className)}>
                <div className="absolute inset-0 bg-black/10" />
                <div className="relative flex h-full flex-col">
                  <div className="flex items-center gap-2.5">
                    <Avatar className="h-8 w-8 border border-white/20">
                      <AvatarImage src={profileAvatar ?? ''} alt={profileName} />
                      <AvatarFallback className="bg-white/15 text-xs text-white">
                        {getInitials(profileName)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-xs font-semibold">{profileName}</p>
                      <p className="text-[10px] text-white/75">Just now</p>
                    </div>
                  </div>

                  <div className="flex flex-1 items-center justify-center px-1.5">
                    <p className="max-w-[145px] text-center text-lg font-semibold leading-tight tracking-tight">
                      {caption.trim() || 'Share a quick update'}
                    </p>
                  </div>

                  <div className="flex items-center justify-between rounded-full bg-black/20 px-2.5 py-1.5 text-[10px] text-white/80 backdrop-blur-sm">
                    <span className="flex items-center gap-1.5">
                      <Eye className="h-3 w-3" />
                      {audience === 'close-friends' ? 'Close Friends' : audience === 'everyone' ? 'Everyone' : 'Contacts'}
                    </span>
                    <span>{durationHours}h</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="overflow-y-auto p-4 md:p-5">
            <DialogHeader className="space-y-1.5 text-left">
              <DialogTitle className="text-lg">Add story</DialogTitle>
              <DialogDescription>Post an update.</DialogDescription>
            </DialogHeader>

            <div className="mt-4 space-y-3.5">
              <div className="space-y-1">
                <label htmlFor="story-caption" className="text-sm font-medium text-foreground">
                  Story text
                </label>
                <Textarea
                  id="story-caption"
                  value={caption}
                  onChange={(event) => setCaption(event.target.value.slice(0, 140))}
                  placeholder="What are you up to?"
                  className="min-h-20 resize-none rounded-2xl border-border bg-background"
                />
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Keep it short.</span>
                  <span>{caption.length}/140</span>
                </div>
              </div>

              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">Theme</p>
                <div className="grid grid-cols-4 gap-1">
                  {STORY_THEMES.map((theme) => (
                    <button
                      key={theme.id}
                      type="button"
                      onClick={() => setThemeId(theme.id)}
                      className={cn(
                        'rounded-lg border border-transparent p-0.5 transition-transform hover:scale-[1.02]',
                        themeId === theme.id && 'border-primary bg-primary/5'
                      )}
                    >
                      <div className={cn('h-7 rounded-md', theme.className)} />
                      <p className="pt-1 text-[8px] font-medium leading-none text-foreground">{theme.label}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">Audience</p>
                <div className="grid gap-1.5 sm:grid-cols-3">
                  {STORY_AUDIENCES.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setAudience(option.id)}
                      className={cn(
                        'flex w-full items-center gap-1.5 rounded-lg border px-2 py-1.5 text-left transition-colors',
                        audience === option.id
                          ? 'border-primary bg-primary/5'
                          : 'border-border bg-background hover:bg-accent'
                      )}
                    >
                      <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md bg-muted">
                        <option.icon className="h-2.5 w-2.5 text-foreground" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] font-medium leading-none text-foreground">{option.label}</p>
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
                <div className="flex gap-1.5">
                  {STORY_DURATIONS.map((duration) => (
                    <button
                      key={duration}
                      type="button"
                      onClick={() => setDurationHours(duration)}
                      className={cn(
                        'flex-1 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
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

            <div className="mt-5 flex justify-end gap-2">
              <DialogClose asChild>
                <Button variant="ghost" className="rounded-full px-5">
                  Cancel
                </Button>
              </DialogClose>
              <Button onClick={handleSubmit} className="rounded-full px-5">
                Post story
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
