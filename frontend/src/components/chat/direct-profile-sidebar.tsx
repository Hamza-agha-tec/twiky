'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { X, AtSign, AlignLeft, Globe, MessageCircle, Phone, Video, MoreHorizontal, Image, ChevronRight, Gamepad2, ShieldOff, BellOff, Archive, Trash2, QrCode } from 'lucide-react'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { useUserById } from '@/hooks/use-user'
import { VerifiedBadge, getVerifiedBadgeVariant } from '@/components/chat/verified-badge'
import { UserName } from '@/components/chat/user-name'
import { StatusDot, resolveStatus } from '@/components/chat/status-dot'
import { QRCodeModal } from '@/components/chat/qr-code-modal'
import { createClient } from '@/utils/supabase/client'
import { toast } from 'sonner'
import type { StoryRingState } from '@/components/chat/channel-feed'

interface DirectProfileSidebarProps {
  userId?: string
  chatOverride?: {
    avatarUrl?: string | null
    isOnline?: boolean
    subPlan?: string | null
    isVerified?: boolean
    name: string
    subtitle?: string | null
    bannerUrl?: string | null
  }
  onClose: () => void
  onVoiceCall?: () => void
  onVideoCall?: () => void
  onOpenPixelRoom?: () => void
  onOpenStory?: (userId: string) => void
  storyRingState?: StoryRingState
}

function Skeleton({ className }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded-lg bg-white/5 ${className ?? ''}`} />
  )
}

export function DirectProfileSidebar({
  userId,
  chatOverride,
  onClose,
  onVoiceCall,
  onVideoCall,
  onOpenPixelRoom,
  onOpenStory,
  storyRingState = 'none',
}: DirectProfileSidebarProps) {
  const { data: profile, isLoading } = useUserById(userId)
  const [qrOpen, setQrOpen] = useState(false)

  const name = profile?.fullname ?? profile?.username ?? chatOverride?.name ?? '—'
  const username = profile?.username ?? null
  const avatar = profile?.avatar_url ?? chatOverride?.avatarUrl ?? null
  const banner = profile?.banner ?? chatOverride?.bannerUrl ?? null
  const bio = profile?.bio ?? null
  const website = profile?.website_url ?? null
  const isOnline = chatOverride?.isOnline ?? false
  const subPlan = profile?.sub_plan ?? chatOverride?.subPlan ?? null
  const isVerified = profile?.is_verified ?? chatOverride?.isVerified ?? false
  const showVerified = isVerified || subPlan === 'PRO' || subPlan === 'GEEK'
  const nameEffect = profile?.name_effect ?? null
  const effectiveStatus = resolveStatus(profile?.user_status, isOnline)
  const canOpenStory = storyRingState !== 'none' && Boolean(userId && onOpenStory)

  const initials = name
    .split(' ')
    .map((w: string) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  const showSkeleton = isLoading && !chatOverride

  const contactAction = async (path: string, body: Record<string, unknown>) => {
    if (!userId) return
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    const token = session?.access_token ?? ''
    const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080/api"'
    await fetch(`${API_URL}/contacts/${userId}/${path}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  }

  const handleBlock = async () => {
    await contactAction('block', { is_blocked: true })
    toast.success(`${name} blocked`)
    onClose()
  }

  const handleMute = async () => {
    await contactAction('mute', { is_muted: true })
    toast.success(`${name} muted`)
  }

  const handleArchive = async () => {
    await contactAction('archive', { is_archived: true })
    toast.success('Conversation archived')
    onClose()
  }

  return (
    <div className="flex h-full flex-col bg-sidebar overflow-y-auto">
      {/* Banner + Avatar header */}
      <div className="relative shrink-0">
        {/* Banner */}
        <div
          className="relative h-28 w-full"
          style={
            banner
              ? { backgroundImage: `url(${banner})`, backgroundSize: 'cover', backgroundPosition: 'center' }
              : { background: 'linear-gradient(135deg, hsl(var(--muted)) 0%, hsl(var(--muted)/0.4) 100%)' }
          }
        >
          <div className="absolute inset-x-0 bottom-0 h-16 pointer-events-none" style={{ background: 'linear-gradient(to bottom, transparent, hsl(var(--sidebar)))' }} />
        </div>

        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-black/40 text-white/80 backdrop-blur-sm transition-colors hover:bg-black/60 hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Avatar — sits on the banner/content boundary */}
        <div className="absolute -bottom-7 left-4">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 300, damping: 24 }}
          >
            <button
              type="button"
              disabled={!canOpenStory}
              onClick={() => {
                if (userId) onOpenStory?.(userId)
              }}
              className={[
                'rounded-full p-[2px] text-left',
                storyRingState === 'unseen' ? 'bg-gradient-to-tr from-[#0080c8] via-[#38b6d8] to-[#92dce5]' : '',
                storyRingState === 'seen' ? 'bg-muted-foreground/35' : '',
                storyRingState === 'none' ? 'bg-transparent' : '',
                canOpenStory ? 'transition-transform hover:scale-[1.03]' : '',
              ].join(' ')}
            >
              <Avatar className="h-14 w-14 ring-2 ring-sidebar shadow-lg">
                <AvatarImage src={avatar ?? undefined} alt={name} />
                <AvatarFallback className="bg-primary text-primary-foreground text-base font-semibold">
                  {initials}
                </AvatarFallback>
              </Avatar>
            </button>
            <StatusDot status={effectiveStatus} className="bottom-0.5 right-0.5 h-3 w-3" />
          </motion.div>
        </div>
      </div>

      {/* Content */}
      <div className="mt-9 flex flex-col">
        {showSkeleton ? (
          <div className="space-y-2 px-4 pt-1">
            <Skeleton className="h-5 w-36" />
            <Skeleton className="h-3.5 w-20" />
            <Skeleton className="mt-4 h-8 w-full" />
          </div>
        ) : (
          <>
            {/* Name */}
            <div className="px-4 pb-3">
              <div className="flex items-center gap-1">
                <UserName name={name} effect={nameEffect} subPlan={subPlan} className="text-sm font-bold leading-tight" />
                {showVerified && (
                  <VerifiedBadge size="sm" variant={getVerifiedBadgeVariant(subPlan)} />
                )}
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex justify-around px-3 pb-3">
              {[
                { icon: MessageCircle, label: 'Message', action: onClose },
                { icon: Phone, label: 'Call', action: onVoiceCall },
                { icon: Video, label: 'Video', action: onVideoCall },
                { icon: Gamepad2, label: 'Pixel Room', action: onOpenPixelRoom },
                { icon: QrCode, label: 'QR Code', action: username ? () => setQrOpen(true) : undefined },
              ].map(({ icon: Icon, label, action }) => (
                <button
                  key={label}
                  onClick={action}
                  disabled={!action}
                  className="flex flex-col items-center gap-1 disabled:opacity-40"
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted transition-colors hover:bg-muted/70">
                    <Icon className="h-4 w-4 text-foreground" />
                  </div>
                  <span className="text-[10px] text-muted-foreground">{label}</span>
                </button>
              ))}

              {/* More dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex flex-col items-center gap-1">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted transition-colors hover:bg-muted/70">
                      <MoreHorizontal className="h-4 w-4 text-foreground" />
                    </div>
                    <span className="text-[10px] text-muted-foreground">More</span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem onClick={handleMute} className="gap-2">
                    <BellOff className="h-4 w-4" />
                    Mute notifications
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleArchive} className="gap-2">
                    <Archive className="h-4 w-4" />
                    Archive conversation
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleBlock} className="gap-2 text-destructive focus:text-destructive">
                    <ShieldOff className="h-4 w-4" />
                    Block user
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {/* Divider */}
            <div className="mx-0 h-px bg-border/60" />

            {/* Info rows */}
            {(username || bio || website) && (
              <div className="py-1">
                {username && (
                  <InfoRow icon={AtSign} label="Username" value={`@${username}`} />
                )}
                {bio && (
                  <InfoRow icon={AlignLeft} label="Bio" value={bio} multiline />
                )}
                {website && (
                  <InfoRow
                    icon={Globe}
                    label="Website"
                    value={website}
                    href={website.startsWith('http') ? website : `https://${website}`}
                  />
                )}
                <div className="mx-0 h-px bg-border/60" />
              </div>
            )}

            {/* Shared media row */}
            <button className="flex w-full items-center gap-3 px-4 py-2.5 transition-colors hover:bg-muted/30">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-muted/60">
                <Image className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
              <span className="flex-1 text-left text-sm text-foreground">Shared Media</span>
              <span className="text-xs text-muted-foreground">0</span>
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50" />
            </button>
          </>
        )}
      </div>

      {qrOpen && username && (
        <QRCodeModal
          open={qrOpen}
          onClose={() => setQrOpen(false)}
          username={username}
          name={name}
          avatarUrl={avatar}
        />
      )}
    </div>
  )
}

function InfoRow({
  icon: Icon,
  label,
  value,
  href,
  multiline,
}: {
  icon: React.ElementType
  label: string
  value: string
  href?: string
  multiline?: boolean
}) {
  const content = (
    <div className="flex gap-2.5 px-4 py-2">
      <div className="mt-0.5 shrink-0">
        <Icon className="h-3.5 w-3.5 text-muted-foreground/60" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] text-muted-foreground/70 mb-0.5">{label}</p>
        <p
          className={`text-xs text-foreground ${multiline ? 'whitespace-pre-wrap' : 'truncate'} ${href ? 'text-primary' : ''}`}
        >
          {value}
        </p>
      </div>
    </div>
  )

  if (href) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className="block hover:bg-muted/20 transition-colors">
        {content}
      </a>
    )
  }

  return <div>{content}</div>
}
