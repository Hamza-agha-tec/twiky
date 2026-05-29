'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Heart, Users } from 'lucide-react'
import { toast } from 'sonner'
import { motion as Motion, AnimatePresence } from 'framer-motion'

import { PixelRoomCanvas } from '@/components/game/pixel-room-canvas'
import {
  createDefaultRoomState,
  DEFAULT_AVATAR_ID,
  OBJECT_CATALOG,
  type PixelDirection,
  type PixelRoomState,
  ROOM_COLUMNS,
  ROOM_ROWS,
} from '@/components/game/game-data'
import {
  fetchPublicRoom,
  fetchMyRoom,
  recordRoomVisit,
  toggleRoomLike,
  type PublicRoomPayload,
} from '@/lib/rooms-api'
import { useProfile } from '@/hooks/use-user'

type Payload = PublicRoomPayload<PixelRoomState>

type VisitorMotion = {
  avatarId: string
  avatarX: number
  avatarY: number
  avatarDirection: PixelDirection
  isSitting: boolean
  sittingObjectId: string | null
}

function directionFromDelta(dx: number, dy: number): PixelDirection {
  if (dx < 0) return 'left'
  if (dx > 0) return 'right'
  if (dy < 0) return 'up'
  return 'down'
}

function defaultMotion(): VisitorMotion {
  return {
    avatarId: DEFAULT_AVATAR_ID,
    avatarX: Math.floor(ROOM_COLUMNS / 2),
    avatarY: Math.floor(ROOM_ROWS / 2),
    avatarDirection: 'down',
    isSitting: false,
    sittingObjectId: null,
  }
}

export default function PublicRoomPage() {
  const params = useParams()
  const router = useRouter()
  const username = typeof params?.username === 'string' ? params.username : ''
  const { data: currentUser } = useProfile()

  const [payload, setPayload] = useState<Payload | null>(null)
  const [ownerObjects, setOwnerObjects] = useState<PixelRoomState['objects']>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [barFull, setBarFull] = useState(false)
  const [overlayVisible, setOverlayVisible] = useState(true)

  const [visitor, setVisitor] = useState<VisitorMotion>(defaultMotion)

  useEffect(() => {
    if (!username) return
    let cancelled = false
    setLoading(true)

    fetchPublicRoom<PixelRoomState>(username)
      .then((res) => {
        if (cancelled) return
        setPayload(res)
        const merged = { ...createDefaultRoomState(), ...(res.state ?? {}) }
        setOwnerObjects(merged.objects)
        setLoading(false)
        if (!res.isOwn) void recordRoomVisit(username).catch(() => {})
      })
      .catch((err) => {
        if (cancelled) return
        setError(err instanceof Error ? err.message : 'Failed to load room')
        setLoading(false)
      })

    return () => { cancelled = true }
  }, [username])

  useEffect(() => {
    let cancelled = false
    fetchMyRoom<PixelRoomState>()
      .then((res) => {
        if (cancelled) return
        const avatarId = res.state?.avatarId ?? DEFAULT_AVATAR_ID
        setVisitor(prev => ({ ...prev, avatarId }))
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (loading || !payload) return
    const t1 = setTimeout(() => setBarFull(true), 1600)
    const t2 = setTimeout(() => setOverlayVisible(false), 2400)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [loading, payload])

  const canvasState: PixelRoomState = useMemo(() => ({
    ...visitor,
    objects: ownerObjects,
    ownedItemIds: [],
  }), [visitor, ownerObjects])

  const handleMoveAvatar = useCallback((dx: number, dy: number) => {
    setVisitor(prev => ({
      ...prev,
      avatarDirection: directionFromDelta(dx, dy),
      isSitting: false,
      sittingObjectId: null,
      avatarX: Math.max(1, Math.min(ROOM_COLUMNS - 2, prev.avatarX + dx)),
      avatarY: Math.max(1, Math.min(ROOM_ROWS - 2, prev.avatarY + dy)),
    }))
  }, [])

  const handleToggleSit = useCallback(() => {
    setVisitor(prev => {
      if (prev.isSitting) return { ...prev, isSitting: false, sittingObjectId: null }

      const seat = ownerObjects
        .map(obj => ({
          obj,
          asset: OBJECT_CATALOG.find(item => item.id === obj.itemId),
          dist: Math.abs(obj.x - prev.avatarX) + Math.abs(obj.y - prev.avatarY),
        }))
        .filter(e => e.asset?.canSit && e.dist <= 1)
        .sort((a, b) => a.dist - b.dist)[0]

      if (!seat?.asset) return prev
      return {
        ...prev,
        avatarX: seat.obj.x,
        avatarY: seat.obj.y,
        avatarDirection: seat.asset.seatDirection ?? prev.avatarDirection,
        isSitting: true,
        sittingObjectId: seat.obj.id,
      }
    })
  }, [ownerObjects])

  async function handleLike() {
    if (!payload || payload.isOwn) return
    try {
      const result = await toggleRoomLike(username)
      setPayload({ ...payload, hasLiked: result.liked, likeCount: result.likeCount })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not like room')
    }
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center bg-[#060910]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }

  if (error || !payload) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 bg-[#060910] text-center text-slate-300">
        <h2 className="text-xl font-bold">Room unavailable</h2>
        <p className="text-sm text-slate-500">{error ?? 'Could not load this room.'}</p>
        <button
          onClick={() => router.back()}
          className="mt-2 inline-flex items-center gap-1.5 rounded-xl border border-[#334155] px-4 py-2 text-sm text-slate-300 hover:bg-[#1e3a5f]"
        >
          <ArrowLeft className="h-4 w-4" /> Go back
        </button>
      </div>
    )
  }

  const ownerName = payload.owner.fullname ?? payload.owner.username ?? 'Player'
  const myName = currentUser?.fullname ?? currentUser?.username ?? 'You'

  return (
    <section className="relative flex h-full min-w-0 flex-1 flex-col overflow-hidden bg-[#060910] text-slate-200">

      {/* Cinematic entry transition */}
      <AnimatePresence>
        {overlayVisible && (
          <Motion.div
            key="entry-overlay"
            className="absolute inset-0 z-50 flex flex-col items-center justify-center overflow-hidden bg-[#060910]"
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
          >
            {/* Ambient glow */}
            <Motion.div
              className="pointer-events-none absolute inset-0"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3, duration: 1 }}
              style={{
                background: 'radial-gradient(ellipse 60% 50% at 50% 50%, rgba(59,130,246,0.12) 0%, transparent 70%)',
              }}
            />

            {/* Owner avatar */}
            <Motion.div
              initial={{ scale: 0.5, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              transition={{ delay: 0.15, duration: 0.65, ease: [0.34, 1.56, 0.64, 1] }}
              className="relative mb-6"
            >
              <div className="h-[88px] w-[88px] overflow-hidden rounded-full border-2 border-[#1e3a5f] shadow-[0_0_40px_rgba(59,130,246,0.35)]">
                {payload.owner.avatarUrl ? (
                  <img src={payload.owner.avatarUrl} alt={ownerName} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-[#0f172a] text-3xl font-black text-slate-200">
                    {ownerName[0]?.toUpperCase()}
                  </div>
                )}
              </div>
              <Motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.55, duration: 0.4, ease: [0.34, 1.56, 0.64, 1] }}
                className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full border border-[#1e3a5f] bg-[#060910] text-[11px]"
              >
                🏠
              </Motion.span>
            </Motion.div>

            <Motion.p
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.35 }}
              className="text-[10px] font-bold uppercase tracking-[0.25em] text-[#3b82f6]"
            >
              Entering
            </Motion.p>
            <Motion.h2
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.4 }}
              className="mt-1 text-[22px] font-black tracking-tight text-slate-100"
            >
              {ownerName}&apos;s Room
            </Motion.h2>

            {/* Loading bar */}
            <Motion.div className="mt-7 h-[2px] w-48 overflow-hidden rounded-full bg-[#1e3a5f]">
              <Motion.div
                className="h-full rounded-full bg-gradient-to-r from-[#3b82f6] to-[#93c5fd]"
                initial={{ width: '0%' }}
                animate={{ width: barFull ? '100%' : '65%' }}
                transition={{ duration: barFull ? 0.5 : 1.4, ease: 'easeInOut' }}
              />
            </Motion.div>

            <Motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: barFull ? 1 : 0 }}
              transition={{ duration: 0.4 }}
              className="mt-3 text-[11px] text-slate-500"
            >
              WASD · move &nbsp;·&nbsp; E · sit
            </Motion.p>
          </Motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <Motion.header
        className="flex flex-shrink-0 items-center justify-between border-b border-[#1e3a5f] px-4 py-3"
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: overlayVisible ? 0 : 1, y: overlayVisible ? -8 : 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
      >
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="flex h-8 w-8 items-center justify-center rounded-[8px] border border-[#334155] text-slate-400 hover:border-[#3b82f6] hover:text-[#93c5fd]"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="min-w-0">
            <h2 className="truncate text-[14px] font-semibold text-slate-100">
              {ownerName}&apos;s room
            </h2>
            <p className="text-[11px] text-slate-500">@{payload.owner.username ?? 'unknown'}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-[8px] border border-[#334155] bg-[#0f172a] px-2.5 py-1 text-[11px] text-slate-300">
            <Users className="h-3 w-3" />
            {payload.visitorCount} visitor{payload.visitorCount === 1 ? '' : 's'}
          </span>
          {!payload.isOwn && (
            <button
              onClick={handleLike}
              className={`inline-flex items-center gap-1.5 rounded-[8px] border px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                payload.hasLiked
                  ? 'border-rose-500/40 bg-rose-500/10 text-rose-400'
                  : 'border-[#334155] bg-[#0f172a] text-slate-300 hover:border-[#3b82f6] hover:text-[#93c5fd]'
              }`}
            >
              <Heart className={`h-3 w-3 ${payload.hasLiked ? 'fill-current' : ''}`} />
              {payload.likeCount}
            </button>
          )}
        </div>
      </Motion.header>

      {/* Canvas */}
      <Motion.main
        className="relative flex min-w-0 flex-1 flex-col overflow-hidden p-4"
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: overlayVisible ? 0 : 1, scale: overlayVisible ? 0.97 : 1 }}
        transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
      >
        <div className="relative mx-auto flex h-full max-h-[576px] w-full max-w-[832px] shrink overflow-hidden rounded-[10px] border-2 border-[#1e3a5f] shadow-[0_0_60px_rgba(59,130,246,0.15)]">
          <PixelRoomCanvas
            state={canvasState}
            playerName={myName}
            selectedObjectId={null}
            onSelectObject={() => {}}
            onMoveObject={() => {}}
            onMoveAvatar={handleMoveAvatar}
            onToggleSit={handleToggleSit}
          />
          <div className="pointer-events-none absolute left-1/2 top-[10px] z-10 -translate-x-1/2 rounded-full border border-[#1e3a5f] bg-[rgba(6,9,16,0.9)] px-3.5 py-1.5 text-[10px] text-slate-500">
            Visiting {ownerName}&apos;s room · WASD move · E sit
          </div>
        </div>
      </Motion.main>
    </section>
  )
}
