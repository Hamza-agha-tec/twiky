'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Link2, GitCommit, GitPullRequest, CircleDot, GitBranch } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { SectionHeader } from '../shared'
import { useSpotifyAuthUrl, useSpotifyDisconnect, useSpotifyNowPlaying } from '@/hooks/use-spotify'
import { useGitHubAuthUrl, useGitHubDisconnect, useGitHubStatus, useGitHubActivity, useGitHubProfile } from '@/hooks/use-github'
import type { GitHubEvent } from '@/lib/github-api'
import type { UserProfile } from '@/lib/user-api'

// ── Spotify ──────────────────────────────────────────────────────────────────

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
            style={{ height: `${h * 3}px`, animation: `pulse ${0.5 + i * 0.1}s ease-in-out infinite alternate` }}
          />
        ))}
      </div>
    </div>
  )
}

// ── GitHub ───────────────────────────────────────────────────────────────────

function eventIcon(type: GitHubEvent['type']) {
  switch (type) {
    case 'PushEvent': return <GitCommit className="h-3 w-3" />
    case 'PullRequestEvent': return <GitPullRequest className="h-3 w-3" />
    case 'IssuesEvent': return <CircleDot className="h-3 w-3" />
    case 'CreateEvent': return <GitBranch className="h-3 w-3" />
    default: return <GitCommit className="h-3 w-3" />
  }
}

function eventLabel(e: GitHubEvent): string {
  const repo = e.repo.split('/')[1] ?? e.repo
  switch (e.type) {
    case 'PushEvent':
      return `Pushed to ${repo}${e.message ? `: ${e.message.split('\n')[0]}` : ''}`
    case 'PullRequestEvent':
      return `PR ${e.action} in ${repo}${e.message ? `: ${e.message}` : ''}`
    case 'IssuesEvent':
      return `Issue ${e.action} in ${repo}${e.message ? `: ${e.message}` : ''}`
    case 'CreateEvent':
      return `Created ${e.ref_type ?? 'branch'} in ${repo}`
    default:
      return repo
  }
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function GitHubActivityFeed({ userId }: { userId: string }) {
  const { data, isLoading } = useGitHubActivity(userId)

  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-8 animate-pulse rounded-lg bg-muted/50" />
        ))}
      </div>
    )
  }

  const events = data?.events ?? []
  if (!events.length) {
    return <p className="text-[11px] text-muted-foreground">No recent activity</p>
  }

  return (
    <div className="space-y-1.5">
      {events.slice(0, 5).map((e, i) => (
        <div key={i} className="flex items-start gap-2 rounded-lg px-2 py-1.5 hover:bg-muted/40 transition-colors">
          <span className="mt-0.5 flex-shrink-0 text-[#6e7681]">{eventIcon(e.type)}</span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[11.5px] text-foreground/80">{eventLabel(e)}</p>
          </div>
          <span className="flex-shrink-0 text-[10px] text-muted-foreground">{timeAgo(e.created_at)}</span>
        </div>
      ))}
    </div>
  )
}

function GitHubConnectedCard({ userId, profile, isCoding, onDisconnect, isPending }: {
  userId: string
  profile: { login: string; name: string; avatar_url: string; html_url: string; public_repos: number; followers: number }
  isCoding: boolean
  onDisconnect: () => void
  isPending: boolean
}) {
  const [showActivity, setShowActivity] = useState(false)

  return (
    <div className="space-y-3">
      {/* Profile row */}
      <div className="flex items-center gap-3 rounded-2xl border border-[#30363d]/60 bg-[#0d1117]/40 px-3 py-2.5">
        <img src={profile.avatar_url} alt={profile.login} className="h-9 w-9 flex-shrink-0 rounded-full" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-[12.5px] font-semibold text-foreground">{profile.name || profile.login}</p>
            <span className="text-[11px] text-muted-foreground">@{profile.login}</span>
          </div>
          <p className="text-[11px] text-muted-foreground">
            {profile.public_repos} repos · {profile.followers} followers
          </p>
        </div>
        {isCoding && (
          <Badge className="rounded-full border-green-500/30 bg-green-500/15 px-2 py-0.5 text-[10px] font-semibold text-green-400">
            Coding now
          </Badge>
        )}
      </div>

      {/* Activity toggle */}
      <button
        className="w-full text-left text-[11.5px] font-medium text-muted-foreground hover:text-foreground transition-colors"
        onClick={() => setShowActivity(v => !v)}
      >
        {showActivity ? '▾' : '▸'} Recent activity
      </button>
      {showActivity && <GitHubActivityFeed userId={userId} />}

      <Button
        size="sm"
        variant="outline"
        className="h-9 rounded-xl border-destructive/30 px-4 text-[12px] font-semibold text-destructive hover:bg-destructive/10 hover:text-destructive"
        onClick={onDisconnect}
        disabled={isPending}
      >
        {isPending ? 'Disconnecting…' : 'Disconnect'}
      </Button>
    </div>
  )
}

// ── Main section ─────────────────────────────────────────────────────────────

export function ConnectionsSection({ profile }: { profile?: UserProfile }) {
  // Spotify
  const getSpotifyAuthUrl = useSpotifyAuthUrl()
  const disconnectSpotify = useSpotifyDisconnect(profile?.id)
  const { data: nowPlaying } = useSpotifyNowPlaying(profile?.id)
  const [spotifyError, setSpotifyError] = useState<string | null>(null)
  const isSpotifyConnected = nowPlaying !== undefined && nowPlaying.message !== 'Spotify not connected'

  // GitHub
  const getGitHubAuthUrl = useGitHubAuthUrl()
  const disconnectGitHub = useGitHubDisconnect(profile?.id)
  const { data: githubStatus } = useGitHubStatus(profile?.id)
  const { data: githubProfile } = useGitHubProfile(profile?.id)
  const [githubError, setGitHubError] = useState<string | null>(null)
  const isGitHubConnected = !!(githubStatus?.username)

  async function handleConnectSpotify() {
    setSpotifyError(null)
    try {
      const { url } = await getSpotifyAuthUrl.mutateAsync()
      window.location.href = url
    } catch (err) {
      setSpotifyError(err instanceof Error ? err.message : 'Failed to start Spotify connection')
    }
  }

  async function handleConnectGitHub() {
    setGitHubError(null)
    try {
      const { url } = await getGitHubAuthUrl.mutateAsync()
      window.location.href = url
    } catch (err) {
      setGitHubError(err instanceof Error ? err.message : 'Failed to start GitHub connection')
    }
  }

  return (
    <>
      <SectionHeader
        title="Connected Apps"
        description="Manage services connected to your profile."
      />

      <div className="space-y-4">
        {/* Spotify card */}
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
                {isSpotifyConnected && (
                  <Badge className="rounded-full border-[#1DB954]/30 bg-[#1DB954]/15 px-2 py-0.5 text-[10px] font-semibold text-[#1DB954] hover:bg-[#1DB954]/15">
                    Connected
                  </Badge>
                )}
              </div>
              <p className="mt-1 max-w-lg text-[12.5px] leading-5 text-muted-foreground">
                Show your current track on your Twiky profile and keep your music status fresh.
              </p>
              {isSpotifyConnected && (
                <div className="mt-3">
                  <SpotifyNowPlaying userId={profile?.id} />
                </div>
              )}
              {!isSpotifyConnected && (
                <div className="mt-3 flex items-center gap-3 rounded-2xl border border-dashed border-[#1DB954]/25 bg-background/70 p-3">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-[#1DB954]/10">
                    <Link2 className="h-4 w-4 text-[#1DB954]" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[12px] font-semibold text-foreground">Ready to connect</p>
                    <p className="text-[11px] text-muted-foreground">Authorize Spotify to display your listening activity.</p>
                  </div>
                </div>
              )}
              {spotifyError && <p className="mt-2 text-[11px] text-destructive">{spotifyError}</p>}
              <div className="mt-4 flex gap-2">
                {isSpotifyConnected ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-9 rounded-xl border-destructive/30 px-4 text-[12px] font-semibold text-destructive hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => disconnectSpotify.mutateAsync()}
                    disabled={disconnectSpotify.isPending}
                  >
                    {disconnectSpotify.isPending ? 'Disconnecting…' : 'Disconnect'}
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    className="h-9 rounded-xl bg-[#1DB954] px-4 text-[12px] font-semibold text-black hover:bg-[#1DB954]/90"
                    onClick={handleConnectSpotify}
                    disabled={getSpotifyAuthUrl.isPending}
                  >
                    {getSpotifyAuthUrl.isPending ? 'Redirecting…' : 'Connect Spotify'}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </motion.div>

        {/* GitHub card */}
        <motion.div
          className="overflow-hidden rounded-[22px] border border-[#30363d]/60 bg-gradient-to-br from-[#161b22]/80 via-background to-background p-5 shadow-sm"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.24, ease: 'easeOut', delay: 0.06 }}
        >
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-[#f0f6ff]/8 ring-1 ring-[#30363d]/80">
              <svg viewBox="0 0 24 24" className="h-7 w-7 fill-foreground">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
              </svg>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-[15px] font-bold text-foreground">GitHub</p>
                {isGitHubConnected && (
                  <Badge className="rounded-full border-[#238636]/40 bg-[#238636]/15 px-2 py-0.5 text-[10px] font-semibold text-[#3fb950] hover:bg-[#238636]/15">
                    Connected
                  </Badge>
                )}
              </div>
              <p className="mt-1 max-w-lg text-[12.5px] leading-5 text-muted-foreground">
                Show your coding activity and GitHub profile on Twiky. Displays recent commits, PRs, and a live "coding now" presence.
              </p>

              {isGitHubConnected && githubProfile && profile?.id ? (
                <div className="mt-3">
                  <GitHubConnectedCard
                    userId={profile.id}
                    profile={githubProfile}
                    isCoding={githubStatus?.is_coding ?? false}
                    onDisconnect={() => disconnectGitHub.mutateAsync()}
                    isPending={disconnectGitHub.isPending}
                  />
                </div>
              ) : !isGitHubConnected ? (
                <>
                  <div className="mt-3 flex items-center gap-3 rounded-2xl border border-dashed border-[#30363d]/80 bg-background/70 p-3">
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-[#f0f6ff]/5">
                      <Link2 className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[12px] font-semibold text-foreground">Ready to connect</p>
                      <p className="text-[11px] text-muted-foreground">Authorize GitHub to display your coding activity.</p>
                    </div>
                  </div>
                  {githubError && <p className="mt-2 text-[11px] text-destructive">{githubError}</p>}
                  <div className="mt-4">
                    <Button
                      size="sm"
                      className="h-9 rounded-xl bg-[#238636] px-4 text-[12px] font-semibold text-white hover:bg-[#2ea043]"
                      onClick={handleConnectGitHub}
                      disabled={getGitHubAuthUrl.isPending}
                    >
                      {getGitHubAuthUrl.isPending ? 'Redirecting…' : 'Connect GitHub'}
                    </Button>
                  </div>
                </>
              ) : null}
            </div>
          </div>
        </motion.div>
      </div>
    </>
  )
}
