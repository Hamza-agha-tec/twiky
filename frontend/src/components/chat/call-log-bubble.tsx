'use client'

import { Phone, Video, PhoneMissed, PhoneIncoming, PhoneOutgoing, PhoneOff, VideoOff, Clock } from 'lucide-react'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'
import type { Message } from '@/lib/mock-data'

interface CallLogBubbleProps {
  message: Message
}

function fmtDuration(secs: number): string {
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  const s = secs % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}

export function CallLogBubble({ message }: CallLogBubbleProps) {
  // content format: "ended:120" or just "ended"
  const parts = (message.content ?? 'ended').split(':')
  const outcome = parts[0] as 'ended' | 'missed' | 'declined' | 'cancelled'
  const durationSecs = parts[1] ? parseInt(parts[1], 10) : null
  const duration = durationSecs != null && durationSecs > 0 ? fmtDuration(durationSecs) : (message.duration ?? null)

  const isVideo = message.mime === 'video'
  const isOwn = message.isOwn
  const answered = outcome === 'ended'

  // ── label ──────────────────────────────────────────────────────────────────
  let label: string
  let sublabel: string
  if (answered) {
    label = isVideo ? 'Video call' : 'Voice call'
    sublabel = duration ? `${duration}` : 'Call ended'
  } else if (outcome === 'declined') {
    label = isOwn ? 'Call declined' : 'You declined'
    sublabel = isVideo ? 'Video call' : 'Voice call'
  } else if (outcome === 'cancelled') {
    label = isOwn ? 'Cancelled' : 'Missed call'
    sublabel = isVideo ? 'Video call' : 'Voice call'
  } else {
    label = isOwn ? 'No answer' : 'Missed call'
    sublabel = isVideo ? 'Video call' : 'Voice call'
  }

  // ── icons ───────────────────────────────────────────────────────────────────
  // Left: status icon (what happened)
  let LeftIcon: React.ComponentType<{ className?: string }>
  if (answered) {
    LeftIcon = isVideo ? Video : Phone
  } else if (outcome === 'declined') {
    LeftIcon = isVideo ? VideoOff : PhoneOff
  } else if (outcome === 'cancelled') {
    LeftIcon = isVideo ? VideoOff : (isOwn ? PhoneOutgoing : PhoneIncoming)
  } else {
    LeftIcon = isVideo ? VideoOff : (isOwn ? PhoneOutgoing : PhoneMissed)
  }

  // Right: call type icon (always shows video vs voice)
  const RightIcon = isVideo ? Video : Phone

  // ── colors ──────────────────────────────────────────────────────────────────
  const leftBg = answered ? 'bg-emerald-500/15' : 'bg-red-500/12'
  const leftColor = answered ? 'text-emerald-500' : 'text-red-400'
  const rightBg = answered ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' : 'bg-red-500/8 border-red-500/20 text-red-400'

  const time = format(new Date(message.timestamp), 'h:mm a')

  return (
    <div className="flex justify-center my-2">
      <div className={cn(
        'flex items-center gap-3 rounded-2xl border px-4 py-2.5 min-w-[230px] max-w-[320px]',
        'bg-card/60 backdrop-blur-sm shadow-sm',
        answered ? 'border-emerald-500/15' : 'border-red-500/12',
      )}>
        {/* Left icon */}
        <div className={cn('h-10 w-10 rounded-full flex items-center justify-center shrink-0', leftBg)}>
          <LeftIcon className={cn('h-4.5 w-4.5', leftColor)} style={{ width: 18, height: 18 }} />
        </div>

        {/* Info */}
        <div className="flex flex-col min-w-0 flex-1 gap-0.5">
          <span className="text-sm font-semibold text-foreground leading-tight">{label}</span>
          <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
            {answered && duration && (
              <>
                <Clock className="h-3 w-3 shrink-0" />
                <span>{duration}</span>
                <span className="opacity-50">·</span>
              </>
            )}
            {!answered && (
              <>
                <span className="opacity-70">{sublabel}</span>
                <span className="opacity-50">·</span>
              </>
            )}
            <span>{time}</span>
          </div>
        </div>

        {/* Right: call type badge */}
        <div className={cn(
          'h-8 w-8 rounded-full flex items-center justify-center shrink-0 border',
          rightBg,
        )}>
          <RightIcon style={{ width: 14, height: 14 }} />
        </div>
      </div>
    </div>
  )
}
