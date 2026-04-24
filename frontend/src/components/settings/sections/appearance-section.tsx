'use client'

import { useEffect, useState } from 'react'
import { ModeToggle } from '@/components/ui/mode-toggle'
import { Button } from '@/components/ui/button'
import { SectionHeader, SectionBlock, SettingRow } from '../shared'
import { cn } from '@/lib/utils'

const COLOR_PRESETS = [
  { name: 'Blue',   hsl: '221 83% 53%',  fg: '0 0% 98%',  preview: '#3b82f6' },
  { name: 'Indigo', hsl: '239 84% 67%',  fg: '0 0% 98%',  preview: '#6366f1' },
  { name: 'Purple', hsl: '262 83% 58%',  fg: '0 0% 98%',  preview: '#8b5cf6' },
  { name: 'Pink',   hsl: '336 80% 58%',  fg: '0 0% 98%',  preview: '#ec4899' },
  { name: 'Red',    hsl: '0 84% 60%',    fg: '0 0% 98%',  preview: '#ef4444' },
  { name: 'Orange', hsl: '25 95% 53%',   fg: '0 0% 98%',  preview: '#f97316' },
  { name: 'Amber',  hsl: '38 92% 50%',   fg: '0 0% 9%',   preview: '#f59e0b' },
  { name: 'Green',  hsl: '142 71% 45%',  fg: '0 0% 98%',  preview: '#22c55e' },
  { name: 'Teal',   hsl: '172 66% 50%',  fg: '0 0% 9%',   preview: '#14b8a6' },
  { name: 'Cyan',   hsl: '189 94% 43%',  fg: '0 0% 9%',   preview: '#06b6d4' },
  { name: 'Slate',  hsl: '215 28% 47%',  fg: '0 0% 98%',  preview: '#64748b' },
  { name: 'Rose',   hsl: '351 80% 60%',  fg: '0 0% 98%',  preview: '#f43f5e' },
] as const

function applyThemeColor(preset: typeof COLOR_PRESETS[number]) {
  if (typeof document === 'undefined') return
  document.documentElement.style.setProperty('--primary', preset.hsl)
  document.documentElement.style.setProperty('--primary-foreground', preset.fg)
  document.documentElement.style.setProperty('--ring', preset.hsl)
  try { localStorage.setItem('twiky-color', JSON.stringify(preset)) } catch {}
}

export function AppearanceSection() {
  const [selectedColor, setSelectedColor] = useState('Blue')

  useEffect(() => {
    try {
      const saved = localStorage.getItem('twiky-color')
      if (saved) {
        const preset = JSON.parse(saved) as typeof COLOR_PRESETS[number]
        setSelectedColor(preset.name)
        applyThemeColor(preset)
      }
    } catch {}
  }, [])

  return (
    <>
      <SectionHeader title="Appearance" description="Customize the look and feel of your workspace." />

      <SectionBlock title="Theme">
        <SettingRow title="App theme" description="Light, dark, or system preference.">
          <ModeToggle buttonClassName="h-9 w-9 rounded-xl" />
        </SettingRow>
      </SectionBlock>

      <SectionBlock title="Accent Color">
        <div className="space-y-4 py-2">
          <div className="flex flex-wrap gap-3">
            {COLOR_PRESETS.map((preset) => {
              const isSelected = selectedColor === preset.name
              return (
                <button
                  key={preset.name}
                  title={preset.name}
                  onClick={() => { setSelectedColor(preset.name); applyThemeColor(preset) }}
                  className="flex flex-col items-center gap-1.5"
                >
                  <div
                    className="h-8 w-8 rounded-full transition-transform hover:scale-110"
                    style={{
                      backgroundColor: preset.preview,
                      transform: isSelected ? 'scale(1.15)' : undefined,
                      boxShadow: isSelected
                        ? `0 0 0 2.5px var(--color-card, #1e1e2e), 0 0 0 4.5px ${preset.preview}`
                        : undefined,
                    }}
                  />
                  <span className={cn('text-[10px] font-medium', isSelected ? 'text-foreground' : 'text-muted-foreground')}>
                    {preset.name}
                  </span>
                </button>
              )
            })}
          </div>

          <div className="flex items-center gap-3 py-1">
            <div
              className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-[11px] font-bold text-white"
              style={{ backgroundColor: COLOR_PRESETS.find((p) => p.name === selectedColor)?.preview }}
            >
              Aa
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[12px] font-semibold text-foreground">{selectedColor}</p>
              <p className="text-[11px] text-muted-foreground">Applied to buttons, links, and highlights</p>
            </div>
            <Button size="sm" className="h-7 flex-shrink-0 rounded-lg px-3 text-[11px]">Preview</Button>
          </div>
        </div>
      </SectionBlock>
    </>
  )
}
