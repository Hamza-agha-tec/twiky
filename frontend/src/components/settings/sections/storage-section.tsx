'use client'

import { Database, HardDrive, Trash2, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SectionHeader, SectionBlock } from '../shared'

export function StorageSection() {
  return (
    <>
      <SectionHeader title="Storage" description="Manage cached data and local files." />
      <div className="mb-6 grid grid-cols-2 gap-6">
        {[{ label: 'App cache', value: '124 MB', icon: Database }, { label: 'Media stored', value: '843 MB', icon: HardDrive }].map(({ label, value, icon: Icon }) => (
          <div key={label}>
            <Icon className="h-5 w-5 text-muted-foreground" />
            <p className="mt-2 text-[22px] font-bold text-foreground">{value}</p>
            <p className="text-[11px] text-muted-foreground">{label}</p>
          </div>
        ))}
      </div>
      <SectionBlock title="Actions">
        <div className="space-y-2 py-2">
          <Button variant="outline" size="sm" className="h-9 rounded-xl text-[12px] gap-2"><Trash2 className="h-4 w-4" />Clear app cache</Button>
          <br />
          <Button variant="outline" size="sm" className="h-9 rounded-xl text-[12px] gap-2"><Download className="h-4 w-4" />Export my data</Button>
        </div>
      </SectionBlock>
    </>
  )
}
