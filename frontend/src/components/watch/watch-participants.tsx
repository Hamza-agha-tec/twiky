'use client'

import { Crown } from 'lucide-react'
import { UserAvatar } from '@/components/chat/user-avatar'
import type { WatchParticipant } from '@/hooks/use-watch-room'

interface WatchParticipantsProps {
  participants: WatchParticipant[]
}

export function WatchParticipants({ participants }: WatchParticipantsProps) {
  return (
    <div className="flex flex-col gap-1">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground px-1 mb-1">
        Watching ({participants.length})
      </p>
      {participants.map((p) => (
        <div key={p.userId} className="flex items-center gap-2 px-1 py-1 rounded-lg hover:bg-accent transition-colors">
          <div className="relative shrink-0">
            <UserAvatar src={p.avatarUrl} alt={p.username} className="h-7 w-7 rounded-full" />
            {p.isHost && (
              <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-amber-500">
                <Crown className="h-2 w-2 text-white" />
              </span>
            )}
          </div>
          <span className="truncate text-[12px] font-medium text-foreground">{p.username}</span>
          {p.isHost && (
            <span className="ml-auto text-[10px] text-amber-500 font-semibold shrink-0">Host</span>
          )}
        </div>
      ))}
    </div>
  )
}
