import { createClient } from '@/utils/supabase/client';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080/api';

export interface UserProfile {
  id: string;
  email?: string | null;
  username: string | null;
  fullname: string | null;
  full_name?: string | null;
  avatar_url: string | null;
  created_at: string;
  phone_number: string | null;
  bio: string | null;
  status: string | null;
  last_seen_at: string | null;
  banner: string | null;
  website_url: string | null;
  x_url: string | null;
  is_verified?: boolean | null;
  sub_plan?: 'FREE' | 'PRO' | 'GEEK' | null;
  enter_sound_url?: string | null;
}

export interface UserSummary {
  id: string;
  email?: string | null;
  bio: string | null;
  fullname?: string | null;
  full_name?: string | null;
  username: string | null;
  avatar_url: string | null;
  is_verified?: boolean | null;
  sub_plan?: 'FREE' | 'PRO' | 'GEEK' | null;
}

export interface FollowerRecord {
  follower_id: string;
  users: UserSummary;
}

export interface FollowingRecord {
  following_id: string;
  users: UserSummary;
}

export interface UserPost {
  id: string;
  user_id: string;
  caption: string | null;
  media_urls: string[] | null;
  created_at: string;
  users: Pick<UserSummary, 'id' | 'username' | 'avatar_url'>;
}

export type UpdateProfileInput = Partial<
  Pick<UserProfile, 'username' | 'fullname' | 'avatar_url' | 'banner' | 'phone_number' | 'bio' | 'status' | 'website_url' | 'x_url' | 'enter_sound_url'>
>;

async function getToken(): Promise<string> {
  const supabase = createClient();
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? '';
}

function humanizeError(status: number, message?: string): string {
  if (message?.toLowerCase().includes('not found') || status === 404)
    return "We couldn't find anyone with that phone number.";
  if (status === 401 || status === 403)
    return 'You need to be logged in to do that.';
  if (status === 409)
    return 'This item already exists.';
  if (status >= 500)
    return 'Something went wrong on our end. Please try again.';
  return message ?? 'Something went wrong. Please try again.';
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
    throw new Error(humanizeError(res.status, body.message));
  }
  return res.json();
}

export interface UserSearchResult {
  id: string;
  email?: string | null;
  username: string;
  avatar_url: string | null;
  fullname: string | null;
  full_name?: string | null;
  is_verified?: boolean | null;
}

export const userApi = {
  getProfile: () => authedFetch<UserProfile>('/users/profile'),
  getUserById: (id: string) => authedFetch<UserProfile>(`/users/${id}`),
  getUserByUsername: (username: string) => authedFetch<UserProfile>(`/users/username/${username}`),
  updateProfile: (data: UpdateProfileInput) =>
    authedFetch<UserProfile>('/users/profile', { method: 'PATCH', body: JSON.stringify(data) }),
  getSettings: () => authedFetch('/users/settings'),
  updateSettings: (data: {
    theme?: string;
    notifications_enabled?: boolean;
    who_can_see_me_online?: 'everyone' | 'followers' | 'nobody';
    who_can_see_my_last_seen?: 'everyone' | 'followers' | 'nobody';
    who_can_see_my_profile_photo?: 'everyone' | 'followers' | 'nobody';
    who_can_discover_me?: 'everyone' | 'followers' | 'nobody';
    read_confirmation?: boolean;
  }) =>
    authedFetch('/users/settings', { method: 'PATCH', body: JSON.stringify(data) }),
  getFollowers: (userId: string) =>
    authedFetch<FollowerRecord[]>(`/users/${userId}/followers`),
  getFollowing: (userId: string) =>
    authedFetch<FollowingRecord[]>(`/users/${userId}/following`),
  getUserPosts: (userId: string) =>
    authedFetch<UserPost[]>(`/posts/users/${userId}`),
  searchUsers: (username: string) =>
    authedFetch<UserSearchResult[]>(`/users/search?username=${encodeURIComponent(username)}`),
  getMutualFollowers: () =>
    authedFetch<UserSummary[]>('/users/mutual-followers'),
  sendFollowRequest: (userId: string) =>
    authedFetch(`/users/follows/${userId}`, { method: 'POST' }),
};
