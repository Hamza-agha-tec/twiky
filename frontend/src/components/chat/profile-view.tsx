'use client'

import { type ReactNode, useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  BriefcaseBusiness,
  CalendarDays,
  Gamepad2,
  MapPin,
  MonitorPlay,
  Paintbrush2,
  Rocket,
  ShieldCheck,
  Sparkles,
  UserRoundPen,
} from 'lucide-react'

import { ProfileRoomFrame } from '@/components/chat/profile-room-frame'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

interface ProfileData {
  id?: string
  username?: string | null
  avatar_url?: string | null
}

interface ProfileViewProps {
  profile?: ProfileData
}

interface EditState {
  name: string
  role: string
  bio: string
  status: 'online' | 'away' | 'busy' | 'offline'
}

const STATUS_META = {
  online: {
    dot: '#4fd1a0',
    label: 'Online',
    tone:
      'border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300',
  },
  away: {
    dot: '#e8c63c',
    label: 'Away',
    tone:
      'border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-300',
  },
  busy: {
    dot: '#f07070',
    label: 'Busy',
    tone: 'border-rose-500/20 bg-rose-500/10 text-rose-600 dark:text-rose-300',
  },
  offline: {
    dot: '#50567a',
    label: 'Offline',
    tone:
      'border-slate-500/20 bg-slate-500/10 text-slate-600 dark:text-slate-300',
  },
} as const

const PROFILE_DETAILS = [
  { icon: BriefcaseBusiness, label: 'Role', value: 'Product Designer' },
  { icon: MapPin, label: 'Location', value: 'Morocco' },
  { icon: CalendarDays, label: 'Member Since', value: 'January 2026' },
]

const PROFILE_TAGS = ['UI Systems', 'Motion', 'React', 'Game UX', 'Accessibility']

const FOCUS_ITEMS = [
  {
    icon: Sparkles,
    title: 'Current Focus',
    description:
      'Tighten chat hierarchy, make the shell feel faster, and keep profile surfaces room-ready.',
  },
  {
    icon: Paintbrush2,
    title: 'Design Direction',
    description:
      'Discord-like structure, denser sections, calmer typography, and less empty space.',
  },
  {
    icon: ShieldCheck,
    title: 'Product Standard',
    description:
      'Readable feed surfaces, scoped group data, and predictable interactions across the workspace.',
  },
]

const SHOWCASE_ITEMS = [
  {
    icon: Gamepad2,
    title: 'Pixel Room Frame',
    description:
      'Every player gets a reserved room surface before the live game-room layer ships.',
  },
  {
    icon: MonitorPlay,
    title: 'Profile Showcase',
    description:
      'Trophies, media, and featured builds will sit inside the room instead of crowding the chat shell.',
  },
  {
    icon: Rocket,
    title: 'Future Rollout',
    description:
      'Visitors, invites, and room actions can attach later without changing the profile layout again.',
  },
]

function ProfileSection({
  children,
  label,
  delay = 0,
}: {
  children: ReactNode
  label: string
  delay?: number
}) {
  return (
    <motion.div
      className="rounded-2xl border border-border bg-background/70 p-4"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.26, ease: 'easeOut' }}
    >
      <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
        {label}
      </p>
      <div className="mt-3">{children}</div>
    </motion.div>
  )
}

export function ProfileView({ profile }: ProfileViewProps) {
  const [editOpen, setEditOpen] = useState(false)
  const [storedAvatar, setStoredAvatar] = useState<string | null>(null)
  const [storedBanner, setStoredBanner] = useState<string | null>(null)

  useEffect(() => {
    try {
      setStoredAvatar(localStorage.getItem('twiky-user-avatar'))
      setStoredBanner(localStorage.getItem('twiky-user-banner'))
    } catch {}
  }, [])

  const [editState, setEditState] = useState<EditState>({
    name: profile?.username ?? 'Youssef Elbidali',
    role: 'Product Designer',
    bio: 'Building compact, expressive interfaces with strong system thinking and a focus on player experience.',
    status: 'online',
  })
  const [saved, setSaved] = useState<EditState>(editState)

  function handleSave() {
    setSaved({ ...editState })
    setEditOpen(false)
  }

  const initial = (saved.name[0] ?? 'Y').toUpperCase()
  const statusMeta = STATUS_META[saved.status]
  const profileDetails = PROFILE_DETAILS.map((item) =>
    item.label === 'Role' ? { ...item, value: saved.role } : item,
  )

  return (
    <div className="flex min-h-0 flex-1 overflow-y-auto bg-background">
      <div className="mx-auto w-full max-w-6xl px-4 py-4">
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.14fr)_340px]">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.32, ease: 'easeOut' }}
          >
          <Card className="overflow-hidden rounded-[30px] border-border bg-sidebar shadow-none">
            <div className="relative h-12 overflow-hidden">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(146,220,229,0.75),_transparent_30%),radial-gradient(circle_at_top_right,_rgba(125,211,252,0.3),_transparent_25%),linear-gradient(135deg,#0f172a_0%,#12335b_40%,#0077b6_100%)]">
                {storedBanner ? <img src={storedBanner} alt="Banner" className="h-full w-full object-cover" /> : null}
              </div>
              <div className="absolute inset-0 bg-[linear-gradient(to_top,rgba(0,0,0,0.42),transparent_60%)]" />

              <div className="absolute left-4 top-4 flex flex-wrap gap-2">
                <Badge className="rounded-full border-white/15 bg-white/10 px-2.5 py-1 text-[10px] text-white hover:bg-white/10">
                  Room ready
                </Badge>
              </div>

              <Button
                onClick={() => {
                  setEditState(saved)
                  setEditOpen(true)
                }}
                variant="secondary"
                className="absolute right-4 top-4 h-8 rounded-full border border-white/20 bg-white/15 px-3 text-[11px] font-semibold text-white backdrop-blur hover:bg-white/20"
              >
                <UserRoundPen className="h-3.5 w-3.5" />
                Edit
              </Button>
            </div>

            <CardContent className="px-5 pb-5">
              <div className="-mt-12 flex flex-col gap-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                  <div className="flex min-w-0 items-end gap-4">
                    <div className="relative">
                      <Avatar className="h-24 w-24 rounded-full border-[5px] border-sidebar shadow-xl">
                        <AvatarImage src={storedAvatar ?? profile?.avatar_url ?? ''} alt={saved.name} />
                        <AvatarFallback
                          className="rounded-full text-[30px] font-black text-white"
                          style={{ background: 'linear-gradient(135deg, #0077b6, #92dce5)' }}
                        >
                          {initial}
                        </AvatarFallback>
                      </Avatar>
                      <span
                        className="absolute bottom-1.5 right-1.5 h-4 w-4 rounded-full border-[3px] border-sidebar"
                        style={{ background: statusMeta.dot }}
                      />
                    </div>

                    <div className="min-w-0 pb-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h1 className="truncate text-[24px] font-black tracking-tight text-foreground">
                          {saved.name}
                        </h1>
                        <Badge
                          variant="outline"
                          className={cn(
                            'rounded-full px-2 py-0.5 text-[10px] font-semibold',
                            statusMeta.tone,
                          )}
                        >
                          {statusMeta.label}
                        </Badge>
                      </div>

                      <p className="mt-1 text-[12px] text-muted-foreground">
                        @{profile?.username ?? 'you'}
                      </p>

                      <div className="mt-3 flex flex-wrap gap-2">
                        {PROFILE_TAGS.map((tag) => (
                          <span
                            key={tag}
                            className="rounded-full border border-border bg-background px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="w-full max-w-[280px] rounded-2xl border border-border bg-background/85 p-3.5">
                    <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
                      Profile Note
                    </p>
                    <p className="mt-2 text-[12px] font-medium text-foreground">
                      Personal profile, direct-message identity, and future room frame all live here.
                    </p>
                    <p className="mt-2 text-[11px] leading-5 text-muted-foreground">
                      Shared channel groups keep their own notes, tasks, goals, and feed data separately.
                    </p>
                  </div>
                </div>

                <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
                  <div className="space-y-4">
                    <ProfileSection label="About Me" delay={0.18}>
                      <p className="text-[12px] leading-6 text-foreground">{saved.bio}</p>
                    </ProfileSection>

                    <ProfileSection label="Current Focus" delay={0.24}>
                      <div className="grid gap-3 md:grid-cols-3">
                        {FOCUS_ITEMS.map((item) => (
                          <div
                            key={item.title}
                            className="rounded-2xl border border-border bg-muted/30 p-3.5"
                          >
                            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                              <item.icon className="h-4 w-4" />
                            </div>
                            <p className="mt-3 text-[12px] font-semibold text-foreground">
                              {item.title}
                            </p>
                            <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
                              {item.description}
                            </p>
                          </div>
                        ))}
                      </div>
                    </ProfileSection>

                    <ProfileSection label="Room Rollout" delay={0.30}>
                      <div className="space-y-3">
                        {SHOWCASE_ITEMS.map((item) => (
                          <div
                            key={item.title}
                            className="flex gap-3 rounded-2xl border border-border bg-muted/25 px-3.5 py-3"
                          >
                            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-2xl bg-background text-primary">
                              <item.icon className="h-4 w-4" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-[12px] font-semibold text-foreground">
                                {item.title}
                              </p>
                              <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
                                {item.description}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </ProfileSection>
                  </div>

                  <div className="space-y-4">
                    <ProfileSection label="User Info" delay={0.2}>
                      <div className="space-y-2.5">
                        {profileDetails.map((item) => (
                          <div
                            key={item.label}
                            className="flex items-center gap-3 rounded-2xl border border-border bg-muted/25 px-3 py-2.5"
                          >
                            <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-background text-muted-foreground">
                              <item.icon className="h-4 w-4" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                                {item.label}
                              </p>
                              <p className="mt-0.5 text-[12px] font-medium text-foreground">
                                {item.value}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </ProfileSection>

                    <ProfileSection label="Profile Frame" delay={0.28}>
                      <div className="space-y-3">
                        <div className="rounded-2xl border border-border bg-muted/25 px-3 py-3">
                          <p className="text-[12px] font-semibold text-foreground">
                            Default Discord-style card
                          </p>
                          <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
                            Banner, identity, and room entry stay visible without relying on oversized tabs.
                          </p>
                        </div>
                        <div className="rounded-2xl border border-border bg-muted/25 px-3 py-3">
                          <p className="text-[12px] font-semibold text-foreground">
                            Room slot reserved
                          </p>
                          <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
                            Each player profile already owns a room frame for the future game mode.
                          </p>
                        </div>
                      </div>
                    </ProfileSection>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
          </motion.div>

          <motion.div
            className="space-y-4"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.12, duration: 0.32, ease: 'easeOut' }}
          >
            <Card className="overflow-hidden rounded-[30px] border-border bg-sidebar shadow-none">
              <CardContent className="p-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
                  Showroom Frame
                </p>
                <div className="mt-3">
                  <ProfileRoomFrame owner={saved.name} />
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-[30px] border-border shadow-none">
              <CardContent className="p-4">
                <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
                  Future Room Features
                </p>
                <div className="mt-3 space-y-3">
                  {[
                    {
                      icon: Gamepad2,
                      title: 'Live room entry',
                      description:
                        'Profiles can open directly into a playable personal room later.',
                    },
                    {
                      icon: MonitorPlay,
                      title: 'Featured media wall',
                      description:
                        'Screenshots, clips, and trophies can live in the room instead of inside chat.',
                    },
                    {
                      icon: Rocket,
                      title: 'Visitor interactions',
                      description:
                        'Invites, quick reactions, and showcase actions can connect once the game mode lands.',
                    },
                  ].map((item) => (
                    <div
                      key={item.title}
                      className="flex gap-3 rounded-2xl border border-border bg-muted/25 px-3.5 py-3"
                    >
                      <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                        <item.icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[12px] font-semibold text-foreground">
                          {item.title}
                        </p>
                        <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
                          {item.description}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-[380px]">
          <DialogHeader>
            <DialogTitle>Edit profile</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-1">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label
                  htmlFor="profile-name"
                  className="text-[10px] font-semibold uppercase tracking-[0.07em] text-muted-foreground"
                >
                  Display name
                </Label>
                <Input
                  id="profile-name"
                  value={editState.name}
                  onChange={(event) =>
                    setEditState((prev) => ({ ...prev, name: event.target.value }))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label
                  htmlFor="profile-role"
                  className="text-[10px] font-semibold uppercase tracking-[0.07em] text-muted-foreground"
                >
                  Role
                </Label>
                <Input
                  id="profile-role"
                  value={editState.role}
                  onChange={(event) =>
                    setEditState((prev) => ({ ...prev, role: event.target.value }))
                  }
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-[10px] font-semibold uppercase tracking-[0.07em] text-muted-foreground">
                Status
              </Label>
              <Select
                value={editState.status}
                onValueChange={(value) =>
                  setEditState((prev) => ({
                    ...prev,
                    status: value as EditState['status'],
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="online">Online</SelectItem>
                  <SelectItem value="away">Away</SelectItem>
                  <SelectItem value="busy">Busy</SelectItem>
                  <SelectItem value="offline">Offline</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label
                htmlFor="profile-bio"
                className="text-[10px] font-semibold uppercase tracking-[0.07em] text-muted-foreground"
              >
                Bio
              </Label>
              <Textarea
                id="profile-bio"
                value={editState.bio}
                onChange={(event) =>
                  setEditState((prev) => ({ ...prev, bio: event.target.value }))
                }
                className="min-h-[96px] resize-y"
              />
            </div>
          </div>
          <DialogFooter className="pt-2">
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave}>Save changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
