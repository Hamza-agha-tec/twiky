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

type PixelRoomCanvasProps = {
  state: PixelRoomState
  playerName: string
  selectedObjectId: string | null
  onSelectObject: (id: string | null) => void
  onMoveObject: (id: string, x: number, y: number) => void
  onMoveAvatar: (dx: number, dy: number) => void
  onToggleSit: () => void
  captureRef?: React.MutableRefObject<(() => string | null) | null>
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
}: PixelRoomCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const hitRectsRef = useRef<HitRect[]>([])
  const dragObjectIdRef = useRef<string | null>(null)
  const lastMoveAtRef = useRef(0)
  const pressedKeysRef = useRef(new Set<string>())
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
        const labelWidth = ctx.measureText(label).width + 16
        ctx.fillStyle = 'rgba(6, 9, 16, 0.9)'
        ctx.strokeStyle = 'rgba(30, 58, 95, 0.9)'
        ctx.lineWidth = 1
        const labelTop = state.isSitting ? p.y - 60 : p.y - 68
        ctx.beginPath()
        ctx.roundRect(p.x - labelWidth / 2, labelTop, labelWidth, 22, 11)
        ctx.fill()
        ctx.stroke()
        ctx.fillStyle = '#e2e8f0'
        ctx.textAlign = 'center'
        ctx.fillText(label, p.x, labelTop + 15)
        ctx.textAlign = 'start'
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
        ctx.drawImage(image, left, top, asset.width, asset.height)
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
  }, [assetMap, images, playerName, selectedObjectId, state])

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
