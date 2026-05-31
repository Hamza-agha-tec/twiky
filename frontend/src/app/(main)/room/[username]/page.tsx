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
    const t1 = setTimeout(() => setBarFull(true), 1400)
    const t2 = setTimeout(() => setOverlayVisible(false), 2200)
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

  const ownerName = payload?.owner.fullname ?? payload?.owner.username ?? username
  const myName = currentUser?.fullname ?? currentUser?.username ?? 'You'

  return (
    <section className="relative flex h-full min-w-0 flex-1 flex-col overflow-hidden bg-background text-foreground">

      {/* Cinematic entry overlay — shown from the very first render */}
      <AnimatePresence>
        {overlayVisible && (
          <Motion.div
            key="entry-overlay"
            className="absolute inset-0 z-50 flex flex-col items-center justify-center overflow-hidden bg-background"
            exit={{ opacity: 0 }}
            transition={{ duration: 0.55, ease: [0.4, 0, 0.2, 1] }}
          >
            {/* Radial glow */}
            <Motion.div
              className="pointer-events-none absolute inset-0"
              initial={{ opacity: 0 }}
              animate={{ opacity: loading ? 0 : 1 }}
              transition={{ duration: 0.8 }}
              style={{
                background:
                  'radial-gradient(ellipse 55% 45% at 50% 50%, color-mix(in srgb, hsl(var(--primary)) 14%, transparent) 0%, transparent 70%)',
              }}
            />

            {/* Owner avatar / skeleton */}
            <Motion.div
              initial={{ scale: 0.7, opacity: 0, y: 16 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.55, ease: [0.34, 1.56, 0.64, 1] }}
              className="relative mb-5"
            >
              <div
                className={`h-[84px] w-[84px] overflow-hidden rounded-full border border-border shadow-lg transition-shadow duration-500 ${
                  !loading ? 'shadow-primary/20' : ''
                }`}
              >
                {loading ? (
                  <div className="h-full w-full animate-pulse bg-muted" />
                ) : payload?.owner.avatarUrl ? (
                  <img
                    src={payload.owner.avatarUrl}
                    alt={ownerName}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-muted text-2xl font-black text-foreground">
                    {ownerName[0]?.toUpperCase()}
                  </div>
                )}
              </div>

              {!loading && (
                <Motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.35, duration: 0.4, ease: [0.34, 1.56, 0.64, 1] }}
                  className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full border border-border bg-background text-[11px]"
                >
                  🏠
                </Motion.span>
              )}
            </Motion.div>

            {/* Label */}
            <Motion.p
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25, duration: 0.3 }}
              className="text-[10px] font-bold uppercase tracking-[0.25em] text-primary"
            >
              {loading ? 'Loading' : 'Entering'}
            </Motion.p>

            <Motion.h2
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35, duration: 0.35 }}
              className="mt-1 text-[21px] font-black tracking-tight text-foreground"
            >
              {loading ? (
                <span className="inline-block h-6 w-40 animate-pulse rounded bg-muted" />
              ) : (
                <>{ownerName}&apos;s Room</>
              )}
            </Motion.h2>

            {/* Progress bar */}
            <Motion.div
              className="mt-7 h-[2px] w-44 overflow-hidden rounded-full bg-border"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
            >
              <Motion.div
                className="h-full rounded-full bg-primary"
                initial={{ width: '0%' }}
                animate={{ width: loading ? '35%' : barFull ? '100%' : '72%' }}
                transition={{
                  duration: loading ? 1.2 : barFull ? 0.45 : 1.0,
                  ease: 'easeInOut',
                }}
              />
            </Motion.div>

            <Motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: barFull ? 1 : 0 }}
              transition={{ duration: 0.35 }}
              className="mt-3 text-[11px] text-muted-foreground"
            >
              WASD · move &nbsp;·&nbsp; E · sit
            </Motion.p>
          </Motion.div>
        )}
      </AnimatePresence>

      {/* Error state — shown after overlay gone */}
      {!overlayVisible && error && (
        <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
          <h2 className="text-xl font-bold text-foreground">Room unavailable</h2>
          <p className="text-sm text-muted-foreground">{error}</p>
          <button
            onClick={() => router.back()}
            className="mt-2 inline-flex items-center gap-1.5 rounded-xl border border-border px-4 py-2 text-sm text-foreground hover:bg-accent"
          >
            <ArrowLeft className="h-4 w-4" /> Go back
          </button>
        </div>
      )}

      {/* Room UI — mounted once data ready, hidden behind overlay until it exits */}
      {payload && (
        <>
          <Motion.header
            className="flex flex-shrink-0 items-center justify-between border-b border-border px-4 py-3"
            initial={{ opacity: 0 }}
            animate={{ opacity: overlayVisible ? 0 : 1 }}
            transition={{ duration: 0.3 }}
          >
            <div className="flex items-center gap-3">
              <button
                onClick={() => router.back()}
                className="flex h-8 w-8 items-center justify-center rounded-[8px] border border-border text-muted-foreground hover:border-primary hover:text-primary"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
              <div className="min-w-0">
                <h2 className="truncate text-[14px] font-semibold text-foreground">
                  {ownerName}&apos;s room
                </h2>
                <p className="text-[11px] text-muted-foreground">
                  @{payload.owner.username ?? 'unknown'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-[8px] border border-border bg-card px-2.5 py-1 text-[11px] text-muted-foreground">
                <Users className="h-3 w-3" />
                {payload.visitorCount} visitor{payload.visitorCount === 1 ? '' : 's'}
              </span>
              {!payload.isOwn && (
                <button
                  onClick={handleLike}
                  className={`inline-flex items-center gap-1.5 rounded-[8px] border px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                    payload.hasLiked
                      ? 'border-rose-500/40 bg-rose-500/10 text-rose-400'
                      : 'border-border bg-card text-muted-foreground hover:border-primary hover:text-primary'
                  }`}
                >
                  <Heart className={`h-3 w-3 ${payload.hasLiked ? 'fill-current' : ''}`} />
                  {payload.likeCount}
                </button>
              )}
            </div>
          </Motion.header>

          <Motion.main
            className="relative flex min-w-0 flex-1 flex-col overflow-hidden p-4"
            initial={{ opacity: 0, scale: 0.975 }}
            animate={{ opacity: overlayVisible ? 0 : 1, scale: overlayVisible ? 0.975 : 1 }}
            transition={{ duration: 0.45, ease: [0.4, 0, 0.2, 1] }}
          >
            <div className="relative mx-auto flex h-full max-h-[576px] w-full max-w-[832px] shrink overflow-hidden rounded-[10px] border border-border shadow-lg">
              <PixelRoomCanvas
                state={canvasState}
                playerName={myName}
                selectedObjectId={null}
                onSelectObject={() => {}}
                onMoveObject={() => {}}
                onMoveAvatar={handleMoveAvatar}
                onToggleSit={handleToggleSit}
              />
              <div className="pointer-events-none absolute left-1/2 top-[10px] z-10 -translate-x-1/2 rounded-full border border-border bg-background/90 px-3.5 py-1.5 text-[10px] text-muted-foreground backdrop-blur-sm">
                Visiting {ownerName}&apos;s room · WASD move · E sit
              </div>
            </div>
          </Motion.main>
        </>
      )}
    </section>
  )
}
