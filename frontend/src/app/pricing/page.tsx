"use client";

import React, { useState } from 'react';
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { createClient } from '@/utils/supabase/client';
import { Check, Loader2, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3500';

const plans = [
    {
        name: 'Free',
        id: 'free',
        price: '$0',
        description: 'Perfect for getting started with basic messaging.',
        features: [
            'Unlimited DMs with mutual followers',
            'Up to 3 Channels',
            'Standard emoji reactions',
            'Standard file sharing (5MB limit)',
        ],
        cta: 'Current Plan',
        isPro: false,
    },
    {
        name: 'Pro',
        id: process.env.NEXT_PUBLIC_DODO_PLAN_ID_PRO || 'pdt_0NdK6U7UrrnbFQdea7CLd',
        price: '$4.99',
        period: '/month',
        description: 'Advanced features for power users and creators.',
        features: [
            'Everything in Free',
            'Pro Badge & Verified Status',
            'Unlimited Channels & Groups',
            'Premium file sharing (50MB limit)',
            'Custom reactions & Stickers',
            'Early access to new features',
        ],
        cta: 'Upgrade to Pro',
        isPro: true,
    },
];

export default function PricingPage() {
    const [loading, setLoading] = useState<string | null>(null);

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
                    productId: productId,
                    redirectUrl: `${window.location.origin}/chat`,
                }),
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data?.message || "Failed to initiate checkout");
            }

            if (data.checkout_url) {
                window.location.href = data.checkout_url;
            } else {
                throw new Error("Could not generate checkout link");
            }
        } catch (error: unknown) {
            console.error("Checkout Error:", error);
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
        } catch (err) {
            toast.error("Could not open billing portal");
        }
    };

    return (
        <main className="min-h-screen bg-slate-950 text-white selection:bg-purple-500/30">
            {/* Background Effects */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-purple-900/20 blur-[120px] rounded-full" />
                <div className="absolute top-[20%] -right-[10%] w-[30%] h-[30%] bg-blue-900/10 blur-[100px] rounded-full" />
            </div>

            <section className="relative mx-auto flex w-full max-w-5xl flex-col gap-12 px-6 py-20">
                <div className="text-center space-y-4">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 text-sm font-medium">
                        <Sparkles className="w-4 h-4" />
                        <span>Pricing Plans</span>
                    </div>
                    <h1 className="text-4xl md:text-5xl font-bold tracking-tight bg-gradient-to-b from-white to-white/60 bg-clip-text text-transparent">
                        Unlock the full potential
                    </h1>
                    <p className="mx-auto max-w-2xl text-lg text-slate-400">
                        Choose the plan that fits your social experience. Upgrade anytime to get premium perks and support Twiky.
                    </p>
                </div>

                <div className="grid gap-8 md:grid-cols-2 mt-8">
                    {plans.map((plan) => (
                        <Card 
                            key={plan.name} 
                            className={`relative flex flex-col h-full bg-slate-900/50 border-slate-800 backdrop-blur-xl transition-all duration-300 hover:border-slate-700 ${
                                plan.isPro ? 'ring-2 ring-purple-500/50 ring-offset-4 ring-offset-slate-950 shadow-2xl shadow-purple-500/10' : ''
                            }`}
                        >
                            {plan.isPro && (
                                <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-gradient-to-r from-purple-600 to-blue-600 text-xs font-bold uppercase tracking-wider text-white shadow-lg">
                                    Most Popular
                                </div>
                            )}

                            <CardHeader className="pt-8">
                                <CardTitle className="text-2xl font-bold text-white">{plan.name}</CardTitle>
                                <CardDescription className="text-slate-400">{plan.description}</CardDescription>
                            </CardHeader>

                            <CardContent className="flex-1 space-y-6">
                                <div className="flex items-baseline gap-1">
                                    <span className="text-5xl font-bold text-white">{plan.price}</span>
                                    {plan.period && <span className="text-slate-400">{plan.period}</span>}
                                </div>

                                <ul className="space-y-4">
                                    {plan.features.map((feature) => (
                                        <li key={feature} className="flex items-start gap-3 text-slate-300">
                                            <div className={`mt-1 flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center ${plan.isPro ? 'bg-purple-500/20 text-purple-400' : 'bg-slate-800 text-slate-500'}`}>
                                                <Check className="w-3.5 h-3.5" />
                                            </div>
                                            <span className="text-sm">{feature}</span>
                                        </li>
                                    ))}
                                </ul>
                            </CardContent>

                            <CardFooter className="pb-8">
                                <Button 
                                    className={`w-full h-12 text-md font-semibold transition-all ${
                                        plan.isPro 
                                            ? 'bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white shadow-lg shadow-purple-500/20 border-0' 
                                            : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-700'
                                    }`}
                                    onClick={() => handleCheckout(plan.id)}
                                    disabled={loading !== null || plan.id === 'free'}
                                >
                                    {loading === plan.id ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            Initializing...
                                        </>
                                    ) : (
                                        plan.cta
                                    )}
                                </Button>
                                {plan.isPro && (
                                <Button
                                        variant="outline"
                                        className="w-full border-slate-700 text-slate-300 hover:bg-slate-800"
                                        onClick={ () => handleManageSubscription()}
                                    >
                                        Manage Subscription
                                    </Button>
                                )}
                            </CardFooter>
                        </Card>
                    ))}
                </div>
            </section>
        </main>
    );
}
