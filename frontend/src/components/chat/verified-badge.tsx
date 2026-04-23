'use client'

import { cn } from '@/lib/utils'

export function isProPlan(sub_plan?: string | null) {
  return sub_plan === 'PRO' || sub_plan === 'ENTERPRISE'
}

export function isVerifiedAccountIdentity(
  identity?: {
    email?: string | null
    id?: string | null
    isVerified?: boolean | null
    is_verified?: boolean | null
    sub_plan?: string | null
  } | null,
  currentIdentity?: {
    email?: string | null
    id?: string | null
    isVerified?: boolean | null
    is_verified?: boolean | null
    sub_plan?: string | null
  } | null,
) {
  if (!identity) return false
  if (identity.isVerified || identity.is_verified || isProPlan(identity.sub_plan)) return true

  const currentIsVerified =
    Boolean(currentIdentity?.isVerified || currentIdentity?.is_verified) ||
    isProPlan(currentIdentity?.sub_plan)

  return Boolean(identity.id && currentIdentity?.id === identity.id && currentIsVerified)
}

export function VerifiedBadge({
  className,
  size = 'sm',
  variant = 'standard',
}: {
  className?: string
  size?: 'xs' | 'sm' | 'md'
  variant?: 'standard' | 'pro'
}) {
  const sizeClass = {
    xs: 'h-3.5 w-3.5',
    sm: 'h-4 w-4',
    md: 'h-5 w-5',
  }[size]

  return (
    <span
      className={cn(
        'inline-flex flex-shrink-0 items-center justify-center align-middle',
        sizeClass,
        className,
      )}
      title={variant === 'pro' ? 'Twiky Pro' : 'Verified account'}
      aria-label={variant === 'pro' ? 'Twiky Pro subscriber' : 'Verified account'}
    >
      <img
        src="/verified-badge-svgrepo-com.svg"
        alt=""
        aria-hidden="true"
        className="block h-full w-full"
        style={variant === 'pro' ? {
          filter: 'sepia(1) saturate(4) hue-rotate(-20deg) brightness(1.1)',
        } : undefined}
      />
    </span>
  )
}
