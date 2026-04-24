'use client'

import { useState } from 'react'
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

export function PrivacySection() {
  const [readReceipts, setReadReceipts] = useState(true)
  const [onlineStatus, setOnlineStatus] = useState(true)
  const [typingIndicators, setTypingIndicators] = useState(true)
  const [linkPreviews, setLinkPreviews] = useState(true)
  const [lastSeen, setLastSeen] = useState('followers')
  const [profilePhoto, setProfilePhoto] = useState('everyone')
  const [visibility, setVisibility] = useState('followers')
  const [dmFromStrangers, setDmFromStrangers] = useState(true)
  const score = [readReceipts, onlineStatus, visibility !== 'public', lastSeen !== 'everyone'].filter(Boolean).length * 25

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
        <SettingRow title="Read receipts" description="Show when you've read a message."><Switch checked={readReceipts} onCheckedChange={setReadReceipts} /></SettingRow>
        <SettingRow title="Online status" description="Show your activity indicator."><Switch checked={onlineStatus} onCheckedChange={setOnlineStatus} /></SettingRow>
        <SettingRow title="Typing indicators" description="Show when you're composing."><Switch checked={typingIndicators} onCheckedChange={setTypingIndicators} /></SettingRow>
      </SectionBlock>
      <SectionBlock title="Visibility">
        <SettingRow title="Last seen" description="Who can see when you were last active.">
          <Select value={lastSeen} onValueChange={setLastSeen}><SelectTrigger className="h-8 w-[130px] rounded-xl text-[12px]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="everyone">Everyone</SelectItem><SelectItem value="followers">Followers</SelectItem><SelectItem value="nobody">Nobody</SelectItem></SelectContent></Select>
        </SettingRow>
        <SettingRow title="Profile photo" description="Who can see your avatar.">
          <Select value={profilePhoto} onValueChange={setProfilePhoto}><SelectTrigger className="h-8 w-[130px] rounded-xl text-[12px]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="everyone">Everyone</SelectItem><SelectItem value="followers">Followers</SelectItem><SelectItem value="nobody">Nobody</SelectItem></SelectContent></Select>
        </SettingRow>
        <SettingRow title="Account discovery" description="Allow others to find you.">
          <Select value={visibility} onValueChange={setVisibility}><SelectTrigger className="h-8 w-[130px] rounded-xl text-[12px]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="public">Public</SelectItem><SelectItem value="followers">Followers</SelectItem><SelectItem value="private">Private</SelectItem></SelectContent></Select>
        </SettingRow>
      </SectionBlock>
      <SectionBlock title="Messages">
        <SettingRow title="DMs from anyone" description="Allow strangers to message you."><Switch checked={dmFromStrangers} onCheckedChange={setDmFromStrangers} /></SettingRow>
        <SettingRow title="Link previews" description="Expand URLs in your messages."><Switch checked={linkPreviews} onCheckedChange={setLinkPreviews} /></SettingRow>
      </SectionBlock>
    </>
  )
}
