'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { AudioLines, Copy, ExternalLink, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { useVoice } from '@/context/VoiceContext'
import { CHANNEL_EVENTS_KEY } from '@/lib/channels-api'
import { getEventShareLink, isEventLive } from '@/lib/event-utils'
import { groupsApi, type VoiceEvent } from '@/lib/groups-api'

interface ChannelEventRowProps {
  event: VoiceEvent
  channelId: string
  roomLabel: string
  canManage?: boolean
  myId?: string
  compact?: boolean
  onChanged?: () => void
  onCloseDialog?: () => void
}

export function ChannelEventRow({
  event,
  channelId,
  roomLabel,
  canManage,
  myId,
  compact,
  onChanged,
  onCloseDialog,
}: ChannelEventRowProps) {
  const router = useRouter()
  const voice = useVoice()
  const queryClient = useQueryClient()
  const [starting, setStarting] = useState(false)
  const live = isEventLive(event)
  const canDelete = event.creator_id === myId || !!canManage

  const eventPath = `/channels/${channelId}/group/${event.group_id}?event=${event.id}`

  async function copyLink() {
    const link = getEventShareLink(event) || `${window.location.origin}${eventPath}`
    try {
      await navigator.clipboard.writeText(link)
      toast.success('Link copied')
    } catch {
      toast.error('Could not copy link')
    }
  }

  function openEvent() {
    onCloseDialog?.()
    router.push(eventPath)
  }

  async function handleStart() {
    setStarting(true)
    try {
      const started = await groupsApi.startGroupEvent(event.group_id, event.id)
      queryClient.setQueryData<VoiceEvent[]>(CHANNEL_EVENTS_KEY(channelId), (prev) => {
        if (!prev?.length) return prev
        return prev.map((e) => (e.id === started.id ? { ...e, ...started } : e))
      })
      onChanged?.()
      onCloseDialog?.()
      router.push(eventPath)
      if (voice.joinedGroupId !== event.group_id) {
        await voice.join(event.group_id)
      }
      toast.success('Event is live')
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to start event')
    } finally {
      setStarting(false)
    }
  }

  async function handleJoin() {
    onCloseDialog?.()
    router.push(eventPath)
    if (voice.joinedGroupId !== event.group_id) {
      try {
        await voice.join(event.group_id)
      } catch {
        toast.error('Could not join voice')
      }
    }
  }

  if (compact) {
    return (
      <button
        type="button"
        onClick={openEvent}
        className={cn(
          'w-full rounded-lg border px-2 py-1.5 text-left transition-colors hover:bg-muted/40',
          live ? 'border-green-500/35 bg-green-500/5' : 'border-border/40 bg-muted/10',
        )}
      >
        <p className="truncate text-[11px] font-semibold text-foreground">{event.title}</p>
        <p className="text-[9px] text-muted-foreground">
          {live ? 'Live' : 'Waiting'} · {event.group_name ?? roomLabel}
        </p>
      </button>
    )
  }

  return (
    <div
      className={cn(
        'group/ev flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-colors',
        live
          ? 'border-green-500/30 bg-green-500/[0.06] hover:bg-green-500/10'
          : 'border-border/50 bg-muted/15 hover:bg-muted/30',
      )}
    >
      <div
        className={cn(
          'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
          live ? 'bg-green-500/15 text-green-600' : 'bg-muted text-muted-foreground',
        )}
      >
        <AudioLines className="h-4 w-4" />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <p className="truncate text-[13px] font-semibold text-foreground">{event.title}</p>
          <span
            className={cn(
              'shrink-0 rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase',
              live
                ? 'bg-green-500/20 text-green-700 dark:text-green-400'
                : 'bg-amber-500/15 text-amber-800 dark:text-amber-400',
            )}
          >
            {live ? 'Live' : 'Not started'}
          </span>
        </div>
        <p className="truncate text-[11px] text-muted-foreground">
          {event.group_name ?? roomLabel}
          <span className="mx-1 text-border">·</span>
          {new Date(event.scheduled_start).toLocaleString([], {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        {canManage && !live && (
          <button
            type="button"
            disabled={starting}
            onClick={handleStart}
            className="rounded-lg bg-primary px-2.5 py-1.5 text-[10px] font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {starting ? '…' : 'Start'}
          </button>
        )}
        {live && (
          <button
            type="button"
            onClick={handleJoin}
            className="rounded-lg bg-primary px-2.5 py-1.5 text-[10px] font-semibold text-primary-foreground hover:bg-primary/90"
          >
            Join
          </button>
        )}
        {!live && !canManage && (
          <button
            type="button"
            onClick={openEvent}
            className="rounded-lg border border-border px-2.5 py-1.5 text-[10px] font-medium text-muted-foreground hover:bg-muted"
          >
            View
          </button>
        )}
        {canManage && (
          <button
            type="button"
            onClick={copyLink}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground opacity-70 transition-opacity hover:bg-muted hover:opacity-100"
            title="Copy event link"
          >
            <Copy className="h-3.5 w-3.5" />
          </button>
        )}
        {live && (
          <button
            type="button"
            onClick={openEvent}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground opacity-70 transition-opacity hover:bg-muted hover:opacity-100"
            title="Open voice room"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </button>
        )}
        {canDelete && (
          <button
            type="button"
            onClick={async () => {
              try {
                await groupsApi.deleteGroupEvent(event.group_id, event.id)
                onChanged?.()
                toast.success('Event removed')
              } catch (err: unknown) {
                toast.error(err instanceof Error ? err.message : 'Failed to delete')
              }
            }}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover/ev:opacity-70"
            title="Delete"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  )
}
