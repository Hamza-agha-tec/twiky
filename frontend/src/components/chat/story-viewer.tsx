'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { X, ChevronLeft, ChevronRight, Eye, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface StorySlide {
  id: string;
  media_url: string;
  type: 'image' | 'video';
  caption?: string | null;
  created_at: string;
  user: { id: string; username: string; avatar_url?: string | null };
  isOwn: boolean;
  viewsCount?: number;
}

interface StoryViewerProps {
  slides: StorySlide[];
  startId: string;
  onClose: () => void;
  onView?: (storyId: string) => void;
  onDelete?: (storyId: string) => void;
}

const DURATION = 6000;

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function StoryViewer({ slides, startId, onClose, onView, onDelete }: StoryViewerProps) {
  const [idx, setIdx] = useState(() => Math.max(0, slides.findIndex((s) => s.id === startId)));
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const frameRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const elapsedRef = useRef<number>(0);

  const active = slides[idx];

  const goNext = useCallback(() => {
    setIdx((i) => {
      if (i < slides.length - 1) return i + 1;
      onClose();
      return i;
    });
    setProgress(0);
    elapsedRef.current = 0;
  }, [slides.length, onClose]);

  const goPrev = useCallback(() => {
    setIdx((i) => Math.max(0, i - 1));
    setProgress(0);
    elapsedRef.current = 0;
  }, []);

  // Progress timer
  useEffect(() => {
    if (!active || paused) return;
    onView?.(active.id);
    startTimeRef.current = Date.now() - elapsedRef.current;

    function tick() {
      const elapsed = Date.now() - startTimeRef.current;
      elapsedRef.current = elapsed;
      const pct = Math.min((elapsed / DURATION) * 100, 100);
      setProgress(pct);
      if (pct < 100) {
        frameRef.current = requestAnimationFrame(tick);
      } else {
        goNext();
      }
    }

    frameRef.current = requestAnimationFrame(tick);
    return () => { if (frameRef.current) cancelAnimationFrame(frameRef.current); };
  }, [idx, paused, active?.id]);

  // Keyboard nav
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'ArrowRight') goNext();
      else if (e.key === 'ArrowLeft') goPrev();
      else if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [goNext, goPrev, onClose]);

  // Reset on idx change
  useEffect(() => {
    setProgress(0);
    elapsedRef.current = 0;
  }, [idx]);

  if (!active) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95">
      {/* top bar — prev/close/next for desktop */}
      <div className="absolute inset-x-0 top-4 z-20 flex items-center justify-between px-4 sm:px-6">
        <button
          onClick={goPrev}
          disabled={idx === 0}
          className="rounded-full bg-white/10 p-2 text-white backdrop-blur-sm transition-opacity hover:bg-white/20 disabled:pointer-events-none disabled:opacity-20"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={onClose}
            className="rounded-full bg-white/10 p-2 text-white backdrop-blur-sm hover:bg-white/20"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <button
          onClick={goNext}
          disabled={idx === slides.length - 1}
          className="rounded-full bg-white/10 p-2 text-white backdrop-blur-sm transition-opacity hover:bg-white/20 disabled:pointer-events-none disabled:opacity-20"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      {/* story card */}
      <div
        className="relative flex h-[88vh] w-full max-w-[360px] flex-col overflow-hidden rounded-2xl bg-zinc-900 shadow-2xl"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => { setPaused(false); elapsedRef.current = Date.now() - startTimeRef.current; }}
      >
        {/* progress bars */}
        <div className="absolute inset-x-3 top-3 z-10 flex gap-1">
          {slides.map((s, i) => (
            <button
              key={s.id}
              type="button"
              onClick={() => { setIdx(i); setProgress(0); elapsedRef.current = 0; }}
              className="h-0.5 flex-1 overflow-hidden rounded-full bg-white/25"
            >
              <div
                className="h-full rounded-full bg-white"
                style={{
                  width: i < idx ? '100%' : i === idx ? `${progress}%` : '0%',
                  transition: i === idx ? 'none' : undefined,
                }}
              />
            </button>
          ))}
        </div>

        {/* user header */}
        <div className="absolute inset-x-0 top-7 z-10 flex items-center justify-between px-3 pt-2">
          <div className="flex items-center gap-2 rounded-full bg-black/30 px-2.5 py-1.5 backdrop-blur-sm">
            <Avatar className="h-7 w-7 border border-white/20">
              <AvatarImage src={active.user.avatar_url ?? ''} alt={active.user.username} />
              <AvatarFallback className="bg-white/10 text-[10px] text-white">
                {active.user.username.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div>
              <p className="text-[11px] font-semibold leading-none text-white">
                {active.user.username}
              </p>
              <p className="mt-0.5 text-[9px] leading-none text-white/50">
                {timeAgo(active.created_at)}
              </p>
            </div>
          </div>

          {active.isOwn && (
            <button
              onClick={() => onDelete?.(active.id)}
              className="rounded-full bg-black/30 p-1.5 text-white/60 backdrop-blur-sm hover:text-red-400 transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* media */}
        <div className="relative flex-1 overflow-hidden bg-black">
          {active.type === 'video' ? (
            <video
              key={active.id}
              src={active.media_url}
              className="h-full w-full object-cover"
              autoPlay
              muted
              playsInline
              loop={false}
              onEnded={goNext}
            />
          ) : (
            <img
              key={active.id}
              src={active.media_url}
              alt={active.caption ?? ''}
              className="h-full w-full object-cover"
              draggable={false}
            />
          )}

          {/* tap zones */}
          <button
            className="absolute inset-y-0 left-0 w-1/3 select-none"
            onClick={goPrev}
            aria-label="Previous story"
          />
          <button
            className="absolute inset-y-0 right-0 w-2/3 select-none"
            onClick={goNext}
            aria-label="Next story"
          />
        </div>

        {/* bottom overlay */}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent px-4 pb-5 pt-16">
          {active.caption && (
            <p className="mb-2 text-[13px] font-medium leading-snug text-white drop-shadow">
              {active.caption}
            </p>
          )}

          {active.isOwn && active.viewsCount !== undefined && (
            <div className="flex items-center gap-1.5 text-[11px] text-white/50">
              <Eye className="h-3 w-3" />
              {active.viewsCount} {active.viewsCount === 1 ? 'view' : 'views'}
            </div>
          )}
        </div>
      </div>

      {/* side thumbnails — visible on wider screens */}
      <div className="absolute right-4 top-1/2 hidden -translate-y-1/2 flex-col gap-2 xl:flex">
        {slides.slice(0, 6).map((s, i) => (
          <button
            key={s.id}
            onClick={() => { setIdx(i); setProgress(0); elapsedRef.current = 0; }}
            className={cn(
              'h-14 w-10 overflow-hidden rounded-lg border-2 transition-all',
              i === idx ? 'border-white scale-105' : 'border-transparent opacity-50 hover:opacity-80',
            )}
          >
            <img src={s.media_url} alt="" className="h-full w-full object-cover" />
          </button>
        ))}
      </div>
    </div>
  );
}
