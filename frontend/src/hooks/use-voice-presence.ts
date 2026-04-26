'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { createClient } from '@/utils/supabase/client'

function playVoiceSound(type: 'join' | 'leave') {
  try {
    const ctx = new AudioContext()
    const gain = ctx.createGain()
    gain.connect(ctx.destination)
    gain.gain.setValueAtTime(0.18, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.5)

    if (type === 'join') {
      const freqs = [660, 880]
      freqs.forEach((freq, i) => {
        const osc = ctx.createOscillator()
        osc.type = 'sine'
        osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.12)
        osc.connect(gain)
        osc.start(ctx.currentTime + i * 0.12)
        osc.stop(ctx.currentTime + i * 0.12 + 0.18)
      })
    } else {
      const freqs = [660, 440]
      freqs.forEach((freq, i) => {
        const osc = ctx.createOscillator()
        osc.type = 'sine'
        osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.12)
        osc.connect(gain)
        osc.start(ctx.currentTime + i * 0.12)
        osc.stop(ctx.currentTime + i * 0.12 + 0.18)
      })
    }

    setTimeout(() => ctx.close(), 800)
  } catch {}
}

export interface VoicePresenceUser {
  id: string
  name: string
  avatarUrl: string | null
  isMuted: boolean
  isSpeaking?: boolean
  joinedAt: number
}

type MyVoiceInfo = {
  id: string
  name: string
  avatarUrl: string | null
}

type VoiceChannelEntry = {
  channel: RealtimeChannel
  subscribed: boolean
  waiters: Array<(subscribed: boolean) => void>
}

function getPresenceUsers(ch: RealtimeChannel) {
  const state = ch.presenceState<VoicePresenceUser>()
  return Object.values(state)
    .map((arr) => (arr as VoicePresenceUser[]).at(-1))
    .filter((user): user is VoicePresenceUser => Boolean(user))
}

function upsertVoiceUser(users: VoicePresenceUser[], user: VoicePresenceUser) {
  return [user, ...users.filter((item) => item.id !== user.id)]
}

function removeVoiceUser(users: VoicePresenceUser[], userId: string) {
  return users.filter((item) => item.id !== userId)
}

export function useVoicePresence(
  myInfo: MyVoiceInfo | null,
  observedGroupIds: string[] = [],
) {
  const [participantsByGroup, setParticipantsByGroup] = useState<Record<string, VoicePresenceUser[]>>({})
  const [currentGroupId, setCurrentGroupId] = useState<string | null>(null)
  const [joinedGroupId, setJoinedGroupId] = useState<string | null>(null)
  const [isJoined, setIsJoined] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [joinedAt, setJoinedAt] = useState(0)
  const channelsRef = useRef<Map<string, VoiceChannelEntry>>(new Map())
  const currentGroupIdRef = useRef<string | null>(null)
  const myInfoRef = useRef<MyVoiceInfo | null>(myInfo)
  const isMutedRef = useRef(false)
  const currentSelfRef = useRef<VoicePresenceUser | null>(null)
  const joinRef = useRef<(groupId: string, muted?: boolean) => Promise<void>>(async () => {})
  const pendingJoinRef = useRef<{ groupId: string; muted: boolean } | null>(null)
  const joinSeqRef = useRef(0)

  useEffect(() => {
    myInfoRef.current = myInfo
    if (myInfo && pendingJoinRef.current) {
      const pending = pendingJoinRef.current
      pendingJoinRef.current = null
      void joinRef.current(pending.groupId, pending.muted)
    }
  }, [myInfo])

  useEffect(() => {
    currentGroupIdRef.current = currentGroupId
  }, [currentGroupId])

  useEffect(() => {
    isMutedRef.current = isMuted
  }, [isMuted])

  const syncParticipants = useCallback((groupId: string, ch: RealtimeChannel) => {
    const myId = myInfoRef.current?.id
    const activeGroupId = currentGroupIdRef.current
    const currentSelf = currentSelfRef.current
    let users = getPresenceUsers(ch)

    if (myId) {
      users = users.filter((user) => user.id !== myId || groupId === activeGroupId)
    }

    if (currentSelf && groupId === activeGroupId) {
      users = upsertVoiceUser(users, currentSelf)
    }

    setParticipantsByGroup((prev) => ({ ...prev, [groupId]: users }))
  }, [])

  const waitForSubscribed = useCallback((entry: VoiceChannelEntry, timeoutMs = 2500) => {
    if (entry.subscribed) return Promise.resolve(true)

    return new Promise<boolean>((resolve) => {
      let settled = false
      const finish = (subscribed: boolean) => {
        if (settled) return
        settled = true
        resolve(subscribed)
      }
      const timeout = window.setTimeout(() => finish(false), timeoutMs)
      entry.waiters.push((subscribed) => {
        window.clearTimeout(timeout)
        finish(subscribed)
      })
    })
  }, [])

  const removeChannel = useCallback((groupId: string) => {
    const entry = channelsRef.current.get(groupId)
    if (!entry) return
    void entry.channel.untrack()
    void entry.channel.unsubscribe()
    createClient().removeChannel(entry.channel)
    entry.waiters.splice(0).forEach((resolve) => resolve(false))
    channelsRef.current.delete(groupId)
  }, [])

  const ensureChannel = useCallback(
    (groupId: string) => {
      const existing = channelsRef.current.get(groupId)
      if (existing) return existing

      const supabase = createClient()
      const channel = supabase.channel(`voice:${groupId}`, {
        config: { presence: { key: myInfoRef.current?.id ?? `observer-${groupId}` } },
      })
      const entry: VoiceChannelEntry = { channel, subscribed: false, waiters: [] }
      channelsRef.current.set(groupId, entry)

      channel.on('presence', { event: 'sync' }, () => syncParticipants(groupId, channel))
      channel.on('presence', { event: 'join' }, ({ newPresences }) => {
        syncParticipants(groupId, channel)
        const myId = myInfoRef.current?.id
        const isOwnJoin = Boolean(myId) && (newPresences as unknown as VoicePresenceUser[]).some((p) => p.id === myId)
        if (!isOwnJoin) playVoiceSound('join')
      })
      channel.on('presence', { event: 'leave' }, ({ leftPresences }) => {
        syncParticipants(groupId, channel)
        const myId = myInfoRef.current?.id
        const isOwnLeave = Boolean(myId) && (leftPresences as unknown as VoicePresenceUser[]).some((p) => p.id === myId)
        if (!isOwnLeave) playVoiceSound('leave')
      })
      channel.on('broadcast', { event: 'kick' }, ({ payload }) => {
        if (payload?.targetId === myInfoRef.current?.id) {
          void channel.untrack()
          currentGroupIdRef.current = null
          currentSelfRef.current = null
          setCurrentGroupId(null)
          setJoinedGroupId(null)
          setIsJoined(false)
          setJoinedAt(0)
          setParticipantsByGroup((prev) => ({
            ...prev,
            [groupId]: removeVoiceUser(prev[groupId] ?? [], payload.targetId),
          }))
        }
      })
      channel.on('broadcast', { event: 'server-mute' }, ({ payload }) => {
        if (payload?.targetId === myInfoRef.current?.id) {
          const muted: boolean = !!payload.muted
          const prev = currentSelfRef.current
          if (!prev) return
          const nextSelf: VoicePresenceUser = { ...prev, isMuted: muted }
          currentSelfRef.current = nextSelf
          void channel.track(nextSelf)
          setIsMuted(muted)
          syncParticipants(groupId, channel)
        }
      })
      channel.on('broadcast', { event: 'move' }, ({ payload }) => {
        if (
          payload?.targetId === myInfoRef.current?.id &&
          typeof payload.targetGroupId === 'string' &&
          payload.targetGroupId !== currentGroupIdRef.current
        ) {
          void joinRef.current(payload.targetGroupId, isMutedRef.current)
        }
      })

      channel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          entry.subscribed = true
          syncParticipants(groupId, channel)
          entry.waiters.splice(0).forEach((resolve) => resolve(true))
        }
      })

      return entry
    },
    [syncParticipants],
  )

  const leave = useCallback(async () => {
    const groupId = currentGroupIdRef.current
    if (!groupId) return
    const entry = channelsRef.current.get(groupId)
    const myId = myInfoRef.current?.id
    currentGroupIdRef.current = null
    currentSelfRef.current = null
    if (entry) {
      await entry.channel.untrack()
      syncParticipants(groupId, entry.channel)
    }
    if (myId) {
      setParticipantsByGroup((prev) => ({
        ...prev,
        [groupId]: removeVoiceUser(prev[groupId] ?? [], myId),
      }))
    }
    setCurrentGroupId(null)
    setJoinedGroupId(null)
    setIsJoined(false)
    setJoinedAt(0)
  }, [syncParticipants])

  const join = useCallback(
    async (groupId: string, muted = false) => {
      if (!groupId) return
      if (!myInfoRef.current) {
        pendingJoinRef.current = { groupId, muted }
        currentGroupIdRef.current = groupId
        setCurrentGroupId(groupId)
        setJoinedGroupId(null)
        setIsJoined(false)
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
        isMuted: muted,
        joinedAt: nextJoinedAt,
      }

      currentGroupIdRef.current = groupId
      currentSelfRef.current = optimisticUser
      setCurrentGroupId(groupId)
      setJoinedGroupId(groupId)
      setIsMuted(muted)
      setIsJoined(true)
      setJoinedAt(nextJoinedAt)
      setParticipantsByGroup((prev) => {
        const next: Record<string, VoicePresenceUser[]> = {}
        Object.entries(prev).forEach(([existingGroupId, users]) => {
          next[existingGroupId] = removeVoiceUser(users, info.id)
        })
        next[groupId] = upsertVoiceUser(next[groupId] ?? [], optimisticUser)
        return next
      })

      if (previousGroupId && previousGroupId !== groupId) {
        const previous = channelsRef.current.get(previousGroupId)
        if (previous) {
          void previous.channel.untrack().then(() => syncParticipants(previousGroupId, previous.channel))
        }
      }

      const entry = ensureChannel(groupId)

      const subscribed = await waitForSubscribed(entry)
      if (joinSeqRef.current !== seq || currentGroupIdRef.current !== groupId) return
      if (!subscribed) {
        removeChannel(groupId)
        if (joinSeqRef.current === seq && currentGroupIdRef.current === groupId) {
          void join(groupId, muted)
        }
        return
      }

      await entry.channel.track({
        id: info.id,
        name: info.name,
        avatarUrl: info.avatarUrl,
        isMuted: muted,
        joinedAt: nextJoinedAt,
      } satisfies VoicePresenceUser)
      if (joinSeqRef.current !== seq || currentGroupIdRef.current !== groupId) return
      syncParticipants(groupId, entry.channel)
    },
    [ensureChannel, removeChannel, syncParticipants, waitForSubscribed],
  )

  useEffect(() => {
    joinRef.current = join
  }, [join])

  const kick = useCallback(async (targetId: string, groupId = currentGroupIdRef.current) => {
    if (!groupId) return
    const entry = ensureChannel(groupId)
    await waitForSubscribed(entry)
    await entry.channel.send({
      type: 'broadcast',
      event: 'kick',
      payload: { targetId },
    })
  }, [ensureChannel, waitForSubscribed])

  const muteUser = useCallback(async (targetId: string, muted: boolean, groupId = currentGroupIdRef.current) => {
    if (!groupId) return
    const entry = ensureChannel(groupId)
    await waitForSubscribed(entry)
    await entry.channel.send({
      type: 'broadcast',
      event: 'server-mute',
      payload: { targetId, muted },
    })
  }, [ensureChannel, waitForSubscribed])

  const moveUser = useCallback(
    async (targetId: string, fromGroupId: string, targetGroupId: string) => {
      if (!targetId || !fromGroupId || !targetGroupId || fromGroupId === targetGroupId) return
      if (targetId === myInfoRef.current?.id) {
        await joinRef.current(targetGroupId, isMutedRef.current)
        return
      }
      setParticipantsByGroup((prev) => {
        const movedUser = prev[fromGroupId]?.find((user) => user.id === targetId)
        if (!movedUser) return prev
        return {
          ...prev,
          [fromGroupId]: removeVoiceUser(prev[fromGroupId] ?? [], targetId),
          [targetGroupId]: upsertVoiceUser(prev[targetGroupId] ?? [], {
            ...movedUser,
            joinedAt: Date.now(),
          }),
        }
      })
      let entry = ensureChannel(fromGroupId)
      let subscribed = await waitForSubscribed(entry)
      if (!subscribed) {
        removeChannel(fromGroupId)
        entry = ensureChannel(fromGroupId)
        subscribed = await waitForSubscribed(entry)
      }
      if (!subscribed) return

      await entry.channel.send({
        type: 'broadcast',
        event: 'move',
        payload: { targetId, targetGroupId },
      })
    },
    [ensureChannel, removeChannel, waitForSubscribed],
  )

  const toggleMute = useCallback(async () => {
    const groupId = currentGroupIdRef.current
    const info = myInfoRef.current
    if (!groupId || !info) return
    const entry = channelsRef.current.get(groupId)
    if (!entry) return
    const next = !isMuted
    const nextSelf: VoicePresenceUser = {
      id: info.id,
      name: info.name,
      avatarUrl: info.avatarUrl,
      isMuted: next,
      joinedAt,
    }
    currentSelfRef.current = nextSelf
    await waitForSubscribed(entry)
    await entry.channel.track(nextSelf satisfies VoicePresenceUser)
    setIsMuted(next)
    syncParticipants(groupId, entry.channel)
  }, [isMuted, joinedAt, syncParticipants, waitForSubscribed])

  const observedKey = useMemo(
    () => [...new Set(observedGroupIds.filter(Boolean))].sort().join('|'),
    [observedGroupIds],
  )

  useEffect(() => {
    const desired = new Set(observedKey ? observedKey.split('|') : [])
    if (currentGroupIdRef.current) desired.add(currentGroupIdRef.current)

    desired.forEach((groupId) => ensureChannel(groupId))

    channelsRef.current.forEach((entry, groupId) => {
      if (desired.has(groupId)) return
      void entry.channel.unsubscribe()
      createClient().removeChannel(entry.channel)
      channelsRef.current.delete(groupId)
      setParticipantsByGroup((prev) => {
        const next = { ...prev }
        delete next[groupId]
        return next
      })
    })
  }, [ensureChannel, observedKey])

  useEffect(() => {
    const supabase = createClient()
    const channels = channelsRef.current
    return () => {
      channels.forEach((entry) => {
        void entry.channel.untrack()
        void entry.channel.unsubscribe()
        supabase.removeChannel(entry.channel)
      })
      channels.clear()
    }
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
  }
}
