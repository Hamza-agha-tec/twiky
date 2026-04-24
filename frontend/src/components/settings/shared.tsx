'use client'

import { type ReactNode } from 'react'
import { motion } from 'framer-motion'

export function SettingRow({ title, description, children, badge }: {
  title: string; description?: string; children: ReactNode; badge?: string
}) {
  return (
    <div className="group flex items-center justify-between gap-4 py-2.5 transition-colors hover:bg-accent/30 px-1 rounded-lg">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="text-[13px] font-medium text-foreground">{title}</p>
          {badge ? <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">{badge}</span> : null}
        </div>
        {description ? <p className="mt-0.5 text-[11.5px] text-muted-foreground">{description}</p> : null}
      </div>
      <div className="flex-shrink-0">{children}</div>
    </div>
  )
}

export function SectionHeader({ title, description }: { title: string; description?: string }) {
  return (
    <div className="mb-7">
      <h2 className="text-[20px] font-bold tracking-tight text-foreground">{title}</h2>
      {description ? <p className="mt-1 text-[12.5px] text-muted-foreground">{description}</p> : null}
    </div>
  )
}

export function SectionBlock({ title, children, delay = 0 }: { title?: string; children: ReactNode; delay?: number }) {
  return (
    <motion.div
      className="mb-6"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.24, ease: 'easeOut' }}
    >
      {title ? (
        <p className="mb-1 text-[10.5px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/60">{title}</p>
      ) : null}
      <div className="divide-y divide-border/40">
        {children}
      </div>
    </motion.div>
  )
}

export function formatDate(value?: string | null) {
  if (!value) return 'Not available'

  return new Intl.DateTimeFormat('en', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(value))
}

export function formatRelativeDate(value?: string | null) {
  if (!value) return 'Never'

  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value))
}

export function getInitial(value?: string | null) {
  return (value?.trim()[0] ?? 'T').toUpperCase()
}

export function versionedImageUrl(url: string) {
  const separator = url.includes('?') ? '&' : '?'
  return `${url}${separator}v=${Date.now()}`
}
