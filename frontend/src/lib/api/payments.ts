import { createClient } from '@/utils/supabase/client';

interface ProductCheckoutRequest {
  product_id: string;
  currency?: string;
  redirect_url?: string;
  cancel_url?: string;
}

interface ProductCheckoutResponse {
  checkout_url: string;
  order_id: string;
  session_id: string;
}

interface Order {
  id: string;
  user_id: string;
  amount_total: number;
  payment_id?: string;
  status: 'pending' | 'completed' | 'failed' | 'expired' | 'refunded' | 'cancelled';
  dodo_order_id?: string;
  currency?: string;
  dodo_invoice_id?: string;
  dodo_business_id?: string;
  dodo_brand_id?: string;
  dodo_checkout_session_id?: string;
  dodo_payment_link?: string;
  product_id: string;
  created_at: string;
  updated_at: string;
  products?: {
    id: string;
    title: string;
    description: string;
    price: number;
    discount?: number;
    images?: any;
    category: string;
  };
}

async function getToken(): Promise<string> {
  const supabase = createClient();
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? '';
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080/api';

class PaymentsAPI {
  private async request<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const token = await getToken();
    const url = `${API_BASE_URL}/payments${endpoint}`;
    
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': token ? `Bearer ${token}` : '',
        ...options?.headers,
      },
      ...options,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Unknown error' }));
      throw new Error(error.message || `HTTP error! status: ${response.status}`);
    }

    return response.json();
  }

  async createProductCheckout(checkoutData: ProductCheckoutRequest): Promise<ProductCheckoutResponse> {
    return this.request<ProductCheckoutResponse>('/checkout/product', {
      method: 'POST',
      body: JSON.stringify(checkoutData),
    });
  }

  async getOrders(): Promise<Order[]> {
    return this.request<Order[]>('/orders');
  }

  async getOrderById(orderId: string): Promise<Order> {
    return this.request<Order>(`/orders/${orderId}`);
  }

  
}

export const paymentsAPI = new PaymentsAPI();
