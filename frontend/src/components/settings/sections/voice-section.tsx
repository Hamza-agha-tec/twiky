'use client'

import { useState } from 'react'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { SectionHeader, SectionBlock, SettingRow } from '../shared'

export function VoiceSection() {
  const [inputDevice, setInputDevice] = useState('default')
  const [outputDevice, setOutputDevice] = useState('default')
  const [noiseSuppression, setNoiseSuppression] = useState(true)
  const [echoCancellation, setEchoCancellation] = useState(true)
  const [voiceActivity, setVoiceActivity] = useState(true)

  return (
    <>
      <SectionHeader title="Voice & Video" description="Configure your audio and video devices." />
      <SectionBlock title="Input">
        <SettingRow title="Microphone" description="Device used for voice calls.">
          <Select value={inputDevice} onValueChange={setInputDevice}><SelectTrigger className="h-8 w-[160px] rounded-xl text-[12px]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="default">Default</SelectItem><SelectItem value="built-in">Built-in Mic</SelectItem></SelectContent></Select>
        </SettingRow>
        <SettingRow title="Noise suppression" description="Reduce background noise."><Switch checked={noiseSuppression} onCheckedChange={setNoiseSuppression} /></SettingRow>
        <SettingRow title="Echo cancellation" description="Prevent feedback loops."><Switch checked={echoCancellation} onCheckedChange={setEchoCancellation} /></SettingRow>
      </SectionBlock>
      <SectionBlock title="Output">
        <SettingRow title="Speakers" description="Device used for audio output.">
          <Select value={outputDevice} onValueChange={setOutputDevice}><SelectTrigger className="h-8 w-[160px] rounded-xl text-[12px]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="default">Default</SelectItem><SelectItem value="built-in">Built-in Speakers</SelectItem></SelectContent></Select>
        </SettingRow>
        <SettingRow title="Voice activity detection" description="Auto-activate mic when speaking."><Switch checked={voiceActivity} onCheckedChange={setVoiceActivity} /></SettingRow>
      </SectionBlock>
    </>
  )
}
