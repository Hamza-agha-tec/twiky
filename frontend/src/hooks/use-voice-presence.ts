'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
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
      // Two ascending tones
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
      // Two descending tones
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

export function useVoicePresence(
  myInfo: { id: string; name: string; avatarUrl: string | null } | null,
) {
  const [participants, setParticipants] = useState<VoicePresenceUser[]>([])
  const [isJoined, setIsJoined] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const channelRef = useRef<RealtimeChannel | null>(null)
  const joinedAtRef = useRef<number>(0)
  const myInfoRef = useRef(myInfo)
  myInfoRef.current = myInfo

  const syncParticipants = useCallback((ch: RealtimeChannel) => {
    const state = ch.presenceState<VoicePresenceUser>()
    // Each key maps to an array (multiple tabs / track() calls accumulate).
    // Take only the last payload per key so one user = one card.
    const users = Object.values(state).map(
      (arr) => (arr as VoicePresenceUser[]).at(-1)!
    ).filter(Boolean)
    setParticipants(users)
  }, [])

  const join = useCallback(
    async (groupId: string, muted = false) => {
      if (!groupId || !myInfoRef.current) return
      if (channelRef.current) {
        const old = channelRef.current
        channelRef.current = null
        old.untrack()
        old.unsubscribe()
        createClient().removeChannel(old)
        setIsJoined(false)
        setParticipants([])
      }
      const info = myInfoRef.current
      const supabase = createClient()
      joinedAtRef.current = Date.now()
      const ch = supabase.channel(`voice:${groupId}`, {
        config: { presence: { key: info.id } },
      })

      // Set ref immediately — prevents double-join if called again before subscribe resolves
      channelRef.current = ch

      ch.on('presence', { event: 'sync' }, () => syncParticipants(ch))
      ch.on('presence', { event: 'join' }, ({ newPresences }) => {
        syncParticipants(ch)
        const isOwnJoin = (newPresences as unknown as VoicePresenceUser[]).some((p) => p.id === info.id)
        if (!isOwnJoin) playVoiceSound('join')
      })
      ch.on('presence', { event: 'leave' }, ({ leftPresences }) => {
        syncParticipants(ch)
        const isOwnLeave = (leftPresences as unknown as VoicePresenceUser[]).some((p) => p.id === info.id)
        if (!isOwnLeave) playVoiceSound('leave')
      })
      // Listen for kick broadcasts targeting this user
      ch.on('broadcast', { event: 'kick' }, ({ payload }) => {
        if (payload?.targetId === info.id) {
          ch.untrack()
          ch.unsubscribe()
          createClient().removeChannel(ch)
          channelRef.current = null
          setIsJoined(false)
          setParticipants([])
        }
      })

      ch.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await ch.track({
            id: info.id,
            name: info.name,
            avatarUrl: info.avatarUrl,
            isMuted: muted,
            joinedAt: joinedAtRef.current,
          } satisfies VoicePresenceUser)
          setIsMuted(muted)
          setIsJoined(true)
        }
      })
    },
    [syncParticipants],
  )

  const leave = useCallback(async () => {
    const ch = channelRef.current
    if (!ch) return
    await ch.untrack()
    await ch.unsubscribe()
    const supabase = createClient()
    supabase.removeChannel(ch)
    channelRef.current = null
    setIsJoined(false)
    setParticipants([])
  }, [])

  const kick = useCallback(async (targetId: string) => {
    if (!channelRef.current) return
    await channelRef.current.send({
      type: 'broadcast',
      event: 'kick',
      payload: { targetId },
    })
  }, [])

  const toggleMute = useCallback(async () => {
    if (!channelRef.current || !myInfoRef.current) return
    const info = myInfoRef.current
    const next = !isMuted
    await channelRef.current.track({
      id: info.id,
      name: info.name,
      avatarUrl: info.avatarUrl,
      isMuted: next,
      joinedAt: joinedAtRef.current,
    } satisfies VoicePresenceUser)
    setIsMuted(next)
  }, [isMuted])

  useEffect(() => {
    return () => {
      const ch = channelRef.current
      if (ch) {
        ch.untrack()
        ch.unsubscribe()
        channelRef.current = null
      }
    }
  }, [])

  return { participants, isJoined, isMuted, joinedAt: joinedAtRef.current, join, leave, toggleMute, kick }
}
