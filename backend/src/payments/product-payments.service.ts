import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../supabase/supabase.module';
import DodoPayments from 'dodopayments';
import { ProductCheckoutDto, OrderStatus, WebhookOrderDto } from './dto/order.dto';
import { createDodoClient } from './dodo-client.config';

@Injectable()
export class ProductPaymentsService {
    private readonly logger = new Logger(ProductPaymentsService.name);
    private readonly client: DodoPayments;

    constructor(
        private readonly configService: ConfigService,
        private readonly supabaseService: SupabaseService,
    ) {
        this.client = createDodoClient(this.configService);
    }

    private async getOrCreateCustomer(userId: string, email: string): Promise<string> {
        const client = this.supabaseService.getClient();

        // First check user_settings for dodo_customer_id
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
            // Update user_settings with the metadata customer_id
            await client
                .from('user_settings')
                .upsert({
                    user_id: userId,
                    dodo_customer_id: metadataCustomerId,
                    updated_at: new Date().toISOString(),
                });
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

            // Store in user_settings
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
        } catch (error: any) {
            this.logger.error(`Failed to create customer: ${error.message}`);
            throw new BadRequestException('Failed to create payment customer');
        }
    }

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
        } catch (error: any) {
            this.logger.error(`Product checkout error: ${error.message}`);
            throw new BadRequestException('Failed to create checkout session');
        }
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
        
        // Add payment_link from session data if available
        if (webhookData.checkout_url) {
            updateData.dodo_payment_link = webhookData.checkout_url;
        }

        this.logger.log(`Updating order ${order.id} with data: ${JSON.stringify(updateData)}`);
        this.logger.log(`Update data: ${JSON.stringify(updateData)}`);
        
        // Debug: Check what data is actually being sent
        this.logger.log('Final update object being sent:', JSON.stringify(updateData));
        
        // Ensure we only send defined fields to avoid database errors
        const cleanUpdateData: any = {};
        Object.keys(updateData).forEach(key => {
            if (updateData[key] !== undefined) {
                cleanUpdateData[key] = updateData[key];
            }
        });
        
        this.logger.log('Clean update data:', JSON.stringify(cleanUpdateData));
        
        const { data: updatedOrder, error: updateError } = await client
            .from('orders')
            .update(cleanUpdateData)
            .eq('id', order.id)
            .select()
            .single();

        this.logger.log(`Update result: ${JSON.stringify(updatedOrder)}`);
        this.logger.log(`Update error: ${updateError?.message}`);
        this.logger.log(`Supabase update response: ${JSON.stringify({ data: updatedOrder, error: updateError })}`);

        if (updateError) {
            this.logger.error(`Database update failed: ${updateError.message}`);
            this.logger.error(`Update data sent: ${JSON.stringify(cleanUpdateData)}`);
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
}
