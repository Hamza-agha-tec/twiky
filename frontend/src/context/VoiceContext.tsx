'use client'

import React, { createContext, useContext, useMemo } from 'react'
import { useVoicePresence, VoicePresenceUser, VoiceInvitePayload } from '@/hooks/use-voice-presence'
import { useProfile } from '@/hooks/use-user'
import { useChannels } from '@/hooks/use-channels'
import { useLiveKitVoice } from '@/hooks/use-livekit-voice'
import { toast } from 'sonner'

interface VoiceContextType {
  participants: VoicePresenceUser[]
  participantsByGroup: Record<string, VoicePresenceUser[]>
  currentGroupId: string | null
  joinedGroupId: string | null
  isJoined: boolean
  isMuted: boolean
  joinedAt: number
  join: (groupId: string, muted?: boolean) => Promise<void>
  leave: () => Promise<void>
  toggleMute: () => void
  kick: (targetId: string, groupId?: string | null) => Promise<void>
  muteUser: (targetId: string, muted: boolean, groupId?: string | null) => Promise<void>
  moveUser: (targetId: string, fromGroupId: string, targetGroupId: string) => Promise<void>
  playSound: (sound: string) => Promise<void>
  soundboardUserId: string | null
  soundboardIntensity: number
  sendVoiceInvite: (inviteeId: string, groupId: string, groupName: string) => Promise<void>
  setSpeaking: (speaking: boolean) => void
  isSpeaking: boolean
  webrtc: ReturnType<typeof useLiveKitVoice>
}

const VoiceContext = createContext<VoiceContextType | undefined>(undefined)

export function VoiceProvider({ children }: { children: React.ReactNode }) {
  const { data: profile } = useProfile()
  const { data: channels = [] } = useChannels()

  const voiceMyInfo = useMemo(() => profile ? {
    id: profile.id,
    name: profile.fullname ?? profile.username ?? 'You',
    avatarUrl: profile.avatar_url,
    bannerUrl: profile.banner ?? null,
    subPlan: profile.sub_plan ?? null,
    isVerified: profile.is_verified ?? null,
    enterSoundUrl: profile.enter_sound_url ?? null,
  } : null, [profile])

  const voiceGroupIds = useMemo(() => {
    // This is a bit expensive, might want to optimize
    return [] // In a real app, you'd get all voice group IDs
  }, [])

  const voice = useVoicePresence(voiceMyInfo, voiceGroupIds, (payload) => {
    const { groupId, groupName, inviterName, inviterAvatar } = payload
    toast.info(`Invite to ${groupName} from ${inviterName}`)
    // You can add a more complex toast here later
  })

  const webrtc = useLiveKitVoice(voice.joinedGroupId, profile?.id ?? null, voice.isMuted)

  // Sync speaking state
  React.useEffect(() => {
    voice.setSpeaking(webrtc.isSpeaking)
  }, [webrtc.isSpeaking, voice])

  return (
    <VoiceContext.Provider
      value={{
        ...voice,
        isSpeaking: webrtc.isSpeaking,
        webrtc,
      }}
    >
      {children}
    </VoiceContext.Provider>
  )
}

export function useVoice() {
  const context = useContext(VoiceContext)
  if (context === undefined) {
    throw new Error('useVoice must be used within a VoiceProvider')
  }
  return context
}
