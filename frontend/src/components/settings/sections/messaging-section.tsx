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

export function MessagingSection() {
  const [sendOnEnter, setSendOnEnter] = useState(true)
  const [spellcheck, setSpellcheck] = useState(true)
  const [formatting, setFormatting] = useState(true)
  const [emoji, setEmoji] = useState(true)
  const [mediaAutoDownload, setMediaAutoDownload] = useState(true)
  const [autosave, setAutosave] = useState(true)
  const [goalTimeline, setGoalTimeline] = useState('month')

  return (
    <>
      <SectionHeader title="Text & Images" description="Control how you compose messages and handle media." />
      <SectionBlock title="Composer">
        <SettingRow title="Send on Enter" description="Enter to send, Shift+Enter for new line."><Switch checked={sendOnEnter} onCheckedChange={setSendOnEnter} /></SettingRow>
        <SettingRow title="Spellcheck" description="Highlight spelling errors."><Switch checked={spellcheck} onCheckedChange={setSpellcheck} /></SettingRow>
        <SettingRow title="Markdown" description="Bold, italic, code blocks."><Switch checked={formatting} onCheckedChange={setFormatting} /></SettingRow>
        <SettingRow title="Emoji suggestions" description="Show picker on :emoji:."><Switch checked={emoji} onCheckedChange={setEmoji} /></SettingRow>
      </SectionBlock>
      <SectionBlock title="Media">
        <SettingRow title="Auto-download" description="Save images and videos automatically."><Switch checked={mediaAutoDownload} onCheckedChange={setMediaAutoDownload} /></SettingRow>
      </SectionBlock>
      <SectionBlock title="Notes & Goals">
        <SettingRow title="Notes autosave" description="Auto-save drafts in My Notes."><Switch checked={autosave} onCheckedChange={setAutosave} /></SettingRow>
        <SettingRow title="Goal timeline" description="Default span in My Goals.">
          <Select value={goalTimeline} onValueChange={setGoalTimeline}><SelectTrigger className="h-8 w-[120px] rounded-xl text-[12px]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="week">Week</SelectItem><SelectItem value="month">Month</SelectItem><SelectItem value="quarter">Quarter</SelectItem><SelectItem value="year">Year</SelectItem></SelectContent></Select>
        </SettingRow>
      </SectionBlock>
    </>
  )
}
