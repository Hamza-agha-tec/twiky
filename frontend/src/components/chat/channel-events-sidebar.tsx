'use client'

import { useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Calendar, Plus } from 'lucide-react'
import { CHANNEL_EVENTS_KEY, channelsApi } from '@/lib/channels-api'
import { ChannelEventRow } from '@/components/chat/channel-event-row'
import type { MockChannelGroup } from '@/components/chat/channels-panel'

interface ChannelEventsSidebarProps {
  channelId: string
  voiceGroups: MockChannelGroup[]
  onScheduleClick: () => void
  myId?: string
  canManage?: boolean
}

export function ChannelEventsSidebar({
  channelId,
  voiceGroups,
  onScheduleClick,
  myId,
  canManage,
}: ChannelEventsSidebarProps) {
  const queryClient = useQueryClient()

  const { data: events = [], isLoading } = useQuery({
    queryKey: CHANNEL_EVENTS_KEY(channelId),
    queryFn: () => channelsApi.getChannelEvents(channelId),
    enabled: !!channelId,
    staleTime: 15_000,
  })

  const voiceGroupById = useMemo(
    () => Object.fromEntries(voiceGroups.map((g) => [g.id, g.label])),
    [voiceGroups],
  )

  const sorted = useMemo(
    () =>
      [...events].sort(
        (a, b) =>
          new Date(a.scheduled_start).getTime() - new Date(b.scheduled_start).getTime(),
      ),
    [events],
  )

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: CHANNEL_EVENTS_KEY(channelId) })
  }

  if (voiceGroups.length === 0) return null

  return (
    <div className="mt-3 border-t border-border/60 px-1 pt-3">
      <div className="mb-1.5 flex items-center gap-2 px-1">
        <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/50">
          Events
        </span>
        <div className="flex-1 border-t border-border/50" />
        <button
          type="button"
          onClick={onScheduleClick}
          className="flex h-5 w-5 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          title="Schedule event"
        >
          <Plus className="h-3 w-3" />
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-1.5 px-1 py-1">
          <div className="h-10 animate-pulse rounded-lg bg-muted/30" />
        </div>
      ) : sorted.length === 0 ? (
        <button
          type="button"
          onClick={onScheduleClick}
          className="mx-1 flex w-[calc(100%-0.5rem)] items-center gap-2 rounded-lg border border-dashed border-border/50 px-2.5 py-2 text-left transition-colors hover:border-primary/40 hover:bg-primary/5"
        >
          <Calendar className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <span className="text-[10px] text-muted-foreground">No events — schedule one</span>
        </button>
      ) : (
        <div className="space-y-1 px-1">
          {sorted.map((ev) => (
            <ChannelEventRow
              key={ev.id}
              event={ev}
              channelId={channelId}
              roomLabel={voiceGroupById[ev.group_id] ?? 'Voice'}
              canManage={canManage}
              myId={myId}
              compact
              onChanged={invalidate}
            />
          ))}
        </div>
      )}
    </div>
  )
}
