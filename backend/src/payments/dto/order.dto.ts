import { IsUUID, IsString, IsNumber, IsEnum, IsOptional, IsEmail, Min, Max } from 'class-validator';

export enum OrderStatus {
  PENDING = 'pending',
  COMPLETED = 'completed',
  FAILED = 'failed',
  EXPIRED = 'expired',
  REFUNDED = 'refunded',
  CANCELLED = 'cancelled'
}

export enum OrderCurrency {
  USD = 'usd',
  EUR = 'eur',
  GBP = 'gbp'
}

export class OrderDto {
  @IsUUID()
  id: string;

  @IsUUID()
  user_id: string;

  @IsNumber()
  @Min(0)
  amount_total: number;

  @IsOptional()
  @IsString()
  payment_id?: string;

  @IsEnum(OrderStatus)
  status: OrderStatus;

  @IsOptional()
  @IsString()
  dodo_order_id?: string;

  @IsOptional()
  @IsEnum(OrderCurrency)
  currency?: OrderCurrency;

  @IsOptional()
  @IsString()
  dodo_invoice_id?: string;

  @IsOptional()
  @IsString()
  dodo_business_id?: string;

  @IsOptional()
  @IsString()
  dodo_brand_id?: string;

  @IsOptional()
  @IsString()
  dodo_checkout_session_id?: string;

  @IsOptional()
  @IsString()
  dodo_payment_link?: string;

  @IsUUID()
  product_id: string;

  created_at: Date;
  updated_at: Date;
}

export class CreateOrderDto {
  @IsUUID()
  product_id: string;

  @IsOptional()
  @IsEnum(OrderCurrency)
  currency?: OrderCurrency;

  @IsOptional()
  @IsString()
  redirect_url?: string;
}

export class UpdateOrderDto {
  @IsOptional()
  @IsEnum(OrderStatus)
  status?: OrderStatus;

  @IsOptional()
  @IsString()
  payment_id?: string;

  @IsOptional()
  @IsString()
  dodo_order_id?: string;

  @IsOptional()
  @IsString()
  dodo_invoice_id?: string;

  @IsOptional()
  @IsString()
  dodo_business_id?: string;

  @IsOptional()
  @IsString()
  dodo_brand_id?: string;

  @IsOptional()
  @IsString()
  dodo_checkout_session_id?: string;

  @IsOptional()
  @IsString()
  dodo_payment_link?: string;
}

export class ProductCheckoutDto {
  @IsUUID()
  product_id: string;

  @IsOptional()
  @IsEnum(OrderCurrency)
  currency?: OrderCurrency;

  @IsOptional()
  @IsString()
  redirect_url?: string;

  @IsOptional()
  @IsString()
  cancel_url?: string;
}

export class WebhookOrderDto {
  @IsString()
  dodo_order_id: string;

  @IsString()
  payment_id: string;

  @IsEnum(OrderStatus)
  status: OrderStatus;

  @IsString()
  dodo_checkout_session_id: string;

  @IsOptional()
  @IsString()
  checkout_url?: string;

  @IsOptional()
  @IsString()
  dodo_invoice_id?: string;

  @IsOptional()
  @IsString()
  dodo_business_id?: string;

  @IsOptional()
  @IsString()
  dodo_brand_id?: string;

  @IsOptional()
  @IsNumber()
  amount_total?: number;

  @IsOptional()
  @IsString()
  currency?: string;
}
