'use client'

import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import { getSocket } from '@/lib/socket'
import type { Socket } from 'socket.io-client'

type VideoSource = 'camera' | 'screen'
type StreamSetter = Dispatch<SetStateAction<Map<string, MediaStream>>>

type LocalVideoTrack = {
  stream: MediaStream
  source: VideoSource
}

type PeerState = {
  polite: boolean
  makingOffer: boolean
  ignoreOffer: boolean
  negotiationQueued: boolean
  suppressInitialOffer: boolean
  pendingCandidates: RTCIceCandidateInit[]
  doNegotiate?: () => Promise<void>
  audioTransceiver: RTCRtpTransceiver
  videoTransceivers: Record<VideoSource, RTCRtpTransceiver>
  videoTrackToSource: Map<MediaStreamTrack, VideoSource>
  remoteMidSources: Map<string, VideoSource>
}

type WebRTCSignal = {
  type: 'offer' | 'answer' | 'ice-candidate'
  payload: RTCSessionDescriptionInit | RTCIceCandidateInit
  roomId?: string
  targetUserId?: string
  fromId?: string
  senderId?: string
  videoSources?: Array<{ mid: string; source: VideoSource }>
}

const DEFAULT_ICE_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
]

function getIceServers(): RTCIceServer[] {
  const turnUrls = process.env.NEXT_PUBLIC_TURN_URLS
    ?.split(',')
    .map((url) => url.trim())
    .filter(Boolean)

  if (!turnUrls?.length) return DEFAULT_ICE_SERVERS

  const username = process.env.NEXT_PUBLIC_TURN_USERNAME
  const credential = process.env.NEXT_PUBLIC_TURN_CREDENTIAL

  if (!username || !credential) return DEFAULT_ICE_SERVERS

  return [
    ...DEFAULT_ICE_SERVERS,
    { urls: turnUrls, username, credential },
  ]
}

function addRemoteTrack(setStreams: StreamSetter, peerId: string, track: MediaStreamTrack) {
  setStreams((prev) => {
    const existing = prev.get(peerId)
    const tracks = existing
      ? existing.getTracks().filter((t) => t !== track && t.kind !== track.kind)
      : []
    tracks.push(track)

    const next = new Map(prev)
    next.set(peerId, new MediaStream(tracks))
    return next
  })
}

function removeRemoteTrack(setStreams: StreamSetter, peerId: string, track: MediaStreamTrack) {
  setStreams((prev) => {
    const existing = prev.get(peerId)
    if (!existing) return prev

    const tracks = existing.getTracks().filter((t) => t !== track && t.readyState === 'live')
    const next = new Map(prev)

    if (tracks.length > 0) next.set(peerId, new MediaStream(tracks))
    else next.delete(peerId)

    return next
  })
}

function removeRemotePeer(setStreams: StreamSetter, peerId: string) {
  setStreams((prev) => {
    if (!prev.has(peerId)) return prev
    const next = new Map(prev)
    next.delete(peerId)
    return next
  })
}

async function attachVideoTrack(
  state: PeerState,
  track: MediaStreamTrack,
  source: VideoSource,
  negotiate = true,
) {
  if (track.readyState !== 'live') return

  const currentSource = state.videoTrackToSource.get(track)
  if (currentSource === source) {
    const currentTransceiver = state.videoTransceivers[source]
    if (currentTransceiver.direction !== 'sendrecv') {
      currentTransceiver.direction = 'sendrecv'
    }
    if (currentTransceiver.sender.track !== track) {
      await currentTransceiver.sender.replaceTrack(track)
      if (negotiate) void state.doNegotiate?.()
    }
    return
  }

  if (currentSource) {
    const currentTransceiver = state.videoTransceivers[currentSource]
    if (currentTransceiver.sender.track === track) {
      currentTransceiver.sender.replaceTrack(null).catch(() => {})
    }
    state.videoTrackToSource.delete(track)
  }

  const transceiver = state.videoTransceivers[source]
  for (const [existingTrack, existingSource] of state.videoTrackToSource.entries()) {
    if (existingSource === source && existingTrack !== track) {
      const existingTransceiver = state.videoTransceivers[existingSource]
      if (existingTransceiver.sender.track === existingTrack) {
        existingTransceiver.sender.replaceTrack(null).catch(() => {})
      }
      state.videoTrackToSource.delete(existingTrack)
    }
  }

  state.videoTrackToSource.set(track, source)
  if (transceiver.direction !== 'sendrecv') {
    transceiver.direction = 'sendrecv'
  }
  try {
    await transceiver.sender.replaceTrack(track)
    if (negotiate) void state.doNegotiate?.()
  } catch (error) {
    state.videoTrackToSource.delete(track)
    console.error('[webrtc] failed to attach video track', error)
  }
}

function detachVideoTrack(state: PeerState, track: MediaStreamTrack) {
  const source = state.videoTrackToSource.get(track)
  if (!source) return

  const transceiver = state.videoTransceivers[source]
  if (transceiver.sender.track === track) {
    transceiver.direction = 'recvonly'
    transceiver.sender.replaceTrack(null)
      .then(() => { void state.doNegotiate?.() })
      .catch(() => {})
  }
  state.videoTrackToSource.delete(track)
}

function getVideoSource(
  pc: RTCPeerConnection,
  state: PeerState,
  transceiver: RTCRtpTransceiver,
): VideoSource {
  if (transceiver.mid) {
    const source = state.remoteMidSources.get(transceiver.mid)
    if (source) return source
  }

  if (transceiver === state.videoTransceivers.screen) return 'screen'
  if (transceiver === state.videoTransceivers.camera) return 'camera'

  const videoTransceivers = pc.getTransceivers().filter((candidate) => {
    return candidate.receiver.track.kind === 'video' || candidate.sender.track?.kind === 'video'
  })
  return videoTransceivers.indexOf(transceiver) === 1 ? 'screen' : 'camera'
}

async function flushQueuedCandidates(pc: RTCPeerConnection, state: PeerState) {
  if (!pc.remoteDescription) return

  const pending = state.pendingCandidates.splice(0)
  for (const candidate of pending) {
    try {
      await pc.addIceCandidate(candidate)
    } catch (error) {
      if (!state.ignoreOffer) {
        console.warn('[webrtc] failed to add queued ICE candidate', error)
      }
    }
  }
}

function getLocalVideoSources(state: PeerState): Array<{ mid: string; source: VideoSource }> {
  return (['camera', 'screen'] as const).flatMap((source) => {
    const mid = state.videoTransceivers[source].mid
    return mid ? [{ mid, source }] : []
  })
}

export function useWebRTC(
  groupId: string | null,
  myId: string | null,
  isMuted: boolean,
) {
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(new Map())
  const [remoteScreenStreams, setRemoteScreenStreams] = useState<Map<string, MediaStream>>(new Map())
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [localStream, setLocalStream] = useState<MediaStream | null>(null)

  const pcsRef = useRef<Map<string, RTCPeerConnection>>(new Map())
  const peerStateRef = useRef<Map<string, PeerState>>(new Map())
  const reconnectTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())
  const localStreamRef = useRef<MediaStream | null>(null)
  const socketRef = useRef<Socket | null>(null)
  const myIdRef = useRef(myId)
  const groupIdRef = useRef(groupId)
  const isMutedRef = useRef(isMuted)
  const speakingRafRef = useRef<number | null>(null)
  const analyserCtxRef = useRef<AudioContext | null>(null)
  const videoTracksRef = useRef<Map<MediaStreamTrack, LocalVideoTrack>>(new Map())
  const mountedRef = useRef(false)

  useEffect(() => { myIdRef.current = myId }, [myId])
  useEffect(() => { groupIdRef.current = groupId }, [groupId])

  useEffect(() => {
    isMutedRef.current = isMuted
    localStreamRef.current?.getAudioTracks().forEach((track) => { track.enabled = !isMuted })
  }, [isMuted])

  const sendSignal = useCallback((payload: object) => {
    socketRef.current?.emit('webrtc-signal', payload)
  }, [])

  const closePeer = useCallback((peerId: string) => {
    const pc = pcsRef.current.get(peerId)
    if (pc) {
      pc.onconnectionstatechange = null
      pc.onnegotiationneeded = null
      pc.onicecandidate = null
      pc.ontrack = null
      pc.close()
    }

    const timer = reconnectTimersRef.current.get(peerId)
    if (timer) {
      clearTimeout(timer)
      reconnectTimersRef.current.delete(peerId)
    }

    pcsRef.current.delete(peerId)
    peerStateRef.current.delete(peerId)
    removeRemotePeer(setRemoteStreams, peerId)
    removeRemotePeer(setRemoteScreenStreams, peerId)
  }, [])

  const createPeer = useCallback((peerId: string, suppressInitialOffer = false): RTCPeerConnection => {
    const existing = pcsRef.current.get(peerId)
    if (existing && existing.connectionState !== 'closed' && existing.connectionState !== 'failed') {
      return existing
    }

    if (existing) {
      existing.onconnectionstatechange = null
      existing.onnegotiationneeded = null
      existing.onicecandidate = null
      existing.ontrack = null
      existing.close()
    }

    const pc = new RTCPeerConnection({ iceServers: getIceServers() })
    pcsRef.current.set(peerId, pc)

    const me = myIdRef.current ?? ''
    const audioTransceiver = pc.addTransceiver('audio', { direction: 'sendrecv' })
    const videoTransceivers: Record<VideoSource, RTCRtpTransceiver> = {
      camera: pc.addTransceiver('video', { direction: 'recvonly' }),
      screen: pc.addTransceiver('video', { direction: 'recvonly' }),
    }

    const state: PeerState = {
      polite: me < peerId,
      makingOffer: false,
      ignoreOffer: false,
      negotiationQueued: false,
      suppressInitialOffer,
      pendingCandidates: [],
      audioTransceiver,
      videoTransceivers,
      videoTrackToSource: new Map(),
      remoteMidSources: new Map(),
    }
    peerStateRef.current.set(peerId, state)

    Promise.resolve().then(() => {
      if (pc.connectionState === 'closed') return

      const audioTrack = localStreamRef.current?.getAudioTracks()[0]
      if (audioTrack) {
        audioTransceiver.sender.replaceTrack(audioTrack).catch(() => {})
      }

      videoTracksRef.current.forEach(({ source }, track) => {
        void attachVideoTrack(state, track, source)
      })
    })

    pc.ontrack = ({ track, transceiver }) => {
      if (!mountedRef.current) return

      const source = track.kind === 'video' ? getVideoSource(pc, state, transceiver) : null
      const setStream = source === 'screen' ? setRemoteScreenStreams : setRemoteStreams

      const addTrackToStream = () => {
        if (!mountedRef.current || track.readyState !== 'live') return
        if (track.kind === 'video' && track.muted) return
        addRemoteTrack(setStream, peerId, track)
      }

      const removeTrackFromStream = () => {
        if (!mountedRef.current) return
        removeRemoteTrack(setStream, peerId, track)
      }

      addTrackToStream()
      track.addEventListener('ended', removeTrackFromStream)
      track.addEventListener('mute', () => {
        if (track.kind === 'video') removeTrackFromStream()
      })
      track.addEventListener('unmute', addTrackToStream)
    }

    pc.onicecandidate = ({ candidate }) => {
      if (!candidate) return

      sendSignal({
        type: 'ice-candidate',
        payload: candidate.toJSON(),
        roomId: groupIdRef.current,
        targetUserId: peerId,
        fromId: me,
      })
    }

    const doNegotiate = async () => {
      if (pc.signalingState === 'closed') return
      if (state.suppressInitialOffer) {
        state.negotiationQueued = true
        return
      }
      if (state.makingOffer || pc.signalingState !== 'stable') {
        state.negotiationQueued = true
        return
      }

      try {
        state.makingOffer = true
        await pc.setLocalDescription()
        if (pc.connectionState === 'closed') return

        sendSignal({
          type: 'offer',
          payload: pc.localDescription,
          roomId: groupIdRef.current,
          targetUserId: peerId,
          fromId: me,
          videoSources: getLocalVideoSources(state),
        })
      } catch (error) {
        console.error('[webrtc] failed to negotiate with peer', peerId, error)
      } finally {
        state.makingOffer = false
      }
    }
    state.doNegotiate = doNegotiate

    pc.onnegotiationneeded = async () => {
      if (state.suppressInitialOffer) {
        state.negotiationQueued = true
        return
      }
      await doNegotiate()
    }

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed') {
        if (pcsRef.current.get(peerId) !== pc) return

        closePeer(peerId)
        const jitter = Math.random() * 500
        const timer = setTimeout(() => {
          reconnectTimersRef.current.delete(peerId)
          if (!socketRef.current || !myIdRef.current || !mountedRef.current) return

          const shouldInitiate = myIdRef.current > peerId
          createPeer(peerId, !shouldInitiate)
        }, 2000 + jitter)
        reconnectTimersRef.current.set(peerId, timer)
      } else if (pc.connectionState === 'closed') {
        if (pcsRef.current.get(peerId) === pc) {
          pcsRef.current.delete(peerId)
          peerStateRef.current.delete(peerId)
          removeRemotePeer(setRemoteStreams, peerId)
          removeRemotePeer(setRemoteScreenStreams, peerId)
        }
      }
    }

    return pc
  }, [sendSignal, closePeer])

  const setupSpeakingDetection = useCallback((stream: MediaStream) => {
    try {
      const ctx = new AudioContext()
      analyserCtxRef.current = ctx
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 256
      analyser.smoothingTimeConstant = 0.4
      ctx.createMediaStreamSource(stream).connect(analyser)

      const buffer = new Uint8Array(analyser.frequencyBinCount)
      let speaking = false

      const tick = () => {
        if (!analyserCtxRef.current || !mountedRef.current) return

        analyser.getByteFrequencyData(buffer)
        const rms = Math.sqrt(buffer.reduce((sum, value) => sum + value * value, 0) / buffer.length)
        const nextSpeaking = speaking ? rms > 8 : rms > 14

        if (nextSpeaking !== speaking) {
          speaking = nextSpeaking
          setIsSpeaking(nextSpeaking)
        }

        speakingRafRef.current = requestAnimationFrame(tick)
      }

      speakingRafRef.current = requestAnimationFrame(tick)
    } catch {}
  }, [])

  const signalScreenShare = useCallback((enabled: boolean) => {
    if (socketRef.current && groupIdRef.current) {
      socketRef.current.emit('voice-screen-share', { roomId: groupIdRef.current, enabled })
    }
  }, [])

  const addVideoTrack = useCallback((track: MediaStreamTrack, stream: MediaStream, source: VideoSource = 'camera') => {
    for (const [existingTrack, entry] of videoTracksRef.current.entries()) {
      if (entry.source === source && existingTrack !== track) {
        videoTracksRef.current.delete(existingTrack)
        peerStateRef.current.forEach((state) => detachVideoTrack(state, existingTrack))
      }
    }

    videoTracksRef.current.set(track, { stream, source })
    peerStateRef.current.forEach((state) => { void attachVideoTrack(state, track, source) })
  }, [])

  const removeVideoTrack = useCallback((track: MediaStreamTrack) => {
    videoTracksRef.current.delete(track)
    peerStateRef.current.forEach((state) => detachVideoTrack(state, track))
  }, [])

  useEffect(() => {
    if (!groupId || !myId) return
    mountedRef.current = true
    const peerConnections = pcsRef.current
    const peerStates = peerStateRef.current
    const reconnectTimers = reconnectTimersRef.current
    const localVideoTracks = videoTracksRef.current

    const syncLocalTracksForAnswer = async (state: PeerState) => {
      const audioTrack = localStreamRef.current?.getAudioTracks()[0]
      if (audioTrack && state.audioTransceiver.sender.track !== audioTrack) {
        await state.audioTransceiver.sender.replaceTrack(audioTrack)
      }

      await Promise.all(Array.from(videoTracksRef.current.entries()).map(([track, { source }]) => {
        return attachVideoTrack(state, track, source, false)
      }))
    }

    const handleSignal = async (signal: WebRTCSignal) => {
      if (!mountedRef.current) return

      const me = myIdRef.current!
      const { type, payload, fromId, senderId, targetUserId, videoSources } = signal

      if (targetUserId && targetUserId !== me) return

      const peerId = fromId ?? senderId
      if (!peerId || peerId === me) return

      if (type === 'offer' || type === 'answer') {
        const pc = createPeer(peerId)
        const state = peerStateRef.current.get(peerId)
        const description = payload as RTCSessionDescriptionInit

        if (!state) return

        const isOffer = description.type === 'offer'
        const offerCollision = isOffer && (state.makingOffer || pc.signalingState !== 'stable')
        state.ignoreOffer = !state.polite && offerCollision

        if (state.ignoreOffer) return

        try {
          if (Array.isArray(videoSources)) {
            state.remoteMidSources = new Map(videoSources.map(({ mid, source }) => [mid, source]))
          }

          await pc.setRemoteDescription(description)
          await flushQueuedCandidates(pc, state)

          if (isOffer) {
            state.suppressInitialOffer = false
            await syncLocalTracksForAnswer(state)
            await pc.setLocalDescription()

            sendSignal({
              type: 'answer',
              payload: pc.localDescription,
              roomId: groupIdRef.current,
              targetUserId: peerId,
              fromId: me,
              videoSources: getLocalVideoSources(state),
            })
            state.negotiationQueued = false
          } else if (state.negotiationQueued) {
            state.negotiationQueued = false
            void state.doNegotiate?.()
          }
        } catch (error) {
          console.error('[webrtc] failed to apply remote description', peerId, error)
        }
        return
      }

      if (type === 'ice-candidate') {
        const pc = pcsRef.current.get(peerId) ?? createPeer(peerId, true)
        const state = peerStateRef.current.get(peerId)
        if (!state) return

        if (!pc.remoteDescription) {
          state.pendingCandidates.push(payload as RTCIceCandidateInit)
          return
        }

        try {
          await pc.addIceCandidate(payload as RTCIceCandidateInit)
        } catch (error) {
          if (!state.ignoreOffer) {
            console.warn('[webrtc] failed to add ICE candidate', error)
          }
        }
      }
    }

    const handleVoiceRoomParticipants = ({ users }: { participants: string[]; users: Array<{ id: string }> }) => {
      if (!mountedRef.current || !Array.isArray(users)) return

      users.forEach((user) => {
        if (user.id !== myIdRef.current) createPeer(user.id)
      })
    }

    const handleUserJoined = ({ userId }: { userId: string }) => {
      if (!mountedRef.current || userId === myIdRef.current) return
      createPeer(userId, true)
    }

    const handleUserLeft = ({ userId }: { userId: string }) => {
      if (!mountedRef.current) return
      closePeer(userId)
    }

    const handleScreenToggled = ({ userId, enabled }: { userId: string; enabled: boolean }) => {
      if (!mountedRef.current || enabled) return
      removeRemotePeer(setRemoteScreenStreams, userId)
    }

    const handleReconnect = () => {
      if (groupIdRef.current) {
        socketRef.current?.emit('get-voice-room-info', { roomId: groupIdRef.current })
      }
    }

    let initDone = false

    const init = async () => {
      const socket = await getSocket()
      if (!mountedRef.current) return

      socketRef.current = socket
      socket.on('webrtc-signal', handleSignal)
      socket.on('voice-room-participants', handleVoiceRoomParticipants)
      socket.on('user-joined-voice', handleUserJoined)
      socket.on('user-left-voice', handleUserLeft)
      socket.on('user-screen-toggled', handleScreenToggled)
      socket.on('connect', handleReconnect)
      initDone = true

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, sampleRate: 48000 },
          video: false,
        })
        if (!mountedRef.current) {
          stream.getTracks().forEach((track) => track.stop())
          return
        }

        stream.getAudioTracks().forEach((track) => { track.enabled = !isMutedRef.current })
        localStreamRef.current = stream
        setLocalStream(stream)
        setupSpeakingDetection(stream)
      } catch (error) {
        console.error('[webrtc] failed to start microphone', error)
      }

      if (groupIdRef.current) {
        socket.emit('get-voice-room-info', { roomId: groupIdRef.current })
      }

      pcsRef.current.forEach((pc, peerId) => {
        if (!localStreamRef.current || pc.connectionState === 'closed' || pc.connectionState === 'failed') return

        const state = peerStateRef.current.get(peerId)
        const audioTrack = localStreamRef.current.getAudioTracks()[0]
        if (state && audioTrack && state.audioTransceiver.sender.track !== audioTrack) {
          state.audioTransceiver.sender.replaceTrack(audioTrack).catch(() => {})
        }
      })
    }

    void init()

    return () => {
      mountedRef.current = false

      if (speakingRafRef.current) cancelAnimationFrame(speakingRafRef.current)
      analyserCtxRef.current?.close().catch(() => {})
      analyserCtxRef.current = null
      setIsSpeaking(false)

      reconnectTimers.forEach((timer) => clearTimeout(timer))
      reconnectTimers.clear()

      peerConnections.forEach((pc) => {
        pc.onconnectionstatechange = null
        pc.onnegotiationneeded = null
        pc.onicecandidate = null
        pc.ontrack = null
        pc.close()
      })
      peerConnections.clear()
      peerStates.clear()

      localStreamRef.current?.getTracks().forEach((track) => track.stop())
      localStreamRef.current = null
      localVideoTracks.clear()
      setLocalStream(null)
      setRemoteStreams(new Map())
      setRemoteScreenStreams(new Map())

      if (socketRef.current && initDone) {
        socketRef.current.off('webrtc-signal', handleSignal)
        socketRef.current.off('voice-room-participants', handleVoiceRoomParticipants)
        socketRef.current.off('user-joined-voice', handleUserJoined)
        socketRef.current.off('user-left-voice', handleUserLeft)
        socketRef.current.off('user-screen-toggled', handleScreenToggled)
        socketRef.current.off('connect', handleReconnect)
      }
    }
  }, [groupId, myId]) // eslint-disable-line react-hooks/exhaustive-deps

  return {
    localStream,
    remoteStreams,
    remoteScreenStreams,
    isSpeaking,
    addVideoTrack,
    removeVideoTrack,
    closePeer,
    signalScreenShare,
  }
}
