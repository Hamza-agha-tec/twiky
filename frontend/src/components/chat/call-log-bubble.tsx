'use client'

import { Phone, Video, PhoneMissed, VideoOff } from 'lucide-react'
import { format } from 'date-fns'
import type { Message } from '@/lib/mock-data'

interface CallLogBubbleProps {
  message: Message
}

export function CallLogBubble({ message }: CallLogBubbleProps) {
  const outcome = message.content as 'ended' | 'missed' | 'declined' | 'cancelled'
  const callType = message.mime === 'video' ? 'video' : 'audio'
  const isOwn = message.isOwn
  const isMissed = outcome !== 'ended'

  let label: string
  if (outcome === 'ended') {
    label = callType === 'video' ? 'Video call' : 'Voice call'
  } else if (outcome === 'missed') {
    label = isOwn ? 'No answer' : 'Missed call'
  } else if (outcome === 'declined') {
    label = isOwn ? 'Call declined' : 'You declined'
  } else {
    label = isOwn ? 'Cancelled' : 'Missed call'
  }

  const ActiveIcon = callType === 'video' ? Video : Phone
  const MissedIcon = callType === 'video' ? VideoOff : PhoneMissed
  const time = format(new Date(message.timestamp), 'h:mm a')

  return (
    <div className="flex justify-center my-0.5">
      <div className="flex items-center gap-1.5 rounded-full border border-[var(--twiky-blue-border)] bg-[var(--twiky-blue-bg)] px-3 py-1 text-xs text-[color:var(--twiky-blue)] select-none">
        {isMissed ? (
          <MissedIcon className="h-3 w-3 text-red-400 shrink-0" />
        ) : (
          <ActiveIcon className="h-3 w-3 text-green-500 shrink-0" />
        )}
        <span className="font-medium">{label}</span>
        {outcome === 'ended' && message.duration && (
          <span className="opacity-70">· {message.duration}</span>
        )}
        <span className="opacity-50">· {time}</span>
      </div>
    </div>
  )
}
