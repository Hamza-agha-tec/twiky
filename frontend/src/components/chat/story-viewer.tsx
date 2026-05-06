'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { X, ChevronLeft, ChevronRight, Eye, Trash2, Music, Volume2, VolumeX } from 'lucide-react';
import { cn } from '@/lib/utils';
import { VerifiedBadge, getVerifiedBadgeVariant, hasPremiumPlan } from '@/components/chat/verified-badge';

export interface StorySlide {
  id: string;
  media_url: string;
  type: 'image' | 'video';
  caption?: string | null;
  created_at: string;
  user: { id: string; username: string; avatar_url?: string | null; sub_plan?: string | null };
  isOwn: boolean;
  viewsCount?: number;
  music_preview_url?: string | null;
  music_title?: string | null;
  music_artist?: string | null;
  music_cover_url?: string | null;
}

interface StoryViewerProps {
  slides: StorySlide[];
  startId: string;
  onClose: () => void;
  onView?: (storyId: string) => void;
  onDelete?: (storyId: string) => void;
}

const DURATION = 30000;

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

const WAVE_DELAYS = [0, 160, 80, 240, 120];

export function StoryViewer({ slides, startId, onClose, onView, onDelete }: StoryViewerProps) {
  const [idx, setIdx] = useState(() => Math.max(0, slides.findIndex((s) => s.id === startId)));
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const [muted, setMuted] = useState(false);
  const [audioBlocked, setAudioBlocked] = useState(false);
  const frameRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const elapsedRef = useRef<number>(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const mutedRef = useRef(false);

  const active = slides[idx];

  const goNext = useCallback(() => {
    setIdx((i) => {
      if (i < slides.length - 1) return i + 1;
      onClose();
      return i;
    });
    elapsedRef.current = 0;
  }, [slides.length, onClose]);

  // Always-fresh ref so rAF tick never calls a stale goNext
  const goNextRef = useRef(goNext);
  useEffect(() => { goNextRef.current = goNext; }, [goNext]);

  const goPrev = useCallback(() => {
    setIdx((i) => Math.max(0, i - 1));
    elapsedRef.current = 0;
  }, []);

  // Reset progress on slide change
  useEffect(() => {
    setProgress(0);
    elapsedRef.current = 0;
  }, [idx]);

  // Progress timer — idx and paused only; goNext via ref to avoid stale closure
  useEffect(() => {
    if (!active || paused) return;
    if (!active.isOwn) onView?.(active.id);
    startTimeRef.current = performance.now() - elapsedRef.current;

    function tick() {
      const elapsed = performance.now() - startTimeRef.current;
      elapsedRef.current = elapsed;
      const pct = Math.min((elapsed / DURATION) * 100, 100);
      setProgress(pct);
      if (pct < 100) {
        frameRef.current = requestAnimationFrame(tick);
      } else {
        goNextRef.current();
      }
    }

    frameRef.current = requestAnimationFrame(tick);
    return () => { if (frameRef.current) cancelAnimationFrame(frameRef.current); };
  }, [idx, paused]);

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

  useEffect(() => { mutedRef.current = muted; }, [muted]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    const url = slides[idx]?.music_preview_url;
    if (!url) return;
    const audio = new Audio(url);
    audio.loop = true;
    audio.volume = mutedRef.current ? 0 : 0.75;
    audioRef.current = audio;
    audio.play().then(() => setAudioBlocked(false)).catch(() => setAudioBlocked(true));
    return () => { audio.pause(); };
  }, [idx]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = muted ? 0 : 0.75;
  }, [muted]);

  useEffect(() => () => { audioRef.current?.pause(); }, []);

  if (!active) return null;

  const hasMusic = !!active.music_title;
  const hasAudio = !!active.music_preview_url;
  const showWaves = hasAudio && !audioBlocked && !muted;

  function handlePointerDown() {
    elapsedRef.current = performance.now() - startTimeRef.current;
    setPaused(true);
  }
  function handlePointerUp() {
    setPaused(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95">
      <style>{`
        @keyframes sv-wave {
          0%, 100% { height: 2px; opacity: 0.5; }
          50%       { height: 10px; opacity: 1; }
        }
      `}</style>

      {/* Desktop prev/next */}
      <button onClick={goPrev} disabled={idx === 0}
        className="absolute left-4 top-1/2 z-20 hidden -translate-y-1/2 rounded-full bg-white/10 p-2 text-white backdrop-blur-sm transition hover:bg-white/20 disabled:pointer-events-none disabled:opacity-20 sm:flex">
        <ChevronLeft className="h-4 w-4" />
      </button>
      <button onClick={goNext} disabled={idx === slides.length - 1}
        className="absolute right-4 top-1/2 z-20 hidden -translate-y-1/2 rounded-full bg-white/10 p-2 text-white backdrop-blur-sm transition hover:bg-white/20 disabled:pointer-events-none disabled:opacity-20 sm:flex">
        <ChevronRight className="h-4 w-4" />
      </button>

      {/* Story card */}
      <div
        className="relative flex h-[92vh] w-full max-w-[380px] flex-col overflow-hidden rounded-2xl bg-black shadow-2xl"
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      >
        {/* Media */}
        <div className="absolute inset-0">
          {active.type === 'video' ? (
            <video key={active.id} src={active.media_url}
              className="h-full w-full object-cover" autoPlay muted playsInline loop={false} onEnded={goNext} />
          ) : (
            <img key={active.id} src={active.media_url} alt={active.caption ?? ''}
              className="h-full w-full object-cover" draggable={false} />
          )}
        </div>

        {/* Tap zones — pointer events only for nav, not pause */}
        <button
          className="absolute inset-y-0 left-0 z-10 w-1/3 select-none"
          onPointerDown={(e) => { e.stopPropagation(); handlePointerDown(); }}
          onPointerUp={(e) => { e.stopPropagation(); handlePointerUp(); goPrev(); }}
          aria-label="Previous"
        />
        <button
          className="absolute inset-y-0 right-0 z-10 w-2/3 select-none"
          onPointerDown={(e) => { e.stopPropagation(); handlePointerDown(); }}
          onPointerUp={(e) => { e.stopPropagation(); handlePointerUp(); goNext(); }}
          aria-label="Next"
        />

        {/* Top overlay */}
        <div className="absolute inset-x-0 top-0 z-20 px-3 pt-3">
          {/* Progress bars */}
          <div className="flex gap-1">
            {slides.map((s, i) => (
              <div key={s.id} className="h-[2px] flex-1 overflow-hidden rounded-full bg-white/25">
                <div className="h-full rounded-full bg-white transition-none"
                  style={{ width: i < idx ? '100%' : i === idx ? `${progress}%` : '0%' }} />
              </div>
            ))}
          </div>

          {/* Avatar + name row */}
          <div className="mt-2.5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <img
                src={active.user.avatar_url || '/defaultprofile.jpg'}
                alt=""
                className="h-7 w-7 rounded-full object-cover ring-1 ring-white/30 shrink-0"
                onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/defaultprofile.jpg' }}
              />
              <div className="flex flex-col gap-0.5">
                <div className="flex items-center gap-1.5">
                  <span className="text-[13px] font-semibold text-white drop-shadow">{active.user.username}</span>
                  {hasPremiumPlan(active.user.sub_plan) && (
                    <VerifiedBadge size="xs" variant={getVerifiedBadgeVariant(active.user.sub_plan)} />
                  )}
                  <span className="text-[11px] text-white/45">{timeAgo(active.created_at)}</span>
                </div>
                {hasMusic && (
                  <div className="flex items-center gap-[3px]">
                    <Music className="h-[7px] w-[7px] shrink-0 text-white/30" />
                    <span className="text-[7.5px] text-white/50 truncate max-w-[70px]">{active.music_title}</span>
                    {active.music_artist && (
                      <span className="text-[7px] text-white/30 truncate max-w-[45px]">· {active.music_artist}</span>
                    )}
                    <div className="flex items-end gap-[1.5px]" style={{ height: 6 }}>
                      {WAVE_DELAYS.map((delay, i) => (
                        <div key={i} className="w-[1px] rounded-full bg-white/40"
                          style={{ height: '1.5px', animation: showWaves ? `sv-wave 0.75s ${delay}ms ease-in-out infinite` : 'none' }} />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-0.5">
              {hasAudio && (
                <button
                  onPointerDown={(e) => e.stopPropagation()}
                  onPointerUp={(e) => { e.stopPropagation(); setMuted(m => !m); }}
                  className="rounded-full p-1.5 text-white/60 hover:text-white transition-colors">
                  {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                </button>
              )}
              {active.isOwn && (
                <button
                  onPointerDown={(e) => e.stopPropagation()}
                  onPointerUp={(e) => { e.stopPropagation(); onDelete?.(active.id); }}
                  className="rounded-full p-1.5 text-white/60 hover:text-red-400 transition-colors">
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
              <button
                onPointerDown={(e) => e.stopPropagation()}
                onPointerUp={(e) => { e.stopPropagation(); onClose(); }}
                className="rounded-full p-1.5 text-white/60 hover:text-white transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Bottom overlay */}
        <div className="absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/70 via-black/10 to-transparent px-4 pb-5 pt-20">
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

      {/* Side thumbnails on wide screens */}
      <div className="absolute right-4 top-1/2 hidden -translate-y-1/2 flex-col gap-2 xl:flex">
        {slides.slice(0, 6).map((s, i) => (
          <button key={s.id}
            onClick={() => { setIdx(i); elapsedRef.current = 0; }}
            className={cn('h-14 w-10 overflow-hidden rounded-lg border-2 transition-all',
              i === idx ? 'border-white scale-105' : 'border-transparent opacity-50 hover:opacity-80')}>
            <img src={s.media_url} alt="" className="h-full w-full object-cover" />
          </button>
        ))}
      </div>
    </div>
  );
}
