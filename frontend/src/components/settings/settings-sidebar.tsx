'use client'

import { motion } from 'framer-motion'
import {
  Bell,
  ChevronRight,
  Eye,
  Globe,
  HardDrive,
  Languages,
  Link2,
  LogOut,
  NotebookPen,
  Palette,
  Shield,
  Sparkles,
  UserRound,
  UserRoundCog,
  Volume2,
  type LucideIcon,
} from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { VerifiedBadge, getVerifiedBadgeVariant } from '@/components/chat/verified-badge'
import { cn } from '@/lib/utils'
import { getInitial } from './shared'
import type { UserProfile } from '@/lib/user-api'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

export type SettingsSectionId =
  | 'account' | 'profile' | 'privacy' | 'notifications'
  | 'appearance' | 'messaging' | 'voice' | 'language'
  | 'security' | 'storage' | 'nitro' | 'connections' | 'about'

interface NavItem { id: SettingsSectionId; label: string; icon: LucideIcon; badge?: string; danger?: boolean }
interface NavCategory { label: string; items: NavItem[] }

export const NAV: NavCategory[] = [
  {
    label: 'User Settings',
    items: [
      { id: 'account',       label: 'My Account',      icon: UserRound },
      { id: 'profile',       label: 'Profile',          icon: UserRoundCog },
      { id: 'privacy',       label: 'Privacy & Safety', icon: Eye },
      { id: 'notifications', label: 'Notifications',    icon: Bell },
    ],
  },
  {
    label: 'App Settings',
    items: [
      { id: 'appearance', label: 'Appearance',    icon: Palette },
      { id: 'messaging',  label: 'Text & Images', icon: NotebookPen },
      { id: 'voice',      label: 'Voice & Video', icon: Volume2 },
      { id: 'language',   label: 'Language',      icon: Languages },
    ],
  },
  {
    label: 'Billing',
    items: [
      { id: 'nitro', label: 'Twiky Premium', icon: Sparkles },
    ],
  },
  {
    label: 'Integrations',
    items: [
      { id: 'connections', label: 'Connected Apps', icon: Link2 },
    ],
  },
  {
    label: 'Info',
    items: [
      { id: 'security', label: 'Security',    icon: Shield },
      { id: 'storage',  label: 'Storage',     icon: HardDrive },
      { id: 'about',    label: 'About Twiky', icon: Globe },
    ],
  },
]

export function SettingsSidebar({ profile, isVerified, avatarUrl }: {
  profile?: UserProfile
  isVerified: boolean
  avatarUrl?: string | null
}) {
  const pathname = usePathname()

  return (
    <nav className="flex w-[210px] flex-shrink-0 flex-col overflow-y-auto border-r border-border/60 bg-sidebar py-4">
      {/* User pill */}
      <div className="mb-4 px-3">
        <Link
          href="/settings/profile"
          className="flex w-full items-center gap-2.5 rounded-xl border border-border/50 bg-background/60 px-3 py-2.5 text-left transition-colors hover:bg-accent"
        >
          <Avatar className="h-8 w-8 flex-shrink-0">
            <AvatarImage src={avatarUrl ?? profile?.avatar_url ?? ''} alt={profile?.username ?? 'Profile'} />
            <AvatarFallback className="bg-primary text-[12px] font-bold text-primary-foreground">
              {getInitial(profile?.username)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-1.5">
              <p className="truncate text-[12px] font-semibold text-foreground">
                {profile?.fullname || profile?.username || 'Loading profile'}
              </p>
              {isVerified ? <VerifiedBadge size="xs" variant={getVerifiedBadgeVariant(profile?.sub_plan)} /> : null}
            </div>
            <p className="truncate text-[10.5px] text-muted-foreground">
              {profile?.username ? `@${profile.username}` : 'Backend profile'}
            </p>
          </div>
          <ChevronRight className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground/50" />
        </Link>
      </div>

      <div className="flex-1 space-y-5 px-2">
        {NAV.map((category, catIdx) => (
          <motion.div
            key={category.label}
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: catIdx * 0.06, duration: 0.22, ease: 'easeOut' }}
          >
            <p className="mb-1.5 px-2 text-[9.5px] font-bold uppercase tracking-[0.12em] text-muted-foreground/50">{category.label}</p>
            <div className="space-y-0.5">
              {category.items.map((item, itemIdx) => {
                const Icon = item.icon
                const isActive = pathname === `/settings/${item.id}` || (item.id === 'account' && pathname === '/settings')
                return (
                  <Link
                    key={item.id}
                    href={`/settings/${item.id}`}
                    className={cn(
                      'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left transition-colors',
                      isActive
                        ? 'bg-primary/10 font-semibold text-primary'
                        : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                    )}
                  >
                    <Icon className={cn('h-3.5 w-3.5 flex-shrink-0', isActive ? 'text-primary' : 'text-muted-foreground/70')} />
                    <span className="flex-1 text-[12.5px]">{item.label}</span>
                    {item.badge ? (
                      <span className="rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-medium text-muted-foreground">{item.badge}</span>
                    ) : null}
                  </Link>
                )
              })}
            </div>
          </motion.div>
        ))}
      </div>

      <div className="mt-auto px-2 pt-4">
        <div className="h-px bg-border/50 mb-3" />
        <button className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-destructive/80 transition-colors hover:bg-destructive/8 hover:text-destructive">
          <LogOut className="h-3.5 w-3.5" />
          <span className="text-[12.5px]">Log Out</span>
        </button>
      </div>
    </nav>
  )
}
