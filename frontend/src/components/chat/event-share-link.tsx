'use client'

import { useState } from 'react'
import { Check, Copy, Link2 } from 'lucide-react'
import { toast } from 'sonner'
import { getEventShareLink } from '@/lib/event-utils'
import type { VoiceEvent } from '@/lib/groups-api'

interface EventShareLinkProps {
  event: VoiceEvent
  channelId: string
  compact?: boolean
}

export function EventShareLink({ event, channelId, compact }: EventShareLinkProps) {
  const [copied, setCopied] = useState(false)
  const link =
    getEventShareLink(event) ||
    (typeof window !== 'undefined'
      ? `${window.location.origin}/channels/${channelId}/group/${event.group_id}?event=${event.id}`
      : '')

  async function copyLink() {
    if (!link) return
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      toast.success('Event link copied')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Could not copy link')
    }
  }

  if (!link) return null

  if (compact) {
    return (
      <button
        type="button"
        onClick={copyLink}
        className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[9px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        title="Copy event link"
      >
        {copied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
        Link
      </button>
    )
  }

  return (
    <div className="space-y-1.5 rounded-xl border border-primary/25 bg-primary/5 p-3">
      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-primary">
        <Link2 className="h-3 w-3" />
        Share event link
      </div>
      <p className="text-[10px] text-muted-foreground">
        Send this link so members can join the scheduled voice event.
      </p>
      <div className="flex gap-1.5">
        <input
          readOnly
          value={link}
          className="min-w-0 flex-1 truncate rounded-lg border border-border bg-background px-2 py-1.5 text-[10px] text-foreground"
        />
        <button
          type="button"
          onClick={copyLink}
          className="flex h-7 shrink-0 items-center gap-1 rounded-lg bg-primary px-2.5 text-[10px] font-bold text-primary-foreground hover:bg-primary/90"
        >
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
    </div>
  )
}
