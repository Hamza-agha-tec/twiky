'use client'

import { cn } from '@/lib/utils'
import type { NameEffect } from '@/lib/user-api'

interface UserNameProps {
  name: string
  effect?: NameEffect
  subPlan?: string | null
  className?: string
}

export function UserName({ name, effect, subPlan, className }: UserNameProps) {
  if (!effect) return <span className={className}>{name}</span>

  if (effect === 'gradient') {
    return <span className={cn('name-gradient', className)}>{name}</span>
  }

  if (effect === 'shimmer') {
    return <span className={cn('name-shimmer', className)}>{name}</span>
  }

  if (effect === 'glow') {
    const glowClass = subPlan === 'GEEK' ? 'name-glow-geek' : 'name-glow-pro'
    return <span className={cn(glowClass, className)}>{name}</span>
  }

  return <span className={className}>{name}</span>
}
