'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { getSocket } from '@/lib/socket'
import { createClient } from '@/utils/supabase/client'

function playVoiceSound(type: 'join' | 'leave') {
  try {
    const ctx = new AudioContext()
    const gain = ctx.createGain()
    gain.connect(ctx.destination)
    gain.gain.setValueAtTime(0.18, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.5)

    const freqs = type === 'join' ? [660, 880] : [660, 440]
    freqs.forEach((freq, i) => {
      const osc = ctx.createOscillator()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.12)
      osc.connect(gain)
      osc.start(ctx.currentTime + i * 0.12)
      osc.stop(ctx.currentTime + i * 0.12 + 0.18)
    })

    setTimeout(() => ctx.close(), 800)
  } catch {}
}

export interface VoicePresenceUser {
  id: string
  name: string
  avatarUrl: string | null
  bannerUrl?: string | null
  subPlan?: 'FREE' | 'PRO' | 'GEEK' | string | null
  isVerified?: boolean | null
  isMuted: boolean
  isSpeaking?: boolean
  joinedAt: number
  soundboardFile?: string
  soundboardStartedAt?: number
  isScreenSharing?: boolean
  isCameraOn?: boolean
  enterSoundUrl?: string | null
}

type MyVoiceInfo = {
  id: string
  name: string
  avatarUrl: string | null
  bannerUrl?: string | null
  subPlan?: 'FREE' | 'PRO' | 'GEEK' | string | null
  isVerified?: boolean | null
  enterSoundUrl?: string | null
}

export type VoiceInvitePayload = {
  groupId: string
  groupName: string
  inviterId: string
  inviterName: string
  inviterAvatar: string | null
}

function upsertUser(list: VoicePresenceUser[], user: VoicePresenceUser): VoicePresenceUser[] {
  return [user, ...list.filter(u => u.id !== user.id)]
}

function removeUser(list: VoicePresenceUser[], userId: string): VoicePresenceUser[] {
  return list.filter(u => u.id !== userId)
}

export function useVoicePresence(
  myInfo: MyVoiceInfo | null,
  observedGroupIds: string[] = [],
  onVoiceInvite?: (payload: VoiceInvitePayload) => void,
) {
  const [participantsByGroup, setParticipantsByGroup] = useState<Record<string, VoicePresenceUser[]>>({})
  const [currentGroupId, setCurrentGroupId] = useState<string | null>(null)
  const [joinedGroupId, setJoinedGroupId] = useState<string | null>(null)
  const [isJoined, setIsJoined] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [joinedAt, setJoinedAt] = useState(0)
  const [soundboardUserId, setSoundboardUserId] = useState<string | null>(null)
  const [soundboardIntensity, setSoundboardIntensity] = useState(0)

  const socketRef = useRef<Awaited<ReturnType<typeof getSocket>> | null>(null)
  const currentGroupIdRef = useRef<string | null>(null)
  const myInfoRef = useRef<MyVoiceInfo | null>(myInfo)
  const isMutedRef = useRef(false)
  const currentSelfRef = useRef<VoicePresenceUser | null>(null)
  const joinRefFn = useRef<(groupId: string, muted?: boolean) => Promise<void>>(async () => {})
  const pendingJoinRef = useRef<{ groupId: string; muted: boolean } | null>(null)
  const joinSeqRef = useRef(0)
  const analyserRafRef = useRef<number | null>(null)
  const analyserCtxRef = useRef<AudioContext | null>(null)
  const activeSoundAudioRef = useRef<HTMLAudioElement | null>(null)
  const onVoiceInviteRef = useRef(onVoiceInvite)
  onVoiceInviteRef.current = onVoiceInvite

  useEffect(() => { myInfoRef.current = myInfo }, [myInfo])
  useEffect(() => { isMutedRef.current = isMuted }, [isMuted])
  useEffect(() => { currentGroupIdRef.current = currentGroupId }, [currentGroupId])

  useEffect(() => {
    if (myInfo && pendingJoinRef.current) {
      const pending = pendingJoinRef.current
      pendingJoinRef.current = null
      void joinRefFn.current(pending.groupId, pending.muted)
    }
  }, [myInfo])

  const stopActiveSound = useCallback(() => {
    if (activeSoundAudioRef.current) {
      activeSoundAudioRef.current.pause()
      activeSoundAudioRef.current.currentTime = 0
      activeSoundAudioRef.current = null
    }
    if (analyserRafRef.current) cancelAnimationFrame(analyserRafRef.current)
    void analyserCtxRef.current?.close()
    analyserCtxRef.current = null
    setSoundboardIntensity(0)
    setSoundboardUserId(null)
  }, [])

  const startSoundboardAnalyser = useCallback((audio: HTMLAudioElement, senderId: string, onStop?: () => void) => {
    if (activeSoundAudioRef.current && activeSoundAudioRef.current !== audio) {
      activeSoundAudioRef.current.pause()
    }
    activeSoundAudioRef.current = audio
    if (analyserRafRef.current) cancelAnimationFrame(analyserRafRef.current)
    void analyserCtxRef.current?.close()
    setSoundboardUserId(senderId)
    setSoundboardIntensity(0)

    const ctx = new AudioContext()
    analyserCtxRef.current = ctx
    const analyser = ctx.createAnalyser()
    analyser.fftSize = 256
    const source = ctx.createMediaElementSource(audio)
    source.connect(analyser)
    analyser.connect(ctx.destination)
    const data = new Uint8Array(analyser.frequencyBinCount)

    const tick = () => {
      analyser.getByteFrequencyData(data)
      const avg = data.reduce((a, b) => a + b, 0) / data.length
      setSoundboardIntensity(avg / 255)
      analyserRafRef.current = requestAnimationFrame(tick)
    }
    analyserRafRef.current = requestAnimationFrame(tick)

    const stop = () => {
      if (analyserRafRef.current) cancelAnimationFrame(analyserRafRef.current)
      setSoundboardIntensity(0)
      setSoundboardUserId(null)
      void ctx.close()
      activeSoundAudioRef.current = null
      onStop?.()
    }
    audio.onended = stop
    audio.onerror = stop
  }, [])

  // Socket.IO event wiring — single source of truth
  useEffect(() => {
    let mounted = true
    let socket: Awaited<ReturnType<typeof getSocket>> | null = null

    const onRoomUsers = (payload: { roomId?: string; participants?: VoicePresenceUser[] }) => {
      if (!mounted || !payload?.roomId) return
      const users = Array.isArray(payload.participants) ? payload.participants : []
      setParticipantsByGroup(prev => ({ ...prev, [payload.roomId!]: users }))
    }

    const onRoomParticipants = (payload: { roomId?: string; users?: VoicePresenceUser[] }) => {
      if (!mounted || !payload?.roomId) return
      const users = Array.isArray(payload.users) ? payload.users : []
      setParticipantsByGroup(prev => {
        const existing = prev[payload.roomId!] ?? []
        const byId = new Map(existing.map(u => [u.id, u]))
        users.forEach(u => byId.set(u.id, u))
        return { ...prev, [payload.roomId!]: Array.from(byId.values()) }
      })
    }

    const onUserJoined = (payload: { roomId?: string; userId?: string; user?: VoicePresenceUser }) => {
      if (!mounted || !payload?.roomId || !payload.user?.id) return
      setParticipantsByGroup(prev => ({
        ...prev,
        [payload.roomId!]: upsertUser(prev[payload.roomId!] ?? [], payload.user!),
      }))
      if (payload.user.id !== myInfoRef.current?.id) {
        playVoiceSound('join')
        if (payload.user.enterSoundUrl) {
          const enterAudio = new Audio(payload.user.enterSoundUrl)
          enterAudio.volume = 0.85
          const stopTimer = setTimeout(() => {
            enterAudio.pause()
            enterAudio.currentTime = 0
          }, 15000)
          enterAudio.onended = () => clearTimeout(stopTimer)
          enterAudio.onerror = () => clearTimeout(stopTimer)
          void enterAudio.play().catch(() => clearTimeout(stopTimer))
        }
      }
    }

    const onUserLeft = (payload: { roomId?: string; userId?: string }) => {
      if (!mounted || !payload?.roomId || !payload.userId) return
      setParticipantsByGroup(prev => ({
        ...prev,
        [payload.roomId!]: removeUser(prev[payload.roomId!] ?? [], payload.userId!),
      }))
      if (payload.userId !== myInfoRef.current?.id) playVoiceSound('leave')
    }

    const onAudioToggled = (payload: { roomId?: string; userId?: string; muted?: boolean }) => {
      if (!mounted || !payload?.roomId || !payload.userId || typeof payload.muted !== 'boolean') return
      setParticipantsByGroup(prev => ({
        ...prev,
        [payload.roomId!]: (prev[payload.roomId!] ?? []).map(u =>
          u.id === payload.userId ? { ...u, isMuted: payload.muted! } : u,
        ),
      }))
    }

    const onUserSpeaking = (payload: { roomId?: string; userId?: string; speaking?: boolean }) => {
      if (!mounted || !payload?.roomId || !payload.userId || typeof payload.speaking !== 'boolean') return
      setParticipantsByGroup(prev => ({
        ...prev,
        [payload.roomId!]: (prev[payload.roomId!] ?? []).map(u =>
          u.id === payload.userId ? { ...u, isSpeaking: payload.speaking } : u,
        ),
      }))
    }

    const onSoundboard = (payload: { roomId?: string; senderId?: string; sound?: string; startedAt?: number }) => {
      if (!mounted || !payload?.sound || !payload.senderId) return
      if (currentGroupIdRef.current !== payload.roomId) return
      const audio = new Audio(`/sounds/${payload.sound}`)
      audio.volume = 0.8
      if (payload.startedAt) {
        const elapsedSec = (Date.now() - payload.startedAt) / 1000
        audio.addEventListener('loadedmetadata', () => {
          if (elapsedSec < audio.duration) audio.currentTime = elapsedSec
          startSoundboardAnalyser(audio, payload.senderId!)
          void audio.play().catch(() => { setSoundboardUserId(null); setSoundboardIntensity(0) })
        }, { once: true })
      } else {
        startSoundboardAnalyser(audio, payload.senderId)
        void audio.play().catch(() => { setSoundboardUserId(null); setSoundboardIntensity(0) })
      }
    }

    const onVideoToggled = (payload: { roomId?: string; userId?: string; enabled?: boolean }) => {
      if (!mounted || !payload?.roomId || !payload.userId || typeof payload.enabled !== 'boolean') return
      if (payload.userId === myInfoRef.current?.id && currentSelfRef.current) {
        currentSelfRef.current = { ...currentSelfRef.current, isCameraOn: payload.enabled }
      }
      setParticipantsByGroup(prev => ({
        ...prev,
        [payload.roomId!]: (prev[payload.roomId!] ?? []).map(u =>
          u.id === payload.userId ? { ...u, isCameraOn: payload.enabled } : u,
        ),
      }))
    }

    const onScreenToggled = (payload: { roomId?: string; userId?: string; enabled?: boolean }) => {
      if (!mounted || !payload?.roomId || !payload.userId || typeof payload.enabled !== 'boolean') return
      if (payload.userId === myInfoRef.current?.id && currentSelfRef.current) {
        currentSelfRef.current = { ...currentSelfRef.current, isScreenSharing: payload.enabled }
      }
      setParticipantsByGroup(prev => ({
        ...prev,
        [payload.roomId!]: (prev[payload.roomId!] ?? []).map(u =>
          u.id === payload.userId ? { ...u, isScreenSharing: payload.enabled } : u,
        ),
      }))
    }

    const onSoundboardStop = (payload: { roomId?: string; senderId?: string }) => {
      if (!mounted) return
      if (payload.senderId === soundboardUserId) stopActiveSound()
    }

    const onKicked = (payload: { roomId?: string }) => {
      if (!mounted) return
      const groupId = payload.roomId ?? currentGroupIdRef.current
      if (!groupId) return
      const myId = myInfoRef.current?.id
      stopActiveSound()
      currentGroupIdRef.current = null
      currentSelfRef.current = null
      setCurrentGroupId(null)
      setJoinedGroupId(null)
      setIsJoined(false)
      setJoinedAt(0)
      if (myId) {
        setParticipantsByGroup(prev => ({
          ...prev,
          [groupId]: removeUser(prev[groupId] ?? [], myId),
        }))
      }
      socket?.emit('leave-voice-room', { roomId: groupId })
    }

    const onServerMuted = (payload: { roomId?: string; muted?: boolean }) => {
      if (!mounted || typeof payload.muted !== 'boolean') return
      const muted = payload.muted
      const prev = currentSelfRef.current
      if (!prev) return
      const nextSelf: VoicePresenceUser = { ...prev, isMuted: muted }
      currentSelfRef.current = nextSelf
      setIsMuted(muted)
      const groupId = currentGroupIdRef.current
      if (groupId) {
        setParticipantsByGroup(p => ({
          ...p,
          [groupId]: upsertUser(p[groupId] ?? [], nextSelf),
        }))
        socket?.emit('voice-room-audio-toggle', { roomId: groupId, muted })
      }
    }

    const onMoved = (payload: { fromRoomId?: string; targetRoomId?: string }) => {
      if (!mounted || !payload.targetRoomId) return
      if (payload.targetRoomId !== currentGroupIdRef.current) {
        void joinRefFn.current(payload.targetRoomId, isMutedRef.current)
      }
    }

    const rejoinActiveRoom = () => {
      const groupId = currentGroupIdRef.current
      const self = currentSelfRef.current
      if (groupId && self && socket) {
        socket.emit('join-voice-room', { roomId: groupId, user: self })
      }
    }

    getSocket().then(s => {
      if (!mounted) return
      socket = s
      socketRef.current = s
      s.on('voice-room-users', onRoomUsers)
      s.on('voice-room-participants', onRoomParticipants)
      s.on('user-joined-voice', onUserJoined)
      s.on('user-left-voice', onUserLeft)
      s.on('user-audio-toggled', onAudioToggled)
      s.on('user-speaking', onUserSpeaking)
      s.on('voice-soundboard', onSoundboard)
      s.on('voice-soundboard-stop', onSoundboardStop)
      s.on('user-video-toggled', onVideoToggled)
      s.on('user-screen-toggled', onScreenToggled)
      s.on('voice-kicked', onKicked)
      s.on('voice-server-muted', onServerMuted)
      s.on('voice-moved', onMoved)
      s.on('connect', rejoinActiveRoom)
      rejoinActiveRoom()
    })

    return () => {
      mounted = false
      if (socket) {
        socket.off('voice-room-users', onRoomUsers)
        socket.off('voice-room-participants', onRoomParticipants)
        socket.off('user-joined-voice', onUserJoined)
        socket.off('user-left-voice', onUserLeft)
        socket.off('user-audio-toggled', onAudioToggled)
        socket.off('user-speaking', onUserSpeaking)
        socket.off('voice-soundboard', onSoundboard)
        socket.off('voice-soundboard-stop', onSoundboardStop)
        socket.off('user-video-toggled', onVideoToggled)
        socket.off('user-screen-toggled', onScreenToggled)
        socket.off('voice-kicked', onKicked)
        socket.off('voice-server-muted', onServerMuted)
        socket.off('voice-moved', onMoved)
        socket.off('connect', rejoinActiveRoom)
      }
    }
  }, [startSoundboardAnalyser, stopActiveSound]) // eslint-disable-line react-hooks/exhaustive-deps

  // Supabase used ONLY for cross-user voice invites
  useEffect(() => {
    const myId = myInfo?.id
    if (!myId) return
    const supabase = createClient()
    const ch = supabase.channel(`voice-invite:${myId}`)
    ch.on('broadcast', { event: 'voice_invite' }, ({ payload }) => {
      if (payload && onVoiceInviteRef.current) {
        onVoiceInviteRef.current(payload as VoiceInvitePayload)
      }
    })
    ch.subscribe()
    return () => { void supabase.removeChannel(ch) }
  }, [myInfo?.id])

  // Observe voice rooms in sidebar for real-time presence
  const observedKey = [...new Set(observedGroupIds.filter(Boolean))].sort().join('|')
  useEffect(() => {
    if (!observedKey) return
    const roomIds = observedKey.split('|')
    const socket = socketRef.current
    let cancelled = false

    const subscribe = (s: Awaited<ReturnType<typeof getSocket>>) => {
      if (cancelled) return
      s.emit('subscribe-voice-rooms', { roomIds })
    }

    if (socket) {
      subscribe(socket)
    } else {
      void getSocket().then((s) => {
        if (cancelled) return
        socketRef.current = s
        subscribe(s)
      })
    }

    const onConnect = () => {
      if (socketRef.current) socketRef.current.emit('subscribe-voice-rooms', { roomIds })
    }
    socket?.on('connect', onConnect)

    return () => {
      cancelled = true
      const s = socketRef.current
      if (s) {
        s.emit('unsubscribe-voice-rooms', { roomIds })
        s.off('connect', onConnect)
      }
    }
  }, [observedKey])

  const sendVoiceInvite = useCallback(async (inviteeId: string, groupId: string, groupName: string) => {
    const me = myInfoRef.current
    if (!me) return
    const supabase = createClient()
    const ch = supabase.channel(`voice-invite:${inviteeId}`)
    await ch.subscribe()
    await ch.send({
      type: 'broadcast',
      event: 'voice_invite',
      payload: {
        groupId,
        groupName,
        inviterId: me.id,
        inviterName: me.name,
        inviterAvatar: me.avatarUrl,
      } satisfies VoiceInvitePayload,
    })
    void supabase.removeChannel(ch)
  }, [])

  const leave = useCallback(async () => {
    const groupId = currentGroupIdRef.current
    if (!groupId) return
    stopActiveSound()
    const myId = myInfoRef.current?.id
    const socket = socketRef.current
    currentGroupIdRef.current = null
    currentSelfRef.current = null
    setCurrentGroupId(null)
    setJoinedGroupId(null)
    setIsJoined(false)
    setJoinedAt(0)
    if (myId) {
      setParticipantsByGroup(prev => ({
        ...prev,
        [groupId]: removeUser(prev[groupId] ?? [], myId),
      }))
    }
    socket?.emit('leave-voice-room', { roomId: groupId })
  }, [stopActiveSound])

  const join = useCallback(async (groupId: string, muted = false) => {
    if (!groupId) return
    if (!myInfoRef.current) {
      pendingJoinRef.current = { groupId, muted }
      currentGroupIdRef.current = groupId
      setCurrentGroupId(groupId)
      setJoinedGroupId(null)
      setIsJoined(false)
      return
    }

    if (currentGroupIdRef.current === groupId && currentSelfRef.current) {
      setCurrentGroupId(groupId)
      setJoinedGroupId(groupId)
      setIsJoined(true)
      return
    }

    const seq = joinSeqRef.current + 1
    joinSeqRef.current = seq

    const previousGroupId = currentGroupIdRef.current
    const info = myInfoRef.current
    const nextJoinedAt = Date.now()

    const optimisticUser: VoicePresenceUser = {
      id: info.id,
      name: info.name,
      avatarUrl: info.avatarUrl,
      bannerUrl: info.bannerUrl ?? null,
      subPlan: info.subPlan ?? null,
      isVerified: info.isVerified ?? null,
      enterSoundUrl: info.enterSoundUrl ?? null,
      isMuted: muted,
      joinedAt: nextJoinedAt,
    }

    stopActiveSound()
    currentGroupIdRef.current = groupId
    currentSelfRef.current = optimisticUser
    isMutedRef.current = muted
    setCurrentGroupId(groupId)
    setJoinedGroupId(groupId)
    setIsMuted(muted)
    setIsJoined(true)
    setJoinedAt(nextJoinedAt)

    // Optimistically add self, remove self from old group
    setParticipantsByGroup(prev => {
      const next: Record<string, VoicePresenceUser[]> = {}
      Object.entries(prev).forEach(([gId, users]) => {
        next[gId] = removeUser(users, info.id)
      })
      next[groupId] = upsertUser(next[groupId] ?? [], optimisticUser)
      return next
    })

    // Leave previous room on socket
    if (previousGroupId && previousGroupId !== groupId) {
      socketRef.current?.emit('leave-voice-room', { roomId: previousGroupId })
    }

    // Get or wait for socket
    let socket = socketRef.current
    if (!socket) {
      try { socket = await getSocket(); socketRef.current = socket } catch { return }
    }

    if (joinSeqRef.current !== seq) return

    socket.emit('join-voice-room', { roomId: groupId, user: optimisticUser })
  }, [stopActiveSound])

  useEffect(() => {
    joinRefFn.current = join
  }, [join])

  const toggleMute = useCallback(() => {
    const groupId = currentGroupIdRef.current
    const info = myInfoRef.current
    if (!groupId || !info) return
    const next = !isMutedRef.current
    isMutedRef.current = next
    const nextSelf: VoicePresenceUser = {
      ...(currentSelfRef.current ?? {
        id: info.id,
        name: info.name,
        avatarUrl: info.avatarUrl,
        joinedAt: Date.now(),
      }),
      isMuted: next,
    }
    currentSelfRef.current = nextSelf
    setIsMuted(next)
    setParticipantsByGroup(prev => ({
      ...prev,
      [groupId]: upsertUser(prev[groupId] ?? [], nextSelf),
    }))
    socketRef.current?.emit('voice-room-audio-toggle', { roomId: groupId, muted: next })
  }, [])

  const setSpeaking = useCallback((speaking: boolean) => {
    const groupId = currentGroupIdRef.current
    const info = myInfoRef.current
    if (!groupId || !info) return
    const prev = currentSelfRef.current
    if (!prev || prev.isSpeaking === speaking) return
    const next: VoicePresenceUser = { ...prev, isSpeaking: speaking }
    currentSelfRef.current = next
    setParticipantsByGroup(p => ({
      ...p,
      [groupId]: upsertUser(p[groupId] ?? [], next),
    }))
    socketRef.current?.emit('voice-speaking', { roomId: groupId, speaking })
  }, [])

  const playSound = useCallback(async (sound: string) => {
    const groupId = currentGroupIdRef.current
    const self = currentSelfRef.current
    if (!groupId || !self) return

    const audio = new Audio(`/sounds/${sound}`)
    audio.volume = 0.8
    startSoundboardAnalyser(audio, self.id, () => {
      socketRef.current?.emit('voice-soundboard-stop', { roomId: groupId })
    })
    void audio.play().catch(() => { setSoundboardUserId(null); setSoundboardIntensity(0) })

    socketRef.current?.emit('voice-soundboard', { roomId: groupId, sound })
  }, [startSoundboardAnalyser])

  const kick = useCallback(async (targetId: string, groupId = currentGroupIdRef.current) => {
    if (!groupId) return
    setParticipantsByGroup(prev => ({
      ...prev,
      [groupId]: removeUser(prev[groupId] ?? [], targetId),
    }))
    socketRef.current?.emit('voice-kick', { roomId: groupId, targetId })
  }, [])

  const muteUser = useCallback(async (targetId: string, muted: boolean, groupId = currentGroupIdRef.current) => {
    if (!groupId) return
    setParticipantsByGroup(prev => ({
      ...prev,
      [groupId]: (prev[groupId] ?? []).map(u =>
        u.id === targetId ? { ...u, isMuted: muted } : u,
      ),
    }))
    socketRef.current?.emit('voice-server-mute', { roomId: groupId, targetId, muted })
  }, [])

  const moveUser = useCallback(async (targetId: string, fromGroupId: string, targetGroupId: string) => {
    if (!targetId || !fromGroupId || !targetGroupId || fromGroupId === targetGroupId) return
    if (targetId === myInfoRef.current?.id) {
      await joinRefFn.current(targetGroupId, isMutedRef.current)
      return
    }
    setParticipantsByGroup(prev => {
      const movedUser = prev[fromGroupId]?.find(u => u.id === targetId)
      if (!movedUser) return prev
      return {
        ...prev,
        [fromGroupId]: removeUser(prev[fromGroupId] ?? [], targetId),
        [targetGroupId]: upsertUser(prev[targetGroupId] ?? [], { ...movedUser, joinedAt: Date.now() }),
      }
    })
    socketRef.current?.emit('voice-move-user', { fromRoomId: fromGroupId, targetRoomId: targetGroupId, targetId })
  }, [])

  const participants = currentGroupId ? (participantsByGroup[currentGroupId] ?? []) : []

  return {
    participants,
    participantsByGroup,
    currentGroupId,
    joinedGroupId,
    isJoined,
    isMuted,
    joinedAt,
    join,
    leave,
    toggleMute,
    kick,
    muteUser,
    moveUser,
    playSound,
    soundboardUserId,
    soundboardIntensity,
    sendVoiceInvite,
    setSpeaking,
  }
}
