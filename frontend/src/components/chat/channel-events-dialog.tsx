'use client'

import { useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Calendar, Check, Copy, Plus } from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ChannelEventRow } from '@/components/chat/channel-event-row'
import { cn } from '@/lib/utils'
import { CHANNEL_EVENTS_KEY, channelsApi } from '@/lib/channels-api'
import { getEventShareLink, isEventLive } from '@/lib/event-utils'
import type { VoiceEvent } from '@/lib/groups-api'
import type { MockChannelGroup } from '@/components/chat/channels-panel'

interface ChannelEventsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  channelId: string
  voiceGroups: MockChannelGroup[]
  myId?: string
  canManage?: boolean
}

export function ChannelEventsDialog({
  open,
  onOpenChange,
  channelId,
  voiceGroups,
  myId,
  canManage,
}: ChannelEventsDialogProps) {
  const queryClient = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [formTitle, setFormTitle] = useState('')
  const [formDesc, setFormDesc] = useState('')
  const [formStart, setFormStart] = useState('')
  const [formGroupId, setFormGroupId] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [createdEvent, setCreatedEvent] = useState<VoiceEvent | null>(null)

  const defaultVoiceGroupId = voiceGroups[0]?.id ?? ''

  useEffect(() => {
    if (!open) {
      setCreatedEvent(null)
      setShowForm(false)
      return
    }
    if (!formGroupId && defaultVoiceGroupId) {
      setFormGroupId(defaultVoiceGroupId)
    }
  }, [open, formGroupId, defaultVoiceGroupId])

  const { data: events = [], isLoading } = useQuery({
    queryKey: CHANNEL_EVENTS_KEY(channelId),
    queryFn: () => channelsApi.getChannelEvents(channelId),
    enabled: !!channelId && open,
  })

  const voiceGroupById = useMemo(
    () => Object.fromEntries(voiceGroups.map((g) => [g.id, g.label])),
    [voiceGroups],
  )

  const { liveEvents, upcomingEvents } = useMemo(() => {
    const live: VoiceEvent[] = []
    const upcoming: VoiceEvent[] = []
    for (const ev of events) {
      if (isEventLive(ev)) live.push(ev)
      else upcoming.push(ev)
    }
    return { liveEvents: live, upcomingEvents: upcoming }
  }, [events])

  const invalidateEvents = () => {
    queryClient.invalidateQueries({ queryKey: CHANNEL_EVENTS_KEY(channelId) })
  }

  async function copyCreatedLink() {
    if (!createdEvent) return
    const link = getEventShareLink(createdEvent)
    if (!link) return
    try {
      await navigator.clipboard.writeText(link)
      toast.success('Event link copied')
    } catch {
      toast.error('Could not copy link')
    }
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    const groupId = formGroupId || defaultVoiceGroupId
    if (!formTitle.trim() || !formStart || !groupId) {
      toast.error('Add a title, voice room, and start time')
      return
    }
    setIsCreating(true)
    setCreatedEvent(null)
    try {
      const event = await channelsApi.createChannelEvent(channelId, {
        group_id: groupId,
        title: formTitle.trim(),
        description: formDesc.trim() || undefined,
        scheduled_start: new Date(formStart).toISOString(),
      })
      toast.success('Event scheduled')
      setFormTitle('')
      setFormDesc('')
      setFormStart('')
      setShowForm(false)
      invalidateEvents()
      if (canManage) setCreatedEvent(event)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Failed to schedule event')
    } finally {
      setIsCreating(false)
    }
  }

  function renderEventList(list: VoiceEvent[]) {
    if (list.length === 0) return null
    return (
      <div className="space-y-1.5">
        {list.map((ev) => (
          <ChannelEventRow
            key={ev.id}
            event={ev}
            channelId={channelId}
            roomLabel={voiceGroupById[ev.group_id] ?? 'Voice room'}
            canManage={canManage}
            myId={myId}
            onChanged={invalidateEvents}
            onCloseDialog={() => onOpenChange(false)}
          />
        ))}
      </div>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!flex !max-w-[32rem] w-[min(calc(100%-1.5rem),32rem)] sm:!max-w-[32rem] flex-col gap-0 p-0 overflow-hidden max-h-[min(85vh,calc(100vh-2rem))]">
        <DialogHeader className="flex shrink-0 flex-row items-center justify-between gap-3 border-b border-border px-4 py-3 text-left sm:px-5">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <Calendar className="h-4 w-4 text-primary" />
            </div>
            <div>
              <DialogTitle className="text-[14px] leading-tight">Voice events</DialogTitle>
              <p className="text-[11px] text-muted-foreground">Schedule and manage channel calls</p>
            </div>
          </div>
          {voiceGroups.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setShowForm((v) => !v)
                setCreatedEvent(null)
              }}
              className="flex shrink-0 items-center gap-1 rounded-lg border border-border bg-muted/30 px-2.5 py-1.5 text-[11px] font-semibold text-foreground transition-colors hover:bg-muted"
            >
              <Plus className={cn('h-3.5 w-3.5 transition-transform', showForm && 'rotate-45')} />
              {showForm ? 'Cancel' : 'New'}
            </button>
          )}
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          {createdEvent && canManage && (
            <div className="mx-4 mt-3 flex items-center gap-2 rounded-lg border border-green-500/25 bg-green-500/5 px-3 py-2 sm:mx-5">
              <Check className="h-4 w-4 shrink-0 text-green-600" />
              <p className="min-w-0 flex-1 truncate text-[11px] font-medium text-foreground">
                &ldquo;{createdEvent.title}&rdquo; scheduled
              </p>
              <button
                type="button"
                onClick={copyCreatedLink}
                className="flex shrink-0 items-center gap-1 rounded-md bg-primary px-2 py-1 text-[10px] font-semibold text-primary-foreground hover:bg-primary/90"
              >
                <Copy className="h-3 w-3" />
                Copy link
              </button>
            </div>
          )}

          {showForm && voiceGroups.length > 0 && (
            <form
              onSubmit={handleCreate}
              className="mx-4 mt-3 space-y-3 rounded-xl border border-border/60 bg-muted/20 p-3 sm:mx-5"
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    Voice room
                  </Label>
                  <Select value={formGroupId || defaultVoiceGroupId} onValueChange={setFormGroupId}>
                    <SelectTrigger className="h-9 w-full text-[12px]">
                      <SelectValue placeholder="Select room" />
                    </SelectTrigger>
                    <SelectContent>
                      {voiceGroups.map((g) => (
                        <SelectItem key={g.id} value={g.id}>
                          {g.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Title</Label>
                  <input
                    required
                    type="text"
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    placeholder="Team meeting…"
                    className="h-9 w-full rounded-lg border border-border bg-background px-3 text-[12px] outline-none focus:border-primary/50"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    Starts at
                  </Label>
                  <input
                    required
                    type="datetime-local"
                    value={formStart}
                    onChange={(e) => setFormStart(e.target.value)}
                    className="h-9 w-full rounded-lg border border-border bg-background px-3 text-[12px] outline-none focus:border-primary/50"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    Description
                  </Label>
                  <input
                    type="text"
                    value={formDesc}
                    onChange={(e) => setFormDesc(e.target.value)}
                    placeholder="Optional"
                    className="h-9 w-full rounded-lg border border-border bg-background px-3 text-[12px] outline-none focus:border-primary/50"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={isCreating}
                className="h-9 w-full rounded-lg bg-primary text-[12px] font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {isCreating ? 'Scheduling…' : 'Schedule event'}
              </button>
            </form>
          )}

          <div className="space-y-4 p-4 sm:p-5">
            {isLoading ? (
              <div className="space-y-2">
                {[1, 2].map((i) => (
                  <div key={i} className="h-14 animate-pulse rounded-xl bg-muted/40" />
                ))}
              </div>
            ) : events.length === 0 && !showForm ? (
              <div className="flex flex-col items-center gap-2 py-10 text-center">
                <Calendar className="h-8 w-8 text-muted-foreground/50" />
                <p className="text-[13px] font-medium text-foreground">No events yet</p>
                <p className="max-w-[220px] text-[11px] text-muted-foreground">
                  Plan a voice call in a specific room, then start it when you are ready.
                </p>
                {voiceGroups.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowForm(true)}
                    className="mt-1 rounded-lg bg-primary px-3 py-1.5 text-[11px] font-semibold text-primary-foreground"
                  >
                    Schedule first event
                  </button>
                )}
              </div>
            ) : (
              <>
                {liveEvents.length > 0 && (
                  <section>
                    <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-green-600">
                      Live now ({liveEvents.length})
                    </p>
                    {renderEventList(liveEvents)}
                  </section>
                )}
                {upcomingEvents.length > 0 && (
                  <section>
                    <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      Upcoming ({upcomingEvents.length})
                    </p>
                    {renderEventList(upcomingEvents)}
                  </section>
                )}
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
