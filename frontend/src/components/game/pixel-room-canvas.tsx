'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AVATAR_CATALOG,
  OBJECT_CATALOG,
  PixelDirection,
  PixelRoomState,
  ROOM_COLUMNS,
  ROOM_ROWS,
  TILE_HEIGHT,
  TILE_WIDTH,
} from './game-data'

type HitRect = {
  id: string
  left: number
  top: number
  right: number
  bottom: number
}

export type OtherParticipant = {
  userId: string
  username: string
  avatarId: string
  x: number
  y: number
  direction: PixelDirection
  isSitting: boolean
  micMuted?: boolean
  isSpeaking?: boolean
  chatBubble?: string | null
  chatBubbleAt?: number
  floatingEmoji?: string | null
  floatingEmojiAt?: number
  movedAt?: number
  spotifyTrack?: {
    name: string
    artist: string
    album_art?: string
    album?: string
    spotify_url?: string
    progress_ms?: number
    duration_ms?: number
  } | null
}

const SPOTIFY_PATH = typeof window !== 'undefined'
  ? new Path2D('M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z')
  : null

function drawSpotifyLogo(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number) {
  if (!SPOTIFY_PATH) return
  ctx.save()
  ctx.translate(cx - size / 2, cy - size / 2)
  ctx.scale(size / 24, size / 24)
  ctx.fillStyle = '#1DB954'
  ctx.fill(SPOTIFY_PATH)
  ctx.restore()
}

const artCache: Record<string, HTMLImageElement | 'loading'> = {}
function loadArt(src: string) {
  if (artCache[src]) return
  artCache[src] = 'loading'
  const img = new Image()
  img.crossOrigin = 'anonymous'
  img.onload = () => { artCache[src] = img }
  img.onerror = () => { delete artCache[src] }
  img.src = src
}

type PixelRoomCanvasProps = {
  state: PixelRoomState
  playerName: string
  selectedObjectId: string | null
  onSelectObject: (id: string | null) => void
  onMoveObject: (id: string, x: number, y: number) => void
  onMoveAvatar: (dx: number, dy: number) => void
  onToggleSit: () => void
  captureRef?: React.MutableRefObject<(() => string | null) | null>
  otherParticipants?: OtherParticipant[]
  localMicMuted?: boolean
  localIsSpeaking?: boolean
  localChatBubble?: string | null
  localChatBubbleAt?: number
  localFloatingEmoji?: string | null
  localFloatingEmojiAt?: number
}

function isFloorLayer(assetId: string) {
  return assetId.includes('rug')
}

function getObjectSort(itemId: string, x: number, y: number, asset?: { width: number; height: number }) {
  if (isFloorLayer(itemId)) return -100000 + y

  const area = asset ? asset.width * asset.height : TILE_WIDTH * TILE_HEIGHT
  return y * TILE_HEIGHT + x - area / 100000
}

const AVATAR_FRAMES: Record<PixelDirection, { idle: number; walk: number[] }> = {
  down: { idle: 0, walk: [1, 0, 2, 0] },
  left: { idle: 4, walk: [4, 5, 4] },
  up: { idle: 6, walk: [7, 6, 8, 6] },
  right: { idle: 9, walk: [10, 9, 11, 9] },
}

const WALK_SPEED_PX_PER_SECOND = 90

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = reject
    image.src = src
  })
}

function tileToScreen(x: number, y: number, originX: number, originY: number) {
  return {
    x: originX + x * TILE_WIDTH,
    y: originY + y * TILE_HEIGHT,
  }
}

function screenToTile(x: number, y: number, originX: number, originY: number) {
  return {
    x: Math.max(0, Math.min(ROOM_COLUMNS - 1, Math.floor((x - originX) / TILE_WIDTH))),
    y: Math.max(0, Math.min(ROOM_ROWS - 1, Math.floor((y - originY) / TILE_HEIGHT))),
  }
}

export function PixelRoomCanvas({
  state,
  playerName,
  selectedObjectId,
  onSelectObject,
  onMoveObject,
  onMoveAvatar,
  onToggleSit,
  captureRef,
  otherParticipants = [],
  localMicMuted = false,
  localIsSpeaking = false,
  localChatBubble = null,
  localChatBubbleAt = 0,
  localFloatingEmoji = null,
  localFloatingEmojiAt = 0,
}: PixelRoomCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const hitRectsRef = useRef<HitRect[]>([])
  const dragObjectIdRef = useRef<string | null>(null)
  const lastMoveAtRef = useRef(0)
  const pressedKeysRef = useRef(new Set<string>())
  const interpRef = useRef<Record<string, { rx: number; ry: number }>>({})
  const prevFrameTimeRef = useRef(0)
  const spotifyBubblesRef = useRef<Array<{ bx: number; by: number; bw: number; bh: number; track: NonNullable<OtherParticipant['spotifyTrack']> }>>([])
  const mousePosRef = useRef<{ x: number; y: number } | null>(null)
  const [images, setImages] = useState<Record<string, HTMLImageElement>>({})

  const assetMap = useMemo(() => {
    const entries = [...AVATAR_CATALOG, ...OBJECT_CATALOG].map((item) => [item.id, item] as const)
    return new Map(entries)
  }, [])

  useEffect(() => {
    if (!captureRef) return

    captureRef.current = () => {
      const canvas = canvasRef.current
      if (!canvas) return null

      try {
        return canvas.toDataURL('image/png')
      } catch {
        return null
      }
    }

    return () => {
      captureRef.current = null
    }
  }, [captureRef])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const onMove = (e: MouseEvent) => {
      const r = canvas.getBoundingClientRect()
      mousePosRef.current = { x: e.clientX - r.left, y: e.clientY - r.top }
      canvas.style.cursor = spotifyBubblesRef.current.some(b =>
        e.clientX - r.left >= b.bx && e.clientX - r.left <= b.bx + b.bw &&
        e.clientY - r.top >= b.by && e.clientY - r.top <= b.by + b.bh
      ) ? 'pointer' : ''
    }
    const onLeave = () => { mousePosRef.current = null; canvas.style.cursor = '' }
    canvas.addEventListener('mousemove', onMove)
    canvas.addEventListener('mouseleave', onLeave)
    return () => {
      canvas.removeEventListener('mousemove', onMove)
      canvas.removeEventListener('mouseleave', onLeave)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    const allAssets = [...AVATAR_CATALOG, ...OBJECT_CATALOG]

    void Promise.all(
      allAssets.map(async (asset) => {
        const image = await loadImage(asset.src)
        return [asset.id, image] as const
      }),
    ).then((loaded) => {
      if (!cancelled) setImages(Object.fromEntries(loaded))
    })

    return () => {
      cancelled = true
    }
  }, [])

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const dpr = window.devicePixelRatio || 1
    const width = Math.max(320, Math.floor(rect.width))
    const height = Math.max(240, Math.floor(rect.height))
    const targetWidth = width * dpr
    const targetHeight = height * dpr
    if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
      canvas.width = targetWidth
      canvas.height = targetHeight
    }

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const now = performance.now()
    const wallNow = Date.now()

    // Per-frame dt for smooth interpolation
    const dt = prevFrameTimeRef.current > 0 ? Math.min(0.1, (now - prevFrameTimeRef.current) / 1000) : 0
    prevFrameTimeRef.current = now

    // Lerp other participants toward their target tile at 12 tiles/sec
    const ip = interpRef.current
    const activeIds = new Set(otherParticipants.map(p => p.userId))
    for (const id of Object.keys(ip)) { if (!activeIds.has(id)) delete ip[id] }
    for (const op of otherParticipants) {
      if (!ip[op.userId]) {
        ip[op.userId] = { rx: op.x, ry: op.y }
      } else {
        const ipos = ip[op.userId]
        const tdx = op.x - ipos.rx
        const tdy = op.y - ipos.ry
        const dist = Math.sqrt(tdx * tdx + tdy * tdy)
        if (dist > 5) { ipos.rx = op.x; ipos.ry = op.y }
        else if (dist > 0.01) {
          const step = Math.min(dist, (WALK_SPEED_PX_PER_SECOND / TILE_WIDTH) * dt)
          ipos.rx += (tdx / dist) * step
          ipos.ry += (tdy / dist) * step
        }
      }
    }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.imageSmoothingEnabled = false
    ctx.clearRect(0, 0, width, height)

    const worldWidth = ROOM_COLUMNS * TILE_WIDTH
    const worldHeight = ROOM_ROWS * TILE_HEIGHT
    const originX = Math.floor((width - worldWidth) / 2)
    const originY = Math.floor((height - worldHeight) / 2)
    const hitRects: HitRect[] = []

    ctx.fillStyle = '#060910'
    ctx.fillRect(0, 0, width, height)

    for (let y = 0; y < ROOM_ROWS; y += 1) {
      for (let x = 0; x < ROOM_COLUMNS; x += 1) {
        const p = tileToScreen(x, y, originX, originY)
        const isWall = y === 0 || y === ROOM_ROWS - 1 || x === 0 || x === ROOM_COLUMNS - 1

        if (isWall) {
          ctx.fillStyle = '#3b2d22'
          ctx.fillRect(p.x, p.y, TILE_WIDTH, TILE_HEIGHT)
          ctx.fillStyle = '#58412f'
          ctx.fillRect(p.x, p.y, TILE_WIDTH, 6)
          ctx.fillStyle = '#231910'
          ctx.fillRect(p.x, p.y, TILE_WIDTH, 2)
        } else {
          const floor = ['#c9b998', '#c1b18d', '#caba9e', '#bba985'][(x + y) % 4]
          ctx.fillStyle = floor
          ctx.fillRect(p.x, p.y, TILE_WIDTH, TILE_HEIGHT)
          ctx.strokeStyle = 'rgba(0, 0, 0, 0.08)'
          ctx.lineWidth = 1
          ctx.strokeRect(p.x + 0.5, p.y + 0.5, TILE_WIDTH - 1, TILE_HEIGHT - 1)
        }
      }
    }

    ctx.fillStyle = 'rgba(99, 102, 241, 0.13)'
    ctx.fillRect(originX + TILE_WIDTH, originY + 6 * TILE_HEIGHT, 8 * TILE_WIDTH, 8 * TILE_HEIGHT)
    ctx.strokeStyle = 'rgba(99, 102, 241, 0.4)'
    ctx.lineWidth = 2
    ctx.strokeRect(originX + TILE_WIDTH + 2, originY + 6 * TILE_HEIGHT + 2, 8 * TILE_WIDTH - 4, 8 * TILE_HEIGHT - 4)

    ctx.fillStyle = 'rgba(15, 118, 110, 0.12)'
    ctx.fillRect(originX + 13 * TILE_WIDTH, originY + TILE_HEIGHT, 6 * TILE_WIDTH, 8 * TILE_HEIGHT)
    ctx.strokeStyle = 'rgba(15, 118, 110, 0.38)'
    ctx.strokeRect(originX + 13 * TILE_WIDTH + 2, originY + TILE_HEIGHT + 2, 6 * TILE_WIDTH - 4, 8 * TILE_HEIGHT - 4)

    ctx.fillStyle = 'rgba(124, 58, 237, 0.1)'
    ctx.fillRect(originX + 8 * TILE_WIDTH, originY + 10 * TILE_HEIGHT, 11 * TILE_WIDTH, 7 * TILE_HEIGHT)
    ctx.strokeStyle = 'rgba(124, 58, 237, 0.32)'
    ctx.strokeRect(originX + 8 * TILE_WIDTH + 2, originY + 10 * TILE_HEIGHT + 2, 11 * TILE_WIDTH - 4, 7 * TILE_HEIGHT - 4)

    ctx.strokeStyle = 'rgba(59, 130, 246, 0.4)'
    ctx.lineWidth = 3
    ctx.strokeRect(originX + 1.5, originY + 1.5, worldWidth - 3, worldHeight - 3)
    ctx.strokeStyle = 'rgba(147, 197, 253, 0.14)'
    ctx.lineWidth = 1
    ctx.strokeRect(originX + 3.5, originY + 3.5, worldWidth - 7, worldHeight - 7)

    const visualAvatar = { x: state.avatarX, y: state.avatarY }
    const drawables = [
      ...state.objects.map((object) => {
        const asset = assetMap.get(object.itemId)
        return { kind: 'object' as const, sort: getObjectSort(object.itemId, object.x, object.y, asset), object }
      }),
      { kind: 'avatar' as const, sort: visualAvatar.y * TILE_HEIGHT + visualAvatar.x + 0.1 },
      ...otherParticipants.map((p) => {
        const ipos = ip[p.userId] ?? { rx: p.x, ry: p.y }
        return { kind: 'other' as const, sort: ipos.ry * TILE_HEIGHT + ipos.rx + 0.05, participant: p }
      }),
    ].sort((a, b) => a.sort - b.sort)

    for (const drawable of drawables) {
      if (drawable.kind === 'avatar') {
        const avatarAsset = assetMap.get(state.avatarId)
        const image = images[state.avatarId]
        const tile = tileToScreen(visualAvatar.x, visualAvatar.y, originX, originY)
        const p = { x: tile.x + TILE_WIDTH / 2, y: tile.y + TILE_HEIGHT - 4 }

        ctx.fillStyle = 'rgba(2, 6, 23, 0.48)'
        ctx.beginPath()
        ctx.ellipse(p.x, p.y + 2, state.isSitting ? 12 : 15, state.isSitting ? 4 : 5, 0, 0, Math.PI * 2)
        ctx.fill()

        if (avatarAsset && image) {
          const sourceSize = image.naturalHeight >= 32 ? 32 : image.naturalHeight
          const directionFrames = AVATAR_FRAMES[state.avatarDirection] ?? AVATAR_FRAMES.down
          const frameTick = Math.floor(now / 120)
          const isWalking = !state.isSitting && now - lastMoveAtRef.current < 260
          const frame = isWalking
            ? directionFrames.walk[frameTick % directionFrames.walk.length]
            : directionFrames.idle
          const availableFrames = Math.max(1, Math.floor(image.naturalWidth / sourceSize))
          const sourceX = Math.min(frame, availableFrames - 1) * sourceSize
          const avatarTop = state.isSitting ? p.y - 42 : p.y - 50
          ctx.drawImage(image, sourceX, 0, sourceSize, sourceSize, p.x - 24, avatarTop, 48, 48)
        } else {
          ctx.fillStyle = '#38bdf8'
          ctx.beginPath()
          ctx.arc(p.x, p.y - 32, 18, 0, Math.PI * 2)
          ctx.fill()
        }

        ctx.font = '600 11px Segoe UI, sans-serif'
        const label = playerName || 'You'
        const labelTextWidth = ctx.measureText(label).width
        const micPad = 14
        const labelWidth = labelTextWidth + 16 + micPad
        const labelTop = state.isSitting ? p.y - 60 : p.y - 68
        ctx.fillStyle = 'rgba(6, 9, 16, 0.9)'
        ctx.strokeStyle = localIsSpeaking ? 'rgba(34, 197, 94, 0.7)' : 'rgba(30, 58, 95, 0.9)'
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.roundRect(p.x - labelWidth / 2, labelTop, labelWidth, 22, 11)
        ctx.fill()
        ctx.stroke()
        ctx.fillStyle = '#e2e8f0'
        ctx.textAlign = 'center'
        ctx.fillText(label, p.x - micPad / 2, labelTop + 15)
        ctx.textAlign = 'start'

        // Mic status dot
        const micDotX = p.x + (labelTextWidth + 16) / 2
        const micDotY = labelTop + 11
        ctx.fillStyle = localMicMuted ? '#ef4444' : localIsSpeaking ? '#22c55e' : '#64748b'
        ctx.beginPath()
        ctx.arc(micDotX, micDotY, 3.5, 0, Math.PI * 2)
        ctx.fill()
        if (localMicMuted) {
          ctx.strokeStyle = '#ef4444'
          ctx.lineWidth = 1
          ctx.beginPath()
          ctx.moveTo(micDotX - 3, micDotY - 3)
          ctx.lineTo(micDotX + 3, micDotY + 3)
          ctx.stroke()
        }

        // Chat bubble
        if (localChatBubble && localChatBubbleAt && wallNow - localChatBubbleAt < 4000) {
          const elapsed = wallNow - localChatBubbleAt
          const alpha = elapsed > 3000 ? Math.max(0, 1 - (elapsed - 3000) / 1000) : 1
          ctx.font = '500 10px Segoe UI, sans-serif'
          const tw = Math.min(ctx.measureText(localChatBubble).width, 120)
          const bw = tw + 14; const bh = 18
          const bx = p.x - bw / 2; const by = labelTop - bh - 6
          ctx.globalAlpha = alpha
          ctx.fillStyle = '#f1f5f9'
          ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, 5); ctx.fill()
          ctx.beginPath()
          ctx.moveTo(p.x - 4, by + bh); ctx.lineTo(p.x, by + bh + 5); ctx.lineTo(p.x + 4, by + bh)
          ctx.closePath(); ctx.fill()
          ctx.fillStyle = '#1e293b'; ctx.textAlign = 'center'
          ctx.fillText(localChatBubble, p.x, by + 12, 120)
          ctx.textAlign = 'start'; ctx.globalAlpha = 1
          ctx.font = '600 11px Segoe UI, sans-serif'
        }

        // Floating emoji
        if (localFloatingEmoji && localFloatingEmojiAt && wallNow - localFloatingEmojiAt < 2000) {
          const progress = (wallNow - localFloatingEmojiAt) / 2000
          ctx.globalAlpha = 1 - progress
          ctx.font = '20px sans-serif'; ctx.textAlign = 'center'
          ctx.fillText(localFloatingEmoji, p.x, labelTop - 12 - progress * 40)
          ctx.textAlign = 'start'; ctx.globalAlpha = 1
          ctx.font = '600 11px Segoe UI, sans-serif'
        }

        continue
      }

      if (drawable.kind === 'other') {
        const op = drawable.participant
        const avatarAsset = assetMap.get(op.avatarId)
        const image = images[op.avatarId]
        const ipos = ip[op.userId] ?? { rx: op.x, ry: op.y }
        const tile = tileToScreen(ipos.rx, ipos.ry, originX, originY)
        const p = { x: tile.x + TILE_WIDTH / 2, y: tile.y + TILE_HEIGHT - 4 }
        const proximityDist = Math.sqrt((ipos.rx - state.avatarX) ** 2 + (ipos.ry - state.avatarY) ** 2)
        const inProximity = proximityDist <= 8

        ctx.fillStyle = 'rgba(2, 6, 23, 0.38)'
        ctx.beginPath()
        ctx.ellipse(p.x, p.y + 2, op.isSitting ? 12 : 15, op.isSitting ? 4 : 5, 0, 0, Math.PI * 2)
        ctx.fill()

        if (avatarAsset && image) {
          const sourceSize = image.naturalHeight >= 32 ? 32 : image.naturalHeight
          const directionFrames = AVATAR_FRAMES[op.direction] ?? AVATAR_FRAMES.down
          const frameTick = Math.floor(now / 120)
          const idist = Math.abs(ipos.rx - op.x) + Math.abs(ipos.ry - op.y)
          const isWalking = !op.isSitting && (idist > 0.02 || (op.movedAt !== undefined && now - op.movedAt < 350))
          const frame = isWalking
            ? directionFrames.walk[frameTick % directionFrames.walk.length]
            : directionFrames.idle
          const availableFrames = Math.max(1, Math.floor(image.naturalWidth / sourceSize))
          const sourceX = Math.min(frame, availableFrames - 1) * sourceSize
          const avatarTop = op.isSitting ? p.y - 42 : p.y - 50
          ctx.drawImage(image, sourceX, 0, sourceSize, sourceSize, p.x - 24, avatarTop, 48, 48)
        } else {
          ctx.fillStyle = '#f59e0b'
          ctx.beginPath()
          ctx.arc(p.x, p.y - 32, 18, 0, Math.PI * 2)
          ctx.fill()
        }

        ctx.font = '600 11px Segoe UI, sans-serif'
        const otherLabel = op.username || 'Visitor'
        const otherTextWidth = ctx.measureText(otherLabel).width
        const otherMicPad = 14
        const otherLabelWidth = otherTextWidth + 16 + otherMicPad
        const otherLabelTop = op.isSitting ? p.y - 60 : p.y - 68
        ctx.fillStyle = 'rgba(6, 9, 16, 0.75)'
        ctx.strokeStyle = op.isSpeaking && inProximity ? 'rgba(34, 197, 94, 0.7)' : 'rgba(30, 58, 95, 0.7)'
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.roundRect(p.x - otherLabelWidth / 2, otherLabelTop, otherLabelWidth, 22, 11)
        ctx.fill()
        ctx.stroke()
        ctx.fillStyle = '#cbd5e1'
        ctx.textAlign = 'center'
        ctx.fillText(otherLabel, p.x - otherMicPad / 2, otherLabelTop + 15)
        ctx.textAlign = 'start'

        // Mic status dot
        const otherMicDotX = p.x + (otherTextWidth + 16) / 2
        const otherMicDotY = otherLabelTop + 11
        ctx.fillStyle = op.micMuted ? '#ef4444' : op.isSpeaking ? '#22c55e' : '#64748b'
        ctx.beginPath()
        ctx.arc(otherMicDotX, otherMicDotY, 3.5, 0, Math.PI * 2)
        ctx.fill()
        if (op.micMuted) {
          ctx.strokeStyle = '#ef4444'
          ctx.lineWidth = 1
          ctx.beginPath()
          ctx.moveTo(otherMicDotX - 3, otherMicDotY - 3)
          ctx.lineTo(otherMicDotX + 3, otherMicDotY + 3)
          ctx.stroke()
        }

        // Chat bubble — proximity only
        if (op.chatBubble && op.chatBubbleAt && wallNow - op.chatBubbleAt < 4000 && inProximity) {
          const elapsed = wallNow - op.chatBubbleAt
          const alpha = elapsed > 3000 ? Math.max(0, 1 - (elapsed - 3000) / 1000) : 1
          ctx.font = '500 10px Segoe UI, sans-serif'
          const tw = Math.min(ctx.measureText(op.chatBubble).width, 120)
          const bw = tw + 14; const bh = 18
          const bx = p.x - bw / 2; const by = otherLabelTop - bh - 6
          ctx.globalAlpha = alpha
          ctx.fillStyle = '#f1f5f9'
          ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, 5); ctx.fill()
          ctx.beginPath()
          ctx.moveTo(p.x - 4, by + bh); ctx.lineTo(p.x, by + bh + 5); ctx.lineTo(p.x + 4, by + bh)
          ctx.closePath(); ctx.fill()
          ctx.fillStyle = '#1e293b'; ctx.textAlign = 'center'
          ctx.fillText(op.chatBubble, p.x, by + 12, 120)
          ctx.textAlign = 'start'; ctx.globalAlpha = 1
          ctx.font = '600 11px Segoe UI, sans-serif'
        }

        // Floating emoji — proximity only
        if (op.floatingEmoji && op.floatingEmojiAt && wallNow - op.floatingEmojiAt < 2000 && inProximity) {
          const progress = (wallNow - op.floatingEmojiAt) / 2000
          ctx.globalAlpha = 1 - progress
          ctx.font = '20px sans-serif'; ctx.textAlign = 'center'
          ctx.fillText(op.floatingEmoji, p.x, otherLabelTop - 12 - progress * 40)
          ctx.textAlign = 'start'; ctx.globalAlpha = 1
          ctx.font = '600 11px Segoe UI, sans-serif'
        }

        // Spotify bubble — glassy pill with real logo + wave bars
        if (op.spotifyTrack?.name) {
          const trackName = op.spotifyTrack.name.length > 17 ? op.spotifyTrack.name.slice(0, 16) + '…' : op.spotifyTrack.name
          ctx.font = '500 10px Segoe UI, sans-serif'
          const textW = ctx.measureText(trackName).width
          const logoSz = 13; const waveW = 16; const pad = 7; const gap = 5
          const bw = pad + logoSz + gap + textW + gap + waveW + pad
          const bh = 22
          const bx = p.x - bw / 2
          const by = otherLabelTop - bh - 6

          // glassy base
          ctx.fillStyle = 'rgba(8,8,12,0.82)'
          ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, 11); ctx.fill()
          // top sheen
          ctx.fillStyle = 'rgba(255,255,255,0.05)'
          ctx.beginPath(); ctx.roundRect(bx + 1, by + 1, bw - 2, bh * 0.45, [10, 10, 0, 0]); ctx.fill()
          // green border
          ctx.strokeStyle = 'rgba(29,185,84,0.5)'
          ctx.lineWidth = 1
          ctx.beginPath(); ctx.roundRect(bx, by, bw, bh, 11); ctx.stroke()

          // real Spotify logo
          drawSpotifyLogo(ctx, bx + pad + logoSz / 2, by + bh / 2, logoSz)

          // track name
          ctx.fillStyle = 'rgba(255,255,255,0.9)'
          ctx.textAlign = 'left'
          ctx.fillText(trackName, bx + pad + logoSz + gap, by + 14.5)

          // animated wave bars
          const waveX = bx + bw - pad - waveW + 1
          const waveY = by + bh / 2
          const barW = 2.5; const barGap = 1.2
          for (let i = 0; i < 4; i++) {
            const h = 3 + 6 * Math.abs(Math.sin(now / 190 + i * 1.1))
            ctx.fillStyle = '#1DB954'
            ctx.beginPath()
            ctx.roundRect(waveX + i * (barW + barGap), waveY - h / 2, barW, h, 1.2)
            ctx.fill()
          }

          ctx.textAlign = 'start'
          ctx.font = '600 11px Segoe UI, sans-serif'

          // register for hover detection
          spotifyBubblesRef.current.push({ bx, by, bw, bh, track: op.spotifyTrack })
        }

        continue
      }

      const object = drawable.object
      const asset = assetMap.get(object.itemId)
      const image = images[object.itemId]
      if (!asset) continue

      const tile = tileToScreen(object.x, object.y, originX, originY)
      const left = tile.x + TILE_WIDTH / 2 - asset.width / 2
      const top = tile.y + TILE_HEIGHT - asset.height
      const right = left + asset.width
      const bottom = top + asset.height

      if (image) {
        if (asset.frame) {
          const { sx, sy, sw, sh } = asset.frame
          ctx.drawImage(image, sx, sy, sw, sh, left, top, asset.width, asset.height)
        } else {
          ctx.drawImage(image, left, top, asset.width, asset.height)
        }
      } else {
        ctx.fillStyle = '#1e293b'
        ctx.fillRect(left, top, asset.width, asset.height)
      }

      if (object.id === selectedObjectId) {
        ctx.strokeStyle = '#3b82f6'
        ctx.lineWidth = 2
        ctx.setLineDash([4, 3])
        ctx.strokeRect(left - 4, top - 4, asset.width + 8, asset.height + 8)
        ctx.setLineDash([])
      }

      hitRects.push({ id: object.id, left, top, right, bottom })
    }

    hitRectsRef.current = hitRects

    // Draw hover card for hovered Spotify bubble
    const mouse = mousePosRef.current
    const hovered = mouse ? spotifyBubblesRef.current.find(b =>
      mouse.x >= b.bx && mouse.x <= b.bx + b.bw &&
      mouse.y >= b.by && mouse.y <= b.by + b.bh
    ) : null

    // Reset for next frame after checking
    spotifyBubblesRef.current = []

    if (hovered) {
      const t = hovered.track
      if (t.album_art) loadArt(t.album_art)
      const artSize = 52
      const cardPad = 10
      const cardW = 192
      const cardH = artSize + cardPad * 2
      let cardX = hovered.bx + hovered.bw / 2 - cardW / 2
      let cardY = hovered.by - cardH - 10
      cardX = Math.max(4, Math.min(width - cardW - 4, cardX))
      if (cardY < 4) cardY = hovered.by + hovered.bh + 10

      // shadow
      ctx.shadowColor = 'rgba(0,0,0,0.55)'
      ctx.shadowBlur = 20
      ctx.fillStyle = 'rgba(10,10,14,0.94)'
      ctx.beginPath(); ctx.roundRect(cardX, cardY, cardW, cardH, 14); ctx.fill()
      ctx.shadowBlur = 0

      // border
      ctx.strokeStyle = 'rgba(29,185,84,0.45)'
      ctx.lineWidth = 1
      ctx.beginPath(); ctx.roundRect(cardX, cardY, cardW, cardH, 14); ctx.stroke()

      // top sheen
      ctx.fillStyle = 'rgba(255,255,255,0.045)'
      ctx.beginPath(); ctx.roundRect(cardX + 1, cardY + 1, cardW - 2, cardH * 0.4, [13, 13, 0, 0]); ctx.fill()

      // album art
      const artX = cardX + cardPad; const artY = cardY + cardPad
      const artImg = t.album_art ? artCache[t.album_art] : null
      if (artImg && artImg !== ('loading' as any)) {
        ctx.save()
        ctx.beginPath(); ctx.roundRect(artX, artY, artSize, artSize, 8); ctx.clip()
        ctx.drawImage(artImg as HTMLImageElement, artX, artY, artSize, artSize)
        ctx.restore()
      } else {
        ctx.fillStyle = 'rgba(29,185,84,0.15)'
        ctx.beginPath(); ctx.roundRect(artX, artY, artSize, artSize, 8); ctx.fill()
        ctx.font = '22px sans-serif'; ctx.textAlign = 'center'
        ctx.fillStyle = 'rgba(29,185,84,0.5)'
        ctx.fillText('♫', artX + artSize / 2, artY + artSize / 2 + 8)
        ctx.textAlign = 'start'
      }

      // text area
      const tx = artX + artSize + 10
      const maxTW = cardW - artSize - cardPad * 3 - artSize * 0 - 28

      ctx.font = '700 9px Segoe UI, sans-serif'
      ctx.fillStyle = '#1DB954'
      ctx.letterSpacing = '0.5px'
      ctx.fillText('NOW PLAYING', tx, artY + 11)
      ctx.letterSpacing = '0px'

      ctx.font = '600 12px Segoe UI, sans-serif'
      ctx.fillStyle = 'rgba(255,255,255,0.95)'
      const tn = t.name.length > 16 ? t.name.slice(0, 15) + '…' : t.name
      ctx.fillText(tn, tx, artY + 27)

      ctx.font = '500 10.5px Segoe UI, sans-serif'
      ctx.fillStyle = 'rgba(255,255,255,0.48)'
      const ar = (t.artist || '').length > 16 ? t.artist!.slice(0, 15) + '…' : (t.artist || '')
      ctx.fillText(ar, tx, artY + 42)

      // Spotify logo bottom-right
      drawSpotifyLogo(ctx, cardX + cardW - 14, cardY + cardH - 13, 14)

      // progress bar
      if (t.progress_ms != null && t.duration_ms && t.duration_ms > 0) {
        const pct = Math.min(1, t.progress_ms / t.duration_ms)
        const barX = tx; const barY = artY + 52; const barW = maxTW + 10
        ctx.fillStyle = 'rgba(255,255,255,0.12)'
        ctx.beginPath(); ctx.roundRect(barX, barY, barW, 3, 1.5); ctx.fill()
        ctx.fillStyle = '#1DB954'
        ctx.beginPath(); ctx.roundRect(barX, barY, barW * pct, 3, 1.5); ctx.fill()
      }
    } else {
      spotifyBubblesRef.current = []
    }
  }, [assetMap, images, localChatBubble, localChatBubbleAt, localFloatingEmoji, localFloatingEmojiAt, localIsSpeaking, localMicMuted, otherParticipants, playerName, selectedObjectId, state])

  useEffect(() => {
    let frameId = 0
    const drawFrame = () => {
      draw()
      frameId = window.requestAnimationFrame(drawFrame)
    }
    drawFrame()

    const onResize = () => draw()
    window.addEventListener('resize', onResize)
    return () => {
      window.cancelAnimationFrame(frameId)
      window.removeEventListener('resize', onResize)
    }
  }, [draw])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return
      const key = event.key.toLowerCase()
      if (key === 'e') {
        event.preventDefault()
        if (!event.repeat) onToggleSit()
        return
      }

      if (!['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'w', 'a', 's', 'd'].includes(key)) return
      event.preventDefault()
      pressedKeysRef.current.add(key)
    }

    const onKeyUp = (event: KeyboardEvent) => {
      pressedKeysRef.current.delete(event.key.toLowerCase())
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [onToggleSit])

  useEffect(() => {
    let frameId = 0
    let previous = performance.now()

    const step = (now: number) => {
      const dt = Math.min(0.05, (now - previous) / 1000)
      previous = now

      const keys = pressedKeysRef.current
      let dx = 0
      let dy = 0
      if (keys.has('a') || keys.has('arrowleft')) dx -= 1
      if (keys.has('d') || keys.has('arrowright')) dx += 1
      if (keys.has('w') || keys.has('arrowup')) dy -= 1
      if (keys.has('s') || keys.has('arrowdown')) dy += 1

      if ((dx !== 0 || dy !== 0) && !state.isSitting) {
        if (dx !== 0 && dy !== 0) {
          const diagonal = Math.SQRT1_2
          dx *= diagonal
          dy *= diagonal
        }
        lastMoveAtRef.current = now
        onMoveAvatar((dx * WALK_SPEED_PX_PER_SECOND * dt) / TILE_WIDTH, (dy * WALK_SPEED_PX_PER_SECOND * dt) / TILE_HEIGHT)
      }

      frameId = window.requestAnimationFrame(step)
    }

    frameId = window.requestAnimationFrame(step)
    return () => window.cancelAnimationFrame(frameId)
  }, [onMoveAvatar, state.isSitting])

  const getCanvasPoint = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = event.currentTarget
    const rect = canvas.getBoundingClientRect()
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
      width: rect.width,
      height: rect.height,
    }
  }

  return (
    <canvas
      ref={canvasRef}
      className="h-full w-full touch-none rounded-none outline-none [image-rendering:pixelated]"
      onPointerDown={(event) => {
        const point = getCanvasPoint(event)
        const hit = [...hitRectsRef.current]
          .reverse()
          .find((rect) => point.x >= rect.left && point.x <= rect.right && point.y >= rect.top && point.y <= rect.bottom)
        onSelectObject(hit?.id ?? null)
        dragObjectIdRef.current = hit?.id ?? null
        if (hit) event.currentTarget.setPointerCapture(event.pointerId)
      }}
      onPointerMove={(event) => {
        const objectId = dragObjectIdRef.current
        if (!objectId) return
        const point = getCanvasPoint(event)
        const originX = Math.floor((point.width - ROOM_COLUMNS * TILE_WIDTH) / 2)
        const originY = Math.floor((point.height - ROOM_ROWS * TILE_HEIGHT) / 2)
        const tile = screenToTile(point.x, point.y, originX, originY)
        onMoveObject(objectId, tile.x, tile.y)
      }}
      onPointerUp={(event) => {
        dragObjectIdRef.current = null
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId)
        }
      }}
      onPointerCancel={() => {
        dragObjectIdRef.current = null
      }}
    />
  )
}
