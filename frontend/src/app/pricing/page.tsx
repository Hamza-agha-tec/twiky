"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { createClient } from '@/utils/supabase/client';
import { Check, Loader2, Sparkles, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ??
  process.env.NEXT_PUBLIC_BACKEND_URL ??
  'http://localhost:3500';

type PlanType = 'FREE' | 'PRO' | 'GEEK';

type SubscriptionResponse = {
  plan_type?: PlanType | string | null;
  status?: string | null;
};

type Plan = {
  key: PlanType;
  title: string;
  priceLabel: string;
  blurb: string;
  productId: string | null;
  accent: 'neutral' | 'primary' | 'red';
  highlight?: string;
  features: Array<{ label: string; description: string; tag?: PlanType }>;
};

export default function PricingPage() {
  const [loading, setLoading] = useState<string | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionResponse | null>(null);
  const [subscriptionLoading, setSubscriptionLoading] = useState(true);

  const proId =
    process.env.NEXT_PUBLIC_DODO_PLAN_ID_PRO ?? 'pdt_0NdK6U7UrrnbFQdea7CLd';
  const geekId = process.env.NEXT_PUBLIC_DODO_PLAN_ID_GEEK ?? null;

  const plans: Plan[] = useMemo(
    () => [
      {
        key: 'FREE',
        title: 'Free',
        priceLabel: '$0',
        blurb: 'Perfect for getting started.',
        productId: null,
        accent: 'neutral',
        features: [
          { label: 'Unlimited DMs', description: 'With mutual followers' },
          { label: 'Up to 3 Channels', description: 'Create and manage channels' },
          { label: 'Standard emoji reactions', description: 'Express yourself with emojis' },
          { label: 'File sharing', description: 'Up to 5 MB per file' },
        ],
      },
      {
        key: 'PRO',
        title: 'Pro',
        priceLabel: '$4.99',
        blurb: 'Advanced features for power users.',
        productId: proId,
        accent: 'primary',
        highlight: 'Most popular',
        features: [
          { label: 'Everything in Free', description: 'All free features included', tag: 'FREE' },
          { label: 'Pro badge & verified status', description: 'Stand out with a verified profile', tag: 'PRO' },
          { label: 'Unlimited Channels & Groups', description: 'No limits on channels or group size', tag: 'PRO' },
          { label: 'Premium file sharing', description: 'Up to 50 MB per file', tag: 'PRO' },
          { label: 'Custom reactions & stickers', description: 'Express more with custom content', tag: 'PRO' },
          { label: 'Early access to new features', description: 'Be first to try what\'s coming', tag: 'PRO' },
        ],
      },
      {
        key: 'GEEK',
        title: 'Geek',
        priceLabel: '$9.99',
        blurb: 'Max perks for enthusiasts.',
        productId: geekId,
        accent: 'red',
        features: [
          { label: 'Everything in Pro', description: 'All Pro perks included', tag: 'PRO' },
          { label: 'Geek badge (Red Shield)', description: 'Exclusive red verified badge', tag: 'GEEK' },
          { label: 'Largest uploads', description: 'Up to 100 MB per file', tag: 'GEEK' },
          { label: 'Early beta access', description: 'Try experimental builds first', tag: 'GEEK' },
          { label: 'Priority support+', description: 'Fastest queue and escalation', tag: 'GEEK' },
        ],
      },
    ],
    [geekId, proId],
  );

  const currentPlan: PlanType = useMemo(() => {
    if (!subscription) return 'FREE';
    if (subscription.status !== 'active') return 'FREE';
    const pt = String(subscription.plan_type ?? '').toUpperCase();
    if (pt === 'GEEK') return 'GEEK';
    if (pt === 'PRO') return 'PRO';
    return 'FREE';
  }, [subscription]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setSubscriptionLoading(true);
      try {
        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          if (!cancelled) setSubscription(null);
          return;
        }
        const res = await fetch(`${API_URL}/payments/subscription`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        const data = (await res.json().catch(() => null)) as SubscriptionResponse | null;
        if (!cancelled) setSubscription(res.ok ? data : null);
      } finally {
        if (!cancelled) setSubscriptionLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleCheckout = async (productId: string | null) => {
    if (!productId) return;
    setLoading(productId);
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Please login to upgrade your plan');
        return;
      }
      const res = await fetch(`${API_URL}/payments/checkout`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          productId,
          redirectUrl: `${window.location.origin}/chat`,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as any)?.message || 'Failed to initiate checkout');
      if ((data as any).checkout_url) {
        window.location.href = (data as any).checkout_url;
      } else {
        throw new Error('Could not generate checkout link');
      }
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : 'Failed to initiate checkout';
      toast.error(message);
    } finally {
      setLoading(null);
    }
  };

  const handleManageSubscription = async () => {
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error('Please login first');
        return;
      }
      const res = await fetch(`${API_URL}/payments/portal`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const { url } = await res.json().catch(() => ({}));
      if (url) window.location.href = url;
      else toast.error('Could not open billing portal');
    } catch {
      toast.error('Could not open billing portal');
    }
  };

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-5xl px-6 py-16">

        {/* Header */}
        <motion.div
          className="mb-10 text-center"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28, ease: 'easeOut' }}
        >
          <div className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-primary">
            <Sparkles className="h-3 w-3" />
            Pricing
          </div>
          <h1 className="text-[30px] font-bold tracking-tight text-foreground">
            Choose your plan
          </h1>
          <p className="mt-2 text-[13px] text-muted-foreground">
            Upgrade anytime. Cancel anytime. Instant activation after payment.
          </p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-[11px] text-muted-foreground">
            <span className="rounded-full border border-border bg-card px-2.5 py-1">
              Current: <span className="font-semibold text-foreground">{subscriptionLoading ? '…' : currentPlan}</span>
            </span>
            {currentPlan !== 'FREE' ? (
              <Button
                variant="outline"
                size="sm"
                className="h-8 rounded-full px-3 text-[11px]"
                onClick={handleManageSubscription}
              >
                Manage billing
              </Button>
            ) : null}
          </div>
        </motion.div>

        {/* Cards */}
        <div className="grid gap-4 md:grid-cols-3">

          {plans.map((plan, idx) => {
            const isCurrent = currentPlan === plan.key;
            const isLoggedIn = subscriptionLoading ? false : subscription !== null;
            const canCheckout =
              Boolean(plan.productId) &&
              !loading &&
              (!isCurrent || plan.key === 'FREE');

            const tone =
              plan.accent === 'primary'
                ? {
                    card: 'border-primary/25 bg-linear-to-br from-primary/12 to-primary/4',
                    badge: 'border-primary/30 bg-primary/15 text-primary',
                    icon: 'bg-primary/15 text-primary',
                    chip: 'border-primary/25 bg-primary/10 text-primary',
                    check: 'bg-primary/15 text-primary',
                    cta: '',
                  }
                : plan.accent === 'red'
                  ? {
                      card: 'border-red-500/25 bg-linear-to-br from-red-500/14 to-red-500/4',
                      badge: 'border-red-500/30 bg-red-500/15 text-red-500',
                      icon: 'bg-red-500/15 text-red-500',
                      chip: 'border-red-500/25 bg-red-500/10 text-red-500',
                      check: 'bg-red-500/15 text-red-500',
                      cta: 'bg-red-500 hover:bg-red-500/90',
                    }
                  : {
                      card: 'border-border bg-card',
                      badge: 'border-border bg-muted text-muted-foreground',
                      icon: 'bg-muted text-muted-foreground',
                      chip: 'border-border bg-muted text-muted-foreground',
                      check: 'bg-muted text-muted-foreground',
                      cta: '',
                    };

            const ctaLabel =
              plan.key === 'FREE'
                ? 'Current plan'
                : isCurrent
                  ? 'Current plan'
                  : `Upgrade to ${plan.title}`;

            return (
              <motion.div
                key={plan.key}
                className={cn(
                  'relative flex flex-col overflow-hidden rounded-[22px] border p-6',
                  tone.card,
                )}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.28, delay: 0.08 + idx * 0.06, ease: 'easeOut' }}
              >
                {plan.highlight ? (
                  <div className={cn('absolute right-5 top-5 rounded-full border px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider', tone.badge)}>
                    {plan.highlight}
                  </div>
                ) : null}

                {isCurrent ? (
                  <div className="absolute left-5 top-5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                    Current
                  </div>
                ) : null}

                <div className="mb-5">
                  <div className={cn('mb-3 flex h-10 w-10 items-center justify-center rounded-2xl', tone.icon)}>
                    {plan.key === 'FREE' ? (
                      <Zap className="h-5 w-5" />
                    ) : (
                      <Sparkles className="h-5 w-5" />
                    )}
                  </div>
                  <p className="text-[15px] font-bold text-foreground">{plan.title}</p>
                  <div className="mt-1 flex items-baseline gap-1">
                    <span className="text-[32px] font-bold tracking-tight text-foreground">{plan.priceLabel}</span>
                    <span className="text-[12px] text-muted-foreground">/month</span>
                  </div>
                  <p className="mt-1 text-[12px] text-muted-foreground">{plan.blurb}</p>
                </div>

                <div className="flex-1 space-y-0 divide-y divide-border/40">
                  {plan.features.map((f) => (
                    <div key={f.label} className="flex items-start gap-2.5 py-2.5">
                      <div className={cn('mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px]', tone.check)}>
                        <Check className="h-2.5 w-2.5" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <p className="text-[12.5px] font-medium text-foreground">{f.label}</p>
                          {f.tag && f.tag !== 'FREE' ? (
                            <span className={cn('rounded-full border px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider', tone.chip)}>
                              {f.tag}
                            </span>
                          ) : null}
                        </div>
                        <p className="text-[11px] text-muted-foreground">{f.description}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-5 flex flex-col gap-2">
                  <Button
                    className={cn(
                      'h-10 w-full rounded-xl text-[13px] font-semibold',
                      tone.cta,
                    )}
                    variant={plan.key === 'FREE' ? 'outline' : 'default'}
                    disabled={plan.key === 'FREE' || !isLoggedIn || !canCheckout}
                    onClick={() => handleCheckout(plan.productId)}
                  >
                    {loading === plan.productId ? (
                      <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Initializing…</>
                    ) : (
                      <><Sparkles className="mr-2 h-4 w-4" />{ctaLabel}</>
                    )}
                  </Button>

                  {plan.key !== 'FREE' ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 w-full rounded-xl text-[11px] text-muted-foreground"
                      onClick={handleManageSubscription}
                      disabled={!isLoggedIn}
                    >
                      Manage subscription
                    </Button>
                  ) : null}
                </div>
              </motion.div>
            );
          })}

        </div>

        {/* Footer */}
        <motion.p
          className="mt-8 text-center text-[11px] text-muted-foreground/50"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.3 }}
        >
          Cancel anytime · Secure payments · Instant activation
        </motion.p>

      </div>
    </main>
  );
}
