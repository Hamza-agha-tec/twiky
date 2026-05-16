'use client'

import { type ChangeEvent, useEffect, useRef, useState } from 'react'
import { Link2, Trash2, Upload, ImageIcon, Music2, Play, Square } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { SectionHeader, SectionBlock, SettingRow, versionedImageUrl } from '../shared'
import { VerifiedBadge, getVerifiedBadgeVariant, isVerifiedAccountIdentity } from '@/components/chat/verified-badge'
import { UserName } from '@/components/chat/user-name'
import { StatusDot, resolveStatus } from '@/components/chat/status-dot'
import { useAuth } from '@/context/AuthContext'
import { useUpdateProfile } from '@/hooks/use-user'
import type { UserPost, UserProfile, NameEffect, UserStatus } from '@/lib/user-api'
import { BANNER_ACCEPT, filesApi } from '@/lib/files-api'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

export function ProfileSection({
  avatarUrl,
  bannerUrl,
  followersCount,
  followingCount,
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
  posts: UserPost[]
  profile?: UserProfile
  profileLoading: boolean
  onAvatarChange: (url: string) => void
  onBannerChange: (url: string) => void
}) {
  const { user } = useAuth()
  const avatarRef = useRef<HTMLInputElement>(null)
  const bannerRef = useRef<HTMLInputElement>(null)
  const avatarPreviewUrlRef = useRef<string | null>(null)
  const bannerPreviewUrlRef = useRef<string | null>(null)
  const updateProfile = useUpdateProfile()
  const [saveMessage, setSaveMessage] = useState<string | null>(null)
  const [avatarBusy, setAvatarBusy] = useState(false)
  const [bannerBusy, setBannerBusy] = useState(false)
  const [fullname, setFullname] = useState(profile?.fullname ?? '')
  const [username, setUsername] = useState(profile?.username ?? '')
  const [bio, setBio] = useState(profile?.bio ?? '')
  const [status, setStatus] = useState(profile?.status ?? '')
  const [statusEmoji, setStatusEmoji] = useState('🟢')
  const [xUrl, setXUrl] = useState(profile?.x_url ?? '')
  const [websiteUrl, setWebsiteUrl] = useState(profile?.website_url ?? '')
  const [nameEffect, setNameEffect] = useState<NameEffect>(profile?.name_effect ?? null)
  const [userStatus, setUserStatus] = useState<UserStatus>(profile?.user_status ?? null)
  const [enterSoundUrl, setEnterSoundUrl] = useState(profile?.enter_sound_url ?? null)
  const [enterSoundBusy, setEnterSoundBusy] = useState(false)
  const [enterSoundPlaying, setEnterSoundPlaying] = useState(false)
  const enterSoundRef = useRef<HTMLInputElement>(null)
  const enterSoundAudioRef = useRef<HTMLAudioElement | null>(null)
  const enterSoundTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (profile) {
      setFullname(profile.fullname ?? '')
      setUsername(profile.username ?? '')
      setBio(profile.bio ?? '')
      setStatus(profile.status ?? '')
      setXUrl(profile.x_url ?? '')
      setWebsiteUrl(profile.website_url ?? '')
      setNameEffect(profile.name_effect ?? null)
      setUserStatus(profile.user_status ?? 'online')
      setEnterSoundUrl(profile.enter_sound_url ?? null)
    }
  }, [profile])

  async function handleSaveProfile() {
    setSaveMessage(null)
    await updateProfile.mutateAsync({
      bio: bio.trim() || null,
      fullname: fullname.trim() || null,
      status: status.trim() || null,
      username: username.trim() || undefined,
    })
    setSaveMessage('Saved')
  }

  async function handleAvatarFile(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    const previousAvatarUrl = effectiveAvatarUrl
    if (avatarPreviewUrlRef.current) {
      URL.revokeObjectURL(avatarPreviewUrlRef.current)
      avatarPreviewUrlRef.current = null
    }
    const previewUrl = URL.createObjectURL(f)
    avatarPreviewUrlRef.current = previewUrl
    onAvatarChange(previewUrl)
    setAvatarBusy(true)
    try {
      const { publicUrl } = await filesApi.uploadUserAvatar(f)
      const nextAvatarUrl = versionedImageUrl(publicUrl)
      await updateProfile.mutateAsync({ avatar_url: nextAvatarUrl })
      onAvatarChange(nextAvatarUrl)
      URL.revokeObjectURL(previewUrl)
      avatarPreviewUrlRef.current = null
      toast.success('Avatar updated')
    } catch (err) {
      onAvatarChange(previousAvatarUrl ?? '')
      URL.revokeObjectURL(previewUrl)
      avatarPreviewUrlRef.current = null
      toast.error(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setAvatarBusy(false)
    }
  }

  async function handleBannerFile(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    const previousBannerUrl = effectiveBannerUrl
    if (bannerPreviewUrlRef.current) {
      URL.revokeObjectURL(bannerPreviewUrlRef.current)
      bannerPreviewUrlRef.current = null
    }
    const previewUrl = URL.createObjectURL(f)
    bannerPreviewUrlRef.current = previewUrl
    onBannerChange(previewUrl)
    setBannerBusy(true)
    try {
      const { publicUrl } = await filesApi.uploadUserBanner(f)
      const nextBannerUrl = versionedImageUrl(publicUrl)
      await updateProfile.mutateAsync({ banner: nextBannerUrl })
      onBannerChange(nextBannerUrl)
      URL.revokeObjectURL(previewUrl)
      bannerPreviewUrlRef.current = null
      toast.success('Banner updated')
    } catch (err) {
      onBannerChange(previousBannerUrl ?? '')
      URL.revokeObjectURL(previewUrl)
      bannerPreviewUrlRef.current = null
      toast.error(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setBannerBusy(false)
    }
  }

  async function handleBannerRemove() {
    setBannerBusy(true)
    try {
      await updateProfile.mutateAsync({ banner: null })
      if (bannerPreviewUrlRef.current) {
        URL.revokeObjectURL(bannerPreviewUrlRef.current)
        bannerPreviewUrlRef.current = null
      }
      onBannerChange('')
      toast.success('Banner removed')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not remove banner')
    } finally {
      setBannerBusy(false)
    }
  }

  useEffect(() => {
    return () => {
      if (avatarPreviewUrlRef.current) {
        URL.revokeObjectURL(avatarPreviewUrlRef.current)
        avatarPreviewUrlRef.current = null
      }
      if (bannerPreviewUrlRef.current) {
        URL.revokeObjectURL(bannerPreviewUrlRef.current)
        bannerPreviewUrlRef.current = null
      }
    }
  }, [])

  const BANNER_GRADIENTS = [
    'from-sky-500 via-cyan-500 to-blue-600',
    'from-violet-500 via-purple-500 to-fuchsia-600',
    'from-emerald-500 via-teal-500 to-cyan-600',
    'from-orange-500 via-amber-500 to-yellow-500',
    'from-pink-500 via-rose-500 to-red-600',
    'from-indigo-500 via-blue-500 to-sky-600',
  ]
  async function handleEnterSoundFile(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    // Validate duration ≤ 60s client-side
    const objectUrl = URL.createObjectURL(f)
    const tempAudio = new Audio(objectUrl)
    const duration = await new Promise<number>((resolve) => {
      tempAudio.addEventListener('loadedmetadata', () => resolve(tempAudio.duration), { once: true })
      tempAudio.addEventListener('error', () => resolve(Infinity), { once: true })
    })
    URL.revokeObjectURL(objectUrl)
    if (duration > 60) {
      toast.error('Enter sound must be 1 minute or shorter')
      return
    }
    setEnterSoundBusy(true)
    try {
      const { publicUrl } = await filesApi.uploadUserEnterSound(f)
      await updateProfile.mutateAsync({ enter_sound_url: publicUrl })
      setEnterSoundUrl(publicUrl)
      toast.success('Enter sound saved')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setEnterSoundBusy(false)
    }
  }

  async function handleEnterSoundRemove() {
    setEnterSoundBusy(true)
    try {
      await updateProfile.mutateAsync({ enter_sound_url: null })
      setEnterSoundUrl(null)
      toast.success('Enter sound removed')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not remove')
    } finally {
      setEnterSoundBusy(false)
    }
  }

  function handleEnterSoundPreview() {
    if (!enterSoundUrl) return
    if (enterSoundPlaying) {
      if (enterSoundTimerRef.current) clearTimeout(enterSoundTimerRef.current)
      enterSoundAudioRef.current?.pause()
      enterSoundAudioRef.current = null
      setEnterSoundPlaying(false)
      return
    }
    const audio = new Audio(enterSoundUrl)
    audio.volume = 0.85
    enterSoundAudioRef.current = audio
    setEnterSoundPlaying(true)
    const stopFn = () => {
      if (enterSoundTimerRef.current) clearTimeout(enterSoundTimerRef.current)
      setEnterSoundPlaying(false)
      enterSoundAudioRef.current = null
    }
    audio.onended = stopFn
    audio.onerror = stopFn
    enterSoundTimerRef.current = setTimeout(() => {
      audio.pause()
      stopFn()
    }, 15000)
    void audio.play().catch(stopFn)
  }

  const effectiveAvatarUrl = avatarUrl ?? profile?.avatar_url ?? null
  const effectiveBannerUrl = bannerUrl ?? profile?.banner ?? null
  const isVerified = isVerifiedAccountIdentity({
    email: profile?.email ?? user?.email,
    id: profile?.id,
    is_verified: profile?.is_verified,
    sub_plan: profile?.sub_plan,
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
            'group relative h-24 cursor-pointer overflow-hidden rounded-t-2xl',
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
          {effectiveBannerUrl ? (
            <img
              src={effectiveBannerUrl}
              alt="Banner"
              className="h-full w-full object-cover [object-position:center_34%]"
            />
          ) : null}
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
          </div>
          <input ref={bannerRef} type="file" accept={BANNER_ACCEPT} className="hidden" onChange={(e) => void handleBannerFile(e)} />

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
                <UserName name={fullname || 'Your Name'} effect={nameEffect} subPlan={profile?.sub_plan} className="text-[17px] font-bold" />
                {isVerified ? <VerifiedBadge size="sm" variant={getVerifiedBadgeVariant(profile?.sub_plan)} /> : null}
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
          <p className="mt-2 text-[10.5px] text-muted-foreground">
            Banner uploads support PNG, JPG, WEBP, SVG, and animated GIF up to 20 MB.
          </p>
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

      <SectionBlock title="Presence">
        <SettingRow title="Status" description="Shown as a colored dot everywhere you appear.">
          <div className="flex items-center gap-2">
            {([
              { value: 'online',    label: 'Online',    dotStatus: 'online' },
              { value: 'idle',      label: 'Idle',      dotStatus: 'idle' },
              { value: 'dnd',       label: 'Do Not Disturb', dotStatus: 'dnd' },
              { value: 'invisible', label: 'Invisible', dotStatus: 'offline' },
            ] as const).map(({ value, label, dotStatus }) => (
              <button
                key={value}
                onClick={() => setUserStatus(value)}
                className={cn(
                  'flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-[11px] font-medium transition-colors hover:bg-accent',
                  userStatus === value && 'bg-primary/10 ring-1 ring-primary border-primary/30',
                )}
              >
                <StatusDot status={dotStatus} inline className="h-2.5 w-2.5" borderClass="border-background" />
                {label}
              </button>
            ))}
          </div>
        </SettingRow>
        <SettingRow title="Status message" description="Short note shown in your profile bubble.">
          <input value={status} onChange={(e) => setStatus(e.target.value)} placeholder="Working on something..." className="h-9 w-52 rounded-xl border border-border bg-background px-3 text-[12px] focus:outline-none focus:ring-1 focus:ring-primary" />
        </SettingRow>
      </SectionBlock>

      {(profile?.sub_plan === 'PRO' || profile?.sub_plan === 'GEEK') && (
        <SectionBlock title="Name Style">
          <SettingRow title="Effect" description="Animated effect on your name — visible to everyone.">
            <div className="flex items-center gap-2 flex-wrap">
              {([
                { value: null,       label: 'None' },
                { value: 'gradient', label: 'Gradient' },
                { value: 'shimmer',  label: 'Shimmer' },
                { value: 'glow',     label: 'Glow' },
              ] as { value: NameEffect; label: string }[]).map(({ value, label }) => (
                <button
                  key={value ?? 'none'}
                  onClick={() => setNameEffect(value)}
                  className={cn(
                    'rounded-lg border border-border px-3 py-1.5 text-[11px] font-medium transition-colors hover:bg-accent',
                    nameEffect === value && 'bg-primary/10 ring-1 ring-primary border-primary/30',
                  )}
                >
                  {value ? (
                    <UserName name={label} effect={value} subPlan={profile?.sub_plan} />
                  ) : label}
                </button>
              ))}
            </div>
          </SettingRow>
        </SectionBlock>
      )}

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

      {profile?.sub_plan === 'GEEK' && (
        <SectionBlock title="Enter Sound">
          <div className="py-2">
            <p className="mb-3 text-[12px] leading-relaxed text-muted-foreground">
              Play a custom sound when you join a voice channel. Others hear the first <span className="font-semibold text-foreground">15 seconds</span>. Max <span className="font-semibold text-foreground">1 minute</span> audio file.
            </p>
            {enterSoundUrl ? (
              <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/40 px-3 py-2.5">
                <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Music2 className="h-4 w-4" />
                </div>
                <span className="flex-1 truncate text-[12px] font-medium text-foreground">
                  {enterSoundUrl.split('/').pop()?.split('?')[0] ?? 'Enter sound'}
                </span>
                <button
                  type="button"
                  onClick={handleEnterSoundPreview}
                  title={enterSoundPlaying ? 'Stop preview' : 'Preview (15s)'}
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground"
                >
                  {enterSoundPlaying ? <Square className="h-3.5 w-3.5 fill-current" /> : <Play className="h-3.5 w-3.5 fill-current" />}
                </button>
                <button
                  type="button"
                  disabled={enterSoundBusy}
                  onClick={() => void handleEnterSoundRemove()}
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                disabled={enterSoundBusy}
                onClick={() => enterSoundRef.current?.click()}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border py-4 text-[12px] font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
              >
                <Upload className="h-4 w-4" />
                {enterSoundBusy ? 'Uploading...' : 'Upload enter sound'}
              </button>
            )}
            <input
              ref={enterSoundRef}
              type="file"
              accept="audio/*"
              className="hidden"
              onChange={(e) => void handleEnterSoundFile(e)}
            />
          </div>
        </SectionBlock>
      )}

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
                      {new Date(post.created_at).toLocaleDateString()}
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
    </>
  )
}
