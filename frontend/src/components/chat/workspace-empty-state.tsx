'use client'

import type { ReactNode } from 'react'
import { Command, Search, Terminal } from 'lucide-react'

export function WorkspaceEmptyState({
  title = 'No group open',
  subtitle = 'Pick a group on left, or press Escape again to return.',
  action,
  showShortcuts = true,
}: {
  title?: string
  subtitle?: string
  action?: ReactNode
  showShortcuts?: boolean
}) {
  return (
    <div className="flex min-h-0 flex-1 items-center justify-center bg-background px-6">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-border bg-muted/30">
          <Command className="h-6 w-6 text-muted-foreground" />
        </div>
        <p className="mt-5 text-[15px] font-semibold text-foreground">{title}</p>
        <p className="mt-2 text-[12px] leading-6 text-muted-foreground">{subtitle}</p>

        {action && (
          <div className="mt-6 flex justify-center">
            {action}
          </div>
        )}

        {showShortcuts && (
          <div className="mt-6 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card text-left">
            <ShortcutRow label="Close group feed" keys={['Esc']} />
            <ShortcutRow label="Search channels/groups" keys={['Ctrl', 'K']} icon={<Search className="h-4 w-4" />} />
            <ShortcutRow label="Open terminal" keys={['Ctrl', '`']} icon={<Terminal className="h-4 w-4" />} />
          </div>
        )}
      </div>
    </div>
  )
}

function ShortcutRow({
  icon,
  keys,
  label,
}: {
  icon?: ReactNode
  keys: string[]
  label: string
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3">
      <div className="flex min-w-0 items-center gap-2 text-muted-foreground">
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-muted/50">
          {icon ?? <Command className="h-4 w-4" />}
        </span>
        <span className="truncate text-[12px] font-medium">{label}</span>
      </div>
      <div className="flex items-center gap-1.5">
        {keys.map((key) => (
          <kbd
            key={key}
            className="rounded-lg border border-border bg-muted px-2 py-1 text-[10px] font-semibold text-foreground"
          >
            {key}
          </kbd>
        ))}
      </div>
    </div>
  )
}
