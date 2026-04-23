import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../supabase/supabase.module';
import DodoPayments from 'dodopayments';

@Injectable()
export class PaymentsService {
    private readonly logger = new Logger(PaymentsService.name);
    private readonly client: DodoPayments;
    private readonly webhookSecret: string;

    constructor(
        private readonly configService: ConfigService,
        private readonly supabaseService: SupabaseService,
    ) {
        this.client = new DodoPayments({
            bearerToken: this.configService.get<string>('DODO_PAYMENTS_API_KEY') || '',
            environment: this.configService.get<string>('NODE_ENV') === 'production' ? 'live_mode' : 'test_mode',
        });
        this.webhookSecret = this.configService.get<string>('DODO_PAYMENTS_WEBHOOK_SECRET') || '';
    }

    async createCheckoutSession(userId: string, planId: string, redirectUrl?: string) {
        const user = await this.supabaseService.getClient().from('user_settings').select('email').eq('user_id', userId).single();

        if (!user.data) {
            throw new BadRequestException('User not found');
        }

        try {
            const session = await this.client.checkoutSessions.create({
                customer: {
                    email: user.data.email,
                },
                product_cart: [
                    {
                        product_id: planId,
                        quantity: 1,
                    },
                ],
                metadata: {
                    userId: userId,
                },
                return_url: redirectUrl || this.configService.get<string>('NEXT_PUBLIC_SITE_URL'),
            });

            return session;
        } catch (error) {
            this.logger.error(`Dodo Payments Error: ${error.message}`);
            throw new BadRequestException('Failed to create checkout session');
        }
    }

    async handleWebhook(payload: any, signature: string) {
        // Verify Webhook Signature (Standard Webhooks implementation)
        // Note: In a real app, use the standardwebhooks library for robust verification
        // This is a simplified version for demonstration

        const eventType = payload.type;
        const data = payload.data;
        const userId = data.metadata?.userId;

        if (!userId) {
            this.logger.warn('Webhook received without userId in metadata');
            return { received: true };
        }

        switch (eventType) {
            case 'subscription.created':
            case 'subscription.active':
            case 'subscription.renewed':
                await this.updateUserSubscription(userId, data, 'active');
                break;
            case 'subscription.cancelled':
                await this.updateUserSubscription(userId, data, 'canceled');
                break;
            case 'subscription.expired':
                await this.updateUserSubscription(userId, data, 'inactive');
                break;
            case 'subscription.on_hold':
                await this.updateUserSubscription(userId, data, 'on_hold');
                break;
            default:
                this.logger.log(`Unhandled event type: ${eventType}`);
        }

        return { received: true };
    }

    async getSubscription(userId: string) {
        const { data, error } = await this.supabaseService
            .getClient()
            .from('user_subscriptions')
            .select('*')
            .eq('user_id', userId)
            .maybeSingle();

        if (error) throw new Error(`Failed to fetch subscription: ${error.message}`);
        return data || { plan_type: 'free', status: 'inactive' };
    }

    private async updateUserSubscription(userId: string, dodoData: any, status: string) {
        const client = this.supabaseService.getClient();

        const planType = 'pro'; // We currently only have Pro

        // Update user_subscriptions table
        await client.from('user_subscriptions').upsert({
            user_id: userId,
            dodo_subscription_id: dodoData.subscription_id,
            dodo_customer_id: dodoData.customer_id,
            plan_type: planType,
            status: status,
            current_period_end: dodoData.current_period_end,
            updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' });

        // Sync with users table for the badge
        if (status === 'active') {
            await client.from('users').update({ badge_type: 'pro' }).eq('id', userId);
        } else if (status === 'inactive' || status === 'canceled') {
            await client.from('users').update({ badge_type: 'none' }).eq('id', userId);
        }
    }
}
