import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { IncomingHttpHeaders } from 'http';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../supabase/supabase.module';
import DodoPayments from 'dodopayments';

@Injectable()
export class PaymentsService {
    private readonly logger = new Logger(PaymentsService.name);
    private readonly client: DodoPayments;

    constructor(
        private readonly configService: ConfigService,
        private readonly supabaseService: SupabaseService,
    ) {
        this.client = new DodoPayments({
            bearerToken: this.configService.get<string>('DODO_PAYMENTS_API_KEY') || '',
            environment: 'test_mode',
            webhookKey: this.configService.get<string>('DODO_PAYMENTS_WEBHOOK_SECRET') || '',
        });
    }

    async getOrCreateCustomer(email: string, name?: string) {
        try {
            // Find existing customer
            const customers = await this.client.customers.list({ email });
            if (customers.items && customers.items.length > 0) {
                return customers.items[0];
            }

            // Create new if not found
            return await this.client.customers.create({
                email,
                ...(name ? { name } : {})
            } as any);
        } catch (error) {
            this.logger.error(`Error in getOrCreateCustomer: ${error.message}`);
            return null;
        }
    }

    async createCheckoutSession(userId: string, productId: string, redirectUrl?: string) {
        const client = this.supabaseService.getClient();

        // Get user email and check for existing customer ID in metadata
        const { data: user } = await client.auth.admin.getUserById(userId);
        const email = user?.user?.email;
        const existingCustomerId = user?.user?.user_metadata?.dodo_customer_id;

        if (!email) {
            throw new BadRequestException('User email not found');
        }

        let customerId = existingCustomerId;

        // If not in metadata, try to find or create
        if (!customerId) {
            const customer = await this.getOrCreateCustomer(email);
            customerId = customer?.customer_id;
        }

        try {
            const session = await this.client.checkoutSessions.create({
                customer: customerId ? { customer_id: customerId } : { email: email },
                product_cart: [
                    {
                        product_id: productId,
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

    async getCustomerPortalUrl(userId: string, returnUrl?: string) {
        const client = this.supabaseService.getClient();
        const { data: user } = await client.auth.admin.getUserById(userId);
        const customerId = user?.user?.user_metadata?.dodo_customer_id;

        if (!customerId) {
            throw new BadRequestException('No payment customer found. Please make a purchase first.');
        }

        try {
            const portalSession = await this.client.customers.customerPortal.create(customerId, {
                return_url: returnUrl || this.configService.get<string>('NEXT_PUBLIC_SITE_URL'),
            });
            return { url: portalSession.link };
        } catch (error) {
            this.logger.error(`Failed to create portal session: ${error.message}`);
            throw new BadRequestException('Could not generate billing portal link');
        }
    }

    async handleWebhook(rawPayload: string, headers: IncomingHttpHeaders) {
        try {

            // Securely verify the webhook signature using the SDK
            const event = this.client.webhooks.unwrap(rawPayload, {
                headers: headers as any,
            });

            const eventType = event.type as any;
            const data = event.data as any;
            const userId = data.metadata?.userId;

            if (!userId) {
                this.logger.warn(`Webhook ${eventType} received without userId in metadata`);
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
        } catch (error) {
            this.logger.error(`Webhook Verification Failed: ${error.message}`);
            throw new BadRequestException('Invalid webhook signature');
        }
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

        // Extract data with fallbacks for different Dodo event shapes
        const subscriptionId = dodoData.subscription_id || dodoData.id;
        const customerId = dodoData.customer_id || dodoData.customer?.customer_id || dodoData.customer?.id;
        const periodEnd = dodoData.current_period_end || dodoData.next_billing_date;

        // Update user_subscriptions table
        await client.from('user_subscriptions').upsert({
            user_id: userId,
            dodo_subscription_id: subscriptionId,
            dodo_customer_id: customerId,
            plan_type: 'pro',
            status: status,
            current_period_end: periodEnd,
            updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' });

        // Update users table: Simplified logic
        const subPlan = status === 'active' ? 'PRO' : 'FREE';

        await client.from('users').update({
            sub_plan: subPlan
        }).eq('id', userId);

        // Sync Dodo customer_id to metadata if we found it
        if (customerId) {
            try {
                const { data: user } = await client.auth.admin.getUserById(userId);
                if (user && user.user?.user_metadata?.dodo_customer_id !== customerId) {
                    await client.auth.admin.updateUserById(userId, {
                        user_metadata: {
                            ...user.user?.user_metadata,
                            dodo_customer_id: customerId,
                        },
                    });
                }
            } catch (error) {
                this.logger.error(`Failed to update user metadata: ${error.message}`);
            }
        }
    }
}
