'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  createDefaultRoomState,
  DEFAULT_AVATAR_ID,
  OBJECT_CATALOG,
  PIXEL_CATALOG,
  PixelDirection,
  PixelRoomState,
  PlacedRoomObject,
  ROOM_COLUMNS,
  ROOM_ROWS,
} from './game-data'

function storageKey(userId?: string | null) {
  return `twiky-pixel-room:${userId ?? 'guest'}`
}

function directionFromDelta(dx: number, dy: number): PixelDirection {
  if (dx < 0) return 'left'
  if (dx > 0) return 'right'
  if (dy < 0) return 'up'
  return 'down'
}

function isDirection(value: unknown): value is PixelDirection {
  return value === 'down' || value === 'left' || value === 'up' || value === 'right'
}

function normalizeState(value: unknown): PixelRoomState {
  const fallback = createDefaultRoomState()
  if (!value || typeof value !== 'object') return fallback

  const raw = value as Partial<PixelRoomState>
  const catalogIds = new Set(PIXEL_CATALOG.map((item) => item.id))
  const owned = Array.isArray(raw.ownedItemIds)
    ? raw.ownedItemIds.filter((id): id is string => typeof id === 'string' && catalogIds.has(id))
    : fallback.ownedItemIds
  const objects = Array.isArray(raw.objects)
    ? raw.objects
        .filter((object): object is PlacedRoomObject =>
          Boolean(
            object &&
            typeof object.id === 'string' &&
            typeof object.itemId === 'string' &&
            catalogIds.has(object.itemId) &&
            Number.isFinite(object.x) &&
            Number.isFinite(object.y),
          ),
        )
        .map((object) => ({
          id: object.id,
          itemId: object.itemId,
          x: Math.max(0, Math.min(ROOM_COLUMNS - 1, Math.round(object.x))),
          y: Math.max(0, Math.min(ROOM_ROWS - 1, Math.round(object.y))),
          rotation: object.rotation ?? 0,
        }))
    : fallback.objects
  const sittingObjectId =
    typeof raw.sittingObjectId === 'string' && objects.some((object) => object.id === raw.sittingObjectId)
      ? raw.sittingObjectId
      : null

  return {
    avatarId: typeof raw.avatarId === 'string' && catalogIds.has(raw.avatarId) ? raw.avatarId : DEFAULT_AVATAR_ID,
    avatarX: Number.isFinite(raw.avatarX) ? Math.max(0, Math.min(ROOM_COLUMNS - 1, Number(raw.avatarX))) : fallback.avatarX,
    avatarY: Number.isFinite(raw.avatarY) ? Math.max(0, Math.min(ROOM_ROWS - 1, Number(raw.avatarY))) : fallback.avatarY,
    avatarDirection: isDirection(raw.avatarDirection) ? raw.avatarDirection : fallback.avatarDirection,
    isSitting: Boolean(raw.isSitting && sittingObjectId),
    sittingObjectId,
    objects,
    ownedItemIds: Array.from(new Set([...fallback.ownedItemIds, ...owned])),
  }
}

export function usePixelRoom(userId?: string | null) {
  const [state, setState] = useState<PixelRoomState>(() => createDefaultRoomState())
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return

    try {
      const raw = window.localStorage.getItem(storageKey(userId))
      setState(raw ? normalizeState(JSON.parse(raw)) : createDefaultRoomState())
      setSelectedObjectId(null)
    } catch {
      setState(createDefaultRoomState())
      setSelectedObjectId(null)
    }
  }, [userId])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const timeoutId = window.setTimeout(() => {
      window.localStorage.setItem(storageKey(userId), JSON.stringify(state))
    }, 250)

    return () => window.clearTimeout(timeoutId)
  }, [state, userId])

  const ownedItemIds = useMemo(() => new Set(state.ownedItemIds), [state.ownedItemIds])
  const inventoryObjects = useMemo(
    () => OBJECT_CATALOG.filter((item) => ownedItemIds.has(item.id)),
    [ownedItemIds],
  )

  const placeObject = useCallback((itemId: string) => {
    if (!ownedItemIds.has(itemId)) return

    const id = `${itemId}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    setState((prev) => ({
      ...prev,
      objects: [
        ...prev.objects,
        {
          id,
          itemId,
          x: Math.max(1, Math.min(ROOM_COLUMNS - 2, Math.round(prev.avatarX) + 1)),
          y: Math.max(1, Math.min(ROOM_ROWS - 2, Math.round(prev.avatarY))),
          rotation: 0,
        },
      ],
    }))
    setSelectedObjectId(id)
  }, [ownedItemIds])

  const moveAvatar = useCallback((dx: number, dy: number) => {
    setState((prev) => ({
      ...prev,
      avatarDirection: directionFromDelta(dx, dy),
      isSitting: false,
      sittingObjectId: null,
      avatarX: Math.max(1, Math.min(ROOM_COLUMNS - 2, prev.avatarX + dx)),
      avatarY: Math.max(1, Math.min(ROOM_ROWS - 2, prev.avatarY + dy)),
    }))
  }, [])

  const toggleSit = useCallback(() => {
    setState((prev) => {
      if (prev.isSitting) {
        return {
          ...prev,
          isSitting: false,
          sittingObjectId: null,
        }
      }

      const seat = prev.objects
        .map((object) => ({
          object,
          asset: OBJECT_CATALOG.find((item) => item.id === object.itemId),
          distance: Math.abs(object.x - prev.avatarX) + Math.abs(object.y - prev.avatarY),
        }))
        .filter((entry) => entry.asset?.canSit && entry.distance <= 1)
        .sort((a, b) => a.distance - b.distance)[0]

      if (!seat?.asset) return prev

      return {
        ...prev,
        avatarX: seat.object.x,
        avatarY: seat.object.y,
        avatarDirection: seat.asset.seatDirection ?? prev.avatarDirection,
        isSitting: true,
        sittingObjectId: seat.object.id,
      }
    })
  }, [])

  const moveObject = useCallback((objectId: string, x: number, y: number) => {
    const nextX = Math.max(0, Math.min(ROOM_COLUMNS - 1, Math.round(x)))
    const nextY = Math.max(0, Math.min(ROOM_ROWS - 1, Math.round(y)))

    setState((prev) => ({
      ...prev,
      avatarX: prev.sittingObjectId === objectId ? nextX : prev.avatarX,
      avatarY: prev.sittingObjectId === objectId ? nextY : prev.avatarY,
      objects: prev.objects.map((object) =>
        object.id === objectId
          ? {
              ...object,
              x: nextX,
              y: nextY,
            }
          : object,
      ),
    }))
  }, [])

  const rotateSelectedObject = useCallback(() => {
    if (!selectedObjectId) return
    setState((prev) => ({
      ...prev,
      objects: prev.objects.map((object) =>
        object.id === selectedObjectId
          ? { ...object, rotation: ((object.rotation + 1) % 4) as PlacedRoomObject['rotation'] }
          : object,
      ),
    }))
  }, [selectedObjectId])

  const deleteSelectedObject = useCallback(() => {
    if (!selectedObjectId) return
    setState((prev) => ({
      ...prev,
      isSitting: prev.sittingObjectId === selectedObjectId ? false : prev.isSitting,
      sittingObjectId: prev.sittingObjectId === selectedObjectId ? null : prev.sittingObjectId,
      objects: prev.objects.filter((object) => object.id !== selectedObjectId),
    }))
    setSelectedObjectId(null)
  }, [selectedObjectId])

  const resetRoom = useCallback(() => {
    setState((prev) => ({ ...createDefaultRoomState(), avatarId: prev.avatarId, ownedItemIds: prev.ownedItemIds }))
    setSelectedObjectId(null)
  }, [])

  return {
    state,
    inventoryObjects,
    selectedObjectId,
    setSelectedObjectId,
    placeObject,
    moveAvatar,
    toggleSit,
    moveObject,
    rotateSelectedObject,
    deleteSelectedObject,
    resetRoom,
  }
}
