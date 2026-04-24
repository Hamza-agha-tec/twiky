'use client'

import { useState } from 'react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { SectionHeader, SectionBlock, SettingRow } from '../shared'

export function LanguageSection() {
  const [language, setLanguage] = useState('en')
  return (
    <>
      <SectionHeader title="Language & Region" />
      <SectionBlock title="Language">
        <SettingRow title="Display language" description="UI text and interface language.">
          <Select value={language} onValueChange={setLanguage}><SelectTrigger className="h-8 w-[160px] rounded-xl text-[12px]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="en">English (US)</SelectItem><SelectItem value="fr">Français</SelectItem><SelectItem value="ar">العربية</SelectItem><SelectItem value="es">Español</SelectItem><SelectItem value="de">Deutsch</SelectItem></SelectContent></Select>
        </SettingRow>
      </SectionBlock>
    </>
  )
}
