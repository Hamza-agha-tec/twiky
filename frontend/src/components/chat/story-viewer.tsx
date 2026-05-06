'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { X, ChevronLeft, ChevronRight, Eye, Trash2, Music, Volume2, VolumeX } from 'lucide-react';
import { cn } from '@/lib/utils';
import { VerifiedBadge, getVerifiedBadgeVariant, hasPremiumPlan } from '@/components/chat/verified-badge';
import { storiesApi } from '@/lib/stories-api';

type ReactionType = 'heart' | 'fire' | 'wow' | 'angry' | 'haha';

const REACTIONS: { type: ReactionType; emoji: string; label: string }[] = [
  { type: 'heart', emoji: '❤️', label: 'Love' },
  { type: 'fire', emoji: '🔥', label: 'Fire' },
  { type: 'wow',  emoji: '😮', label: 'Wow'  },
  { type: 'angry',emoji: '😡', label: 'Angry'},
  { type: 'haha', emoji: '😂', label: 'Haha' },
];

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

// 30 bars like Instagram waveform
const WAVE_COUNT = 30;
const WAVE_HEIGHTS = [3,5,8,6,10,7,4,9,6,8,5,11,7,9,4,8,6,10,5,7,9,6,8,4,10,7,5,9,6,8];

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

interface FlyingHeart {
  id: number;
  x: number;
  emoji: string;
}

interface Viewer {
  viewed_at: string;
  user: { id: string; username: string; avatar_url?: string | null };
  reaction: string | null;
}

export function StoryViewer({ slides, startId, onClose, onView, onDelete }: StoryViewerProps) {
  const [idx, setIdx] = useState(() => Math.max(0, slides.findIndex((s) => s.id === startId)));
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const [muted, setMuted] = useState(false);
  const [audioBlocked, setAudioBlocked] = useState(false);
  const [myReactions, setMyReactions] = useState<Record<string, ReactionType | null>>({});
  const [pickerOpen, setPickerOpen] = useState(false);
  const [flyingHearts, setFlyingHearts] = useState<FlyingHeart[]>([]);
  const [showViewers, setShowViewers] = useState(false);
  const [viewers, setViewers] = useState<Viewer[]>([]);
  const [viewersLoading, setViewersLoading] = useState(false);
  const heartIdRef = useRef(0);
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

  const goNextRef = useRef(goNext);
  useEffect(() => { goNextRef.current = goNext; }, [goNext]);

  const goPrev = useCallback(() => {
    setIdx((i) => Math.max(0, i - 1));
    elapsedRef.current = 0;
  }, []);

  useEffect(() => {
    setProgress(0);
    elapsedRef.current = 0;
    setShowViewers(false);
    setPickerOpen(false);
  }, [idx]);

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

  async function openViewers() {
    if (!active?.isOwn) return;
    setShowViewers(true);
    setPaused(true);
    setViewersLoading(true);
    try {
      const data = await storiesApi.getViewers(active.id);
      setViewers(data);
    } finally {
      setViewersLoading(false);
    }
  }

  function closeViewers() {
    setShowViewers(false);
    setPaused(false);
  }

  async function handleReact(reaction: ReactionType) {
    if (!active || active.isOwn) return;
    const storyId = active.id;
    const prev = myReactions[storyId];
    setPickerOpen(false);

    if (prev === reaction) {
      // toggle off
      setMyReactions(r => ({ ...r, [storyId]: null }));
      storiesApi.removeReaction(storyId).catch(() =>
        setMyReactions(r => ({ ...r, [storyId]: reaction }))
      );
    } else {
      setMyReactions(r => ({ ...r, [storyId]: reaction }));
      const id = ++heartIdRef.current;
      const x = 28 + Math.random() * 44;
      setFlyingHearts(prev => [...prev, { id, x, emoji: REACTIONS.find(r => r.type === reaction)!.emoji }]);
      setTimeout(() => setFlyingHearts(p => p.filter(h => h.id !== id)), 1100);
      storiesApi.reactToStory(storyId, reaction).catch(() =>
        setMyReactions(r => ({ ...r, [storyId]: prev ?? null }))
      );
    }
  }

  function handlePointerDown() {
    elapsedRef.current = performance.now() - startTimeRef.current;
    setPaused(true);
  }
  function handlePointerUp() {
    if (!showViewers) setPaused(false);
  }

  if (!active) return null;

  const hasMusic = !!active.music_title;
  const hasAudio = !!active.music_preview_url;
  const showWaves = hasAudio && !audioBlocked && !muted;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95">
      <style>{`
        @keyframes sv-wave {
          0%, 100% { transform: scaleY(0.3); opacity: 0.5; }
          50%       { transform: scaleY(1); opacity: 1; }
        }
        @keyframes emoji-fly {
          0%   { transform: translateY(0) scale(1.2); opacity: 1; }
          55%  { transform: translateY(-110px) scale(1.6); opacity: 1; }
          100% { transform: translateY(-170px) scale(0.6); opacity: 0; }
        }
        @keyframes viewers-up {
          from { transform: translateY(100%); }
          to   { transform: translateY(0); }
        }
        @keyframes picker-pop {
          0%   { transform: scale(0.5) translateY(12px); opacity: 0; }
          70%  { transform: scale(1.06) translateY(-2px); opacity: 1; }
          100% { transform: scale(1) translateY(0); opacity: 1; }
        }
        @keyframes emoji-in {
          0%   { transform: scale(0) translateY(6px); opacity: 0; }
          70%  { transform: scale(1.15) translateY(-2px); opacity: 1; }
          100% { transform: scale(1) translateY(0); opacity: 1; }
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

        {/* Tap zones */}
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
                    {/* Waves at the start */}
                    <div className="flex items-center gap-[1px] mr-1" style={{ height: 10 }}>
                      {WAVE_HEIGHTS.slice(0, 12).map((h, i) => (
                        <div
                          key={i}
                          className="w-[1px] rounded-full bg-white/50 origin-center"
                          style={{
                            height: `${Math.round(h * 0.7)}px`,
                            animation: showWaves ? `sv-wave ${0.6 + (i % 3) * 0.12}s ${(i * 55) % 380}ms ease-in-out infinite` : 'none',
                            transform: showWaves ? undefined : 'scaleY(0.3)',
                            opacity: showWaves ? 0.8 : 0.35,
                          }}
                        />
                      ))}
                    </div>
                    <Music className="h-[7px] w-[7px] shrink-0 text-white/70" />
                    <span className="text-[7.5px] text-white/90 truncate max-w-[70px]">{active.music_title}</span>
                    {active.music_artist && (
                      <span className="text-[7px] text-white/60 truncate max-w-[45px]">· {active.music_artist}</span>
                    )}
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

        {/* Flying emojis */}
        <div className="pointer-events-none absolute inset-0 z-30 overflow-hidden">
          {flyingHearts.map((h) => (
            <div
              key={h.id}
              className="absolute bottom-24 text-3xl select-none"
              style={{ left: `${h.x}%`, animation: 'emoji-fly 1.1s ease-out forwards' }}
            >
              {h.emoji}
            </div>
          ))}
        </div>

        {/* Bottom overlay */}
        <div className="absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/80 via-black/20 to-transparent px-4 pb-5 pt-24">
          {active.caption && (
            <p className="mb-3 text-[13px] font-medium leading-snug text-white drop-shadow">
              {active.caption}
            </p>
          )}

          {/* Bottom action row */}
          <div className="flex items-center justify-between">
            {active.isOwn ? (
              <button
                onPointerDown={(e) => e.stopPropagation()}
                onPointerUp={(e) => { e.stopPropagation(); openViewers(); }}
                className="flex items-center gap-1.5 text-[11px] text-white/60 hover:text-white transition-colors"
              >
                <Eye className="h-3.5 w-3.5" />
                {active.viewsCount ?? 0} {(active.viewsCount ?? 0) === 1 ? 'view' : 'views'}
              </button>
            ) : (
              <div />
            )}

            {/* Reaction picker for non-owners */}
            {!active.isOwn && (
              <div className="relative" onPointerDown={(e) => e.stopPropagation()}>
                {/* Picker bubble */}
                {pickerOpen && (
                  <div
                    className="absolute bottom-12 right-0 flex items-center gap-1 rounded-full bg-black/60 px-2.5 py-1.5 backdrop-blur border border-white/10 shadow-xl"
                    style={{ animation: 'picker-pop 0.28s cubic-bezier(0.34,1.56,0.64,1) forwards' }}
                  >
                    {REACTIONS.map((r, i) => (
                      <button
                        key={r.type}
                        title={r.label}
                        onPointerUp={(e) => { e.stopPropagation(); handleReact(r.type); }}
                        className="group relative flex h-9 w-9 items-center justify-center rounded-full transition-transform hover:scale-125 active:scale-110"
                        style={{ animation: `emoji-in 0.22s ${i * 35}ms cubic-bezier(0.34,1.56,0.64,1) both` }}
                      >
                        <span className="text-[22px] leading-none drop-shadow-lg">{r.emoji}</span>
                        {myReactions[active.id] === r.type && (
                          <span className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 h-1 w-1 rounded-full bg-white" />
                        )}
                        {/* label tooltip */}
                        <span className="pointer-events-none absolute -top-6 left-1/2 -translate-x-1/2 whitespace-nowrap rounded bg-black/80 px-1.5 py-0.5 text-[9px] text-white opacity-0 group-hover:opacity-100 transition-opacity">
                          {r.label}
                        </span>
                      </button>
                    ))}
                  </div>
                )}

                {/* Trigger button */}
                <button
                  onPointerUp={(e) => {
                    e.stopPropagation();
                    if (myReactions[active.id]) {
                      handleReact(myReactions[active.id]!);
                    } else {
                      setPickerOpen(o => !o);
                      setPaused(true);
                    }
                  }}
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 backdrop-blur-sm border border-white/15 transition-transform active:scale-90 hover:bg-white/20"
                >
                  <span className="text-[20px] leading-none">
                    {myReactions[active.id]
                      ? REACTIONS.find(r => r.type === myReactions[active.id])!.emoji
                      : '❤️'}
                  </span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Viewers panel — slides up from bottom */}
        {showViewers && (
          <div
            className="absolute inset-x-0 bottom-0 z-40 rounded-t-2xl border border-white/10 bg-black/70 backdrop-blur"
            style={{ animation: 'viewers-up 0.3s ease-out' }}
            onPointerDown={(e) => e.stopPropagation()}
          >
            {/* drag handle */}
            <div className="flex justify-center pt-2.5 pb-1">
              <div className="h-[3px] w-8 rounded-full bg-white/20" />
            </div>
            <div className="flex items-center justify-between px-4 py-2 border-b border-white/10">
              <span className="text-[13px] font-semibold text-white">
                {viewersLoading ? 'Views' : `${viewers.length} ${viewers.length === 1 ? 'view' : 'views'}`}
              </span>
              <button onPointerUp={closeViewers} className="text-white/40 hover:text-white transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>
            {/* list — fixed to ~2.5 rows, scroll for rest */}
            <div style={{ maxHeight: 110, overflowY: 'auto' }}>
              {viewersLoading ? (
                <ul className="py-1">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <li key={i} className="flex items-center gap-3 px-4 py-2">
                      <div className="h-7 w-7 rounded-full bg-white/10 animate-pulse shrink-0" style={{ animationDelay: `${i * 80}ms` }} />
                      <div className="h-2.5 flex-1 rounded-full bg-white/10 animate-pulse" style={{ animationDelay: `${i * 80 + 40}ms` }} />
                      <div className="h-2 w-7 rounded-full bg-white/10 animate-pulse" style={{ animationDelay: `${i * 80 + 80}ms` }} />
                    </li>
                  ))}
                </ul>
              ) : viewers.length === 0 ? (
                <p className="py-6 text-center text-[12px] text-white/40">No views yet</p>
              ) : (
                <ul className="py-1">
                  {viewers.map((v) => (
                    <li key={v.user.id} className="flex items-center gap-3 px-4 py-2">
                      <img
                        src={v.user.avatar_url || '/defaultprofile.jpg'}
                        alt=""
                        className="h-7 w-7 rounded-full object-cover shrink-0"
                        onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/defaultprofile.jpg' }}
                      />
                      <span className="flex-1 text-[13px] text-white">{v.user.username}</span>
                      {v.reaction && (
                        <span className="text-[14px] shrink-0">{REACTIONS.find(r => r.type === v.reaction)?.emoji ?? v.reaction}</span>
                      )}
                      <span className="text-[10px] text-white/30">{timeAgo(v.viewed_at)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
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
