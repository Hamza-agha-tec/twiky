'use client'

import { useEffect, useState } from 'react'
import { ModeToggle } from '@/components/ui/mode-toggle'
import { SectionHeader, SectionBlock, SettingRow } from '../shared'
import { cn } from '@/lib/utils'

const BLACK_VARS: Record<string, string> = {
  '--background':                  'oklch(0.05 0 0)',
  '--sidebar':                     'oklch(0.03 0 0)',
  '--card':                        'oklch(0.08 0 0)',
  '--popover':                     'oklch(0.08 0 0)',
  '--muted':                       'oklch(0.11 0 0)',
  '--accent':                      'oklch(0.11 0 0)',
  '--border':                      'oklch(1 0 0 / 7%)',
  '--input':                       'oklch(1 0 0 / 9%)',
  '--sidebar-border':              'oklch(1 0 0 / 7%)',
  '--primary':                     'oklch(0.72 0 0)',
  '--primary-foreground':          'oklch(0.08 0 0)',
  '--ring':                        'oklch(0.72 0 0)',
  '--sidebar-primary':             'oklch(0.72 0 0)',
  '--sidebar-primary-foreground':  'oklch(0.08 0 0)',
}

const GLASSY_VARS: Record<string, string> = {
  '--background':                  'transparent',
  '--sidebar':                     'oklch(0.18 0.03 233 / 45%)',
  '--card':                        'oklch(0.20 0.03 233 / 40%)',
  '--popover':                     'oklch(0.22 0.04 233 / 55%)',
  '--muted':                       'oklch(0.22 0.03 233 / 40%)',
  '--accent':                      'oklch(0.28 0.05 233 / 50%)',
  '--border':                      'oklch(0.55 0.08 233 / 18%)',
  '--input':                       'oklch(0.55 0.08 233 / 15%)',
  '--sidebar-border':              'oklch(0.55 0.08 233 / 15%)',
  '--foreground':                  'oklch(0.97 0 0)',
  '--card-foreground':             'oklch(0.97 0 0)',
  '--popover-foreground':          'oklch(0.97 0 0)',
  '--muted-foreground':            'oklch(0.68 0.04 233)',
  '--accent-foreground':           'oklch(0.97 0 0)',
  '--primary':                     'oklch(0.51 0.17 233)',
  '--primary-foreground':          'oklch(0.98 0 0)',
  '--ring':                        'oklch(0.51 0.17 233)',
  '--sidebar-primary':             'oklch(0.51 0.17 233)',
  '--sidebar-primary-foreground':  'oklch(0.98 0 0)',
  '--sidebar-foreground':          'oklch(0.97 0 0)',
  '--sidebar-accent':              'oklch(0.28 0.05 233 / 50%)',
  '--sidebar-accent-foreground':   'oklch(0.97 0 0)',
}

const ALL_OVERRIDE_KEYS = [...new Set([...Object.keys(BLACK_VARS), ...Object.keys(GLASSY_VARS)])]

function applyStyleTheme(id: string) {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  for (const k of ALL_OVERRIDE_KEYS) root.style.removeProperty(k)
  root.removeAttribute('data-style')
  if (id === 'black') {
    root.classList.add('dark')
    for (const [k, v] of Object.entries(BLACK_VARS)) root.style.setProperty(k, v)
    root.setAttribute('data-style', 'black')
  } else if (id === 'glassy') {
    root.classList.add('dark')
    for (const [k, v] of Object.entries(GLASSY_VARS)) root.style.setProperty(k, v)
    root.setAttribute('data-style', 'glassy')
  }
  try { localStorage.setItem('twiky-style', id) } catch {}
}

const STYLE_PRESETS = [
  {
    id: 'normal',
    label: 'Normal',
    description: 'Clean and minimal',
    preview: {
      bg: 'bg-white dark:bg-[#1a1b23]',
      sidebar: 'bg-[#f5f5f7] dark:bg-[#13141a]',
      bubble: 'bg-[#e8e8ec] dark:bg-[#2a2b35]',
    },
  },
  {
    id: 'black',
    label: 'Black',
    description: 'Pure OLED black',
    preview: {
      bg: 'bg-[#0a0a0a]',
      sidebar: 'bg-black',
      bubble: 'bg-[#1a1a1a]',
    },
  },
  {
    id: 'glassy',
    label: 'Glassy',
    description: 'Frosted glass effect',
    preview: {
      bg: 'bg-gradient-to-br from-indigo-950 via-purple-950 to-slate-900',
      sidebar: 'bg-white/5',
      bubble: 'bg-white/10',
    },
  },
] as const

export function AppearanceSection() {
  const [selectedStyle, setSelectedStyle] = useState('normal')

  useEffect(() => {
    try {
      const saved = localStorage.getItem('twiky-style') ?? 'normal'
      setSelectedStyle(saved)
      applyStyleTheme(saved)
    } catch {}
  }, [])

  function handleStyleChange(id: string) {
    setSelectedStyle(id)
    applyStyleTheme(id)
  }

  return (
    <>
      <SectionHeader title="Appearance" description="Customize the look and feel of your workspace." />

      <SectionBlock title="Theme">
        <SettingRow title="App theme" description="Light, dark, or system preference.">
          <ModeToggle buttonClassName="h-9 w-9 rounded-xl" />
        </SettingRow>
      </SectionBlock>

      <SectionBlock title="Style">
        <div className="py-3">
          <div className="grid grid-cols-3 gap-3">
            {STYLE_PRESETS.map((preset) => {
              const isSelected = selectedStyle === preset.id
              return (
                <button
                  key={preset.id}
                  onClick={() => handleStyleChange(preset.id)}
                  className={cn(
                    'group relative flex flex-col overflow-hidden rounded-2xl border-2 transition-all duration-200',
                    isSelected
                      ? 'border-primary shadow-[0_0_0_1px_hsl(var(--primary)/0.3),0_4px_20px_hsl(var(--primary)/0.2)]'
                      : 'border-border/50 hover:border-border',
                  )}
                >
                  {/* Mini UI preview */}
                  <div className={cn('relative h-[88px] w-full overflow-hidden', preset.preview.bg)}>
                    {/* Sidebar strip */}
                    <div className={cn('absolute inset-y-0 left-0 w-[30%]', preset.preview.sidebar)}>
                      <div className="mx-auto mt-2.5 h-5 w-5 rounded-full bg-white/20" />
                      {[0, 1, 2].map((i) => (
                        <div
                          key={i}
                          className={cn('mx-2 h-2 rounded-full opacity-40', preset.preview.bubble)}
                          style={{ marginTop: i === 0 ? 10 : 4 }}
                        />
                      ))}
                    </div>
                    {/* Chat area */}
                    <div className="absolute inset-y-0 right-0 flex w-[68%] flex-col justify-end gap-1.5 p-2 pb-3">
                      <div className={cn('self-start rounded-xl rounded-tl-sm px-2 py-1', preset.preview.bubble)}>
                        <div className="h-1.5 w-12 rounded-full bg-white/30" />
                      </div>
                      <div className="self-end rounded-xl rounded-tr-sm bg-primary/70 px-2 py-1">
                        <div className="h-1.5 w-8 rounded-full bg-white/50" />
                      </div>
                      <div className={cn('self-start rounded-xl rounded-tl-sm px-2 py-1', preset.preview.bubble)}>
                        <div className="h-1.5 w-16 rounded-full bg-white/30" />
                      </div>
                    </div>
                    {preset.id === 'glassy' && (
                      <div className="absolute inset-0 bg-gradient-to-t from-white/5 to-transparent backdrop-blur-[1px]" />
                    )}
                    {isSelected && (
                      <div className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-primary shadow-md">
                        <svg className="h-3 w-3 text-primary-foreground" fill="none" viewBox="0 0 12 12">
                          <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </div>
                    )}
                  </div>

                  {/* Label */}
                  <div className={cn(
                    'flex flex-col gap-0.5 px-3 py-2.5 transition-colors',
                    isSelected ? 'bg-primary/5' : 'bg-background group-hover:bg-muted/40',
                  )}>
                    <span className={cn('text-[12px] font-semibold', isSelected ? 'text-primary' : 'text-foreground')}>
                      {preset.label}
                    </span>
                    <span className="text-[10px] text-muted-foreground">{preset.description}</span>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      </SectionBlock>
    </>
  )
}
