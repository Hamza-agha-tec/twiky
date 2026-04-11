'use client';

import { create } from 'zustand';
import { createClient } from '@/utils/supabase/client';

const API_URL = process.env.NEXT_PUBLIC_API_URL;

async function getToken(): Promise<string | null> {
  const supabase = createClient();
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

export interface UserProfile {
  id: string;
  username: string | null;
  phone_number: string | null;
  avatar_url: string | null;
  created_at: string | null;
}

interface UserStore {
  profile: UserProfile | null;
  loading: boolean;
  error: string | null;
  fetchProfile: () => Promise<void>;
  updateProfile: (data: { username?: string; phone_number?: string }) => Promise<void>;
}

export const useUserStore = create<UserStore>((set) => ({
  profile: null,
  loading: false,
  error: null,

  fetchProfile: async () => {
    set({ loading: true, error: null });
    try {
      const token = await getToken();
      const res = await fetch(`${API_URL}/users/profile`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`${res.status}`);
      const data = await res.json();
      set({ profile: data, loading: false });
    } catch (err: unknown) {
      set({ error: (err as Error).message, loading: false });
    }
  },

  updateProfile: async (data) => {
    set({ loading: true, error: null });
    try {
      const token = await getToken();
      const res = await fetch(`${API_URL}/users/profile`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error(`${res.status}`);
      const updated = await res.json();
      set({ profile: updated, loading: false });
    } catch (err: unknown) {
      set({ error: (err as Error).message, loading: false });
    }
  },
}));
