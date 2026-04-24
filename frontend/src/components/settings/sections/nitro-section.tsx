'use client'

import { motion } from 'framer-motion'
import { Sparkles, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SectionHeader, SectionBlock } from '../shared'
import { VerifiedBadge } from '@/components/chat/verified-badge'
import { cn } from '@/lib/utils'

const PRO_FEATURES = [
  { label: 'Pro verified badge', description: 'Gold shield badge on your profile and posts', pro: true, free: false },
  { label: 'Unlimited file uploads', description: 'Up to 100 MB per file, no daily cap', pro: true, free: false },
  { label: 'Custom profile themes', description: 'Exclusive color palettes and banner effects', pro: true, free: false },
  { label: 'Priority support', description: '24 h response, dedicated queue', pro: true, free: false },
  { label: 'Analytics dashboard', description: 'Post reach, follower growth, engagement stats', pro: true, free: false },
  { label: 'Extended message history', description: 'Unlimited search across all channels', pro: true, free: false },
  { label: 'Basic messaging', description: 'Text, images, reactions', pro: true, free: true },
  { label: 'Channel participation', description: 'Join and post in public channels', pro: true, free: true },
  { label: 'Standard file uploads', description: 'Up to 10 MB per file', pro: true, free: true },
]

export function NitroSection({ isPro }: { isPro: boolean }) {
  return (
    <>
      <SectionHeader
        title="Twiky Premium"
        description={isPro ? 'You are on the Pro plan. Thank you for supporting Twiky.' : 'Unlock the full Twiky experience.'}
      />

      {/* Current plan banner */}
      {isPro ? (
        <motion.div
          className="mb-6 overflow-hidden rounded-[22px] border border-orange-400/30 bg-[linear-gradient(135deg,rgba(249,115,22,0.18),rgba(234,88,12,0.12),rgba(194,65,12,0.08))] p-5 shadow-[0_0_32px_rgba(249,115,22,0.12)]"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28, ease: 'easeOut' }}
        >
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-orange-500/15 ring-1 ring-orange-400/30">
              <Sparkles className="h-6 w-6 text-orange-500" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-[16px] font-bold text-foreground">Pro Plan</p>
                <span className="rounded-full border border-orange-400/40 bg-orange-500/15 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-orange-600 dark:text-orange-300">
                  Active
                </span>
              </div>
              <p className="mt-0.5 text-[12px] text-muted-foreground">elbidali.zakaria@gmail.com · Renews monthly</p>
              <div className="mt-3 grid grid-cols-3 gap-3">
                {[
                  { label: 'Plan', value: 'Pro' },
                  { label: 'Since', value: 'Apr 2026' },
                  { label: 'Next bill', value: 'May 23' },
                ].map(({ label, value }) => (
                  <div key={label} className="rounded-xl border border-orange-400/20 bg-background/60 px-3 py-2 text-center">
                    <p className="text-[13px] font-bold text-foreground">{value}</p>
                    <p className="text-[10px] text-muted-foreground">{label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <Button variant="outline" size="sm" className="h-8 rounded-xl border-orange-400/30 text-[11px] text-orange-600 hover:bg-orange-500/10 dark:text-orange-400">
              Manage billing
            </Button>
            <Button variant="ghost" size="sm" className="h-8 rounded-xl text-[11px] text-muted-foreground hover:text-destructive">
              Cancel plan
            </Button>
          </div>
        </motion.div>
      ) : (
        <motion.div
          className="mb-6 overflow-hidden rounded-[22px] border border-primary/20 bg-[linear-gradient(135deg,rgba(var(--primary)/0.12),rgba(var(--primary)/0.06))] p-5"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28, ease: 'easeOut' }}
        >
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-muted">
              <Users className="h-6 w-6 text-muted-foreground" />
            </div>
            <div>
              <p className="text-[15px] font-bold text-foreground">Free Plan</p>
              <p className="text-[12px] text-muted-foreground">Upgrade to Pro to unlock all features.</p>
            </div>
          </div>
          <Button className="mt-4 h-9 w-full rounded-xl text-[13px] font-semibold bg-[linear-gradient(135deg,#f59e0b,#d97706)] text-white hover:opacity-90 border-0">
            <Sparkles className="mr-2 h-4 w-4" />
            Upgrade to Pro · $9 / month
          </Button>
        </motion.div>
      )}

      {/* Feature comparison */}
      <SectionBlock title="What's included">
        <div className="space-y-0">
          {PRO_FEATURES.map((feat, i) => (
            <motion.div
              key={feat.label}
              className="flex items-start gap-3 py-2.5 px-1"
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.04, duration: 0.2 }}
            >
              <div className={cn(
                'mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-[10px]',
                feat.pro
                  ? 'bg-orange-500/15 text-orange-600 dark:text-orange-400'
                  : 'bg-muted text-muted-foreground',
              )}>
                ✓
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-[13px] font-medium text-foreground">{feat.label}</p>
                  {!feat.free && (
                    <span className="rounded-full border border-orange-400/30 bg-orange-500/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-orange-600 dark:text-orange-400">
                      Pro
                    </span>
                  )}
                </div>
                <p className="text-[11.5px] text-muted-foreground">{feat.description}</p>
              </div>
              <div className="flex flex-shrink-0 gap-3 text-[11px]">
                <span className={cn('w-8 text-center', feat.free ? 'text-emerald-500' : 'text-muted-foreground/40')}>
                  {feat.free ? '✓' : '—'}
                </span>
                <span className={cn('w-8 text-center', feat.pro ? 'text-orange-500' : 'text-muted-foreground/40')}>
                  {feat.pro ? '✓' : '—'}
                </span>
              </div>
            </motion.div>
          ))}
          <div className="flex items-center justify-end gap-3 border-t border-border/40 pt-2 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">
            <span className="w-8 text-center">Free</span>
            <span className="w-8 text-center text-orange-500">Pro</span>
          </div>
        </div>
      </SectionBlock>

      {/* Pro badge preview */}
      {isPro && (
        <SectionBlock title="Your Pro badge">
          <div className="flex items-center gap-4 py-3 px-1">
            <VerifiedBadge size="md" variant="pro" />
            <div>
              <p className="text-[13px] font-semibold text-foreground">Gold shield badge</p>
              <p className="text-[11.5px] text-muted-foreground">Shows on your profile, posts, and messages.</p>
            </div>
          </div>
        </SectionBlock>
      )}

      {/* Invoice history */}
      {isPro && (
        <SectionBlock title="Billing history">
          <div className="space-y-0">
            {[
              { date: 'Apr 23, 2026', amount: '$9.00', status: 'Paid' },
              { date: 'Mar 23, 2026', amount: '$9.00', status: 'Paid' },
              { date: 'Feb 23, 2026', amount: '$9.00', status: 'Paid' },
            ].map(({ date, amount, status }) => (
              <div key={date} className="flex items-center justify-between py-2.5 px-1">
                <div>
                  <p className="text-[13px] font-medium text-foreground">{date}</p>
                  <p className="text-[11px] text-muted-foreground">Twiky Pro · Monthly</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[13px] font-semibold text-foreground">{amount}</span>
                  <span className="rounded-full bg-emerald-500/12 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                    {status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </SectionBlock>
      )}
    </>
  )
}
