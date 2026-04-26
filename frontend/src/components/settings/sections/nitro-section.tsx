'use client'

import { motion } from 'framer-motion'
import { Sparkles, Users, Zap, Calendar, CreditCard } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SectionHeader, SectionBlock } from '../shared'
import { VerifiedBadge, getVerifiedBadgeVariant, hasPremiumPlan } from '@/components/chat/verified-badge'
import { cn } from '@/lib/utils'

const PRO_FEATURES = [
  { label: 'Pro verified badge', description: 'Light blue shield badge on your profile and posts', pro: true, free: false },
  { label: 'Unlimited file uploads', description: 'Up to 100 MB per file, no daily cap', pro: true, free: false },
  { label: 'Custom profile themes', description: 'Exclusive color palettes and banner effects', pro: true, free: false },
  { label: 'Priority support', description: '24 h response, dedicated queue', pro: true, free: false },
  { label: 'Analytics dashboard', description: 'Post reach, follower growth, engagement stats', pro: true, free: false },
  { label: 'Extended message history', description: 'Unlimited search across all channels', pro: true, free: false },
  { label: 'Basic messaging', description: 'Text, images, reactions', pro: true, free: true },
  { label: 'Channel participation', description: 'Join and post in public channels', pro: true, free: true },
  { label: 'Standard file uploads', description: 'Up to 10 MB per file', pro: true, free: true },
]

export function NitroSection({ subPlan }: { subPlan?: string | null }) {
  const hasPremium = hasPremiumPlan(subPlan)
  const planLabel = subPlan === 'GEEK' ? 'Geek' : 'Pro'
  const badgeVariant = getVerifiedBadgeVariant(subPlan)

  return (
    <>
      <SectionHeader
        title="Twiky Premium"
        description={hasPremium ? `You are on the ${planLabel} plan. Thank you for supporting Twiky.` : 'Unlock the full Twiky experience.'}
      />

      {/* Current plan banner */}
      {hasPremium ? (
        <motion.div
          className="mb-6 overflow-hidden rounded-2xl border border-sky-400/25 bg-gradient-to-br from-sky-500/10 via-blue-500/6 to-background shadow-[0_2px_24px_rgba(14,165,233,0.08)]"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28, ease: 'easeOut' }}
        >
          {/* Header stripe */}
          <div className="flex items-center justify-between border-b border-sky-400/15 px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sky-500/15 ring-1 ring-sky-400/30">
                <Zap className="h-4.5 w-4.5 text-sky-500" fill="currentColor" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-[15px] font-bold text-foreground">{planLabel} Plan</p>
                  <span className="rounded-full bg-sky-500/15 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-sky-600 dark:text-sky-400">
                    Active
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground">elbidali.zakaria@gmail.com</p>
              </div>
            </div>
            <Button variant="outline" size="sm" className="h-7 rounded-lg border-sky-400/30 text-[11px] font-semibold text-sky-600 hover:bg-sky-500/10 dark:text-sky-400">
              Manage
            </Button>
          </div>
          {/* Stats row */}
          <div className="grid grid-cols-3 divide-x divide-sky-400/10 px-1 py-1">
            {[
              { icon: Zap, label: 'Plan', value: planLabel },
              { icon: Calendar, label: 'Member since', value: 'Apr 2026' },
              { icon: CreditCard, label: 'Next bill', value: 'May 23' },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} className="flex flex-col items-center gap-0.5 py-3">
                <p className="text-[14px] font-bold text-foreground">{value}</p>
                <p className="text-[10px] text-muted-foreground">{label}</p>
              </div>
            ))}
          </div>
          {/* Cancel */}
          <div className="border-t border-sky-400/10 px-5 py-3">
            <Button variant="ghost" size="sm" className="h-7 rounded-lg text-[11px] text-muted-foreground hover:text-destructive">
              Cancel plan
            </Button>
          </div>
        </motion.div>
      ) : (
        <motion.div
          className="mb-6 overflow-hidden rounded-2xl border border-sky-400/20 bg-gradient-to-br from-sky-500/8 to-background p-5"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28, ease: 'easeOut' }}
        >
          <div className="flex items-center gap-4">
            <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-muted">
              <Users className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-[15px] font-bold text-foreground">Free Plan</p>
              <p className="text-[12px] text-muted-foreground">Upgrade to Pro to unlock all features.</p>
            </div>
          </div>
          <Button className="mt-4 h-9 w-full rounded-xl text-[13px] font-semibold bg-gradient-to-r from-sky-500 to-blue-600 text-white hover:opacity-90 border-0 shadow-sm">
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
                  ? 'bg-sky-500/15 text-sky-600 dark:text-sky-400'
                  : 'bg-muted text-muted-foreground',
              )}>
                ✓
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-[13px] font-medium text-foreground">{feat.label}</p>
                  {!feat.free && (
                    <span className="rounded-full border border-sky-400/30 bg-sky-500/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-sky-600 dark:text-sky-400">
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
                <span className={cn('w-8 text-center', feat.pro ? 'text-sky-500' : 'text-muted-foreground/40')}>
                  {feat.pro ? '✓' : '—'}
                </span>
              </div>
            </motion.div>
          ))}
          <div className="flex items-center justify-end gap-3 border-t border-border/40 pt-2 text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">
            <span className="w-8 text-center">Free</span>
            <span className="w-8 text-center text-sky-500">Pro</span>
          </div>
        </div>
      </SectionBlock>

      {/* Pro badge preview */}
      {hasPremium && (
        <SectionBlock title={`Your ${planLabel} badge`}>
          <div className="flex items-center gap-4 py-3 px-1">
            <VerifiedBadge size="md" variant={badgeVariant} />
            <div>
              <p className="text-[13px] font-semibold text-foreground">{subPlan === 'GEEK' ? 'Red shield badge' : 'Blue shield badge'}</p>
              <p className="text-[11.5px] text-muted-foreground">Shows on your profile, posts, and messages.</p>
            </div>
          </div>
        </SectionBlock>
      )}

      {/* Invoice history */}
      {hasPremium && (
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
