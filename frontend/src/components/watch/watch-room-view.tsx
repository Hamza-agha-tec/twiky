'use client'

import { useRef, useEffect, useState, useCallback } from 'react'
import {
  LiveKitRoom,
  VideoTrack,
  useTracks,
  useRoomContext,
} from '@livekit/components-react'
import { Track, LocalVideoTrack } from 'livekit-client'
import { Loader2, Wifi, WifiOff } from 'lucide-react'
import { useLiveKitToken } from '@/hooks/use-livekit-token'
import { useWatchRoom, type WatchParticipant } from '@/hooks/use-watch-room'
import { WatchHostControls } from './watch-host-controls'
import { WatchParticipants } from './watch-participants'
import { cn } from '@/lib/utils'

const LIVEKIT_URL = process.env.NEXT_PUBLIC_LIVEKIT_URL ?? 'ws://localhost:7880'

// ── Viewer: subscribes to host video track ────────────────────────────────
function ViewerVideo() {
  const tracks = useTracks([Track.Source.Camera], { onlySubscribed: true })
  const hostTrack = tracks[0]

  if (!hostTrack) {
    return (
      <div className="flex flex-1 items-center justify-center bg-black text-muted-foreground text-sm">
        Waiting for host to start the video…
      </div>
    )
  }

  return (
    <VideoTrack
      trackRef={hostTrack}
      className="h-full w-full object-contain bg-black"
    />
  )
}

// ── Host: publishes captureStream from <video> element ────────────────────
function HostPublisher({ videoRef }: { videoRef: React.RefObject<HTMLVideoElement | null> }) {
  const room = useRoomContext()
  const publishedRef = useRef(false)

  useEffect(() => {
    const video = videoRef.current
    if (!video || publishedRef.current) return

    const tryPublish = async () => {
      if (publishedRef.current) return
      try {
        // @ts-ignore — captureStream is not in TS lib but works in all modern browsers
        const stream: MediaStream = video.captureStream(60)
        const videoTrack = stream.getVideoTracks()[0]
        if (!videoTrack) return

        publishedRef.current = true
        const localTrack = new LocalVideoTrack(videoTrack, {
          name: 'watch-video',
        })

        await room.localParticipant.publishTrack(localTrack, {
          source: Track.Source.Camera,
          videoEncoding: {
            maxBitrate: 8_000_000,
            maxFramerate: 60,
          },
        })
      } catch (e) {
        console.error('Failed to publish watch track:', e)
      }
    }

    // publish once video is loaded
    if (video.readyState >= 1) {
      tryPublish()
    } else {
      video.addEventListener('loadedmetadata', tryPublish, { once: true })
    }

    return () => {
      publishedRef.current = false
    }
  }, [videoRef, room])

  return null
}

// ── Main room component ────────────────────────────────────────────────────
interface WatchRoomInnerProps {
  roomId: string
  userId: string
  isHost: boolean
  videoRef: React.RefObject<HTMLVideoElement | null>
  participants: WatchParticipant[]
  syncing: boolean
  onPlay: () => void
  onPause: () => void
  onSeek: (t: number) => void
}

function WatchRoomInner({
  isHost,
  videoRef,
  participants,
  syncing,
  onPlay,
  onPause,
  onSeek,
}: WatchRoomInnerProps) {
  return (
    <div className="flex h-full w-full overflow-hidden bg-black">
      {/* video area */}
      <div className="relative flex flex-1 flex-col">
        {syncing && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/60">
            <Loader2 className="h-8 w-8 animate-spin text-white" />
            <span className="ml-2 text-white text-sm">Syncing…</span>
          </div>
        )}

        {isHost ? (
          <div className="flex flex-1 items-center justify-center bg-zinc-950 p-4">
            <WatchHostControls
              videoRef={videoRef}
              onPlay={onPlay}
              onPause={onPause}
              onSeek={onSeek}
              className="w-full max-w-lg"
            />
            <HostPublisher videoRef={videoRef} />
          </div>
        ) : (
          <div className="flex flex-1">
            <ViewerVideo />
          </div>
        )}
      </div>

      {/* sidebar */}
      <div className="flex w-56 shrink-0 flex-col gap-4 border-l border-border bg-sidebar p-3">
        <WatchParticipants participants={participants} />
      </div>
    </div>
  )
}

// ── Public entry point ─────────────────────────────────────────────────────
interface WatchRoomViewProps {
  roomId: string
  userId: string
  username: string
  isHost: boolean
}

export function WatchRoomView({ roomId, userId, username, isHost }: WatchRoomViewProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const participantIdentity = `${userId}__${username}`

  const { token, loading, error } = useLiveKitToken(roomId, participantIdentity)
  const { participants, syncing, emitPlay, emitPause, emitSeek } = useWatchRoom({
    roomId,
    userId,
    isHost,
    videoRef,
  })

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center bg-black">
        <Loader2 className="h-8 w-8 animate-spin text-white" />
      </div>
    )
  }

  if (error || !token) {
    return (
      <div className="flex h-full items-center justify-center bg-black text-destructive gap-2">
        <WifiOff className="h-5 w-5" />
        <span className="text-sm">{error ?? 'Could not connect to watch room'}</span>
      </div>
    )
  }

  return (
    <LiveKitRoom
      serverUrl={LIVEKIT_URL}
      token={token}
      connect={true}
      video={false}
      audio={false}
    >
      <WatchRoomInner
        roomId={roomId}
        userId={userId}
        isHost={isHost}
        videoRef={videoRef}
        participants={participants}
        syncing={syncing}
        onPlay={emitPlay}
        onPause={emitPause}
        onSeek={emitSeek}
      />
    </LiveKitRoom>
  )
}
