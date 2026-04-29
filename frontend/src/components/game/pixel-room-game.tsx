'use client'

import { useRef } from 'react'
import { Armchair, Box, Gamepad2, PackagePlus, Plus, RotateCw, Save, Trash2, Undo2, UserRound } from 'lucide-react'
import { toast } from 'sonner'

import { useProfile } from '@/hooks/use-user'
import { cn } from '@/lib/utils'
import { OBJECT_CATALOG } from './game-data'
import { PixelRoomCanvas } from './pixel-room-canvas'
import { usePixelRoom } from './use-pixel-room'

export function PixelRoomGame() {
  const { data: profile } = useProfile()
  const playerName = profile?.fullname ?? profile?.username ?? 'You'
  const captureRoomRef = useRef<(() => string | null) | null>(null)
  const {
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
  } = usePixelRoom(profile?.id)

  const selectedObject = state.objects.find((object) => object.id === selectedObjectId)
  const selectedAsset = selectedObject
    ? OBJECT_CATALOG.find((item) => item.id === selectedObject.itemId)
    : null

  const saveRoomPreview = () => {
    if (typeof window === 'undefined') return

    const image = captureRoomRef.current?.()
    if (!image) {
      toast.error('Could not capture room preview')
      return
    }

    const preview = {
      image,
      savedAt: new Date().toISOString(),
      username: profile?.username ?? null,
      objectCount: state.objects.length,
    }
    const serialized = JSON.stringify(preview)
    window.localStorage.setItem(`twiky-pixel-room-preview:${profile?.id ?? 'guest'}`, serialized)
    if (profile?.username) {
      window.localStorage.setItem(`twiky-pixel-room-preview:username:${profile.username}`, serialized)
    }
    window.localStorage.setItem(`twiky-pixel-room:${profile?.id ?? 'guest'}`, JSON.stringify(state))
    window.dispatchEvent(new CustomEvent('twiky-pixel-room-preview-saved'))
    toast.success('Room preview saved')
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
          <Panel title="Room" icon={Box}>
            <div className="grid grid-cols-2 gap-2">
              <Stat label="Objects" value={state.objects.length.toString()} />
              <Stat label="Unlocked" value={inventoryObjects.length.toString()} />
            </div>
            <div className="mt-3 rounded-[10px] border border-[#1e3a5f] bg-[#0f172a] p-3">
              <div className="flex items-center gap-2">
                <img
                  src="/pixel/game/avatars/default_avatar.png"
                  alt=""
                  className="h-10 w-10 rounded-[8px] border border-[#334155] bg-[#020617] object-cover [image-rendering:pixelated]"
                />
                <div className="min-w-0">
                  <p className="truncate text-[12px] font-semibold text-slate-100">{playerName}</p>
                  <p className="text-[11px] text-slate-500">Default avatar</p>
                </div>
              </div>
            </div>
          </Panel>

          <Panel title="Inventory" icon={PackagePlus}>
            <div className="grid gap-2">
              {inventoryObjects.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  onClick={() => {
                    placeObject(item.id)
                    toast.success(`${item.name} added`)
                  }}
                  className="grid min-h-[52px] grid-cols-[38px_1fr_auto] items-center gap-2 rounded-[6px] border border-[#334155] bg-[#0f172a] p-2 text-left transition-colors hover:border-[#3b82f6] hover:bg-[rgba(59,130,246,0.1)]"
                >
                  <img
                    src={item.src}
                    alt=""
                    className="h-[34px] w-[34px] rounded-[6px] border border-[#334155] bg-[#020617] object-contain p-1 [image-rendering:pixelated]"
                  />
                  <span className="min-w-0">
                    <span className="block truncate text-[10px] font-semibold text-slate-100">{item.name}</span>
                    <span className="block truncate text-[8px] text-slate-500">{item.category}</span>
                  </span>
                  <span className="inline-flex h-[18px] items-center rounded-full border border-[#334155] bg-[#020617] px-2 text-[8px] font-bold text-slate-400">
                    {item.price === 0 ? 'Owned' : item.price}
                  </span>
                </button>
              ))}
            </div>
          </Panel>
        </div>

        <div className="border-t border-[#1e3a5f] p-3">
          {selectedObject && selectedAsset ? (
            <div className="rounded-[10px] border border-[#1e3a5f] bg-[#0f172a] p-3">
              <div className="mb-3 flex items-center gap-2">
                <img
                  src={selectedAsset.src}
                  alt=""
                  className="h-9 w-9 rounded-[6px] border border-[#334155] bg-[#020617] object-contain p-1 [image-rendering:pixelated]"
                />
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

          <div className="absolute bottom-[10px] left-[10px] z-10 flex gap-2">
            <button
              type="button"
              className="flex h-8 w-8 items-center justify-center rounded-[8px] border border-[#334155] bg-[rgba(6,9,16,0.9)] text-[#94a3b8] transition-colors hover:border-[#3b82f6] hover:text-[#93c5fd]"
              title="Add object"
            >
              <Plus className="h-4 w-4" />
            </button>
            <button
              type="button"
              className="flex h-8 w-8 items-center justify-center rounded-[8px] border border-[#334155] bg-[rgba(6,9,16,0.9)] text-[#94a3b8] transition-colors hover:border-[#3b82f6] hover:text-[#93c5fd]"
              title="Avatar"
            >
              <UserRound className="h-4 w-4" />
            </button>
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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[8px] border border-[#1e3a5f] bg-[#0f172a] p-3">
      <p className="text-[10.5px] text-slate-500">{label}</p>
      <p className="mt-1 text-[16px] font-bold text-slate-100">{value}</p>
    </div>
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
