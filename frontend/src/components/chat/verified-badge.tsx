'use client'

import { cn } from '@/lib/utils'

export const VERIFIED_ACCOUNT_EMAIL = 'elbidali.zakaria@gmail.com'

export function isVerifiedAccountEmail(email?: string | null) {
  return email?.trim().toLowerCase() === VERIFIED_ACCOUNT_EMAIL
}

export function isVerifiedAccountIdentity(
  identity?: {
    email?: string | null
    id?: string | null
    isVerified?: boolean | null
    is_verified?: boolean | null
  } | null,
  currentIdentity?: {
    email?: string | null
    id?: string | null
    isVerified?: boolean | null
    is_verified?: boolean | null
  } | null,
) {
  if (!identity) return false
  if (identity.isVerified || identity.is_verified || isVerifiedAccountEmail(identity.email)) return true

  const currentIsVerified =
    Boolean(currentIdentity?.isVerified || currentIdentity?.is_verified) ||
    isVerifiedAccountEmail(currentIdentity?.email)

  return Boolean(identity.id && currentIdentity?.id === identity.id && currentIsVerified)
}

export function VerifiedBadge({
  className,
  size = 'sm',
}: {
  className?: string
  size?: 'xs' | 'sm' | 'md'
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
      title="Verified account"
      aria-label="Verified account"
    >
      <img
        src="/verified-badge-svgrepo-com.svg"
        alt=""
        aria-hidden="true"
        className="block h-full w-full"
      />
    </span>
  )
}
