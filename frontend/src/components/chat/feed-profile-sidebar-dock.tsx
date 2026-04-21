'use client'

import type { ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'

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
    <AnimatePresence initial={false}>
      {open && (
        <motion.aside
          key="profile-dock"
          initial={{ width: 0, opacity: 0 }}
          animate={{ width, opacity: 1 }}
          exit={{ width: 0, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 340, damping: 34 }}
          className="flex h-full flex-shrink-0 flex-col overflow-hidden border-l border-border bg-sidebar"
        >
          <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
        </motion.aside>
      )}
    </AnimatePresence>
  )
}
