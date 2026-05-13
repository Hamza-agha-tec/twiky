import { createClient } from '@/utils/supabase/client';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080/api';

export interface Product {
  id: string;
  title: string;
  description: string;
  price: number;
  category: 'ROOM_ITEM' | 'STICKER' | 'THEME' | null;
  features: Record<string, unknown>;
  slug: string;
  active: boolean;
  sales: number;
  discount: number;
  images: Record<string, unknown>;
  metadata: Record<string, unknown>;
  created_at: string;
}

async function getToken(): Promise<string> {
  const supabase = createClient();
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? '';
}

async function authedFetch<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await getToken();
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...init.headers,
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message ?? 'Request failed');
  }
  return res.json();
}

export const notificationsApi = {
  getAll: () => authedFetch<Product[]>('/products')
};
