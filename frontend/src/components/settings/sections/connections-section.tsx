'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Link2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { SectionHeader } from '../shared'
import { useSpotifyAuthUrl, useSpotifyDisconnect, useSpotifyNowPlaying } from '@/hooks/use-spotify'
import type { UserProfile } from '@/lib/user-api'

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

export function ConnectionsSection({ profile }: { profile?: UserProfile }) {
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
