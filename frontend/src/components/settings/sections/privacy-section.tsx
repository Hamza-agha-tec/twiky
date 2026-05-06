'use client'

import { useEffect, useState } from 'react'
import { Progress } from '@/components/ui/progress'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { SectionHeader, SectionBlock, SettingRow } from '../shared'
import { cn } from '@/lib/utils'
import { useSettings, useUpdateSettings } from '@/hooks/use-user'

type VisibilityOption = 'everyone' | 'followers' | 'nobody'

type PrivacySettings = {
  read_confirmation?: boolean | null
  who_can_see_me_online?: VisibilityOption | null
  who_can_see_my_last_seen?: VisibilityOption | null
  who_can_see_my_profile_photo?: VisibilityOption | null
  who_can_discover_me?: VisibilityOption | null
}

const TYPING_INDICATORS_KEY = 'twiky-typing-indicators-enabled'

export function PrivacySection() {
  const { data: rawSettings } = useSettings()
  const settings = rawSettings as PrivacySettings | undefined
  const updateSettings = useUpdateSettings()
  const [readReceipts, setReadReceipts] = useState(true)
  const [onlineStatus, setOnlineStatus] = useState(true)
  const [typingIndicators, setTypingIndicators] = useState(true)
  const [linkPreviews, setLinkPreviews] = useState(true)
  const [lastSeen, setLastSeen] = useState<VisibilityOption>('followers')
  const [profilePhoto, setProfilePhoto] = useState<VisibilityOption>('everyone')
  const [visibility, setVisibility] = useState<VisibilityOption>('followers')
  const [dmFromStrangers, setDmFromStrangers] = useState(true)
  const score = [readReceipts, onlineStatus, visibility !== 'public', lastSeen !== 'everyone'].filter(Boolean).length * 25

  useEffect(() => {
    if (!settings) return
    if (typeof settings.read_confirmation === 'boolean') {
      setReadReceipts(settings.read_confirmation)
    }
    setOnlineStatus(settings.who_can_see_me_online !== 'nobody')
    if (settings.who_can_see_my_last_seen) {
      setLastSeen(settings.who_can_see_my_last_seen)
    }
    if (settings.who_can_see_my_profile_photo) {
      setProfilePhoto(settings.who_can_see_my_profile_photo)
    }
    if (settings.who_can_discover_me) {
      setVisibility(settings.who_can_discover_me)
    }
    try {
      setTypingIndicators(localStorage.getItem(TYPING_INDICATORS_KEY) !== 'false')
    } catch {
      setTypingIndicators(true)
    }
  }, [settings])

  const updateReadReceipts = (checked: boolean) => {
    setReadReceipts(checked)
    updateSettings.mutate({ read_confirmation: checked })
  }

  const updateOnlineStatus = (checked: boolean) => {
    setOnlineStatus(checked)
    updateSettings.mutate({ who_can_see_me_online: checked ? 'everyone' : 'nobody' })
  }

  const updateLastSeen = (value: VisibilityOption) => {
    setLastSeen(value)
    updateSettings.mutate({ who_can_see_my_last_seen: value })
  }

  const updateProfilePhoto = (value: VisibilityOption) => {
    setProfilePhoto(value)
    updateSettings.mutate({ who_can_see_my_profile_photo: value })
  }

  const updateVisibility = (value: VisibilityOption) => {
    setVisibility(value)
    updateSettings.mutate({ who_can_discover_me: value })
  }

  const updateTypingIndicators = (checked: boolean) => {
    setTypingIndicators(checked)
    try {
      localStorage.setItem(TYPING_INDICATORS_KEY, checked ? 'true' : 'false')
      window.dispatchEvent(new Event('twiky-typing-indicators-change'))
    } catch {}
  }

  return (
    <>
      <SectionHeader title="Privacy & Safety" description="Control your visibility and what others see." />
      <div className="mb-6">
        <div className="flex items-center justify-between text-[12px]">
          <span className="font-semibold text-foreground">Privacy score</span>
          <span className={cn('font-bold', score >= 75 ? 'text-emerald-500' : score >= 50 ? 'text-orange-500' : 'text-destructive')}>{score}%</span>
        </div>
        <Progress value={score} className="mt-2 h-1.5" />
        <p className="mt-2 text-[11px] text-muted-foreground">{score >= 75 ? 'Strong privacy setup.' : score >= 50 ? 'Good baseline. Consider hiding last seen.' : 'Low privacy — review settings below.'}</p>
      </div>
      <SectionBlock title="Activity & Presence">
        <SettingRow title="Read receipts" description="Show when you've read a message."><Switch checked={readReceipts} onCheckedChange={updateReadReceipts} /></SettingRow>
        <SettingRow title="Online status" description="Show your activity indicator."><Switch checked={onlineStatus} onCheckedChange={updateOnlineStatus} /></SettingRow>
        <SettingRow title="Typing indicators" description="Show when you're composing."><Switch checked={typingIndicators} onCheckedChange={updateTypingIndicators} /></SettingRow>
      </SectionBlock>
      <SectionBlock title="Visibility">
        <SettingRow title="Last seen" description="Who can see when you were last active.">
          <Select value={lastSeen} onValueChange={(value) => updateLastSeen(value as VisibilityOption)}><SelectTrigger className="h-8 w-[130px] rounded-xl text-[12px]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="everyone">Everyone</SelectItem><SelectItem value="followers">Followers</SelectItem><SelectItem value="nobody">Nobody</SelectItem></SelectContent></Select>
        </SettingRow>
        <SettingRow title="Profile photo" description="Who can see your avatar.">
          <Select value={profilePhoto} onValueChange={(v) => updateProfilePhoto(v as VisibilityOption)}><SelectTrigger className="h-8 w-[130px] rounded-xl text-[12px]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="everyone">Everyone</SelectItem><SelectItem value="followers">Followers</SelectItem><SelectItem value="nobody">Nobody</SelectItem></SelectContent></Select>
        </SettingRow>
        <SettingRow title="Account discovery" description="Allow others to find you.">
          <Select value={visibility} onValueChange={(v) => updateVisibility(v as VisibilityOption)}><SelectTrigger className="h-8 w-[130px] rounded-xl text-[12px]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="everyone">Everyone</SelectItem><SelectItem value="followers">Followers</SelectItem><SelectItem value="nobody">Nobody</SelectItem></SelectContent></Select>
        </SettingRow>
      </SectionBlock>
      <SectionBlock title="Messages">
        <SettingRow title="DMs from anyone" description="Allow strangers to message you."><Switch checked={dmFromStrangers} onCheckedChange={setDmFromStrangers} /></SettingRow>
        <SettingRow title="Link previews" description="Expand URLs in your messages."><Switch checked={linkPreviews} onCheckedChange={setLinkPreviews} /></SettingRow>
      </SectionBlock>
    </>
  )
}
