'use client'

import { useMemo, useState } from 'react'
import { ArrowRight, CalendarDays, Check, Compass, Globe, Lock, Search, Sparkles, Users, X } from 'lucide-react'
import { toast } from 'sonner'

import { useDiscoverChannels, useJoinChannel, useRequestJoinChannel } from '@/hooks/use-channels'

type DiscoverFilter = 'all' | 'joined' | 'new' | 'private'

const DISCOVER_FILTERS: { id: DiscoverFilter; icon: typeof Sparkles; label: string }[] = [
  { id: 'all', icon: Sparkles, label: 'All' },
  { id: 'joined', icon: Check, label: 'Joined' },
  { id: 'new', icon: CalendarDays, label: 'New' },
  { id: 'private', icon: Lock, label: 'Private' },
]

const DISCOVER_CHANNEL_TONES = [
  'from-sky-500 via-cyan-500 to-blue-600',
  'from-emerald-500 via-teal-500 to-cyan-600',
  'from-orange-500 via-amber-500 to-yellow-500',
  'from-fuchsia-500 via-violet-500 to-indigo-600',
]

function getDiscoverChannelTone(seed: string) {
  const index =
    seed.split('').reduce((total, char) => total + char.charCodeAt(0), 0) %
    DISCOVER_CHANNEL_TONES.length
  return DISCOVER_CHANNEL_TONES[index]
}

function getDiscoverChannelMonogram(label: string) {
  const words = label.split(/\s+/).filter(Boolean)
  if (words.length >= 2) return `${words[0][0]}${words[1][0]}`.toUpperCase()
  return label.slice(0, 2).toUpperCase() || 'CH'
}

type DiscoverChannel = NonNullable<ReturnType<typeof useDiscoverChannels>['data']>[number]

function ChannelPopupCard({
  ch,
  onClose,
  onSelectChannel,
  joinChannel,
  requestJoin,
}: {
  ch: DiscoverChannel
  onClose: () => void
  onSelectChannel?: (id: string) => void
  joinChannel: ReturnType<typeof useJoinChannel>
  requestJoin: ReturnType<typeof useRequestJoinChannel>
}) {
  const status = ch.membership_status ?? 'none'
  const isPrivate = ch.access_type === 'PRIVATE'
  const tone = getDiscoverChannelTone(ch.id)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative w-[340px] overflow-hidden rounded-[24px] border border-border bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className={`relative h-[110px] w-full overflow-hidden bg-gradient-to-br ${tone}`}>
          {ch.banner_url && (
            <img src={ch.banner_url} alt="" className="absolute inset-0 h-full w-full object-cover object-center" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
          <button
            onClick={onClose}
            className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-full bg-black/30 text-white/80 backdrop-blur-sm transition-colors hover:bg-black/50 hover:text-white"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="relative -mt-7 flex px-5">
          <div className={`relative flex h-14 w-14 flex-shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br text-[13px] font-bold text-white shadow-lg ring-4 ring-card ${tone}`}>
            {ch.avatar_url ? (
              <img src={ch.avatar_url} alt={ch.name} className="block h-full w-full object-cover object-center" />
            ) : getDiscoverChannelMonogram(ch.name)}
          </div>
        </div>

        <div className="px-5 pb-5 pt-2">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-[16px] font-bold text-foreground">{ch.name}</p>
              <div className="mt-0.5 flex items-center gap-1.5">
                {isPrivate ? (
                  <span className="inline-flex items-center gap-0.5 text-[11px] font-medium text-amber-600 dark:text-amber-400">
                    <Lock className="h-3 w-3" /> Private
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-0.5 text-[11px] font-medium text-muted-foreground">
                    <Globe className="h-3 w-3" /> Public
                  </span>
                )}
                {ch.member_count !== undefined && (
                  <>
                    <span className="text-muted-foreground/40">·</span>
                    <span className="inline-flex items-center gap-0.5 text-[11px] font-medium text-muted-foreground">
                      <Users className="h-3 w-3" /> {ch.member_count} {ch.member_count === 1 ? 'member' : 'members'}
                    </span>
                  </>
                )}
              </div>
            </div>
            {status === 'member' && (
              <span className="flex-shrink-0 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
                Joined
              </span>
            )}
            {status === 'requested' && (
              <span className="flex-shrink-0 rounded-full bg-blue-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-blue-600 dark:text-blue-400">
                Pending
              </span>
            )}
          </div>

          {ch.description ? (
            <p className="mt-3 text-[12.5px] leading-relaxed text-muted-foreground">{ch.description}</p>
          ) : (
            <p className="mt-3 text-[12.5px] italic text-muted-foreground/50">No description.</p>
          )}

          <div className="mt-4 flex gap-2">
            {status === 'member' ? (
              <button
                onClick={() => { onSelectChannel?.(ch.id); onClose() }}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-primary py-2 text-[13px] font-semibold text-primary-foreground transition-opacity hover:opacity-90"
              >
                Open channel <ArrowRight className="h-3.5 w-3.5" />
              </button>
            ) : status === 'requested' ? (
              <div className="flex flex-1 items-center justify-center rounded-xl border border-border bg-muted/60 py-2 text-[13px] font-semibold text-muted-foreground">
                Request sent
              </div>
            ) : isPrivate ? (
              <button
                onClick={async () => { try { await requestJoin.mutateAsync(ch.id); toast.success(`Request sent to join ${ch.name}`); onClose() } catch {} }}
                disabled={requestJoin.isPending}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-amber-500/30 bg-amber-500/10 py-2 text-[13px] font-semibold text-amber-600 transition-colors hover:bg-amber-500/20 disabled:opacity-50 dark:text-amber-400"
              >
                <Lock className="h-3.5 w-3.5" /> Request access
              </button>
            ) : (
              <button
                onClick={async () => {
                  try { await joinChannel.mutateAsync(ch.id); onSelectChannel?.(ch.id); onClose() } catch {}
                }}
                disabled={joinChannel.isPending}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-primary py-2 text-[13px] font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                Join <ArrowRight className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export function DiscoverChannelsView({ onSelectChannel }: { onSelectChannel?: (id: string) => void }) {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<DiscoverFilter>('all')
  const [popup, setPopup] = useState<string | null>(null)
  const { data: channels = [], isLoading } = useDiscoverChannels()
  const joinChannel = useJoinChannel()
  const requestJoin = useRequestJoinChannel()

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const thirtyDays = 30 * 24 * 60 * 60 * 1000
    const newestCreatedAt = channels.reduce((latest, ch) => {
      const t = new Date(ch.created_at).getTime()
      return Number.isFinite(t) ? Math.max(latest, t) : latest
    }, 0)
    return channels.filter((ch) => {
      const desc = ch.description ?? ''
      const createdAt = new Date(ch.created_at).getTime()
      const isNew =
        Number.isFinite(createdAt) &&
        newestCreatedAt > 0 &&
        newestCreatedAt - createdAt <= thirtyDays
      const matchesQuery =
        q.length === 0 ||
        ch.name.toLowerCase().includes(q) ||
        desc.toLowerCase().includes(q)
      if (!matchesQuery) return false
      if (filter === 'joined') return ch.membership_status === 'member'
      if (filter === 'new') return isNew
      if (filter === 'private') return ch.access_type === 'PRIVATE'
      return true
    })
  }, [channels, filter, query])

  const searchActive = query.trim().length > 0
  const popupChannel = popup ? channels.find((c) => c.id === popup) : null

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-background">
      <div className="border-b border-border bg-background px-5 py-3">
        <div className="flex items-center gap-2">
          <Compass className="h-4 w-4 text-primary" />
          <span className="text-[13px] font-bold text-foreground">Browse Channels</span>
          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">{channels.length}</span>
        </div>
      </div>

      <div className="p-4">
        <div className="mb-10 flex flex-wrap items-center gap-2">
          <div className="relative min-w-0 flex-1">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search channels…"
              className="h-8 w-full rounded-xl border border-border bg-muted/50 pl-8 pr-8 text-[12px] text-foreground placeholder:text-muted-foreground focus:border-primary/40 focus:bg-background focus:outline-none focus:ring-1 focus:ring-primary/20"
            />
            {searchActive && (
              <button onClick={() => setQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            {DISCOVER_FILTERS.map(({ id, icon: Icon, label }) => {
              const isActive = filter === id
              return (
                <button
                  key={id}
                  onClick={() => setFilter(id)}
                  className={`flex h-8 items-center gap-1 rounded-xl border px-2.5 text-[11px] font-semibold transition-colors ${
                    isActive
                      ? 'border-primary/30 bg-primary/10 text-primary'
                      : 'border-border bg-background text-muted-foreground hover:bg-accent hover:text-foreground'
                  }`}
                >
                  <Icon className="h-2.5 w-2.5" />
                  {label}
                </button>
              )
            })}
          </div>
        </div>
        {isLoading ? (
          <div className="grid grid-cols-6 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="overflow-hidden rounded-2xl border border-border bg-card">
                <div className="h-16 animate-pulse bg-muted" />
                <div className="space-y-2 p-3">
                  <div className="h-3 w-24 animate-pulse rounded-full bg-muted" />
                  <div className="h-2 w-32 animate-pulse rounded-full bg-muted" />
                  <div className="mt-3 h-7 w-full animate-pulse rounded-xl bg-muted" />
                </div>
              </div>
            ))}
          </div>
        ) : channels.length === 0 ? (
          <div className="flex flex-col items-center py-14 text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-muted">
              <Globe className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="text-[14px] font-semibold text-foreground">No channels yet</p>
            <p className="mt-1 text-[12px] text-muted-foreground">Create the first channel to get started.</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center py-14 text-center">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-muted">
              <Search className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="text-[14px] font-semibold text-foreground">No matches</p>
            <p className="mt-1 text-[12px] text-muted-foreground">Try a different search or filter.</p>
          </div>
        ) : (
          <div className="grid grid-cols-6 gap-3">
            {filtered.map((ch) => {
              const status = ch.membership_status ?? 'none'
              const isPrivate = ch.access_type === 'PRIVATE'
              const tone = getDiscoverChannelTone(ch.id)
              return (
                <div
                  key={ch.id}
                  className={`group overflow-hidden rounded-2xl border bg-card transition-all hover:shadow-md ${
                    status === 'member' ? 'border-primary/20' : 'border-border hover:border-primary/20'
                  }`}
                >
                  <button
                    className={`relative h-16 w-full overflow-hidden bg-gradient-to-br ${tone}`}
                    onClick={() => setPopup(ch.id)}
                  >
                    {ch.banner_url && (
                      <img src={ch.banner_url} alt="" className="absolute inset-0 h-full w-full object-cover object-center" />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
                    {isPrivate && (
                      <span className="absolute right-2 top-2 flex items-center gap-0.5 rounded-full bg-black/40 px-1.5 py-0.5 text-[9px] font-semibold text-white/90 backdrop-blur-sm">
                        <Lock className="h-2.5 w-2.5" /> Private
                      </span>
                    )}
                    {status === 'member' && (
                      <span className="absolute right-2 top-2 flex items-center gap-0.5 rounded-full bg-emerald-500/90 px-1.5 py-0.5 text-[9px] font-semibold text-white">
                        <Check className="h-2.5 w-2.5" strokeWidth={3} /> Joined
                      </span>
                    )}
                  </button>

                  <div className="p-3">
                    <div className="flex items-start gap-2">
                      <div
                        className={`relative -mt-6 flex h-10 w-10 flex-shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br text-[10px] font-bold text-white shadow-md ring-2 ring-card ${tone}`}
                        onClick={() => setPopup(ch.id)}
                      >
                        {ch.avatar_url ? (
                          <img src={ch.avatar_url} alt={ch.name} className="block h-full w-full object-cover object-center" />
                        ) : getDiscoverChannelMonogram(ch.name)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <button
                          onClick={() => setPopup(ch.id)}
                          className="block w-full truncate text-left text-[13px] font-semibold text-foreground transition-colors hover:text-primary"
                        >
                          {ch.name}
                        </button>
                        {ch.member_count !== undefined && (
                          <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground/60">
                            <Users className="h-2.5 w-2.5" />{ch.member_count} members
                          </span>
                        )}
                      </div>
                    </div>

                    {ch.description ? (
                      <p className="mt-2 line-clamp-2 text-[11px] leading-relaxed text-muted-foreground">{ch.description}</p>
                    ) : (
                      <p className="mt-2 text-[11px] italic text-muted-foreground/40">No description</p>
                    )}

                    <div className="mt-3">
                      {status === 'member' ? (
                        <button
                          onClick={() => onSelectChannel?.(ch.id)}
                          className="flex w-full items-center justify-center gap-1 rounded-xl border border-primary/30 bg-primary/10 py-1.5 text-[11px] font-semibold text-primary transition-colors hover:bg-primary/20"
                        >
                          Open <ArrowRight className="h-3 w-3" />
                        </button>
                      ) : status === 'requested' ? (
                        <div className="flex w-full items-center justify-center rounded-xl border border-border bg-muted/60 py-1.5 text-[11px] font-semibold text-muted-foreground">
                          Request sent
                        </div>
                      ) : isPrivate ? (
                        <button
                          onClick={async () => { try { await requestJoin.mutateAsync(ch.id); toast.success(`Request sent to join ${ch.name}`) } catch {} }}
                          disabled={requestJoin.isPending}
                          className="flex w-full items-center justify-center gap-1 rounded-xl border border-amber-500/30 bg-amber-500/10 py-1.5 text-[11px] font-semibold text-amber-600 transition-colors hover:bg-amber-500/20 disabled:opacity-50 dark:text-amber-400"
                        >
                          <Lock className="h-3 w-3" /> Request
                        </button>
                      ) : (
                        <button
                          onClick={async () => {
                            try { await joinChannel.mutateAsync(ch.id); onSelectChannel?.(ch.id) } catch {}
                          }}
                          disabled={joinChannel.isPending}
                          className="flex w-full items-center justify-center gap-1 rounded-xl bg-primary py-1.5 text-[11px] font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
                        >
                          Join <ArrowRight className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {popupChannel && (
        <ChannelPopupCard
          ch={popupChannel}
          onClose={() => setPopup(null)}
          onSelectChannel={onSelectChannel}
          joinChannel={joinChannel}
          requestJoin={requestJoin}
        />
      )}
    </div>
  )
}
