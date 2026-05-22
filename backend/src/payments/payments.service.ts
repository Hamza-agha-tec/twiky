import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { IncomingHttpHeaders } from 'http';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../supabase/supabase.module';
import DodoPayments from 'dodopayments';
import { CreateOrderDto, ProductCheckoutDto, OrderStatus, WebhookOrderDto } from './dto/order.dto';
import { createDodoClient } from './dodo-client.config';

@Injectable()
export class PaymentsService {
    private readonly logger = new Logger(PaymentsService.name);
    private readonly client: DodoPayments;

    constructor(
        private readonly configService: ConfigService,
        private readonly supabaseService: SupabaseService,
    ) {
        this.client = createDodoClient(this.configService);
    }

    private getPlanTypeFromProductId(productId: string): 'PRO' | 'GEEK' {
        const proId = this.configService.get<string>('DODO_PLAN_ID_PRO') || '';
        const geekId = this.configService.get<string>('DODO_PLAN_ID_GEEK') || '';

        if (geekId && productId === geekId) return 'GEEK';
        if (proId && productId === proId) return 'PRO';

        // Back-compat: allow passing literal markers in dev/test.
        if (productId.toLowerCase() === 'geek') return 'GEEK';
        return 'PRO';
    }

    private getPlanTypeFromDodoData(dodoData: any): 'PRO' | 'GEEK' {
        const rawPlanType = String(dodoData?.metadata?.planType ?? '').trim().toLowerCase();
        if (rawPlanType === 'geek') return 'GEEK';
        if (rawPlanType === 'pro') return 'PRO';

        const productIdCandidate =
            dodoData?.product_id ||
            dodoData?.product?.product_id ||
            dodoData?.product?.id ||
            dodoData?.items?.[0]?.product_id ||
            dodoData?.product_cart?.[0]?.product_id;

        if (typeof productIdCandidate === 'string' && productIdCandidate.trim()) {
            return this.getPlanTypeFromProductId(productIdCandidate.trim());
        }

        return 'PRO';
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
            const customer = await this.getOrCreateCustomer(userId, email);
            customerId = customer;
        }

        try {
            const planType = this.getPlanTypeFromProductId(productId);
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
                    planType,
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

        const { data: settings } = await client
            .from('user_settings')
            .select('dodo_customer_id')
            .eq('user_id', userId)
            .maybeSingle();

        const { data: user } = await client.auth.admin.getUserById(userId);
        const customerId =
            settings?.dodo_customer_id ?? user?.user?.user_metadata?.dodo_customer_id;

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
                // Subscription events
                case 'subscription.created':
                case 'subscription.active':
                case 'subscription.renewed':
                case 'subscription.updated':
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
                
                // Product order events
                case 'checkout.session.completed':
                    if (data.metadata?.type === 'product_purchase') {
                        await this.updateOrderFromWebhook({
                            dodo_checkout_session_id: data.id,
                            payment_id: data.payment_id,
                            status: OrderStatus.COMPLETED,
                            dodo_invoice_id: data.invoice_id,
                            dodo_business_id: data.business_id,
                            dodo_brand_id: data.brand_id,
                            amount_total: data.amount_total,
                            currency: data.currency,
                            dodo_order_id: data.order_id
                        });
                    }
                    break;
                    
                case 'payment.succeeded':
                    if (data.metadata?.type === 'product_purchase') {
                        await this.updateOrderFromWebhook({
                            dodo_checkout_session_id: data.checkout_session_id,
                            payment_id: data.payment_id,
                            status: OrderStatus.COMPLETED,
                            dodo_invoice_id: data.invoice_id,
                            dodo_business_id: data.business_id,
                            dodo_brand_id: data.brand_id,
                            amount_total: data.amount_total,
                            currency: data.currency,
                            dodo_order_id: data.order_id
                        });
                    }
                    break;
                    
                case 'payment.failed':
                    if (data.metadata?.type === 'product_purchase') {
                        await this.updateOrderFromWebhook({
                            dodo_checkout_session_id: data.checkout_session_id,
                            payment_id: data.payment_id,
                            status: OrderStatus.FAILED,
                            dodo_order_id: data.order_id
                        });
                    }
                    break;
                    
                case 'checkout.session.expired':
                    if (data.metadata?.type === 'product_purchase') {
                        await this.updateOrderFromWebhook({
                            dodo_checkout_session_id: data.id,
                            payment_id: data.payment_id,
                            status: OrderStatus.EXPIRED,
                            dodo_order_id: data.order_id
                        });
                    }
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
        return data || { plan_type: 'FREE', status: 'inactive' };
    }

    private async updateUserSubscription(userId: string, dodoData: any, status: string) {
        const client = this.supabaseService.getClient();

        // Extract data with fallbacks for different Dodo event shapes
        const subscriptionId = dodoData.subscription_id || dodoData.id;
        const customerId = dodoData.customer_id || dodoData.customer?.customer_id || dodoData.customer?.id;
        const periodEnd = dodoData.current_period_end || dodoData.next_billing_date;

        const planType = this.getPlanTypeFromDodoData(dodoData);

        // Update user_subscriptions table
        const { error: subscriptionError } = await client.from('user_subscriptions').upsert({
            user_id: userId,
            dodo_subscription_id: subscriptionId,
            dodo_customer_id: customerId,
            plan_type: planType,
            status: status,
            current_period_end: periodEnd,
            updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' });

        if (subscriptionError) {
            this.logger.error(
                `Failed to upsert user_subscriptions (userId=${userId}, planType=${planType}, status=${status}): ${subscriptionError.message}`,
            );
        }

        // Update users table: Simplified logic
        const subPlan = status === 'active' ? planType : 'FREE';

        const premiumActive = status === 'active';
        const { error: userUpdateError } = await client
            .from('users')
            .update({
                sub_plan: subPlan,
                ...(premiumActive ? { is_verified: true } : {}),
            })
            .eq('id', userId);

        if (userUpdateError) {
            this.logger.error(
                `Failed to update users plan (userId=${userId}, sub_plan=${subPlan}): ${userUpdateError.message}`,
            );
        }

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

    // ========== ORDER MANAGEMENT METHODS ==========

    async createProductCheckout(userId: string, checkoutDto: ProductCheckoutDto) {
        const client = this.supabaseService.getClient();
        
        // Get product details
        const { data: product, error: productError } = await client
            .from('products')
            .select('*')
            .eq('id', checkoutDto.product_id)
            .eq('active', true)
            .single();

        if (productError || !product) {
            throw new NotFoundException('Product not found or inactive');
        }

        // Get user email and customer info
        const { data: user } = await client.auth.admin.getUserById(userId);
        const email = user?.user?.email;
        const existingCustomerId = user?.user?.user_metadata?.dodo_customer_id;

        this.logger.log(`User data retrieved: ${JSON.stringify({ email, userId, hasEmail: !!email })}`);

        if (!email) {
            throw new BadRequestException('User email not found');
        }

        // Get or create customer
        const customerId = await this.getOrCreateCustomer(userId, email);

        // Calculate final price
        const finalPrice = product.discount && product.discount > 0
            ? product.price * (1 - product.discount / 100)
            : product.price;

        try {
            // Create Dodo checkout session
            const session = await this.client.checkoutSessions.create({
                customer: { customer_id: customerId },
                product_cart: [
                    {
                        product_id: product.dodo_product_id,
                        quantity: 1
                    }
                ],
                metadata: {
                    userId: userId,
                    productId: product.id,
                    type: 'product_purchase'
                },
                return_url: checkoutDto.redirect_url || this.configService.get<string>('NEXT_PUBLIC_SITE_URL'),
            });

            // Create order record
            this.logger.log(`Creating order with email: ${email}, customerId: ${customerId}`);
            const { data: order, error: orderError } = await client
                .from('orders')
                .insert({
                    user_id: userId,
                    customer_email: email,
                    amount_total: finalPrice,
                    currency: checkoutDto.currency?.toUpperCase() || 'USD',
                    product_id: product.id,
                    dodo_checkout_session_id: (session as any).id || 'temp_session_id',
                    status: OrderStatus.PENDING,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                })
                .select()
                .single();

            if (orderError) {
                throw new Error(`Failed to create order: ${orderError.message}`);
            }

            return {
                checkout_url: session.checkout_url,
                order_id: order.id,
                session_id: (session as any).id || 'temp_session_id'
            };
        } catch (error) {
            this.logger.error(`Product checkout error: ${error.message}`);
            throw new BadRequestException('Failed to create checkout session');
        }
    }

    async getOrders(userId: string) {
        const { data, error } = await this.supabaseService
            .getClient()
            .from('orders')
            .select(`
                *,
                products (
                    id,
                    title,
                    description,
                    price,
                    discount,
                    images,
                    category
                )
            `)
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (error) {
            throw new Error(`Failed to fetch orders: ${error.message}`);
        }

        return data || [];
    }

    async getOrderById(userId: string, orderId: string) {
        const { data, error } = await this.supabaseService
            .getClient()
            .from('orders')
            .select(`
                *,
                products (
                    id,
                    title,
                    description,
                    price,
                    discount,
                    images,
                    category
                )
            `)
            .eq('user_id', userId)
            .eq('id', orderId)
            .single();

        if (error || !data) {
            throw new NotFoundException('Order not found');
        }

        return data;
    }

    async updateOrderFromWebhook(webhookData: WebhookOrderDto) {
        const client = this.supabaseService.getClient();

        // Find order by dodo_checkout_session_id
        const { data: order, error: orderError } = await client
            .from('orders')
            .select('*')
            .eq('dodo_checkout_session_id', webhookData.dodo_checkout_session_id)
            .single();

        if (orderError || !order) {
            this.logger.warn(`Order not found for session: ${webhookData.dodo_checkout_session_id}`);
            return null;
        }

        // Update order with webhook data
        const updateData: any = {
            status: webhookData.status,
            updated_at: new Date().toISOString(),
        };

        if (webhookData.payment_id) updateData.payment_id = webhookData.payment_id;
        if (webhookData.dodo_order_id) updateData.dodo_order_id = webhookData.dodo_order_id;
        if (webhookData.dodo_invoice_id) updateData.dodo_invoice_id = webhookData.dodo_invoice_id;
        if (webhookData.dodo_business_id) updateData.dodo_business_id = webhookData.dodo_business_id;
        if (webhookData.dodo_brand_id) updateData.dodo_brand_id = webhookData.dodo_brand_id;
        if (webhookData.amount_total) updateData.amount_total = webhookData.amount_total;
        if (webhookData.currency) updateData.currency = webhookData.currency;

        const { data: updatedOrder, error: updateError } = await client
            .from('orders')
            .update(updateData)
            .eq('id', order.id)
            .select()
            .single();

        if (updateError) {
            throw new Error(`Failed to update order: ${updateError.message}`);
        }

        // If order is completed, increment product sales
        if (webhookData.status === OrderStatus.COMPLETED) {
            await this.incrementProductSales(order.product_id);
        }

        return updatedOrder;
    }

    private async incrementProductSales(productId: string) {
        const client = this.supabaseService.getClient();
        
        // First get current sales, then increment
        const { data: currentProduct } = await client
            .from('products')
            .select('sales')
            .eq('id', productId)
            .single();
        
        const { error } = await client
            .from('products')
            .update({ sales: (currentProduct?.sales || 0) + 1 })
            .eq('id', productId);

        if (error) {
            this.logger.error(`Failed to increment product sales: ${error.message}`);
        }
    }

    private async getOrCreateCustomer(userId: string, email: string): Promise<string> {
        const client = this.supabaseService.getClient();

        // First check if user has dodo_customer_id in user_settings
        const { data: settings, error: settingsError } = await client
            .from('user_settings')
            .select('dodo_customer_id')
            .eq('user_id', userId)
            .single();

        if (!settingsError && settings?.dodo_customer_id) {
            return settings.dodo_customer_id;
        }

        // Check user metadata as fallback
        const { data: user } = await client.auth.admin.getUserById(userId);
        const metadataCustomerId = user?.user?.user_metadata?.dodo_customer_id;
        
        if (metadataCustomerId) {
            // Update user_settings with the customer_id
            await client
                .from('user_settings')
                .update({ dodo_customer_id: metadataCustomerId })
                .eq('user_id', userId);
            return metadataCustomerId;
        }

        // Create new customer
        try {
            const customer = await this.client.customers.create({
                email: email,
                name: email.split('@')[0], // Use email username as name
                metadata: {
                    userId: userId
                }
            });

            // Store customer_id in user_settings
            await client
                .from('user_settings')
                .upsert({
                    user_id: userId,
                    dodo_customer_id: customer.customer_id,
                    updated_at: new Date().toISOString(),
                });

            // Also update user metadata for backward compatibility
            await client.auth.admin.updateUserById(userId, {
                user_metadata: {
                    ...user?.user?.user_metadata,
                    dodo_customer_id: customer.customer_id,
                },
            });

            return customer.customer_id;
        } catch (error) {
            this.logger.error(`Failed to create customer: ${error.message}`);
            throw new BadRequestException('Failed to create payment customer');
        }
    }
}