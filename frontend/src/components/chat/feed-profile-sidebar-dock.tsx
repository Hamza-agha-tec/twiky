'use client'

import type { ReactNode } from 'react'

interface FeedProfileSidebarDockProps {
  children: ReactNode
  onBack?: () => void
  open: boolean
  width: number
}

export function FeedProfileSidebarDock({
  children,
  open,
  width,
}: FeedProfileSidebarDockProps) {
  return (
    <aside
      className="flex h-full flex-shrink-0 flex-col overflow-hidden border-l border-border bg-[#0a0f17] transition-[width,opacity] duration-200 ease-out"
      style={{ opacity: open ? 1 : 0, width: open ? width : 0 }}
    >
      <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
    </aside>
  )
}
