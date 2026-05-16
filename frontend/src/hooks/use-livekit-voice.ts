'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Room,
  RoomEvent,
  Track,
  ParticipantEvent,
  LocalVideoTrack,
  type RemoteTrack,
  type RemoteParticipant,
  type TrackPublication,
  type LocalTrack,
  type LocalTrackPublication,
} from 'livekit-client'
import { fetchLiveKitToken } from './use-livekit-token'
import { getSocket } from '@/lib/socket'

const LIVEKIT_URL = process.env.NEXT_PUBLIC_LIVEKIT_URL ?? 'ws://localhost:7880'

type VideoSource = 'camera' | 'screen'

// ── helpers to build MediaStream maps ────────────────────────────────────
function addTrackToMap(
  map: Map<string, MediaStream>,
  participantId: string,
  track: MediaStreamTrack,
): Map<string, MediaStream> {
  const next = new Map(map)
  const existing = next.get(participantId)
  const tracks = existing
    ? existing.getTracks().filter((t) => t.kind !== track.kind)
    : []
  tracks.push(track)
  next.set(participantId, new MediaStream(tracks))
  return next
}

function removeTrackFromMap(
  map: Map<string, MediaStream>,
  participantId: string,
  track: MediaStreamTrack,
): Map<string, MediaStream> {
  const next = new Map(map)
  const existing = next.get(participantId)
  if (!existing) return next
  const tracks = existing.getTracks().filter((t) => t !== track && t.readyState === 'live')
  if (tracks.length > 0) next.set(participantId, new MediaStream(tracks))
  else next.delete(participantId)
  return next
}

// Remove all tracks of a given kind (video/audio) — reliable when object identity is unavailable
function removeKindFromMap(
  map: Map<string, MediaStream>,
  participantId: string,
  kind: 'video' | 'audio',
): Map<string, MediaStream> {
  const next = new Map(map)
  const existing = next.get(participantId)
  if (!existing) return next
  const tracks = existing.getTracks().filter((t) => t.kind !== kind && t.readyState === 'live')
  if (tracks.length > 0) next.set(participantId, new MediaStream(tracks))
  else next.delete(participantId)
  return next
}

// ── hook ──────────────────────────────────────────────────────────────────
export function useLiveKitVoice(
  groupId: string | null,
  myId: string | null,
  isMuted: boolean,
) {
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(new Map())
  const [remoteScreenStreams, setRemoteScreenStreams] = useState<Map<string, MediaStream>>(new Map())
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [remoteSpeakingUserIds, setRemoteSpeakingUserIds] = useState<Set<string>>(new Set())
  const [localStream, setLocalStream] = useState<MediaStream | null>(null)
  const [isScreenSharing, setIsScreenSharing] = useState(false)
  const [localScreenStream, setLocalScreenStream] = useState<MediaStream | null>(null)

  const roomRef = useRef<Room | null>(null)
  const isMutedRef = useRef(isMuted)

  // sync mute ref and apply to room
  useEffect(() => {
    isMutedRef.current = isMuted
    roomRef.current?.localParticipant.setMicrophoneEnabled(!isMuted).catch(() => {})
  }, [isMuted])

  // ── main room lifecycle ───────────────────────────────────────────────
  useEffect(() => {
    if (!groupId || !myId) return
    let mounted = true

    const room = new Room({
      adaptiveStream: true,
      dynacast: true,
      audioCaptureDefaults: {
        echoCancellation: true,
        noiseSuppression: true,
        sampleRate: 48000,
      },
    })
    roomRef.current = room

    // ── remote track subscribed ─────────────────────────────────────────
    const onTrackSubscribed = (
      track: RemoteTrack,
      _pub: unknown,
      participant: RemoteParticipant,
    ) => {
      if (!mounted) return
      const mediaTrack = track.mediaStreamTrack
      const isScreen = track.source === Track.Source.ScreenShare

      if (isScreen) {
        setRemoteScreenStreams((prev) => addTrackToMap(prev, participant.identity, mediaTrack))
      } else {
        setRemoteStreams((prev) => addTrackToMap(prev, participant.identity, mediaTrack))
      }

      mediaTrack.addEventListener('ended', () => {
        if (isScreen) {
          setRemoteScreenStreams((prev) => removeTrackFromMap(prev, participant.identity, mediaTrack))
        } else {
          setRemoteStreams((prev) => removeTrackFromMap(prev, participant.identity, mediaTrack))
        }
      })
    }

    // ── remote track unsubscribed ───────────────────────────────────────
    const onTrackUnsubscribed = (
      track: RemoteTrack,
      _pub: unknown,
      participant: RemoteParticipant,
    ) => {
      if (!mounted) return
      const isScreen = track.source === Track.Source.ScreenShare
      const kind = track.kind === Track.Kind.Video ? 'video' : 'audio'
      if (isScreen) {
        setRemoteScreenStreams((prev) => removeKindFromMap(prev, participant.identity, kind))
      } else {
        setRemoteStreams((prev) => removeKindFromMap(prev, participant.identity, kind))
      }
    }

    // ── participant disconnected ────────────────────────────────────────
    const onParticipantDisconnected = (participant: RemoteParticipant) => {
      if (!mounted) return
      setRemoteStreams((prev) => { const n = new Map(prev); n.delete(participant.identity); return n })
      setRemoteScreenStreams((prev) => { const n = new Map(prev); n.delete(participant.identity); return n })
      setRemoteSpeakingUserIds((prev) => { const n = new Set(prev); n.delete(participant.identity); return n })
    }

    // ── speaking detection (remote) ─────────────────────────────────────
    const onActiveSpeakersChanged = (speakers: Array<{ identity: string }>) => {
      if (!mounted) return
      const speakingIds = new Set(speakers.map((s) => s.identity))
      speakingIds.delete(myId) // exclude self (handled separately)
      setRemoteSpeakingUserIds(speakingIds)
    }

    // ── remote track muted (cam disabled by sender) ────────────────────
    // pub.track may be null when muted — use kind-based removal, not identity
    const onTrackMuted = (
      pub: TrackPublication,
      participant: RemoteParticipant,
    ) => {
      if (!mounted || pub.kind !== Track.Kind.Video) return
      const isScreen = pub.source === Track.Source.ScreenShare
      if (isScreen) {
        setRemoteScreenStreams((prev) => removeKindFromMap(prev, participant.identity, 'video'))
      } else {
        setRemoteStreams((prev) => removeKindFromMap(prev, participant.identity, 'video'))
      }
    }

    // ── remote track unmuted (cam re-enabled by sender) ────────────────
    const onTrackUnmuted = (
      pub: TrackPublication,
      participant: RemoteParticipant,
    ) => {
      if (!mounted || pub.kind !== Track.Kind.Video) return
      const mediaTrack = pub.track?.mediaStreamTrack
      if (!mediaTrack) return
      const isScreen = pub.source === Track.Source.ScreenShare
      if (isScreen) {
        setRemoteScreenStreams((prev) => addTrackToMap(prev, participant.identity, mediaTrack))
      } else {
        setRemoteStreams((prev) => addTrackToMap(prev, participant.identity, mediaTrack))
      }
    }

    // ── local screen share lifecycle ────────────────────────────────────
    const onLocalPublished = (pub: LocalTrackPublication) => {
      if (pub.source === Track.Source.ScreenShare) {
        setIsScreenSharing(true)
        const mt = pub.track?.mediaStreamTrack
        if (mt) setLocalScreenStream(new MediaStream([mt]))
      }
    }
    const onLocalUnpublished = (pub: LocalTrackPublication) => {
      if (pub.source === Track.Source.ScreenShare) {
        setIsScreenSharing(false)
        setLocalScreenStream(null)
      }
    }

    room.on(RoomEvent.TrackSubscribed, onTrackSubscribed)
    room.on(RoomEvent.TrackUnsubscribed, onTrackUnsubscribed)
    room.on(RoomEvent.TrackMuted, onTrackMuted)
    room.on(RoomEvent.TrackUnmuted, onTrackUnmuted)
    room.on(RoomEvent.ParticipantDisconnected, onParticipantDisconnected)
    room.on(RoomEvent.ActiveSpeakersChanged, onActiveSpeakersChanged)
    room.on(RoomEvent.LocalTrackPublished, onLocalPublished)
    room.on(RoomEvent.LocalTrackUnpublished, onLocalUnpublished)

    // ── self speaking ───────────────────────────────────────────────────
    room.localParticipant.on(ParticipantEvent.IsSpeakingChanged, (speaking: boolean) => {
      if (mounted) setIsSpeaking(speaking)
    })

    const connect = async () => {
      try {
        const token = await fetchLiveKitToken(groupId, myId)
        if (!mounted) return

        await room.connect(LIVEKIT_URL, token)
        if (!mounted) { room.disconnect(); return }

        // publish microphone
        await room.localParticipant.setMicrophoneEnabled(!isMutedRef.current)

        // expose local stream for any consumers
        const micTrack = room.localParticipant.getTrackPublication(Track.Source.Microphone)
        if (micTrack?.track?.mediaStreamTrack) {
          const stream = new MediaStream([micTrack.track.mediaStreamTrack])
          if (mounted) setLocalStream(stream)
        }
      } catch (err) {
        console.error('[livekit-voice] connect failed', err)
      }
    }

    void connect()

    return () => {
      mounted = false
      room.off(RoomEvent.TrackSubscribed, onTrackSubscribed)
      room.off(RoomEvent.TrackUnsubscribed, onTrackUnsubscribed)
      room.off(RoomEvent.TrackMuted, onTrackMuted)
      room.off(RoomEvent.TrackUnmuted, onTrackUnmuted)
      room.off(RoomEvent.ParticipantDisconnected, onParticipantDisconnected)
      room.off(RoomEvent.ActiveSpeakersChanged, onActiveSpeakersChanged)
      room.off(RoomEvent.LocalTrackPublished, onLocalPublished)
      room.off(RoomEvent.LocalTrackUnpublished, onLocalUnpublished)
      setIsScreenSharing(false)
      setLocalScreenStream(null)
      room.disconnect()
      roomRef.current = null
      setRemoteStreams(new Map())
      setRemoteScreenStreams(new Map())
      setRemoteSpeakingUserIds(new Set())
      setLocalStream(null)
      setIsSpeaking(false)
    }
  }, [groupId, myId]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── addVideoTrack / removeVideoTrack ─────────────────────────────────
  // Called by VoiceGroupView when camera/screen tracks start or stop.
  // With LiveKit the room publishes for us — we just emit the presence event.
  const addVideoTrack = useCallback(
    async (track: MediaStreamTrack, _stream: MediaStream, source: VideoSource = 'camera') => {
      const room = roomRef.current
      const gId = groupId
      if (!room || !gId) return

      if (source === 'screen') {
        // screen share is handled via setScreenShareEnabled
        return
      }

      // camera: publish via LiveKit at highest quality
      const livekitTrack = new LocalVideoTrack(track)
      await room.localParticipant.publishTrack(livekitTrack, {
        source: Track.Source.Camera,
        videoEncoding: { maxBitrate: 4_000_000, maxFramerate: 60 },
      })
    },
    [groupId],
  )

  const removeVideoTrack = useCallback(
    async (_track: MediaStreamTrack) => {
      const room = roomRef.current
      const gId = groupId
      if (!room || !gId) return

      const camPub = room.localParticipant.getTrackPublication(Track.Source.Camera)
      if (camPub?.track) {
        await room.localParticipant.unpublishTrack(camPub.track as LocalTrack)
      }
    },
    [groupId],
  )

  // ── screen share ──────────────────────────────────────────────────────
  const signalScreenShare = useCallback(
    async (enabled: boolean) => {
      const room = roomRef.current
      const gId = groupId
      if (!room || !gId) return

      if (enabled) {
        await room.localParticipant.setScreenShareEnabled(true, {
          video: { frameRate: 30, width: { ideal: 1920 }, height: { ideal: 1080 } },
          contentHint: 'detail',
        }, {
          videoEncoding: { maxBitrate: 7_500_000, maxFramerate: 30 },
        })
      } else {
        await room.localParticipant.setScreenShareEnabled(false)
      }
      const socket = await getSocket()
      socket.emit('voice-screen-share', { roomId: gId, enabled })
    },
    [groupId],
  )

  // ── audio input switch ────────────────────────────────────────────────
  const switchAudioInput = useCallback(async (deviceId: string) => {
    await roomRef.current?.switchActiveDevice('audioinput', deviceId)
  }, [])

  // closePeer is a no-op with LiveKit (SFU handles it)
  const closePeer = useCallback((_peerId: string) => {}, [])

  return {
    localStream,
    localScreenStream,
    remoteStreams,
    remoteScreenStreams,
    isSpeaking,
    isScreenSharing,
    remoteSpeakingUserIds,
    addVideoTrack,
    removeVideoTrack,
    closePeer,
    signalScreenShare,
    switchAudioInput,
  }
}
