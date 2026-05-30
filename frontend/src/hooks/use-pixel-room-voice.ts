'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Room,
  RoomEvent,
  Track,
  ParticipantEvent,
  type RemoteTrack,
  type RemoteParticipant,
} from 'livekit-client'
import { fetchLiveKitToken } from './use-livekit-token'

const LIVEKIT_URL = process.env.NEXT_PUBLIC_LIVEKIT_URL ?? 'wss://twikyapp-spq2q6t8.livekit.cloud'

// Spatial audio tuning for 26×18 grid
const REF_DISTANCE = 2
const ROLLOFF = 1.5
const MAX_DISTANCE = 15
const ROOM_CENTER_X = 13
const ROOM_CENTER_Y = 9

type AudioNode3D = {
  audioEl: HTMLAudioElement
  source: MediaElementAudioSourceNode
  panner: PannerNode
  gain: GainNode
}

export function usePixelRoomVoice(
  groupId: string | null,
  myId: string | null,
  isMuted: boolean,
  myX: number,
  myY: number,
) {
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [remoteSpeakingIds, setRemoteSpeakingIds] = useState<Set<string>>(new Set())

  const roomRef = useRef<Room | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const nodesRef = useRef<Map<string, AudioNode3D>>(new Map())
  const positionsRef = useRef<Map<string, { x: number; y: number }>>(new Map())
  const isMutedRef = useRef(isMuted)
  const myPositionRef = useRef({ x: myX, y: myY })

  useEffect(() => {
    isMutedRef.current = isMuted
    roomRef.current?.localParticipant.setMicrophoneEnabled(!isMuted).catch(() => {})
  }, [isMuted])

  useEffect(() => {
    myPositionRef.current = { x: myX, y: myY }
    const ctx = audioCtxRef.current
    if (!ctx) return
    if (ctx.listener.positionX) {
      ctx.listener.positionX.value = myX
      ctx.listener.positionZ.value = myY
    } else {
      ctx.listener.setPosition?.(myX, 0, myY)
    }
  }, [myX, myY])

  const updateParticipantPosition = useCallback((userId: string, x: number, y: number) => {
    positionsRef.current.set(userId, { x, y })
    const node = nodesRef.current.get(userId)
    if (!node || !audioCtxRef.current) return
    const { panner } = node
    if (panner.positionX) {
      const t = audioCtxRef.current.currentTime
      panner.positionX.setTargetAtTime(x, t, 0.05)
      panner.positionZ.setTargetAtTime(y, t, 0.05)
    } else {
      panner.setPosition?.(x, 0, y)
    }
  }, [])

  const resumeAudio = useCallback(() => {
    const ctx = audioCtxRef.current
    if (!ctx || ctx.state === 'running') return
    ctx.resume().then(() => {
      console.log('[pixel-room-voice] AudioContext resumed → running')
    }).catch(err => {
      console.warn('[pixel-room-voice] AudioContext resume failed', err)
    })
  }, [])

  useEffect(() => {
    if (!groupId || !myId) return
    let mounted = true

    const ctx = new AudioContext()
    audioCtxRef.current = ctx
    console.log('[pixel-room-voice] AudioContext created, state:', ctx.state)
    ctx.resume().catch(() => {})

    if (ctx.listener.forwardX) {
      ctx.listener.forwardX.value = 0
      ctx.listener.forwardY.value = 0
      ctx.listener.forwardZ.value = -1
      ctx.listener.upX.value = 0
      ctx.listener.upY.value = 1
      ctx.listener.upZ.value = 0
    } else {
      ctx.listener.setOrientation?.(0, 0, -1, 0, 1, 0)
    }
    if (ctx.listener.positionX) {
      ctx.listener.positionX.value = myPositionRef.current.x
      ctx.listener.positionY.value = 0
      ctx.listener.positionZ.value = myPositionRef.current.y
    } else {
      ctx.listener.setPosition?.(myPositionRef.current.x, 0, myPositionRef.current.y)
    }

    const createAudioNode = (userId: string, track: MediaStreamTrack) => {
      if (nodesRef.current.has(userId)) return
      console.log('[pixel-room-voice] creating audio node for', userId, 'ctx:', ctx.state, 'track:', track.readyState, 'muted:', track.muted)

      const pos = positionsRef.current.get(userId) ?? { x: ROOM_CENTER_X, y: ROOM_CENTER_Y }

      // Use <audio> element — more reliable for WebRTC tracks across browsers
      const audioEl = new Audio()
      audioEl.srcObject = new MediaStream([track])
      audioEl.autoplay = true

      const source = ctx.createMediaElementSource(audioEl)

      const panner = ctx.createPanner()
      panner.panningModel = 'HRTF'
      panner.distanceModel = 'inverse'
      panner.refDistance = REF_DISTANCE
      panner.rolloffFactor = ROLLOFF
      panner.maxDistance = MAX_DISTANCE
      panner.coneInnerAngle = 360
      panner.coneOuterAngle = 0
      panner.coneOuterGain = 0
      if (panner.positionX) {
        panner.positionX.value = pos.x
        panner.positionY.value = 0
        panner.positionZ.value = pos.y
      } else {
        panner.setPosition?.(pos.x, 0, pos.y)
      }

      const gain = ctx.createGain()
      gain.gain.value = 1.0

      source.connect(panner)
      panner.connect(gain)
      gain.connect(ctx.destination)

      audioEl.play().then(() => {
        console.log('[pixel-room-voice] audio playing for', userId)
        ctx.resume().catch(() => {})
      }).catch(err => {
        console.warn('[pixel-room-voice] audio play failed for', userId, err)
      })

      nodesRef.current.set(userId, { audioEl, source, panner, gain })
    }

    const destroyAudioNode = (userId: string) => {
      const node = nodesRef.current.get(userId)
      if (!node) return
      try { node.source.disconnect() } catch { /* ignore */ }
      try { node.panner.disconnect() } catch { /* ignore */ }
      try { node.gain.disconnect() } catch { /* ignore */ }
      node.audioEl.pause()
      node.audioEl.srcObject = null
      nodesRef.current.delete(userId)
    }

    const onTrackSubscribed = (
      track: RemoteTrack,
      _pub: unknown,
      participant: RemoteParticipant,
    ) => {
      if (!mounted) return
      console.log('[pixel-room-voice] TrackSubscribed', participant.identity, 'kind:', track.kind, 'source:', track.source, 'ctx:', ctx.state)
      if (track.kind !== Track.Kind.Audio) return
      ctx.resume().catch(() => {})
      createAudioNode(participant.identity, track.mediaStreamTrack)
    }

    const onTrackUnsubscribed = (
      track: RemoteTrack,
      _pub: unknown,
      participant: RemoteParticipant,
    ) => {
      if (!mounted || track.kind !== Track.Kind.Audio) return
      destroyAudioNode(participant.identity)
    }

    const onParticipantDisconnected = (participant: RemoteParticipant) => {
      if (!mounted) return
      destroyAudioNode(participant.identity)
      setRemoteSpeakingIds(prev => { const n = new Set(prev); n.delete(participant.identity); return n })
    }

    const onActiveSpeakersChanged = (speakers: Array<{ identity: string }>) => {
      if (!mounted) return
      const ids = new Set(speakers.map(s => s.identity))
      ids.delete(myId)
      setRemoteSpeakingIds(ids)
    }

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

    room.on(RoomEvent.TrackSubscribed, onTrackSubscribed)
    room.on(RoomEvent.TrackUnsubscribed, onTrackUnsubscribed)
    room.on(RoomEvent.ParticipantDisconnected, onParticipantDisconnected)
    room.on(RoomEvent.ActiveSpeakersChanged, onActiveSpeakersChanged)

    room.localParticipant.on(ParticipantEvent.IsSpeakingChanged, (speaking: boolean) => {
      if (mounted) setIsSpeaking(speaking)
    })

    const connect = async () => {
      try {
        console.log('[pixel-room-voice] connecting, groupId:', groupId, 'myId:', myId)
        const token = await fetchLiveKitToken(`pixel-room:${groupId}`, myId)
        if (!mounted) return
        await room.connect(LIVEKIT_URL, token)
        if (!mounted) { room.disconnect(); return }
        console.log('[pixel-room-voice] connected. participants:', room.remoteParticipants.size)
        ctx.resume().catch(() => {})

        // Process tracks from participants already in the room
        room.remoteParticipants.forEach((participant) => {
          console.log('[pixel-room-voice] existing participant', participant.identity, 'publications:', participant.trackPublications.size)
          participant.trackPublications.forEach((pub) => {
            console.log('[pixel-room-voice]   pub kind:', pub.kind, 'subscribed:', pub.isSubscribed, 'track:', !!pub.track)
            const t = pub.track
            if (t && t.kind === Track.Kind.Audio && t.mediaStreamTrack) {
              createAudioNode(participant.identity, t.mediaStreamTrack)
            }
          })
        })

        try {
          await room.localParticipant.setMicrophoneEnabled(!isMutedRef.current)
          console.log('[pixel-room-voice] mic enabled:', !isMutedRef.current)
        } catch (micErr) {
          console.error('[pixel-room-voice] mic enable failed:', micErr)
        }
      } catch (err) {
        console.error('[pixel-room-voice] connect failed', err)
      }
    }

    void connect()

    return () => {
      mounted = false
      Array.from(nodesRef.current.keys()).forEach(destroyAudioNode)
      nodesRef.current.clear()
      positionsRef.current.clear()
      room.off(RoomEvent.TrackSubscribed, onTrackSubscribed)
      room.off(RoomEvent.TrackUnsubscribed, onTrackUnsubscribed)
      room.off(RoomEvent.ParticipantDisconnected, onParticipantDisconnected)
      room.off(RoomEvent.ActiveSpeakersChanged, onActiveSpeakersChanged)
      room.disconnect()
      roomRef.current = null
      ctx.close()
      audioCtxRef.current = null
      setIsSpeaking(false)
      setRemoteSpeakingIds(new Set())
    }
  }, [groupId, myId]) // eslint-disable-line react-hooks/exhaustive-deps

  return { isSpeaking, remoteSpeakingIds, updateParticipantPosition, resumeAudio }
}
