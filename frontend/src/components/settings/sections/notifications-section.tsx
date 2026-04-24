'use client'

import { useState } from 'react'
import { Switch } from '@/components/ui/switch'
import { Slider } from '@/components/ui/slider'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { SectionHeader, SectionBlock, SettingRow } from '../shared'

export function NotificationsSection() {
  const [desktop, setDesktop] = useState(true)
  const [dnd, setDnd] = useState(false)
  const [sound, setSound] = useState(true)
  const [volume, setVolume] = useState([70])
  const [mentions, setMentions] = useState(true)
  const [replies, setReplies] = useState(true)
  const [channels, setChannels] = useState(false)
  const [digest, setDigest] = useState('hourly')

  return (
    <>
      <SectionHeader title="Notifications" description="Choose how and when Twiky alerts you." />
      <SectionBlock title="Desktop & Mobile">
        <SettingRow title="Enable notifications" description="Show alerts for messages and activity."><Switch checked={desktop} onCheckedChange={setDesktop} /></SettingRow>
        <SettingRow title="Do not disturb" description="Silence all notifications."><Switch checked={dnd} onCheckedChange={setDnd} /></SettingRow>
        <SettingRow title="Digest mode" description="Bundle lower-priority alerts.">
          <Select value={digest} onValueChange={setDigest}><SelectTrigger className="h-8 w-[120px] rounded-xl text-[12px]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="realtime">Realtime</SelectItem><SelectItem value="hourly">Hourly</SelectItem><SelectItem value="daily">Daily</SelectItem><SelectItem value="off">Off</SelectItem></SelectContent></Select>
        </SettingRow>
      </SectionBlock>
      <SectionBlock title="Sounds">
        <SettingRow title="Message sounds" description="Play audio on new message."><Switch checked={sound} onCheckedChange={setSound} /></SettingRow>
        <div className="py-3">
          <div className="flex items-center justify-between text-[12px]"><span className="font-medium text-foreground">Volume</span><span className="text-muted-foreground">{volume[0]}%</span></div>
          <Slider value={volume} onValueChange={setVolume} min={0} max={100} step={5} disabled={!sound} className="mt-2" />
        </div>
      </SectionBlock>
      <SectionBlock title="What notifies you">
        <SettingRow title="@Mentions" description="Someone tags you." badge="Recommended"><Switch checked={mentions} onCheckedChange={setMentions} /></SettingRow>
        <SettingRow title="Replies" description="Someone replies to you."><Switch checked={replies} onCheckedChange={setReplies} /></SettingRow>
        <SettingRow title="All channel messages" description="Every post in followed channels." badge="Noisy"><Switch checked={channels} onCheckedChange={setChannels} /></SettingRow>
      </SectionBlock>
    </>
  )
}
