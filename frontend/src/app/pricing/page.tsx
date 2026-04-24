"use client";

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { createClient } from '@/utils/supabase/client';
import { Check, Loader2, Sparkles, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3500';

const FREE_FEATURES = [
    { label: 'Unlimited DMs', description: 'With mutual followers' },
    { label: 'Up to 3 Channels', description: 'Create and manage channels' },
    { label: 'Standard emoji reactions', description: 'Express yourself with emojis' },
    { label: 'File sharing', description: 'Up to 5 MB per file' },
];

const PRO_FEATURES = [
    { label: 'Everything in Free', description: 'All free features included', free: true },
    { label: 'Pro Badge & Verified Status', description: 'Stand out with a verified profile', free: false },
    { label: 'Unlimited Channels & Groups', description: 'No limits on channels or group size', free: false },
    { label: 'Premium file sharing', description: 'Up to 50 MB per file', free: false },
    { label: 'Custom reactions & Stickers', description: 'Express more with custom content', free: false },
    { label: 'Early access to new features', description: 'Be first to try what\'s coming', free: false },
];

export default function PricingPage() {
    const [loading, setLoading] = useState<string | null>(null);
    const proId = process.env.NEXT_PUBLIC_DODO_PLAN_ID_PRO || 'pdt_0NdK6U7UrrnbFQdea7CLd';

    const handleCheckout = async (productId: string) => {
        if (productId === 'free') return;
        setLoading(productId);
        try {
            const supabase = createClient();
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                toast.error("Please login to upgrade your plan");
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
            const data = await res.json();
            if (!res.ok) throw new Error(data?.message || "Failed to initiate checkout");
            if (data.checkout_url) {
                window.location.href = data.checkout_url;
            } else {
                throw new Error("Could not generate checkout link");
            }
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : "Failed to initiate checkout";
            toast.error(message);
        } finally {
            setLoading(null);
        }
    };

    const handleManageSubscription = async () => {
        try {
            const supabase = createClient();
            const { data: { session } } = await supabase.auth.getSession();
            const res = await fetch(`${API_URL}/payments/portal`, {
                headers: { Authorization: `Bearer ${session?.access_token}` }
            });
            const { url } = await res.json();
            if (url) window.location.href = url;
        } catch {
            toast.error("Could not open billing portal");
        }
    };

    return (
        <main className="min-h-screen bg-background">
            <div className="mx-auto max-w-3xl px-6 py-16">

                {/* Header */}
                <motion.div
                    className="mb-12 text-center"
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.28, ease: 'easeOut' }}
                >
                    <div className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-primary">
                        <Sparkles className="h-3 w-3" />
                        Pricing
                    </div>
                    <h1 className="text-[28px] font-bold tracking-tight text-foreground">
                        Choose your plan
                    </h1>
                    <p className="mt-2 text-[13px] text-muted-foreground">
                        Upgrade anytime to unlock premium perks and support Twiky.
                    </p>
                </motion.div>

                {/* Cards */}
                <div className="grid gap-4 md:grid-cols-2">

                    {/* Free */}
                    <motion.div
                        className="flex flex-col rounded-[22px] border border-border bg-card p-6"
                        initial={{ opacity: 0, y: 14 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.28, delay: 0.08, ease: 'easeOut' }}
                    >
                        <div className="mb-5">
                            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-muted">
                                <Zap className="h-5 w-5 text-muted-foreground" />
                            </div>
                            <p className="text-[15px] font-bold text-foreground">Free</p>
                            <div className="mt-1 flex items-baseline gap-1">
                                <span className="text-[32px] font-bold tracking-tight text-foreground">$0</span>
                                <span className="text-[12px] text-muted-foreground">/month</span>
                            </div>
                            <p className="mt-1 text-[12px] text-muted-foreground">
                                Perfect for getting started.
                            </p>
                        </div>

                        <div className="flex-1 space-y-0 divide-y divide-border/50">
                            {FREE_FEATURES.map((f) => (
                                <div key={f.label} className="flex items-start gap-2.5 py-2.5">
                                    <div className="mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full bg-muted text-[9px] text-muted-foreground">
                                        <Check className="h-2.5 w-2.5" />
                                    </div>
                                    <div>
                                        <p className="text-[12.5px] font-medium text-foreground">{f.label}</p>
                                        <p className="text-[11px] text-muted-foreground">{f.description}</p>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <Button
                            variant="outline"
                            className="mt-5 h-9 w-full rounded-xl text-[12px]"
                            disabled
                        >
                            Current Plan
                        </Button>
                    </motion.div>

                    {/* Pro */}
                    <motion.div
                        className="relative flex flex-col overflow-hidden rounded-[22px] border border-primary/25 bg-gradient-to-br from-primary/[0.12] to-primary/[0.04] p-6"
                        initial={{ opacity: 0, y: 14 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.28, delay: 0.14, ease: 'easeOut' }}
                    >
                        {/* Most popular badge */}
                        <div className="absolute right-5 top-5 rounded-full border border-primary/30 bg-primary/15 px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-primary">
                            Most popular
                        </div>

                        <div className="mb-5">
                            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/15">
                                <Sparkles className="h-5 w-5 text-primary" />
                            </div>
                            <p className="text-[15px] font-bold text-foreground">Pro</p>
                            <div className="mt-1 flex items-baseline gap-1">
                                <span className="text-[32px] font-bold tracking-tight text-foreground">$4.99</span>
                                <span className="text-[12px] text-muted-foreground">/month</span>
                            </div>
                            <p className="mt-1 text-[12px] text-muted-foreground">
                                Advanced features for power users.
                            </p>
                        </div>

                        <div className="flex-1 space-y-0 divide-y divide-border/40">
                            {PRO_FEATURES.map((f) => (
                                <div key={f.label} className="flex items-start gap-2.5 py-2.5">
                                    <div className={cn(
                                        'mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full text-[9px]',
                                        f.free
                                            ? 'bg-muted text-muted-foreground'
                                            : 'bg-primary/15 text-primary'
                                    )}>
                                        <Check className="h-2.5 w-2.5" />
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-1.5">
                                            <p className="text-[12.5px] font-medium text-foreground">{f.label}</p>
                                            {!f.free && (
                                                <span className="rounded-full border border-primary/25 bg-primary/10 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-primary">
                                                    Pro
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-[11px] text-muted-foreground">{f.description}</p>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="mt-5 flex flex-col gap-2">
                            <Button
                                className="h-10 w-full rounded-xl text-[13px] font-semibold"
                                onClick={() => handleCheckout(proId)}
                                disabled={loading !== null}
                            >
                                {loading === proId ? (
                                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Initializing…</>
                                ) : (
                                    <><Sparkles className="mr-2 h-4 w-4" />Upgrade to Pro</>
                                )}
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-full rounded-xl text-[11px] text-muted-foreground"
                                onClick={handleManageSubscription}
                            >
                                Manage subscription
                            </Button>
                        </div>
                    </motion.div>

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
