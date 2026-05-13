'use client'

import { cn } from '@/lib/utils'
import type { UserStatus } from '@/lib/user-api'

interface StatusDotProps {
  status: UserStatus | 'online' | 'offline'
  className?: string
  /** Pass border color matching background behind the dot. Defaults to border-sidebar for overlaid dots. */
  borderClass?: string
  /** When true, renders inline (no absolute positioning). Default: false (absolute). */
  inline?: boolean
}

export function StatusDot({ status, className, borderClass = 'border-sidebar', inline = false }: StatusDotProps) {
  const pos = inline ? '' : 'absolute'
  const base = cn(pos, 'rounded-full border-2', borderClass, className)

  if (status === 'online') {
    return <span className={cn(base, 'bg-green-500')} />
  }

  if (status === 'idle') {
    return <span className={cn(base, 'bg-amber-400')} />
  }

  if (status === 'dnd') {
    return (
      <span className={cn(base, 'bg-red-500 flex items-center justify-center')}>
        <span className="h-[2px] w-[55%] rounded-full bg-white" />
      </span>
    )
  }

  // offline / invisible / null
  return <span className={cn(base, 'bg-muted-foreground/40')} />
}

export function resolveStatus(
  userStatus: UserStatus | undefined | null,
  isOnline: boolean,
): 'online' | 'idle' | 'dnd' | 'offline' {
  if (userStatus === 'dnd') return 'dnd'
  if (userStatus === 'idle') return 'idle'
  if (userStatus === 'invisible') return 'offline'
  return isOnline ? 'online' : 'offline'
}
