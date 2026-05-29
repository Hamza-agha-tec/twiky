'use client'

import { useRef, useState, useMemo } from 'react'
import { Armchair, Box, Gamepad2, PackagePlus, RotateCw, Save, Trash2, Undo2, UserRound, Search, ChevronLeft, ChevronRight, Check } from 'lucide-react'
import { toast } from 'sonner'

import { useProfile } from '@/hooks/use-user'
import { cn } from '@/lib/utils'
import { AVATAR_CATALOG, OBJECT_CATALOG, type PixelCatalogItem } from './game-data'
import { saveMyRoom } from '@/lib/rooms-api'

function AvatarThumb({ src, size = 26 }: { src: string; size?: number }) {
  return (
    <div
      style={{ width: size, height: size, overflow: 'hidden', flexShrink: 0 }}
    >
      <img
        src={src}
        alt=""
        style={{
          height: size,
          width: 'auto',
          maxWidth: 'none',
          display: 'block',
          imageRendering: 'pixelated',
        }}
      />
    </div>
  )
}

function ItemThumb({ item, size = 26 }: { item: PixelCatalogItem; size?: number }) {
  if (item.frame) {
    const { sx, sy, sw, sh, sheetW, sheetH } = item.frame
    const scale = size / Math.max(sw, sh)
    return (
      <div
        style={{
          width: size,
          height: size,
          flexShrink: 0,
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
import { PixelRoomCanvas } from './pixel-room-canvas'
import { usePixelRoom } from './use-pixel-room'

export function PixelRoomGame() {
  const { data: profile } = useProfile()
  const playerName = profile?.fullname ?? profile?.username ?? 'You'
  const captureRoomRef = useRef<(() => string | null) | null>(null)
  const {
    state,
    avatarOptions,
    selectedObjectId,
    setSelectedObjectId,
    placeObject,
    moveAvatar,
    toggleSit,
    moveObject,
    rotateSelectedObject,
    deleteSelectedObject,
    setAvatar,
    resetRoom,
  } = usePixelRoom(profile?.id)

  const selectedObject = state.objects.find((object) => object.id === selectedObjectId)
  const selectedAsset = selectedObject
    ? OBJECT_CATALOG.find((item) => item.id === selectedObject.itemId)
    : null

  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const PAGE_SIZE = 5

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return q
      ? OBJECT_CATALOG.filter(i => i.name.toLowerCase().includes(q) || i.category.toLowerCase().includes(q))
      : OBJECT_CATALOG
  }, [search])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages - 1)
  const pageItems = filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE)

  const saveRoomPreview = async () => {
    if (typeof window === 'undefined') return

    const image = captureRoomRef.current?.()
    if (!image) {
      toast.error('Could not capture room preview')
      return
    }

    if (!profile?.id) {
      toast.error('Sign in to save your room')
      return
    }

    try {
      await saveMyRoom(state, image)
      window.localStorage.setItem(`twiky-pixel-room:${profile.id}`, JSON.stringify(state))
      window.dispatchEvent(new CustomEvent('twiky-pixel-room-preview-saved'))
      toast.success('Room saved')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed')
    }
  }

  return (
    <section className="flex min-w-0 flex-1 overflow-hidden bg-[#060910] text-slate-200">
      <aside className="flex w-[308px] shrink-0 flex-col border-r border-[#1e3a5f] bg-[rgba(6,9,16,0.97)]">
        <div className="border-b border-[#1e3a5f] px-4 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-[10px] border border-[#334155] bg-[#0f172a] text-[#93c5fd]">
              <Gamepad2 className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h2 className="truncate text-[15px] font-semibold text-slate-100">Pixel World</h2>
              <p className="truncate text-[12px] text-slate-500">{playerName}&apos;s room</p>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-3">
          <Panel title="Avatar" icon={UserRound}>
            <div className="grid grid-cols-4 gap-1.5">
              {avatarOptions.map((avatar) => {
                const active = avatar.id === state.avatarId
                return (
                  <button
                    type="button"
                    key={avatar.id}
                    onClick={() => {
                      if (active) return
                      setAvatar(avatar.id)
                      toast.success(`${avatar.name} equipped`)
                    }}
                    title={avatar.name}
                    className={cn(
                      'relative flex h-[52px] items-center justify-center rounded-[6px] border bg-[#020617] transition-colors',
                      active
                        ? 'border-[#3b82f6] ring-1 ring-[#3b82f6]/40'
                        : 'border-[#334155] hover:border-[#3b82f6]',
                    )}
                  >
                    <AvatarThumb src={avatar.src} size={36} />
                    {active && (
                      <span className="absolute right-0.5 top-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[#3b82f6] text-white">
                        <Check className="h-2.5 w-2.5" />
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
            {avatarOptions.length < AVATAR_CATALOG.length && (
              <p className="mt-2 text-[10px] text-slate-500">
                {AVATAR_CATALOG.length - avatarOptions.length} more unlock in store.
              </p>
            )}
          </Panel>

          <Panel title="Objects" icon={PackagePlus}>
            {/* Search */}
            <div className="relative mb-2">
              <Search className="absolute left-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-slate-500" />
              <input
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(0) }}
                placeholder="Search objects…"
                className="w-full rounded-[6px] border border-[#334155] bg-[#0f172a] py-1.5 pl-7 pr-3 text-[11px] text-slate-200 placeholder-slate-600 outline-none focus:border-[#3b82f6]"
              />
            </div>

            {/* List */}
            <div className="grid gap-1.5">
              {pageItems.length === 0 && (
                <p className="py-4 text-center text-[11px] text-slate-600">No objects found</p>
              )}
              {pageItems.map((item) => {
                const owned = state.ownedItemIds.includes(item.id)
                return (
                  <button
                    type="button"
                    key={item.id}
                    onClick={() => { placeObject(item.id); toast.success(`${item.name} placed`) }}
                    className="grid min-h-[48px] grid-cols-[34px_1fr_auto] items-center gap-2 rounded-[6px] border border-[#334155] bg-[#0f172a] p-2 text-left transition-colors hover:border-[#3b82f6] hover:bg-[rgba(59,130,246,0.1)]"
                  >
                    <div className="flex h-[30px] w-[30px] items-center justify-center overflow-hidden rounded-[5px] border border-[#334155] bg-[#020617]">
                      <ItemThumb item={item} size={26} />
                    </div>
                    <span className="min-w-0">
                      <span className="block truncate text-[10px] font-semibold text-slate-100">{item.name}</span>
                      <span className="block truncate text-[8px] text-slate-500">{item.category}</span>
                    </span>
                    <span className={cn(
                      'inline-flex h-[16px] items-center rounded-full border px-1.5 text-[8px] font-bold',
                      owned
                        ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                        : 'border-[#334155] bg-[#020617] text-slate-500',
                    )}>
                      {owned ? 'Owned' : `${item.price}c`}
                    </span>
                  </button>
                )
              })}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-2 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setPage(p => Math.max(0, p - 1))}
                  disabled={safePage === 0}
                  className="flex h-6 w-6 items-center justify-center rounded-[5px] border border-[#334155] bg-[#0f172a] text-slate-400 disabled:opacity-30 hover:border-[#3b82f6] hover:text-[#93c5fd] disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </button>
                <span className="text-[9px] text-slate-500">
                  {safePage + 1} / {totalPages}
                  <span className="ml-1 text-slate-600">({filtered.length} items)</span>
                </span>
                <button
                  type="button"
                  onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                  disabled={safePage === totalPages - 1}
                  className="flex h-6 w-6 items-center justify-center rounded-[5px] border border-[#334155] bg-[#0f172a] text-slate-400 disabled:opacity-30 hover:border-[#3b82f6] hover:text-[#93c5fd] disabled:cursor-not-allowed"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </Panel>
        </div>

        <div className="border-t border-[#1e3a5f] p-3">
          {selectedObject && selectedAsset ? (
            <div className="rounded-[10px] border border-[#1e3a5f] bg-[#0f172a] p-3">
              <div className="mb-3 flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-[6px] border border-[#334155] bg-[#020617]">
                  <ItemThumb item={selectedAsset} size={28} />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-[12px] font-semibold text-slate-100">{selectedAsset.name}</p>
                  <p className="text-[10.5px] text-slate-500">
                    Tile {selectedObject.x}, {selectedObject.y}
                    {selectedAsset.canSit ? ' - Seat' : ''}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <ActionButton onClick={rotateSelectedObject} icon={RotateCw} label="Rotate" />
                <ActionButton onClick={deleteSelectedObject} icon={Trash2} label="Delete" danger />
              </div>
            </div>
          ) : (
            <div className="rounded-[10px] border border-[#1e3a5f] bg-[#0f172a] p-3 text-[12px] text-slate-500">
              Select an object in the room to move or delete it.
            </div>
          )}
        </div>
      </aside>

      <main className="relative flex min-w-0 flex-1 flex-col overflow-hidden bg-[#060910] p-4">
        <div className="relative mx-auto flex h-full max-h-[576px] w-full max-w-[832px] shrink overflow-hidden rounded-[10px] border-2 border-[#1e3a5f] bg-[#060910] shadow-[0_0_60px_rgba(59,130,246,0.15)]">
          <PixelRoomCanvas
            state={state}
            playerName={playerName}
            selectedObjectId={selectedObjectId}
            onSelectObject={setSelectedObjectId}
            onMoveObject={moveObject}
            onMoveAvatar={moveAvatar}
            onToggleSit={toggleSit}
            captureRef={captureRoomRef}
          />

          <div className="pointer-events-none absolute left-1/2 top-[10px] z-10 flex -translate-x-1/2 items-center gap-1.5 whitespace-nowrap rounded-full border border-[#1e3a5f] bg-[rgba(6,9,16,0.9)] px-3.5 py-1.5 text-[10px] text-slate-500">
            <KeyCap>WASD</KeyCap> move
            <KeyCap>E</KeyCap> sit
            <KeyCap>Drag</KeyCap> objects
          </div>

<div className="absolute bottom-[10px] right-[10px] z-10 flex items-center gap-2">
            <button
              type="button"
              onClick={saveRoomPreview}
              className="inline-flex h-8 items-center gap-1.5 rounded-[8px] border border-[#334155] bg-[rgba(6,9,16,0.9)] px-2.5 text-[10px] font-semibold text-[#94a3b8] transition-colors hover:border-[#3b82f6] hover:text-[#93c5fd]"
            >
              <Save className="h-3.5 w-3.5" />
              Save
            </button>
            <button
              type="button"
              onClick={toggleSit}
              className="inline-flex h-8 items-center gap-1.5 rounded-[8px] border border-[#334155] bg-[rgba(6,9,16,0.9)] px-2.5 text-[10px] font-semibold text-[#94a3b8] transition-colors hover:border-[#3b82f6] hover:text-[#93c5fd]"
            >
              <Armchair className="h-3.5 w-3.5" />
              {state.isSitting ? 'Stand' : 'Sit'}
            </button>
            <button
              type="button"
              onClick={() => {
                resetRoom()
                toast.success('Room reset')
              }}
              className="inline-flex h-8 items-center gap-1.5 rounded-[8px] border border-[#334155] bg-[rgba(6,9,16,0.9)] px-2.5 text-[10px] font-semibold text-[#94a3b8] transition-colors hover:border-[#3b82f6] hover:text-[#93c5fd]"
            >
              <Undo2 className="h-3.5 w-3.5" />
              Reset
            </button>
          </div>

          {state.objects.length === 0 ? (
            <div className="pointer-events-none absolute left-1/2 top-[58px] z-10 -translate-x-1/2 rounded-[10px] border border-[#1e3a5f] bg-[rgba(6,9,16,0.9)] px-3.5 py-1.5 text-center text-[11px] text-[#93c5fd]">
              <p>Add objects from the inventory.</p>
            </div>
          ) : null}
        </div>
      </main>
    </section>
  )
}

function Panel({
  title,
  icon: Icon,
  children,
}: {
  title: string
  icon: typeof Box
  children: React.ReactNode
}) {
  return (
    <section className="mb-4">
      <div className="mb-2 flex items-center gap-2 px-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {title}
      </div>
      {children}
    </section>
  )
}

function ActionButton({
  icon: Icon,
  label,
  danger,
  onClick,
}: {
  icon: typeof RotateCw
  label: string
  danger?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex h-8 items-center justify-center gap-1.5 rounded-[8px] border px-2 text-[11px] font-semibold transition-colors',
        danger
          ? 'border-red-500/30 bg-red-500/10 text-red-200 hover:bg-red-500/20'
          : 'border-[#334155] bg-[#020617] text-slate-400 hover:border-[#3b82f6] hover:text-[#93c5fd]',
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  )
}

function KeyCap({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-[3px] border border-[#334155] bg-[#0f172a] px-1.5 py-px font-mono text-[9px] text-slate-400">
      {children}
    </span>
  )
}
