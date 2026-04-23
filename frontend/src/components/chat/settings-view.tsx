'use client'

import { type ChangeEvent, type ReactNode, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Archive,
  Bell,
  CalendarDays,
  ChevronRight,
  Database,
  Download,
  Eye,
  Fingerprint,
  Globe,
  HardDrive,
  ImageIcon,
  Languages,
  Link2,
  LogOut,
  NotebookPen,
  Palette,
  Shield,
  Smartphone,
  Sparkles,
  Trash2,
  Upload,
  UserRound,
  UserRoundCog,
  Users,
  Volume2,
  type LucideIcon,
} from 'lucide-react'

import { ModeToggle } from '@/components/ui/mode-toggle'
import { VerifiedBadge, isVerifiedAccountIdentity, isProPlan } from '@/components/chat/verified-badge'
import { useAuth } from '@/context/AuthContext'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Slider } from '@/components/ui/slider'
import { Switch } from '@/components/ui/switch'
import {
  useProfile,
  useUpdateProfile,
  useUserFollowers,
  useUserFollowing,
  useUserPosts,
} from '@/hooks/use-user'
import { useSpotifyAuthUrl, useSpotifyDisconnect, useSpotifyNowPlaying } from '@/hooks/use-spotify'
import type { UserPost, UserProfile } from '@/lib/user-api'
import { filesApi } from '@/lib/files-api'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

interface SettingsViewProps {
  initialSection?: string
  onAvatarChange?: (url: string) => void
  avatarUrl?: string | null
}

type SettingsSectionId =
  | 'account' | 'profile' | 'privacy' | 'notifications'
  | 'appearance' | 'messaging' | 'voice' | 'language'
  | 'security' | 'storage' | 'nitro' | 'connections' | 'about'

interface NavItem { id: SettingsSectionId; label: string; icon: LucideIcon; badge?: string; danger?: boolean }
interface NavCategory { label: string; items: NavItem[] }

const NAV: NavCategory[] = [
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

// ─── shared UI helpers ────────────────────────────────────────────────────────

function SettingRow({ title, description, children, badge }: {
  title: string; description?: string; children: ReactNode; badge?: string
}) {
  return (
    <div className="group flex items-center justify-between gap-4 py-2.5 transition-colors hover:bg-accent/30 px-1 rounded-lg">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="text-[13px] font-medium text-foreground">{title}</p>
          {badge ? <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">{badge}</span> : null}
        </div>
        {description ? <p className="mt-0.5 text-[11.5px] text-muted-foreground">{description}</p> : null}
      </div>
      <div className="flex-shrink-0">{children}</div>
    </div>
  )
}

function SectionHeader({ title, description }: { title: string; description?: string }) {
  return (
    <div className="mb-7">
      <h2 className="text-[20px] font-bold tracking-tight text-foreground">{title}</h2>
      {description ? <p className="mt-1 text-[12.5px] text-muted-foreground">{description}</p> : null}
    </div>
  )
}

function SectionBlock({ title, children, delay = 0 }: { title?: string; children: ReactNode; delay?: number }) {
  return (
    <motion.div
      className="mb-6"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.24, ease: 'easeOut' }}
    >
      {title ? (
        <p className="mb-1 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/60">{title}</p>
      ) : null}
      <div className="divide-y divide-border/40">
        {children}
      </div>
    </motion.div>
  )
}

// ─── sections ─────────────────────────────────────────────────────────────────

function formatDate(value?: string | null) {
  if (!value) return 'Not available'

  return new Intl.DateTimeFormat('en', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(value))
}

function formatRelativeDate(value?: string | null) {
  if (!value) return 'Never'

  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value))
}

function getInitial(value?: string | null) {
  return (value?.trim()[0] ?? 'T').toUpperCase()
}

function versionedImageUrl(url: string) {
  const separator = url.includes('?') ? '&' : '?'
  return `${url}${separator}v=${Date.now()}`
}

function AccountSection({ profile }: { profile?: UserProfile }) {
  return (
    <>
      <SectionHeader title="My Account" description="Manage your credentials and linked accounts." />
      <SectionBlock title="Account Info">
        <SettingRow title="Username" description={profile?.username ? `@${profile.username}` : 'Not set'}>
          <Button variant="outline" size="sm" className="h-8 rounded-xl text-[11px]">Edit</Button>
        </SettingRow>
        <SettingRow title="User ID" description={profile?.id ?? 'Loading profile...'}>
          <Badge variant="outline" className="rounded-full text-[10px]">Backend</Badge>
        </SettingRow>
        <SettingRow title="Phone number" description={profile?.phone_number ?? 'Not set'}>
          <Button variant="outline" size="sm" className="h-8 rounded-xl text-[11px]">
            {profile?.phone_number ? 'Edit' : 'Add'}
          </Button>
        </SettingRow>
        <SettingRow title="Member since" description={formatDate(profile?.created_at)}>
          <CalendarDays className="h-4 w-4 text-muted-foreground" />
        </SettingRow>
        <SettingRow title="Last seen" description={formatRelativeDate(profile?.last_seen_at)}>
          <Badge variant="secondary" className="rounded-full text-[10px]">
            {profile?.status ?? 'Offline'}
          </Badge>
        </SettingRow>
      </SectionBlock>
      <SectionBlock title="Password & Authentication">
        <SettingRow title="Password" description="Last changed 3 months ago">
          <Button variant="outline" size="sm" className="h-8 rounded-xl text-[11px]">Change</Button>
        </SettingRow>
        <SettingRow title="Two-factor auth" description="Add an extra layer of security.">
          <Button variant="outline" size="sm" className="h-8 rounded-xl text-[11px] gap-1.5">
            <Shield className="h-3.5 w-3.5" />Enable 2FA
          </Button>
        </SettingRow>
        <SettingRow title="Backup codes" description="Emergency one-time access codes.">
          <Button variant="ghost" size="sm" className="h-8 rounded-xl text-[11px]">View</Button>
        </SettingRow>
      </SectionBlock>
      <SectionBlock title="Account Actions">
        <SettingRow title="Download my data" description="Request a copy of all your data.">
          <Button variant="outline" size="sm" className="h-8 rounded-xl text-[11px] gap-1.5">
            <Download className="h-3.5 w-3.5" />Request
          </Button>
        </SettingRow>
        <div className="py-3">
          <p className="text-[13px] font-semibold text-foreground">Danger Zone</p>
          <p className="mt-1 text-[12px] text-muted-foreground">These actions are permanent and cannot be undone.</p>
          <div className="mt-3 flex gap-2">
            <Button variant="outline" size="sm" className="h-8 rounded-xl border-amber-500/30 text-[11px] text-orange-600 hover:bg-orange-500/10">
              <Archive className="mr-1.5 h-3.5 w-3.5" />Deactivate
            </Button>
            <Button variant="outline" size="sm" className="h-8 rounded-xl border-destructive/30 text-[11px] text-destructive hover:bg-destructive/10">
              <Trash2 className="mr-1.5 h-3.5 w-3.5" />Delete Account
            </Button>
          </div>
        </div>
      </SectionBlock>
    </>
  )
}

function ProfileSection({
  avatarUrl,
  bannerUrl,
  followersCount,
  followingCount,
  isPro,
  posts,
  profile,
  profileLoading,
  onAvatarChange,
  onBannerChange,
}: {
  avatarUrl: string | null
  bannerUrl: string | null
  followersCount: number
  followingCount: number
  isPro: boolean
  posts: UserPost[]
  profile?: UserProfile
  profileLoading: boolean
  onAvatarChange: (url: string) => void
  onBannerChange: (url: string) => void
}) {
  const { user } = useAuth()
  const avatarRef = useRef<HTMLInputElement>(null)
  const bannerRef = useRef<HTMLInputElement>(null)
  const updateProfile = useUpdateProfile()
  const [saveMessage, setSaveMessage] = useState<string | null>(null)
  const [avatarBusy, setAvatarBusy] = useState(false)
  const [bannerBusy, setBannerBusy] = useState(false)
  const [fullname, setFullname] = useState(profile?.fullname ?? '')
  const [username, setUsername] = useState(profile?.username ?? '')
  const [pronouns, setPronouns] = useState('')
  const [location, setLocation] = useState('')
  const [bio, setBio] = useState(profile?.bio ?? '')
  const [status, setStatus] = useState(profile?.status ?? '')
  const [statusEmoji, setStatusEmoji] = useState('🟢')
  const [xUrl, setXUrl] = useState(profile?.x_url ?? '')
  const [websiteUrl, setWebsiteUrl] = useState(profile?.website_url ?? '')

  async function handleSaveProfile() {
    setSaveMessage(null)
    await updateProfile.mutateAsync({
      bio: bio.trim() || null,
      fullname: fullname.trim() || null,
      status: status.trim() || null,
      username: username.trim() || undefined
    })
    setSaveMessage('Saved')
  }

  async function handleAvatarFile(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    setAvatarBusy(true)
    try {
      const { publicUrl } = await filesApi.uploadUserAvatar(f)
      await updateProfile.mutateAsync({ avatar_url: publicUrl })
      onAvatarChange(publicUrl)
      toast.success('Avatar updated')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setAvatarBusy(false)
    }
  }

  async function handleBannerFile(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    setBannerBusy(true)
    try {
      const { publicUrl } = await filesApi.uploadUserLogo(f)
      const nextBannerUrl = versionedImageUrl(publicUrl)
      await updateProfile.mutateAsync({ banner: nextBannerUrl })
      onBannerChange(nextBannerUrl)
      toast.success('Banner updated')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setBannerBusy(false)
    }
  }

  async function handleBannerRemove() {
    setBannerBusy(true)
    try {
      await updateProfile.mutateAsync({ banner: null })
      onBannerChange('')
      toast.success('Banner removed')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not remove banner')
    } finally {
      setBannerBusy(false)
    }
  }

  const BANNER_GRADIENTS = [
    'from-sky-500 via-cyan-500 to-blue-600',
    'from-violet-500 via-purple-500 to-fuchsia-600',
    'from-emerald-500 via-teal-500 to-cyan-600',
    'from-orange-500 via-amber-500 to-yellow-500',
    'from-pink-500 via-rose-500 to-red-600',
    'from-indigo-500 via-blue-500 to-sky-600',
  ]
  const effectiveAvatarUrl = avatarUrl ?? profile?.avatar_url ?? null
  const effectiveBannerUrl = bannerUrl ?? profile?.banner ?? null
  const isVerified = isVerifiedAccountIdentity({
    email: profile?.email ?? user?.email,
    id: profile?.id,
    is_verified: profile?.is_verified,
  })
  const [selectedGradient, setSelectedGradient] = useState(0)

  return (
    <>
      <SectionHeader title="Profile" description="Customize how you appear to others in Twiky." />

      {/* Profile preview */}
      <div className="mb-6 overflow-visible">
        {/* Banner */}
        <div
          className={cn(
            'group relative h-20 cursor-pointer overflow-hidden rounded-t-2xl',
            !effectiveBannerUrl && cn('bg-gradient-to-br', BANNER_GRADIENTS[selectedGradient]),
          )}
          onClick={() => bannerRef.current?.click()}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault()
              bannerRef.current?.click()
            }
          }}
          role="button"
          tabIndex={0}
        >
          {effectiveBannerUrl ? <img src={effectiveBannerUrl} alt="Banner" className="h-full w-full object-cover" /> : null}
          <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/20 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-primary/15 via-transparent to-transparent" />
          <div className="absolute inset-0 flex items-center justify-center gap-1.5 bg-black/35 opacity-0 transition-opacity group-hover:opacity-100">
            <Upload className="h-4 w-4 text-white" />
            <span className="text-[12px] font-semibold text-white">
              {effectiveBannerUrl ? 'Change banner' : 'Upload banner'}
            </span>
          </div>
          <div className="absolute left-3 top-3 rounded-full border border-white/20 bg-black/40 px-2.5 py-1 backdrop-blur-sm">
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-white/90">
              Profile header
            </p>
          </div>
          <div className="absolute right-3 top-3 flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
            {effectiveBannerUrl ? (
              <button
                type="button"
                disabled={bannerBusy}
                onClick={() => void handleBannerRemove()}
                className="inline-flex h-7 items-center gap-1 rounded-full border border-white/20 bg-black/45 px-2.5 text-[10px] font-semibold text-white/90 backdrop-blur-sm transition-colors hover:bg-black/60"
              >
                <Trash2 className="h-3 w-3" />
                Remove
              </button>
            ) : null}
            <button
              type="button"
              disabled={bannerBusy}
              onClick={() => bannerRef.current?.click()}
              className="inline-flex h-7 items-center gap-1 rounded-full border border-white/20 bg-black/45 px-2.5 text-[10px] font-semibold text-white/90 backdrop-blur-sm transition-colors hover:bg-black/60 disabled:opacity-50"
            >
              <Upload className="h-3 w-3" />
              {effectiveBannerUrl ? 'Replace' : 'Upload'}
            </button>
          </div>
          <input ref={bannerRef} type="file" accept="image/*" className="hidden" onChange={(e) => void handleBannerFile(e)} />

          {!effectiveBannerUrl ? (
            <div className="absolute bottom-2.5 right-2.5 flex items-center gap-1.5 rounded-full border border-white/20 bg-black/40 px-2 py-1.5 backdrop-blur-sm" onClick={(e) => e.stopPropagation()}>
              <span className="text-[10px] font-medium text-white/80">Style</span>
              {BANNER_GRADIENTS.map((g, i) => (
                <button
                  type="button"
                  key={i}
                  onClick={() => setSelectedGradient(i)}
                  className={cn('h-4 w-4 rounded-full bg-gradient-to-br transition-transform hover:scale-110', g, selectedGradient === i && 'ring-2 ring-white ring-offset-1 ring-offset-black/40')}
                />
              ))}
            </div>
          ) : null}
        </div>

        {/* Profile info preview */}
        <div className="px-4 pb-4">
          {/* Avatar row */}
          <div className="relative z-10 mb-3 -mt-8">
            <button
              type="button"
              disabled={avatarBusy}
              className="relative cursor-pointer disabled:pointer-events-none disabled:opacity-50"
              onClick={() => avatarRef.current?.click()}
            >
              <div className="h-16 w-16 overflow-hidden rounded-2xl border-4 border-card">
                {effectiveAvatarUrl ? (
                  <img src={effectiveAvatarUrl} alt={fullname} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-primary text-[22px] font-bold text-primary-foreground">
                    {fullname?.[0]?.toUpperCase() ?? 'Z'}
                  </div>
                )}
              </div>
              <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-black/50 opacity-0 transition-opacity hover:opacity-100">
                <Upload className="h-4 w-4 text-white" />
              </div>
              <input ref={avatarRef} type="file" accept="image/*" className="hidden" onChange={(e) => void handleAvatarFile(e)} />
            </button>
          </div>

          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="text-[17px] font-bold text-foreground">{fullname || 'Your Name'}</p>
                {isVerified ? <VerifiedBadge size="sm" variant={isPro ? 'pro' : 'standard'} /> : null}
                {status ? <span className="text-[13px]">{statusEmoji}</span> : null}
              </div>
              <p className="text-[12px] text-muted-foreground">@{username}</p>
              {bio ? <p className="mt-1.5 text-[12px] leading-[1.5] text-foreground">{bio}</p> : null}
            </div>
            <div className="flex flex-shrink-0 items-center gap-4">
              {[
                { label: 'Followers', value: followersCount },
                { label: 'Following', value: followingCount },
                { label: 'Posts', value: posts.length },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-baseline gap-1">
                  <span className="text-[14px] font-bold text-foreground">{profileLoading ? '-' : value}</span>
                  <span className="text-[11px] text-muted-foreground">{label}</span>
                </div>
              ))}
            </div>
          </div>

          {(xUrl || websiteUrl) ? (
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {xUrl ? <span className="flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground">X {xUrl}</span> : null}
              {websiteUrl ? <span className="flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground"><Link2 className="h-2.5 w-2.5" />{websiteUrl}</span> : null}
            </div>
          ) : null}
        </div>
      </div>

      {/* Edit fields */}
      <SectionBlock title="Identity">
        <div className="space-y-4 py-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label className="mb-1.5 block text-[11px] text-muted-foreground">Display name</Label>
              <input
                value={fullname}
                onChange={(e) => setFullname(e.target.value)}
                placeholder="How your name appears"
                className="h-10 w-full rounded-xl border border-border bg-background px-3 text-[13px] focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            <div>
              <Label className="mb-1.5 block text-[11px] text-muted-foreground">Username</Label>
              <div className="flex h-10 w-full items-center overflow-hidden rounded-xl border border-border bg-background px-3">
                <span className="text-[12px] text-muted-foreground">@</span>
                <input
                  value={username}
                  onChange={(e) => setUsername(e.target.value.replace(/\s+/g, '').toLowerCase())}
                  className="flex-1 bg-transparent px-1 text-[13px] focus:outline-none"
                />
              </div>
            </div>
          </div>
          <div>
            <Label className="mb-1.5 block text-[11px] text-muted-foreground">About me</Label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value.slice(0, 190))}
              placeholder="Tell people what you build, what you care about, and how they should reach you."
              rows={4}
              className="w-full resize-none rounded-xl border border-border bg-background p-3 text-[13px] leading-5 focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <p className="mt-1 text-right text-[10px] text-muted-foreground">{bio.length}/190</p>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Tip: profiles with a clear bio and one social link get more profile visits.
          </p>
          <div className="flex items-center justify-end gap-2">
            {updateProfile.isError ? (
              <span className="text-[11px] text-destructive">
                {updateProfile.error.message}
              </span>
            ) : saveMessage ? (
              <span className="text-[11px] text-emerald-600 dark:text-emerald-400">
                {saveMessage}
              </span>
            ) : null}
          </div>
        </div>
      </SectionBlock>

      <SectionBlock title="Status">
        <SettingRow title="Status emoji" description="Emoji shown next to your name.">
          <div className="flex items-center gap-2">
            {['🟢','🌙','🎯','💻','📵','🔴'].map((e) => (
              <button
                key={e}
                onClick={() => setStatusEmoji(e)}
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-lg text-[16px] transition-colors hover:bg-accent',
                  statusEmoji === e && 'bg-primary/10 ring-1 ring-primary',
                )}
              >
                {e}
              </button>
            ))}
          </div>
        </SettingRow>
        <SettingRow title="Status message" description="Short note about what you're doing.">
          <input value={status} onChange={(e) => setStatus(e.target.value)} placeholder="Working on something..." className="h-9 w-52 rounded-xl border border-border bg-background px-3 text-[12px] focus:outline-none focus:ring-1 focus:ring-primary" />
        </SettingRow>
      </SectionBlock>

      <SectionBlock title="Social Links">
        <SettingRow title="X" description="Link to your X profile.">
          <div className="flex h-9 w-48 items-center gap-2 overflow-hidden rounded-xl border border-border bg-background px-3">
            <span className="text-[11px] font-bold text-muted-foreground">X</span>
            <input value={xUrl} onChange={(e) => setXUrl(e.target.value)} placeholder="https://x.com/username" className="flex-1 bg-transparent text-[12px] focus:outline-none" />
          </div>
        </SettingRow>
        <SettingRow title="Website URL" description="Your personal website.">
          <div className="flex h-9 w-48 items-center gap-2 overflow-hidden rounded-xl border border-border bg-background px-3">
            <Link2 className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
            <input value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)} placeholder="https://..." className="flex-1 bg-transparent text-[12px] focus:outline-none" />
          </div>
        </SettingRow>
        <div className="flex justify-end py-2">
          <Button
            className="h-8 rounded-xl text-[12px]"
            disabled={!username.trim() || updateProfile.isPending}
            onClick={handleSaveProfile}
          >
            {updateProfile.isPending ? 'Saving...' : 'Save profile'}
          </Button>
        </div>
      </SectionBlock>

      <SectionBlock title="Recent Posts">
        <div className="space-y-2 py-2">
          {posts.length ? (
            posts.slice(0, 3).map((post) => {
              const firstMediaUrl = post.media_urls?.[0] ?? null

              return (
                <div key={post.id} className="flex gap-3 py-2">
                  <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg bg-muted">
                    {firstMediaUrl ? (
                      <img src={firstMediaUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <ImageIcon className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-[12px] leading-5 text-foreground">
                      {post.caption || 'No caption'}
                    </p>
                    <p className="mt-1 text-[10.5px] text-muted-foreground">
                      {formatDate(post.created_at)}
                    </p>
                  </div>
                </div>
              )
            })
          ) : (
            <p className="px-1 py-3 text-[12px] text-muted-foreground">
              No posts from the backend yet.
            </p>
          )}
        </div>
      </SectionBlock>

      <SectionBlock title="Pixel Room">
        <div className="py-2">
          <div className="relative overflow-hidden rounded-2xl">
            <img
              src={(() => {
                const artwork = `<rect width='800' height='560' rx='38' fill='#0B1422'/><rect y='320' width='800' height='240' fill='#20384A'/><rect x='90' y='96' width='146' height='126' fill='#2D4B79'/><rect x='112' y='118' width='104' height='80' fill='#9EE6FF'/><rect x='298' y='84' width='118' height='92' fill='#F3B949'/><rect x='318' y='102' width='78' height='40' fill='#FFF0BF'/><rect x='112' y='372' width='264' height='88' fill='#4B6CB7'/><rect x='520' y='112' width='132' height='152' fill='#252F45'/><rect x='548' y='136' width='84' height='48' fill='#FFD369'/>`
                const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 800 560' fill='none'>${artwork}</svg>`
                return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`
              })()}
              alt="Pixel Room"
              className="h-44 w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
            <div className="absolute bottom-3 left-4 right-4 flex items-end justify-between">
              <div>
                <p className="text-[13px] font-bold text-white">Your Room</p>
                <p className="text-[11px] text-white/70">Pixel World · coming soon</p>
              </div>
              <span className="rounded-full bg-white/15 px-2.5 py-1 text-[10px] font-semibold text-white backdrop-blur-sm">
                Preview
              </span>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {[
              { label: 'Furniture', value: '—' },
              { label: 'Visitors', value: '—' },
              { label: 'Style', value: '—' },
            ].map(({ label, value }) => (
              <div key={label} className="text-center">
                <p className="text-[15px] font-bold text-muted-foreground">{value}</p>
                <p className="text-[10px] text-muted-foreground">{label}</p>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[11px] text-muted-foreground">
            Your pixel room will be customizable once Pixel World launches. Visitors can drop by and leave messages.
          </p>
        </div>
      </SectionBlock>
    </>
  )
}

function PrivacySection() {
  const [readReceipts, setReadReceipts] = useState(true)
  const [onlineStatus, setOnlineStatus] = useState(true)
  const [typingIndicators, setTypingIndicators] = useState(true)
  const [linkPreviews, setLinkPreviews] = useState(true)
  const [lastSeen, setLastSeen] = useState('followers')
  const [profilePhoto, setProfilePhoto] = useState('everyone')
  const [visibility, setVisibility] = useState('followers')
  const [dmFromStrangers, setDmFromStrangers] = useState(true)
  const score = [readReceipts, onlineStatus, visibility !== 'public', lastSeen !== 'everyone'].filter(Boolean).length * 25

  return (
    <>
      <SectionHeader title="Privacy & Safety" description="Control your visibility and what others see." />
      <div className="mb-6">
        <div className="flex items-center justify-between text-[12px]">
          <span className="font-semibold text-foreground">Privacy score</span>
          <span className={cn('font-bold', score >= 75 ? 'text-emerald-500' : score >= 50 ? 'text-orange-500' : 'text-destructive')}>{score}%</span>
        </div>
        <Progress value={score} className="mt-2 h-1.5" />
        <p className="mt-2 text-[11px] text-muted-foreground">{score >= 75 ? 'Strong privacy setup.' : score >= 50 ? 'Good baseline. Consider hiding last seen.' : 'Low privacy — review settings below.'}</p>
      </div>
      <SectionBlock title="Activity & Presence">
        <SettingRow title="Read receipts" description="Show when you've read a message."><Switch checked={readReceipts} onCheckedChange={setReadReceipts} /></SettingRow>
        <SettingRow title="Online status" description="Show your activity indicator."><Switch checked={onlineStatus} onCheckedChange={setOnlineStatus} /></SettingRow>
        <SettingRow title="Typing indicators" description="Show when you're composing."><Switch checked={typingIndicators} onCheckedChange={setTypingIndicators} /></SettingRow>
      </SectionBlock>
      <SectionBlock title="Visibility">
        <SettingRow title="Last seen" description="Who can see when you were last active.">
          <Select value={lastSeen} onValueChange={setLastSeen}><SelectTrigger className="h-8 w-[130px] rounded-xl text-[12px]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="everyone">Everyone</SelectItem><SelectItem value="followers">Followers</SelectItem><SelectItem value="nobody">Nobody</SelectItem></SelectContent></Select>
        </SettingRow>
        <SettingRow title="Profile photo" description="Who can see your avatar.">
          <Select value={profilePhoto} onValueChange={setProfilePhoto}><SelectTrigger className="h-8 w-[130px] rounded-xl text-[12px]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="everyone">Everyone</SelectItem><SelectItem value="followers">Followers</SelectItem><SelectItem value="nobody">Nobody</SelectItem></SelectContent></Select>
        </SettingRow>
        <SettingRow title="Account discovery" description="Allow others to find you.">
          <Select value={visibility} onValueChange={setVisibility}><SelectTrigger className="h-8 w-[130px] rounded-xl text-[12px]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="public">Public</SelectItem><SelectItem value="followers">Followers</SelectItem><SelectItem value="private">Private</SelectItem></SelectContent></Select>
        </SettingRow>
      </SectionBlock>
      <SectionBlock title="Messages">
        <SettingRow title="DMs from anyone" description="Allow strangers to message you."><Switch checked={dmFromStrangers} onCheckedChange={setDmFromStrangers} /></SettingRow>
        <SettingRow title="Link previews" description="Expand URLs in your messages."><Switch checked={linkPreviews} onCheckedChange={setLinkPreviews} /></SettingRow>
      </SectionBlock>
    </>
  )
}

function NotificationsSection() {
  const [desktop, setDesktop] = useState(true)
  const [dnd, setDnd] = useState(false)
  const [sound, setSound] = useState(true)
  const [volume, setVolume] = useState([70])
  const [mentions, setMentions] = useState(true)
  const [replies, setReplies] = useState(true)
  const [channels, setChannels] = useState(false)
  const [digest, setDigest] = useState('hourly')

  return (
    <>
      <SectionHeader title="Notifications" description="Choose how and when Twiky alerts you." />
      <SectionBlock title="Desktop & Mobile">
        <SettingRow title="Enable notifications" description="Show alerts for messages and activity."><Switch checked={desktop} onCheckedChange={setDesktop} /></SettingRow>
        <SettingRow title="Do not disturb" description="Silence all notifications."><Switch checked={dnd} onCheckedChange={setDnd} /></SettingRow>
        <SettingRow title="Digest mode" description="Bundle lower-priority alerts.">
          <Select value={digest} onValueChange={setDigest}><SelectTrigger className="h-8 w-[120px] rounded-xl text-[12px]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="realtime">Realtime</SelectItem><SelectItem value="hourly">Hourly</SelectItem><SelectItem value="daily">Daily</SelectItem><SelectItem value="off">Off</SelectItem></SelectContent></Select>
        </SettingRow>
      </SectionBlock>
      <SectionBlock title="Sounds">
        <SettingRow title="Message sounds" description="Play audio on new message."><Switch checked={sound} onCheckedChange={setSound} /></SettingRow>
        <div className="py-3">
          <div className="flex items-center justify-between text-[12px]"><span className="font-medium text-foreground">Volume</span><span className="text-muted-foreground">{volume[0]}%</span></div>
          <Slider value={volume} onValueChange={setVolume} min={0} max={100} step={5} disabled={!sound} className="mt-2" />
        </div>
      </SectionBlock>
      <SectionBlock title="What notifies you">
        <SettingRow title="@Mentions" description="Someone tags you." badge="Recommended"><Switch checked={mentions} onCheckedChange={setMentions} /></SettingRow>
        <SettingRow title="Replies" description="Someone replies to you."><Switch checked={replies} onCheckedChange={setReplies} /></SettingRow>
        <SettingRow title="All channel messages" description="Every post in followed channels." badge="Noisy"><Switch checked={channels} onCheckedChange={setChannels} /></SettingRow>
      </SectionBlock>
    </>
  )
}

const COLOR_PRESETS = [
  { name: 'Blue',   hsl: '221 83% 53%',  fg: '0 0% 98%',  preview: '#3b82f6' },
  { name: 'Indigo', hsl: '239 84% 67%',  fg: '0 0% 98%',  preview: '#6366f1' },
  { name: 'Purple', hsl: '262 83% 58%',  fg: '0 0% 98%',  preview: '#8b5cf6' },
  { name: 'Pink',   hsl: '336 80% 58%',  fg: '0 0% 98%',  preview: '#ec4899' },
  { name: 'Red',    hsl: '0 84% 60%',    fg: '0 0% 98%',  preview: '#ef4444' },
  { name: 'Orange', hsl: '25 95% 53%',   fg: '0 0% 98%',  preview: '#f97316' },
  { name: 'Amber',  hsl: '38 92% 50%',   fg: '0 0% 9%',   preview: '#f59e0b' },
  { name: 'Green',  hsl: '142 71% 45%',  fg: '0 0% 98%',  preview: '#22c55e' },
  { name: 'Teal',   hsl: '172 66% 50%',  fg: '0 0% 9%',   preview: '#14b8a6' },
  { name: 'Cyan',   hsl: '189 94% 43%',  fg: '0 0% 9%',   preview: '#06b6d4' },
  { name: 'Slate',  hsl: '215 28% 47%',  fg: '0 0% 98%',  preview: '#64748b' },
  { name: 'Rose',   hsl: '351 80% 60%',  fg: '0 0% 98%',  preview: '#f43f5e' },
] as const

function applyThemeColor(preset: typeof COLOR_PRESETS[number]) {
  if (typeof document === 'undefined') return
  document.documentElement.style.setProperty('--primary', preset.hsl)
  document.documentElement.style.setProperty('--primary-foreground', preset.fg)
  document.documentElement.style.setProperty('--ring', preset.hsl)
  try { localStorage.setItem('twiky-color', JSON.stringify(preset)) } catch {}
}

function AppearanceSection() {
  const [selectedColor, setSelectedColor] = useState('Blue')

  useEffect(() => {
    try {
      const saved = localStorage.getItem('twiky-color')
      if (saved) {
        const preset = JSON.parse(saved) as typeof COLOR_PRESETS[number]
        setSelectedColor(preset.name)
        applyThemeColor(preset)
      }
    } catch {}
  }, [])

  return (
    <>
      <SectionHeader title="Appearance" description="Customize the look and feel of your workspace." />

      <SectionBlock title="Theme">
        <SettingRow title="App theme" description="Light, dark, or system preference.">
          <ModeToggle buttonClassName="h-9 w-9 rounded-xl" />
        </SettingRow>
      </SectionBlock>

      <SectionBlock title="Accent Color">
        <div className="space-y-4 py-2">
          <div className="flex flex-wrap gap-3">
            {COLOR_PRESETS.map((preset) => {
              const isSelected = selectedColor === preset.name
              return (
                <button
                  key={preset.name}
                  title={preset.name}
                  onClick={() => { setSelectedColor(preset.name); applyThemeColor(preset) }}
                  className="flex flex-col items-center gap-1.5"
                >
                  <div
                    className="h-8 w-8 rounded-full transition-transform hover:scale-110"
                    style={{
                      backgroundColor: preset.preview,
                      transform: isSelected ? 'scale(1.15)' : undefined,
                      boxShadow: isSelected
                        ? `0 0 0 2.5px var(--color-card, #1e1e2e), 0 0 0 4.5px ${preset.preview}`
                        : undefined,
                    }}
                  />
                  <span className={cn('text-[10px] font-medium', isSelected ? 'text-foreground' : 'text-muted-foreground')}>
                    {preset.name}
                  </span>
                </button>
              )
            })}
          </div>

          <div className="flex items-center gap-3 py-1">
            <div
              className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-[11px] font-bold text-white"
              style={{ backgroundColor: COLOR_PRESETS.find((p) => p.name === selectedColor)?.preview }}
            >
              Aa
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[12px] font-semibold text-foreground">{selectedColor}</p>
              <p className="text-[11px] text-muted-foreground">Applied to buttons, links, and highlights</p>
            </div>
            <Button size="sm" className="h-7 flex-shrink-0 rounded-lg px-3 text-[11px]">Preview</Button>
          </div>
        </div>
      </SectionBlock>

    </>
  )
}

function MessagingSection() {
  const [sendOnEnter, setSendOnEnter] = useState(true)
  const [spellcheck, setSpellcheck] = useState(true)
  const [formatting, setFormatting] = useState(true)
  const [emoji, setEmoji] = useState(true)
  const [mediaAutoDownload, setMediaAutoDownload] = useState(true)
  const [autosave, setAutosave] = useState(true)
  const [goalTimeline, setGoalTimeline] = useState('month')

  return (
    <>
      <SectionHeader title="Text & Images" description="Control how you compose messages and handle media." />
      <SectionBlock title="Composer">
        <SettingRow title="Send on Enter" description="Enter to send, Shift+Enter for new line."><Switch checked={sendOnEnter} onCheckedChange={setSendOnEnter} /></SettingRow>
        <SettingRow title="Spellcheck" description="Highlight spelling errors."><Switch checked={spellcheck} onCheckedChange={setSpellcheck} /></SettingRow>
        <SettingRow title="Markdown" description="Bold, italic, code blocks."><Switch checked={formatting} onCheckedChange={setFormatting} /></SettingRow>
        <SettingRow title="Emoji suggestions" description="Show picker on :emoji:."><Switch checked={emoji} onCheckedChange={setEmoji} /></SettingRow>
      </SectionBlock>
      <SectionBlock title="Media">
        <SettingRow title="Auto-download" description="Save images and videos automatically."><Switch checked={mediaAutoDownload} onCheckedChange={setMediaAutoDownload} /></SettingRow>
      </SectionBlock>
      <SectionBlock title="Notes & Goals">
        <SettingRow title="Notes autosave" description="Auto-save drafts in My Notes."><Switch checked={autosave} onCheckedChange={setAutosave} /></SettingRow>
        <SettingRow title="Goal timeline" description="Default span in My Goals.">
          <Select value={goalTimeline} onValueChange={setGoalTimeline}><SelectTrigger className="h-8 w-[120px] rounded-xl text-[12px]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="week">Week</SelectItem><SelectItem value="month">Month</SelectItem><SelectItem value="quarter">Quarter</SelectItem><SelectItem value="year">Year</SelectItem></SelectContent></Select>
        </SettingRow>
      </SectionBlock>
    </>
  )
}

function VoiceSection() {
  const [inputDevice, setInputDevice] = useState('default')
  const [outputDevice, setOutputDevice] = useState('default')
  const [noiseSuppression, setNoiseSuppression] = useState(true)
  const [echoCancellation, setEchoCancellation] = useState(true)
  const [voiceActivity, setVoiceActivity] = useState(true)

  return (
    <>
      <SectionHeader title="Voice & Video" description="Configure your audio and video devices." />
      <SectionBlock title="Input">
        <SettingRow title="Microphone" description="Device used for voice calls.">
          <Select value={inputDevice} onValueChange={setInputDevice}><SelectTrigger className="h-8 w-[160px] rounded-xl text-[12px]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="default">Default</SelectItem><SelectItem value="built-in">Built-in Mic</SelectItem></SelectContent></Select>
        </SettingRow>
        <SettingRow title="Noise suppression" description="Reduce background noise."><Switch checked={noiseSuppression} onCheckedChange={setNoiseSuppression} /></SettingRow>
        <SettingRow title="Echo cancellation" description="Prevent feedback loops."><Switch checked={echoCancellation} onCheckedChange={setEchoCancellation} /></SettingRow>
      </SectionBlock>
      <SectionBlock title="Output">
        <SettingRow title="Speakers" description="Device used for audio output.">
          <Select value={outputDevice} onValueChange={setOutputDevice}><SelectTrigger className="h-8 w-[160px] rounded-xl text-[12px]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="default">Default</SelectItem><SelectItem value="built-in">Built-in Speakers</SelectItem></SelectContent></Select>
        </SettingRow>
        <SettingRow title="Voice activity detection" description="Auto-activate mic when speaking."><Switch checked={voiceActivity} onCheckedChange={setVoiceActivity} /></SettingRow>
      </SectionBlock>
    </>
  )
}

function LanguageSection() {
  const [language, setLanguage] = useState('en')
  return (
    <>
      <SectionHeader title="Language & Region" />
      <SectionBlock title="Language">
        <SettingRow title="Display language" description="UI text and interface language.">
          <Select value={language} onValueChange={setLanguage}><SelectTrigger className="h-8 w-[160px] rounded-xl text-[12px]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="en">English (US)</SelectItem><SelectItem value="fr">Français</SelectItem><SelectItem value="ar">العربية</SelectItem><SelectItem value="es">Español</SelectItem><SelectItem value="de">Deutsch</SelectItem></SelectContent></Select>
        </SettingRow>
      </SectionBlock>
    </>
  )
}

function SecuritySection() {
  const [twoFactor, setTwoFactor] = useState(false)
  const [loginAlerts, setLoginAlerts] = useState(true)
  const [sessionTimeout, setSessionTimeout] = useState('30d')

  return (
    <>
      <SectionHeader title="Security" description="Protect your account and manage sessions." />
      <SectionBlock title="Two-Factor Authentication">
        <div className="flex items-center justify-between py-2.5 px-1">
          <div>
            <p className="text-[13px] font-medium text-foreground">2FA is {twoFactor ? 'active' : 'not enabled'}</p>
            <p className="mt-0.5 text-[11.5px] text-muted-foreground">{twoFactor ? 'Your account is protected.' : 'Strongly recommended.'}</p>
          </div>
          <Switch checked={twoFactor} onCheckedChange={setTwoFactor} />
        </div>
        {!twoFactor ? <div className="py-2"><Button variant="outline" size="sm" className="h-8 rounded-xl text-[11px] gap-1.5"><Smartphone className="h-3.5 w-3.5" />Set up authenticator</Button></div> : null}
      </SectionBlock>
      <SectionBlock title="Sessions">
        <SettingRow title="Login alerts" description="Notify on new device sign-ins."><Switch checked={loginAlerts} onCheckedChange={setLoginAlerts} /></SettingRow>
        <SettingRow title="Session timeout" description="Auto sign-out after inactivity.">
          <Select value={sessionTimeout} onValueChange={setSessionTimeout}><SelectTrigger className="h-8 w-[120px] rounded-xl text-[12px]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="1d">1 day</SelectItem><SelectItem value="7d">7 days</SelectItem><SelectItem value="30d">30 days</SelectItem><SelectItem value="never">Never</SelectItem></SelectContent></Select>
        </SettingRow>
        <div className="py-2"><Button variant="outline" size="sm" className="h-8 rounded-xl text-[11px] text-destructive border-destructive/30 hover:bg-destructive/10"><LogOut className="mr-1.5 h-3.5 w-3.5" />Sign out all other devices</Button></div>
      </SectionBlock>
    </>
  )
}

function StorageSection() {
  return (
    <>
      <SectionHeader title="Storage" description="Manage cached data and local files." />
      <div className="mb-6 grid grid-cols-2 gap-6">
        {[{ label: 'App cache', value: '124 MB', icon: Database }, { label: 'Media stored', value: '843 MB', icon: HardDrive }].map(({ label, value, icon: Icon }) => (
          <div key={label}>
            <Icon className="h-5 w-5 text-muted-foreground" />
            <p className="mt-2 text-[22px] font-bold text-foreground">{value}</p>
            <p className="text-[11px] text-muted-foreground">{label}</p>
          </div>
        ))}
      </div>
      <SectionBlock title="Actions">
        <div className="space-y-2 py-2">
          <Button variant="outline" size="sm" className="h-9 rounded-xl text-[12px] gap-2"><Trash2 className="h-4 w-4" />Clear app cache</Button>
          <br />
          <Button variant="outline" size="sm" className="h-9 rounded-xl text-[12px] gap-2"><Download className="h-4 w-4" />Export my data</Button>
        </div>
      </SectionBlock>
    </>
  )
}

const PRO_FEATURES = [
  { label: 'Pro verified badge', description: 'Gold shield badge on your profile and posts', pro: true, free: false },
  { label: 'Unlimited file uploads', description: 'Up to 100 MB per file, no daily cap', pro: true, free: false },
  { label: 'Custom profile themes', description: 'Exclusive color palettes and banner effects', pro: true, free: false },
  { label: 'Priority support', description: '24 h response, dedicated queue', pro: true, free: false },
  { label: 'Analytics dashboard', description: 'Post reach, follower growth, engagement stats', pro: true, free: false },
  { label: 'Extended message history', description: 'Unlimited search across all channels', pro: true, free: false },
  { label: 'Basic messaging', description: 'Text, images, reactions', pro: true, free: true },
  { label: 'Channel participation', description: 'Join and post in public channels', pro: true, free: true },
  { label: 'Standard file uploads', description: 'Up to 10 MB per file', pro: true, free: true },
]

function NitroSection({ isPro }: { isPro: boolean }) {
  return (
    <>
      <SectionHeader
        title="Twiky Premium"
        description={isPro ? 'You are on the Pro plan. Thank you for supporting Twiky.' : 'Unlock the full Twiky experience.'}
      />

      {/* Current plan banner */}
      {isPro ? (
        <motion.div
          className="mb-6 overflow-hidden rounded-[22px] border border-orange-400/30 bg-[linear-gradient(135deg,rgba(249,115,22,0.18),rgba(234,88,12,0.12),rgba(194,65,12,0.08))] p-5 shadow-[0_0_32px_rgba(249,115,22,0.12)]"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28, ease: 'easeOut' }}
        >
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-orange-500/15 ring-1 ring-orange-400/30">
              <Sparkles className="h-6 w-6 text-orange-500" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-[16px] font-bold text-foreground">Pro Plan</p>
                <span className="rounded-full border border-orange-400/40 bg-orange-500/15 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-orange-600 dark:text-orange-300">
                  Active
                </span>
              </div>
              <p className="mt-0.5 text-[12px] text-muted-foreground">elbidali.zakaria@gmail.com · Renews monthly</p>
              <div className="mt-3 grid grid-cols-3 gap-3">
                {[
                  { label: 'Plan', value: 'Pro' },
                  { label: 'Since', value: 'Apr 2026' },
                  { label: 'Next bill', value: 'May 23' },
                ].map(({ label, value }) => (
                  <div key={label} className="rounded-xl border border-orange-400/20 bg-background/60 px-3 py-2 text-center">
                    <p className="text-[13px] font-bold text-foreground">{value}</p>
                    <p className="text-[10px] text-muted-foreground">{label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <Button variant="outline" size="sm" className="h-8 rounded-xl border-orange-400/30 text-[11px] text-orange-600 hover:bg-orange-500/10 dark:text-orange-400">
              Manage billing
            </Button>
            <Button variant="ghost" size="sm" className="h-8 rounded-xl text-[11px] text-muted-foreground hover:text-destructive">
              Cancel plan
            </Button>
          </div>
        </motion.div>
      ) : (
        <motion.div
          className="mb-6 overflow-hidden rounded-[22px] border border-primary/20 bg-[linear-gradient(135deg,rgba(var(--primary)/0.12),rgba(var(--primary)/0.06))] p-5"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28, ease: 'easeOut' }}
        >
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-muted">
              <Users className="h-6 w-6 text-muted-foreground" />
            </div>
            <div>
              <p className="text-[15px] font-bold text-foreground">Free Plan</p>
              <p className="text-[12px] text-muted-foreground">Upgrade to Pro to unlock all features.</p>
            </div>
          </div>
          <Button className="mt-4 h-9 w-full rounded-xl text-[13px] font-semibold bg-[linear-gradient(135deg,#f59e0b,#d97706)] text-white hover:opacity-90 border-0">
            <Sparkles className="mr-2 h-4 w-4" />
            Upgrade to Pro · $9 / month
          </Button>
        </motion.div>
      )}

      {/* Feature comparison */}
      <SectionBlock title="What's included">
        <div className="space-y-0">
          {PRO_FEATURES.map((feat, i) => (
            <motion.div
              key={feat.label}
              className="flex items-start gap-3 py-2.5 px-1"
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.04, duration: 0.2 }}
            >
              <div className={cn(
                'mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-[10px]',
                feat.pro
                  ? 'bg-orange-500/15 text-orange-600 dark:text-orange-400'
                  : 'bg-muted text-muted-foreground',
              )}>
                ✓
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-[13px] font-medium text-foreground">{feat.label}</p>
                  {!feat.free && (
                    <span className="rounded-full border border-orange-400/30 bg-orange-500/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-orange-600 dark:text-orange-400">
                      Pro
                    </span>
                  )}
                </div>
                <p className="text-[11.5px] text-muted-foreground">{feat.description}</p>
              </div>
              <div className="flex flex-shrink-0 gap-3 text-[11px]">
                <span className={cn('w-8 text-center', feat.free ? 'text-emerald-500' : 'text-muted-foreground/40')}>
                  {feat.free ? '✓' : '—'}
                </span>
                <span className={cn('w-8 text-center', feat.pro ? 'text-orange-500' : 'text-muted-foreground/40')}>
                  {feat.pro ? '✓' : '—'}
                </span>
              </div>
            </motion.div>
          ))}
          <div className="flex items-center justify-end gap-3 border-t border-border/40 pt-2 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">
            <span className="w-8 text-center">Free</span>
            <span className="w-8 text-center text-orange-500">Pro</span>
          </div>
        </div>
      </SectionBlock>

      {/* Pro badge preview */}
      {isPro && (
        <SectionBlock title="Your Pro badge">
          <div className="flex items-center gap-4 py-3 px-1">
            <VerifiedBadge size="md" variant="pro" />
            <div>
              <p className="text-[13px] font-semibold text-foreground">Gold shield badge</p>
              <p className="text-[11.5px] text-muted-foreground">Shows on your profile, posts, and messages.</p>
            </div>
          </div>
        </SectionBlock>
      )}

      {/* Invoice history */}
      {isPro && (
        <SectionBlock title="Billing history">
          <div className="space-y-0">
            {[
              { date: 'Apr 23, 2026', amount: '$9.00', status: 'Paid' },
              { date: 'Mar 23, 2026', amount: '$9.00', status: 'Paid' },
              { date: 'Feb 23, 2026', amount: '$9.00', status: 'Paid' },
            ].map(({ date, amount, status }) => (
              <div key={date} className="flex items-center justify-between py-2.5 px-1">
                <div>
                  <p className="text-[13px] font-medium text-foreground">{date}</p>
                  <p className="text-[11px] text-muted-foreground">Twiky Pro · Monthly</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[13px] font-semibold text-foreground">{amount}</span>
                  <span className="rounded-full bg-emerald-500/12 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                    {status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </SectionBlock>
      )}
    </>
  )
}

function SpotifyNowPlaying({ userId }: { userId?: string }) {
  const { data } = useSpotifyNowPlaying(userId)

  if (!data?.is_playing || !data.track) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-[#1DB954]/20 bg-[#1DB954]/5 p-3">
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[#1DB954]/15">
          <svg viewBox="0 0 24 24" className="h-5 w-5 fill-[#1DB954]/50">
            <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
          </svg>
        </div>
        <p className="text-[12px] text-muted-foreground">Not playing anything right now</p>
      </div>
    )
  }

  const { track } = data
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-[#1DB954]/30 bg-[#1DB954]/8 p-3">
      {track.album_art ? (
        <img src={track.album_art} alt={track.album} className="h-10 w-10 flex-shrink-0 rounded-xl object-cover" />
      ) : (
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[#1DB954]/20">
          <svg viewBox="0 0 24 24" className="h-5 w-5 fill-[#1DB954]">
            <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
          </svg>
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-bold uppercase tracking-wider text-[#1DB954]">Now Playing</p>
        <p className="truncate text-[12px] font-semibold text-foreground">{track.name}</p>
        <p className="truncate text-[11px] text-muted-foreground">{track.artist}</p>
      </div>
      <div className="flex flex-shrink-0 items-center gap-0.5">
        {[3, 5, 4, 6, 3, 5].map((h, i) => (
          <div
            key={i}
            className="w-1 rounded-full bg-[#1DB954]"
            style={{
              height: `${h * 3}px`,
              animation: `pulse ${0.5 + i * 0.1}s ease-in-out infinite alternate`,
            }}
          />
        ))}
      </div>
    </div>
  )
}

function ConnectionsSection({ profile }: { profile?: UserProfile }) {
  const getAuthUrl = useSpotifyAuthUrl()
  const disconnectSpotify = useSpotifyDisconnect(profile?.id)
  const { data: nowPlaying } = useSpotifyNowPlaying(profile?.id)
  const [spotifyError, setSpotifyError] = useState<string | null>(null)

  const isSpotifyConnected = nowPlaying !== undefined && nowPlaying.message !== 'Spotify not connected'

  async function handleConnectSpotify() {
    setSpotifyError(null)
    try {
      const { url } = await getAuthUrl.mutateAsync()
      window.location.href = url
    } catch (err) {
      setSpotifyError(err instanceof Error ? err.message : 'Failed to start Spotify connection')
    }
  }

  async function handleDisconnectSpotify() {
    setSpotifyError(null)
    try {
      await disconnectSpotify.mutateAsync()
    } catch (err) {
      setSpotifyError(err instanceof Error ? err.message : 'Failed to disconnect Spotify')
    }
  }

  return (
    <>
      <SectionHeader
        title="Connected Apps"
        description="Manage services connected to your profile."
      />

      <motion.div
        className="overflow-hidden rounded-[22px] border border-[#1DB954]/25 bg-gradient-to-br from-[#1DB954]/12 via-background to-background p-5 shadow-sm"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.24, ease: 'easeOut' }}
      >
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-[#1DB954]/15 ring-1 ring-[#1DB954]/25">
            <svg viewBox="0 0 24 24" className="h-7 w-7 fill-[#1DB954]">
              <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
            </svg>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[15px] font-bold text-foreground">Spotify</p>
              {isSpotifyConnected ? (
                <Badge className="rounded-full border-[#1DB954]/30 bg-[#1DB954]/15 px-2 py-0.5 text-[10px] font-semibold text-[#1DB954] hover:bg-[#1DB954]/15">
                  Connected
                </Badge>
              ) : null}
            </div>
            <p className="mt-1 max-w-lg text-[12.5px] leading-5 text-muted-foreground">
              Show your current track on your Twiky profile and keep your music status fresh.
            </p>
            {isSpotifyConnected ? (
              <div className="mt-3">
                <SpotifyNowPlaying userId={profile?.id} />
              </div>
            ) : null}
            {!isSpotifyConnected ? (
              <div className="mt-3 flex items-center gap-3 rounded-2xl border border-dashed border-[#1DB954]/25 bg-background/70 p-3">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-[#1DB954]/10">
                  <Link2 className="h-4 w-4 text-[#1DB954]" />
                </div>
                <div className="min-w-0">
                  <p className="text-[12px] font-semibold text-foreground">Ready to connect</p>
                  <p className="text-[11px] text-muted-foreground">Authorize Spotify to display your listening activity.</p>
                </div>
              </div>
            ) : null}
            {spotifyError ? (
              <p className="mt-2 text-[11px] text-destructive">{spotifyError}</p>
            ) : null}
            <div className="mt-4 flex gap-2">
              {isSpotifyConnected ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-9 rounded-xl border-destructive/30 px-4 text-[12px] font-semibold text-destructive hover:bg-destructive/10 hover:text-destructive"
                  onClick={handleDisconnectSpotify}
                  disabled={disconnectSpotify.isPending}
                >
                  {disconnectSpotify.isPending ? 'Disconnecting...' : 'Disconnect'}
                </Button>
              ) : (
                <Button
                  size="sm"
                  className="h-9 rounded-xl bg-[#1DB954] px-4 text-[12px] font-semibold text-black hover:bg-[#1DB954]/90"
                  onClick={handleConnectSpotify}
                  disabled={getAuthUrl.isPending}
                >
                  {getAuthUrl.isPending ? 'Redirecting...' : 'Connect Spotify'}
                </Button>
              )}
            </div>
          </div>
        </div>
      </motion.div>

    </>
  )
}

function AboutSection() {
  return (
    <>
      <SectionHeader title="About Twiky" />
      <SectionBlock>
        <SettingRow title="Version" description="Current app version."><Badge variant="secondary" className="rounded-full">0.1.0-beta</Badge></SettingRow>
        <SettingRow title="Build" description="Last build date."><span className="text-[12px] text-muted-foreground">Apr 19 2026</span></SettingRow>
        <SettingRow title="Release channel" description="Update channel."><Badge variant="outline" className="rounded-full">Canary</Badge></SettingRow>
      </SectionBlock>
      <div className="text-center text-[11px] text-muted-foreground"><p>Made with ❤️ by the Twiky team</p></div>
    </>
  )
}

// ─── root ─────────────────────────────────────────────────────────────────────

export function SettingsView({ initialSection, onAvatarChange, avatarUrl: avatarUrlProp }: SettingsViewProps) {
  const { user } = useAuth()
  const [activeSection, setActiveSection] = useState<SettingsSectionId>(
    (initialSection as SettingsSectionId) ?? 'account',
  )
  const { data: profile, isLoading: profileLoading } = useProfile()
  const { data: followers = [] } = useUserFollowers(profile?.id)
  const { data: following = [] } = useUserFollowing(profile?.id)
  const { data: posts = [] } = useUserPosts(profile?.id)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(avatarUrlProp ?? null)
  const [bannerUrl, setBannerUrl] = useState<string | null>(null)
  const isVerified = isVerifiedAccountIdentity({
    email: profile?.email ?? user?.email,
    id: profile?.id,
    is_verified: profile?.is_verified,
  })
  const isPro = isProPlan(profile?.sub_plan)

  useEffect(() => {
    if (initialSection) setActiveSection(initialSection as SettingsSectionId)
  }, [initialSection])

  useEffect(() => {
    if (avatarUrlProp) setAvatarUrl(avatarUrlProp)
  }, [avatarUrlProp])

  useEffect(() => {
    setBannerUrl(profile?.banner ?? null)
  }, [profile?.banner, profile?.id])

  function handleAvatarChange(url: string) {
    setAvatarUrl(url)
    onAvatarChange?.(url)
  }

  function handleBannerChange(url: string) {
    setBannerUrl(url || null)
  }

  function renderSection() {
    switch (activeSection) {
      case 'account':       return <AccountSection profile={profile} />
      case 'profile':       return <ProfileSection key={profile?.id ?? 'profile-loading'} avatarUrl={avatarUrl} bannerUrl={bannerUrl} followersCount={followers.length} followingCount={following.length} isPro={isPro} posts={posts} profile={profile} profileLoading={profileLoading} onAvatarChange={handleAvatarChange} onBannerChange={handleBannerChange} />
      case 'privacy':       return <PrivacySection />
      case 'notifications': return <NotificationsSection />
      case 'appearance':    return <AppearanceSection />
      case 'messaging':     return <MessagingSection />
      case 'voice':         return <VoiceSection />
      case 'language':      return <LanguageSection />
      case 'security':      return <SecuritySection />
      case 'storage':       return <StorageSection />
      case 'nitro':         return <NitroSection isPro={isPro} />
      case 'connections':   return <ConnectionsSection profile={profile} />
      case 'about':         return <AboutSection />
    }
  }

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden bg-background">
      {/* Left nav */}
      <nav className="flex w-[210px] flex-shrink-0 flex-col overflow-y-auto border-r border-border/60 bg-sidebar py-4">
        {/* User pill */}
        <div className="mb-4 px-3">
          <button
            type="button"
            onClick={() => setActiveSection('profile')}
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
                {isVerified ? <VerifiedBadge size="xs" variant={isPro ? 'pro' : 'standard'} /> : null}
              </div>
              <p className="truncate text-[10.5px] text-muted-foreground">
                {profile?.username ? `@${profile.username}` : 'Backend profile'}
              </p>
            </div>
            <ChevronRight className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground/50" />
          </button>
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
                  const isActive = activeSection === item.id
                  return (
                    <motion.button
                      key={item.id}
                      onClick={() => setActiveSection(item.id)}
                      className={cn(
                        'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left transition-colors',
                        isActive
                          ? 'bg-primary/10 font-semibold text-primary'
                          : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                      )}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: catIdx * 0.06 + itemIdx * 0.04, duration: 0.2 }}
                      whileHover={{ x: 2 }}
                      whileTap={{ scale: 0.97 }}
                    >
                      <Icon className={cn('h-3.5 w-3.5 flex-shrink-0', isActive ? 'text-primary' : 'text-muted-foreground/70')} />
                      <span className="flex-1 text-[12.5px]">{item.label}</span>
                      {item.badge ? (
                        <span className="rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-medium text-muted-foreground">{item.badge}</span>
                      ) : null}
                    </motion.button>
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

      {/* Content */}
      <div className="relative flex-1 overflow-y-auto bg-background px-8 py-7">
        <div className="mx-auto max-w-[640px]">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeSection}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
            >
              {renderSection()}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}
