'use client'

import { Calendar, Clock, Play } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { isEventLive } from '@/lib/event-utils'
import type { VoiceEvent } from '@/lib/groups-api'

interface VoiceEventBannerProps {
  event: VoiceEvent
  canManage?: boolean
  isJoined: boolean
  onJoin: () => void
  onStart?: () => void
  starting?: boolean
}

export function VoiceEventBanner({
  event,
  canManage,
  isJoined,
  onJoin,
  onStart,
  starting,
}: VoiceEventBannerProps) {
  const live = isEventLive(event)

  return (
    <div
      className={`shrink-0 border-b px-3 py-2 ${
        live ? 'border-green-500/30 bg-green-500/10' : 'border-amber-500/25 bg-amber-500/5'
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <Calendar className="h-3.5 w-3.5 shrink-0 text-primary" />
          <span className="truncate text-[12px] font-bold text-foreground">{event.title}</span>
          {live ? (
            <span className="shrink-0 rounded-full bg-green-500/20 px-2 py-0.5 text-[9px] font-bold uppercase text-green-600">
              Live now
            </span>
          ) : (
            <span className="shrink-0 rounded-full bg-amber-500/15 px-2 py-0.5 text-[9px] font-bold uppercase text-amber-700 dark:text-amber-400">
              Event not yet started
            </span>
          )}
          <span className="hidden text-[10px] text-muted-foreground sm:inline">
            {new Date(event.scheduled_start).toLocaleString([], {
              weekday: 'short',
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {canManage && !live && onStart && (
            <Button
              size="sm"
              className="h-7 gap-1 rounded-lg text-[10px]"
              disabled={starting}
              onClick={onStart}
            >
              <Play className="h-3 w-3" />
              {starting ? 'Starting…' : 'Start event'}
            </Button>
          )}
          {live && !isJoined && (
            <Button size="sm" className="h-7 rounded-lg text-[10px]" onClick={onJoin}>
              Join event
            </Button>
          )}
          {live && isJoined && (
            <span className="text-[10px] font-semibold text-green-600">You are in the call</span>
          )}
        </div>
      </div>

      {!live && (
        <p className="mt-1.5 flex items-center gap-1 text-[10px] text-amber-700/90 dark:text-amber-400/90">
          <Clock className="h-3 w-3 shrink-0" />
          Waiting for the host to start. You cannot join until then.
        </p>
      )}
    </div>
  )
}
