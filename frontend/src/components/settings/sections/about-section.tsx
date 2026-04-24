'use client'

import { Badge } from '@/components/ui/badge'
import { SectionHeader, SectionBlock, SettingRow } from '../shared'

export function AboutSection() {
  return (
    <>
      <SectionHeader title="About Twiky" />
      <SectionBlock>
        <SettingRow title="Version" description="Current app version."><Badge variant="secondary" className="rounded-full">0.1.0-beta</Badge></SettingRow>
        <SettingRow title="Build" description="Last build date."><span className="text-[12px] text-muted-foreground">Apr 19 2026</span></SettingRow>
        <SettingRow title="Release channel" description="Update channel."><Badge variant="outline" className="rounded-full">Canary</Badge></SettingRow>
      </SectionBlock>
      <div className="text-center text-[11px] text-muted-foreground"><p>Made with ❤️ by the Twiky team</p></div>
    </>
  )
}
