'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowLeft, ChevronLeft, ChevronRight, Edit3, Maximize2, MessageCircle,
  Mic, MicOff, Minimize2, PackagePlus, RotateCw, Save, Search, Smile,
  Trash2, Users, X,
} from 'lucide-react'
import { motion as Motion } from 'framer-motion'
import { toast } from 'sonner'

import { PixelRoomCanvas, type OtherParticipant } from './pixel-room-canvas'
import {
  createDefaultRoomState,
  DEFAULT_AVATAR_ID,
  OBJECT_CATALOG,
  type PixelCatalogItem,
  type PixelDirection,
  type PixelRoomState,
  type PlacedRoomObject,
  ROOM_COLUMNS,
  ROOM_ROWS,
} from './game-data'
import { fetchGroupPixelRoom, saveGroupPixelRoom, fetchMyRoom } from '@/lib/rooms-api'
import { useProfile } from '@/hooks/use-user'
import { getSocket } from '@/lib/socket'
import { cn } from '@/lib/utils'
import type { MockChannelGroup } from '@/components/chat/channels-panel'
import { useSpotifyNowPlaying } from '@/hooks/use-spotify'
import { usePixelRoomVoice } from '@/hooks/use-pixel-room-voice'

const EMOJI_LIST = ['👍', '❤️', '😂', '😮', '😢', '😡', '🎉', '👋', '🔥', '💯', '🙌', '😎']
const EDIT_PAGE_SIZE = 6

function emojiAppleUrl(emoji: string): string {
  const codes = [...emoji].map(c => c.codePointAt(0)!.toString(16)).join('-')
  return `https://cdn.jsdelivr.net/npm/emoji-datasource-apple/img/apple/64/${codes}.png`
}

function ItemThumb({ item, size = 26 }: { item: PixelCatalogItem; size?: number }) {
  if (item.frame) {
    const { sx, sy, sw, sh, sheetW, sheetH } = item.frame
    const scale = size / Math.max(sw, sh)
    return (
      <div
        style={{
          width: size, height: size, flexShrink: 0,
          backgroundImage: `url(${item.src})`,
          backgroundPosition: `-${sx * scale}px -${sy * scale}px`,
          backgroundSize: `${sheetW * scale}px ${sheetH * scale}px`,
          backgroundRepeat: 'no-repeat',
          imageRendering: 'pixelated',
        }}
      />
    )
  }
  return (
    <img
      src={item.src}
      alt=""
      width={size}
      height={size}
      style={{ objectFit: 'contain', imageRendering: 'pixelated', flexShrink: 0 }}
    />
  )
}

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

interface Props {
  group: MockChannelGroup
  channelId: string
  myId?: string
  isChannelAdmin?: boolean
}

export function PixelRoomGroupView({ group, channelId, myId, isChannelAdmin = false }: Props) {
  const router = useRouter()
  const { data: currentUser } = useProfile()
  const { data: nowPlaying } = useSpotifyNowPlaying(currentUser?.id)

  const [ownerObjects, setOwnerObjects] = useState<PixelRoomState['objects']>([])

  const [visitor, setVisitor] = useState<VisitorMotion>(defaultMotion)
  const [others, setOthers] = useState<OtherParticipant[]>([])
  const [participantCount, setParticipantCount] = useState(1)
  const [micMuted, setMicMuted] = useState(false)
  const [localChatBubble, setLocalChatBubble] = useState<string | null>(null)
  const [localChatBubbleAt, setLocalChatBubbleAt] = useState(0)
  const [localFloatingEmoji, setLocalFloatingEmoji] = useState<string | null>(null)
  const [localFloatingEmojiAt, setLocalFloatingEmojiAt] = useState(0)
  const [chatInputOpen, setChatInputOpen] = useState(false)
  const [chatInput, setChatInput] = useState('')
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const sectionRef = useRef<HTMLElement | null>(null)

  // Edit mode state
  const [isEditMode, setIsEditMode] = useState(false)
  const [editObjects, setEditObjects] = useState<PlacedRoomObject[]>([])
  const [selectedEditObjectId, setSelectedEditObjectId] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [editSearch, setEditSearch] = useState('')
  const [editPage, setEditPage] = useState(0)

  const joinedRef = useRef(false)
  const visitorRef = useRef<VisitorMotion>(defaultMotion())
  const lastEmitRef = useRef(0)
  const micMutedRef = useRef(false)
  const liveGroupIdRef = useRef(group.id)
  liveGroupIdRef.current = group.id
  visitorRef.current = visitor

  const { isSpeaking, remoteSpeakingIds, updateParticipantPosition, resumeAudio } = usePixelRoomVoice(
    group.id,
    currentUser?.id ?? null,
    micMuted,
    visitor.avatarX,
    visitor.avatarY,
  )

  // Sync LiveKit speaking state into others array
  useEffect(() => {
    setOthers(prev => prev.map(p => ({ ...p, isSpeaking: remoteSpeakingIds.has(p.userId) })))
  }, [remoteSpeakingIds])

  // Resume AudioContext on every user gesture until it's running
  useEffect(() => {
    window.addEventListener('pointerdown', resumeAudio)
    window.addEventListener('keydown', resumeAudio)
    return () => {
      window.removeEventListener('pointerdown', resumeAudio)
      window.removeEventListener('keydown', resumeAudio)
    }
  }, [resumeAudio])

  // Broadcast own Spotify track to pixel room on change
  useEffect(() => {
    if (!currentUser || !joinedRef.current) return
    getSocket().then(socket => {
      socket.emit('pixel-room:spotify-update', {
        groupId: group.id,
        track: nowPlaying?.is_playing && nowPlaying.track ? nowPlaying.track : null,
      })
    })
  }, [nowPlaying, currentUser, group.id])

  // Fetch group room objects
  useEffect(() => {
    let cancelled = false
    fetchGroupPixelRoom<PixelRoomState>(group.id)
      .then((res) => {
        if (cancelled) return
        const merged = { ...createDefaultRoomState(), ...(res.state ?? {}) }
        setOwnerObjects(merged.objects)
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [group.id])


  // Socket presence + events
  useEffect(() => {
    if (!currentUser || joinedRef.current) return
    joinedRef.current = true

    let mounted = true
    let cleanup: (() => void) | null = null

    Promise.all([
      fetchMyRoom<PixelRoomState>().catch(() => null),
      getSocket(),
    ]).then(([roomData, socket]) => {
      if (!mounted) return

      const myAvatarId = roomData?.state?.avatarId ?? DEFAULT_AVATAR_ID
      setVisitor(prev => ({ ...prev, avatarId: myAvatarId }))
      visitorRef.current = { ...visitorRef.current, avatarId: myAvatarId }

      const onParticipants = (data: { groupId: string; participants: OtherParticipant[] }) => {
        if (data.groupId !== group.id) return
        const filtered = data.participants.filter(p => p.userId !== currentUser.id)
        filtered.forEach(p => updateParticipantPosition(p.userId, p.x, p.y))
        setOthers(prev => filtered.map(p => {
          const existing = prev.find(e => e.userId === p.userId)
          return {
            ...p,
            chatBubble: existing?.chatBubble,
            chatBubbleAt: existing?.chatBubbleAt,
            floatingEmoji: existing?.floatingEmoji,
            floatingEmojiAt: existing?.floatingEmojiAt,
            movedAt: existing?.movedAt,
            spotifyTrack: p.spotifyTrack ?? existing?.spotifyTrack,
          }
        }))
        setParticipantCount(data.participants.length)
      }

      const onMoved = (data: { groupId: string; userId: string; x: number; y: number; direction: string; isSitting: boolean }) => {
        if (data.groupId !== group.id || data.userId === currentUser.id) return
        updateParticipantPosition(data.userId, data.x, data.y)
        const movedAt = performance.now()
        setOthers(prev => prev.map(p =>
          p.userId === data.userId
            ? { ...p, x: data.x, y: data.y, direction: data.direction as PixelDirection, isSitting: data.isSitting, movedAt }
            : p
        ))
      }

      const onChat = (data: { groupId: string; userId: string; text: string; at: number }) => {
        if (data.groupId !== group.id || data.userId === currentUser.id) return
        setOthers(prev => prev.map(p =>
          p.userId === data.userId
            ? { ...p, chatBubble: data.text, chatBubbleAt: data.at }
            : p
        ))
      }

      const onEmoji = (data: { groupId: string; userId: string; emoji: string; at: number }) => {
        if (data.groupId !== group.id || data.userId === currentUser.id) return
        setOthers(prev => prev.map(p =>
          p.userId === data.userId
            ? { ...p, floatingEmoji: data.emoji, floatingEmojiAt: data.at }
            : p
        ))
      }

      const onSpotifyTrack = (data: { groupId: string; userId: string; track: OtherParticipant['spotifyTrack'] }) => {
        if (data.groupId !== group.id || data.userId === currentUser.id) return
        setOthers(prev => prev.map(p =>
          p.userId === data.userId ? { ...p, spotifyTrack: data.track } : p
        ))
      }

      const onObjectsUpdate = (data: { groupId: string; userId: string; objects: PlacedRoomObject[] }) => {
        if (data.groupId !== group.id || data.userId === currentUser.id) return
        if (Array.isArray(data.objects)) setOwnerObjects(data.objects)
      }

      socket.on('pixel-room:participants', onParticipants)
      socket.on('pixel-room:moved', onMoved)
      socket.on('pixel-room:chat', onChat)
      socket.on('pixel-room:emoji', onEmoji)
      socket.on('pixel-room:spotify-track', onSpotifyTrack)
      socket.on('pixel-room:objects-update', onObjectsUpdate)

      socket.emit('pixel-room:join', {
        groupId: group.id,
        user: {
          id: currentUser.id,
          username: currentUser.username || currentUser.fullname || 'Visitor',
          avatarId: myAvatarId,
          avatarUrl: currentUser.avatar_url ?? null,
          bannerUrl: currentUser.banner ?? null,
          subPlan: currentUser.sub_plan ?? null,
          x: visitorRef.current.avatarX,
          y: visitorRef.current.avatarY,
        },
      })

      cleanup = () => {
        socket.emit('pixel-room:leave', { groupId: group.id })
        socket.off('pixel-room:participants', onParticipants)
        socket.off('pixel-room:moved', onMoved)
        socket.off('pixel-room:chat', onChat)
        socket.off('pixel-room:emoji', onEmoji)
        socket.off('pixel-room:spotify-track', onSpotifyTrack)
        socket.off('pixel-room:objects-update', onObjectsUpdate)
      }
    })

    return () => {
      mounted = false
      cleanup?.()
      joinedRef.current = false
    }
  }, [currentUser, group.id])

  const emitMove = useCallback((motion: VisitorMotion, force = false) => {
    const now = Date.now()
    if (!force && now - lastEmitRef.current < 100) return
    if (!force) lastEmitRef.current = now
    getSocket().then(socket => {
      socket.emit('pixel-room:move', {
        groupId: group.id,
        x: Math.round(motion.avatarX),
        y: Math.round(motion.avatarY),
        direction: motion.avatarDirection,
        isSitting: motion.isSitting,
      })
    })
  }, [group.id])

  const toggleMic = useCallback(() => {
    setMicMuted(prev => {
      const next = !prev
      micMutedRef.current = next
      getSocket().then(socket => {
        socket.emit('pixel-room:mic', { groupId: liveGroupIdRef.current, muted: next })
      })
      return next
    })
  }, [])

  const sendChat = useCallback((text: string) => {
    const trimmed = text.trim().slice(0, 80)
    if (!trimmed) return
    const at = Date.now()
    setLocalChatBubble(trimmed)
    setLocalChatBubbleAt(at)
    getSocket().then(socket => {
      socket.emit('pixel-room:chat', { groupId: liveGroupIdRef.current, text: trimmed })
    })
  }, [])

  const sendEmoji = useCallback((emoji: string) => {
    setLocalFloatingEmoji(emoji)
    setLocalFloatingEmojiAt(Date.now())
    setEmojiPickerOpen(false)
    getSocket().then(socket => {
      socket.emit('pixel-room:emoji', { groupId: liveGroupIdRef.current, emoji })
    })
  }, [])

  const handleMoveAvatar = useCallback((dx: number, dy: number) => {
    if (isEditMode) return
    const prev = visitorRef.current
    const next: VisitorMotion = {
      ...prev,
      avatarDirection: directionFromDelta(dx, dy),
      isSitting: false,
      sittingObjectId: null,
      avatarX: Math.max(1, Math.min(ROOM_COLUMNS - 2, prev.avatarX + dx)),
      avatarY: Math.max(1, Math.min(ROOM_ROWS - 2, prev.avatarY + dy)),
    }
    visitorRef.current = next
    setVisitor(next)
    emitMove(next)
  }, [emitMove, isEditMode])

  const handleToggleSit = useCallback(() => {
    if (isEditMode) return
    const prev = visitorRef.current
    if (prev.isSitting) {
      const next: VisitorMotion = { ...prev, isSitting: false, sittingObjectId: null }
      visitorRef.current = next
      setVisitor(next)
      emitMove(next, true)
      return
    }
    const seat = ownerObjects
      .map(obj => ({
        obj,
        asset: OBJECT_CATALOG.find(item => item.id === obj.itemId),
        dist: Math.abs(obj.x - prev.avatarX) + Math.abs(obj.y - prev.avatarY),
      }))
      .filter(e => e.asset?.canSit && e.dist <= 1)
      .sort((a, b) => a.dist - b.dist)[0]
    if (!seat?.asset) return
    const next: VisitorMotion = {
      ...prev,
      avatarX: seat.obj.x,
      avatarY: seat.obj.y,
      avatarDirection: seat.asset.seatDirection ?? prev.avatarDirection,
      isSitting: true,
      sittingObjectId: seat.obj.id,
    }
    visitorRef.current = next
    setVisitor(next)
    emitMove(next, true)
  }, [ownerObjects, emitMove, isEditMode])

  // Edit mode callbacks
  const enterEditMode = useCallback(() => {
    setEditObjects([...ownerObjects])
    setSelectedEditObjectId(null)
    setEditSearch('')
    setEditPage(0)
    setIsEditMode(true)
  }, [ownerObjects])

  const cancelEditMode = useCallback(() => {
    setIsEditMode(false)
    setSelectedEditObjectId(null)
  }, [])

  const saveEditedRoom = useCallback(async () => {
    setIsSaving(true)
    try {
      await saveGroupPixelRoom(group.id, { objects: editObjects })
      setOwnerObjects(editObjects)
      setIsEditMode(false)
      setSelectedEditObjectId(null)
      getSocket().then(socket => {
        socket.emit('pixel-room:objects-update', {
          groupId: liveGroupIdRef.current,
          objects: editObjects,
        })
      })
      toast.success('Room saved')
    } catch {
      toast.error('Save failed')
    } finally {
      setIsSaving(false)
    }
  }, [group.id, editObjects])

  const placeEditObject = useCallback((itemId: string) => {
    if (!OBJECT_CATALOG.some(i => i.id === itemId)) return
    const id = `${itemId}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    const newObj: PlacedRoomObject = {
      id,
      itemId,
      x: Math.max(1, Math.min(ROOM_COLUMNS - 2, Math.round(visitorRef.current.avatarX) + 1)),
      y: Math.max(1, Math.min(ROOM_ROWS - 2, Math.round(visitorRef.current.avatarY))),
      rotation: 0,
    }
    setEditObjects(prev => [...prev, newObj])
    setSelectedEditObjectId(id)
  }, [])

  const moveEditObject = useCallback((objectId: string, x: number, y: number) => {
    setEditObjects(prev => prev.map(obj =>
      obj.id === objectId
        ? {
            ...obj,
            x: Math.max(0, Math.min(ROOM_COLUMNS - 1, Math.round(x))),
            y: Math.max(0, Math.min(ROOM_ROWS - 1, Math.round(y))),
          }
        : obj
    ))
  }, [])

  const rotateEditObject = useCallback(() => {
    if (!selectedEditObjectId) return
    setEditObjects(prev => prev.map(obj =>
      obj.id === selectedEditObjectId
        ? { ...obj, rotation: ((obj.rotation + 1) % 4) as PlacedRoomObject['rotation'] }
        : obj
    ))
  }, [selectedEditObjectId])

  const deleteEditObject = useCallback(() => {
    if (!selectedEditObjectId) return
    setEditObjects(prev => prev.filter(obj => obj.id !== selectedEditObjectId))
    setSelectedEditObjectId(null)
  }, [selectedEditObjectId])

  // Edit catalog
  const editFiltered = useMemo(() => {
    const q = editSearch.trim().toLowerCase()
    return q
      ? OBJECT_CATALOG.filter(i => i.name.toLowerCase().includes(q) || i.category.toLowerCase().includes(q))
      : OBJECT_CATALOG
  }, [editSearch])

  const editTotalPages = Math.max(1, Math.ceil(editFiltered.length / EDIT_PAGE_SIZE))
  const editSafePage = Math.min(editPage, editTotalPages - 1)
  const editPageItems = editFiltered.slice(editSafePage * EDIT_PAGE_SIZE, editSafePage * EDIT_PAGE_SIZE + EDIT_PAGE_SIZE)

  const selectedEditObject = editObjects.find(o => o.id === selectedEditObjectId)
  const selectedEditAsset = selectedEditObject
    ? OBJECT_CATALOG.find(i => i.id === selectedEditObject.itemId)
    : null

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      const key = e.key.toLowerCase()
      if (key === 'm') { e.preventDefault(); toggleMic() }
      if (key === 't' && !isEditMode) { e.preventDefault(); setChatInputOpen(true) }
      if (key === 'r' && !isEditMode) { e.preventDefault(); setEmojiPickerOpen(prev => !prev) }
      if (key === 'f') { e.preventDefault(); toggleFullscreen() }
      if (key === 'escape') {
        setChatInputOpen(false)
        setEmojiPickerOpen(false)
        if (isEditMode) cancelEditMode()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [toggleMic, isEditMode, cancelEditMode])

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      sectionRef.current?.requestFullscreen()
    } else {
      document.exitFullscreen()
    }
  }, [])

  useEffect(() => {
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', onFsChange)
    return () => document.removeEventListener('fullscreenchange', onFsChange)
  }, [])

  const activeObjects = isEditMode ? editObjects : ownerObjects
  const canvasState: PixelRoomState = useMemo(() => ({
    ...visitor,
    objects: activeObjects,
    ownedItemIds: [],
  }), [visitor, activeObjects])

  const myName = currentUser?.username ?? currentUser?.fullname ?? 'You'

  return (
    <section ref={sectionRef} className="relative flex h-full min-w-0 flex-1 flex-col overflow-hidden bg-background text-foreground">
      <Motion.header
        className={cn('flex flex-shrink-0 items-center justify-between border-b border-border px-4 py-3', isFullscreen && 'hidden')}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push(`/channels/${channelId}`)}
            className="flex h-8 w-8 items-center justify-center rounded-[8px] border border-border text-muted-foreground hover:border-primary hover:text-primary"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="min-w-0">
            <h2 className="truncate text-[14px] font-semibold text-foreground">{group.label}</h2>
          </div>
          {isEditMode && (
            <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-400">
              <Edit3 className="h-2.5 w-2.5" />
              Editing
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-[8px] border border-border bg-card px-2.5 py-1 text-[11px] text-muted-foreground">
            <Users className="h-3 w-3" />
            {participantCount}
          </span>
          {isChannelAdmin && !isEditMode && (
            <button
              onClick={enterEditMode}
              className="flex h-8 items-center gap-1.5 rounded-[8px] border border-border px-2.5 text-[11px] font-medium text-muted-foreground hover:border-primary hover:text-primary"
              title="Edit room"
            >
              <Edit3 className="h-3.5 w-3.5" />
              Edit Room
            </button>
          )}
          <button
            onClick={toggleFullscreen}
            className="flex h-8 w-8 items-center justify-center rounded-[8px] border border-border text-muted-foreground hover:border-primary hover:text-primary"
            title={isFullscreen ? 'Exit fullscreen (F)' : 'Fullscreen (F)'}
          >
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
        </div>
      </Motion.header>

      <Motion.main
        className={cn(
          'relative flex min-w-0 flex-1 overflow-hidden',
          isFullscreen ? 'p-0' : 'p-4',
          isEditMode ? 'flex-row gap-3 items-start' : 'flex-col',
        )}
        initial={{ opacity: 0, scale: 0.975 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
      >
        {/* Edit sidebar */}
        {isEditMode && (
          <div className={cn('flex w-[220px] shrink-0 flex-col overflow-hidden rounded-[10px] border border-amber-500/20 bg-card', isFullscreen ? 'h-full' : 'h-full max-h-[576px]')}>
            <div className="flex items-center justify-between border-b border-border px-3 py-2.5">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-foreground">
                <PackagePlus className="h-3.5 w-3.5 text-amber-400" />
                Add Objects
              </div>
              <button
                onClick={cancelEditMode}
                className="flex h-5 w-5 items-center justify-center rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="h-3 w-3" />
              </button>
            </div>

            {/* Search */}
            <div className="relative border-b border-border px-2 py-2">
              <Search className="absolute left-4 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
              <input
                value={editSearch}
                onChange={e => { setEditSearch(e.target.value); setEditPage(0) }}
                placeholder="Search…"
                className="w-full rounded-[6px] border border-border bg-background py-1.5 pl-7 pr-2 text-[11px] text-foreground placeholder-muted-foreground outline-none focus:border-primary"
              />
            </div>

            {/* Object list */}
            <div className="flex-1 overflow-y-auto px-2 py-2">
              <div className="grid gap-1">
                {editPageItems.length === 0 && (
                  <p className="py-4 text-center text-[11px] text-muted-foreground">No objects found</p>
                )}
                {editPageItems.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => { placeEditObject(item.id); toast.success(`${item.name} placed`) }}
                    className="grid grid-cols-[28px_1fr] items-center gap-2 rounded-[6px] border border-border bg-background p-1.5 text-left transition-colors hover:border-primary hover:bg-primary/5"
                  >
                    <div className="flex h-7 w-7 items-center justify-center overflow-hidden rounded-[4px] border border-border">
                      <ItemThumb item={item} size={22} />
                    </div>
                    <span className="min-w-0">
                      <span className="block truncate text-[10px] font-semibold text-foreground">{item.name}</span>
                      <span className="block truncate text-[9px] text-muted-foreground">{item.category}</span>
                    </span>
                  </button>
                ))}
              </div>

              {/* Pagination */}
              {editTotalPages > 1 && (
                <div className="mt-2 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setEditPage(p => Math.max(0, p - 1))}
                    disabled={editSafePage === 0}
                    className="flex h-6 w-6 items-center justify-center rounded-[5px] border border-border text-muted-foreground disabled:opacity-30 hover:border-primary hover:text-primary disabled:cursor-not-allowed"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </button>
                  <span className="text-[9px] text-muted-foreground">
                    {editSafePage + 1} / {editTotalPages}
                  </span>
                  <button
                    type="button"
                    onClick={() => setEditPage(p => Math.min(editTotalPages - 1, p + 1))}
                    disabled={editSafePage === editTotalPages - 1}
                    className="flex h-6 w-6 items-center justify-center rounded-[5px] border border-border text-muted-foreground disabled:opacity-30 hover:border-primary hover:text-primary disabled:cursor-not-allowed"
                  >
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </div>

            {/* Selected object controls */}
            <div className="border-t border-border p-2">
              {selectedEditObject && selectedEditAsset ? (
                <div className="rounded-[8px] border border-border bg-background p-2">
                  <div className="mb-2 flex items-center gap-1.5">
                    <div className="flex h-7 w-7 items-center justify-center rounded-[4px] border border-border">
                      <ItemThumb item={selectedEditAsset} size={22} />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-[10px] font-semibold text-foreground">{selectedEditAsset.name}</p>
                      <p className="text-[9px] text-muted-foreground">{selectedEditObject.x}, {selectedEditObject.y}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={rotateEditObject}
                      className="inline-flex h-7 items-center justify-center gap-1 rounded-[6px] border border-border text-[10px] font-medium text-muted-foreground transition-colors hover:border-primary hover:text-primary"
                    >
                      <RotateCw className="h-3 w-3" />
                      Rotate
                    </button>
                    <button
                      type="button"
                      onClick={deleteEditObject}
                      className="inline-flex h-7 items-center justify-center gap-1 rounded-[6px] border border-red-500/30 bg-red-500/10 text-[10px] font-medium text-red-400 transition-colors hover:bg-red-500/20"
                    >
                      <Trash2 className="h-3 w-3" />
                      Delete
                    </button>
                  </div>
                </div>
              ) : (
                <p className="rounded-[8px] border border-border bg-background p-2 text-[10px] text-muted-foreground">
                  Click an object to select it.
                </p>
              )}

              {/* Save / Cancel */}
              <div className="mt-2 grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={cancelEditMode}
                  className="inline-flex h-7 items-center justify-center rounded-[6px] border border-border text-[10px] font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={saveEditedRoom}
                  disabled={isSaving}
                  className="inline-flex h-7 items-center justify-center gap-1 rounded-[6px] bg-primary text-[10px] font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
                >
                  <Save className="h-3 w-3" />
                  {isSaving ? 'Saving…' : 'Save'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Canvas area */}
        <div className={cn(
          'relative flex shrink overflow-hidden border border-border shadow-lg',
          isFullscreen ? 'h-full w-full rounded-none' : 'h-full max-h-[576px] rounded-[10px]',
          !isFullscreen && (isEditMode ? 'flex-1' : 'mx-auto w-full max-w-[832px]'),
        )}>
          <PixelRoomCanvas
            state={canvasState}
            playerName={myName}
            selectedObjectId={isEditMode ? selectedEditObjectId : null}
            onSelectObject={isEditMode ? setSelectedEditObjectId : () => {}}
            onMoveObject={isEditMode ? moveEditObject : () => {}}
            onMoveAvatar={handleMoveAvatar}
            onToggleSit={handleToggleSit}
            otherParticipants={others}
            localMicMuted={micMuted}
            localIsSpeaking={isSpeaking}
            localChatBubble={localChatBubble}
            localChatBubbleAt={localChatBubbleAt}
            localFloatingEmoji={localFloatingEmoji}
            localFloatingEmojiAt={localFloatingEmojiAt}
          />

          <div className="pointer-events-none absolute left-1/2 top-[10px] z-10 -translate-x-1/2 rounded-full border border-border bg-background/90 px-3.5 py-1.5 text-[10px] text-muted-foreground backdrop-blur-sm">
            {isEditMode
              ? 'Edit mode · Drag objects · Click to select · Esc to cancel'
              : `${group.label} · WASD move · E sit · T chat · R emoji · M mic · F fullscreen`}
          </div>

          {/* Emoji picker */}
          {!isEditMode && emojiPickerOpen && (
            <div className="absolute bottom-16 left-1/2 z-20 -translate-x-1/2 rounded-[14px] border border-white/10 bg-black/55 p-3 shadow-2xl backdrop-blur-md">
              <div className="mb-2.5 flex items-center justify-between">
                <span className="text-[9px] font-bold uppercase tracking-widest text-white/40">Reactions</span>
                <button
                  onClick={() => setEmojiPickerOpen(false)}
                  className="flex h-5 w-5 items-center justify-center rounded-full text-white/40 transition-colors hover:bg-white/10 hover:text-white"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
              <div className="grid grid-cols-6 gap-1">
                {EMOJI_LIST.map(emoji => (
                  <button
                    key={emoji}
                    onClick={() => sendEmoji(emoji)}
                    className="flex h-10 w-10 items-center justify-center rounded-[8px] transition-colors hover:bg-white/12"
                  >
                    <img src={emojiAppleUrl(emoji)} alt={emoji} className="h-7 w-7 select-none" draggable={false} />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Chat bubble input */}
          {!isEditMode && chatInputOpen && (
            <div className="absolute bottom-16 left-1/2 z-20 flex w-72 -translate-x-1/2 items-center gap-2 rounded-[12px] border border-white/10 bg-black/55 px-3 py-2.5 shadow-2xl backdrop-blur-md">
              <MessageCircle className="h-4 w-4 flex-shrink-0 text-white/40" />
              <input
                autoFocus
                className="min-w-0 flex-1 bg-transparent text-[13px] text-white outline-none placeholder:text-white/35"
                placeholder="Say something..."
                maxLength={80}
                value={chatInput}
                onChange={e => setChatInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    sendChat(chatInput)
                    setChatInput('')
                    setChatInputOpen(false)
                  }
                  if (e.key === 'Escape') {
                    setChatInput('')
                    setChatInputOpen(false)
                  }
                }}
              />
              <button
                onClick={() => { setChatInput(''); setChatInputOpen(false) }}
                className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-white/40 transition-colors hover:bg-white/10 hover:text-white"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          )}

          {/* Spotify now playing */}
          {!isEditMode && nowPlaying?.is_playing && nowPlaying.track && (
            <a
              href={nowPlaying.track.spotify_url}
              target="_blank"
              rel="noopener noreferrer"
              className="absolute bottom-4 left-4 z-10 flex items-center gap-2.5 rounded-[12px] border border-white/10 bg-black/45 px-2.5 py-2 shadow-lg backdrop-blur-md transition-colors hover:bg-black/60"
            >
              <img src={nowPlaying.track.album_art} alt="" className="h-9 w-9 flex-shrink-0 rounded-[6px] object-cover" />
              <div className="min-w-0">
                <p className="max-w-[130px] truncate text-[11px] font-semibold leading-tight text-white">{nowPlaying.track.name}</p>
                <p className="max-w-[130px] truncate text-[10px] text-white/55">{nowPlaying.track.artist}</p>
                <div className="mt-1.5 h-[3px] w-full overflow-hidden rounded-full bg-white/15">
                  <div
                    className="h-full rounded-full bg-[#1DB954]"
                    style={{ width: `${Math.round((nowPlaying.track.progress_ms / nowPlaying.track.duration_ms) * 100)}%` }}
                  />
                </div>
              </div>
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 flex-shrink-0 fill-[#1DB954]">
                <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
              </svg>
            </a>
          )}

          {/* Bottom toolbar */}
          {!isEditMode && (
            <div className="pointer-events-auto absolute bottom-4 right-4 z-10 flex items-center gap-1.5 rounded-[12px] border border-white/10 bg-black/30 px-2 py-1.5 shadow-lg backdrop-blur-md">
              <button
                onClick={toggleMic}
                title={micMuted ? 'Unmute (M)' : 'Mute (M)'}
                className={`flex h-8 w-8 items-center justify-center rounded-[8px] transition-colors ${
                  micMuted
                    ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                    : isSpeaking
                    ? 'bg-green-500/20 text-green-400'
                    : 'text-white/60 hover:bg-white/10 hover:text-white'
                }`}
              >
                {micMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              </button>
              <div className="h-4 w-px bg-white/10" />
              <button
                onClick={() => setEmojiPickerOpen(prev => !prev)}
                className="flex h-8 w-8 items-center justify-center rounded-[8px] text-white/60 transition-colors hover:bg-white/10 hover:text-white"
                title="React (R)"
              >
                <Smile className="h-4 w-4" />
              </button>
              <button
                onClick={() => setChatInputOpen(true)}
                className="flex h-8 w-8 items-center justify-center rounded-[8px] text-white/60 transition-colors hover:bg-white/10 hover:text-white"
                title="Chat (T)"
              >
                <MessageCircle className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </Motion.main>
    </section>
  )
}
