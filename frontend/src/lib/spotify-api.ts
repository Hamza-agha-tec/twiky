import { createClient } from '@/utils/supabase/client';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080/api';

async function getToken(): Promise<string> {
  const supabase = createClient();
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? '';
}

async function authedFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
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
    throw new Error(body.message ?? `Request failed (${res.status})`);
  }
  return res.json();
}

export interface SpotifyAuthUrl {
  url: string;
}

export interface SpotifyNowPlaying {
  is_playing: boolean;
  track?: {
    name: string;
    artist: string;
    album: string;
    album_art: string;
    spotify_url: string;
    progress_ms: number;
    duration_ms: number;
  };
  message?: string;
}

export interface SpotifyTrack {
  name: string;
  artist: string;
  album_art: string;
  spotify_url: string;
}

export interface SpotifyProfile {
  profile: {
    display_name: string;
    images: { url: string }[];
    followers: number;
    spotify_url: string;
  };
  top_tracks: SpotifyTrack[];
  recently_played: (SpotifyTrack & { played_at: string })[];
  playlists: {
    name: string;
    description: string;
    image: string;
    tracks_count: number;
    spotify_url: string;
    owner: string;
  }[];
}

export const spotifyApi = {
  getAuthUrl: () => authedFetch<SpotifyAuthUrl>('/spotify/auth'),

  connect: (code: string) => authedFetch<{ success: boolean }>(`/spotify/connect?code=${encodeURIComponent(code)}`),

  disconnect: () => authedFetch<{ success: boolean }>('/spotify/disconnect', { method: 'DELETE' }),

  getNowPlaying: (userId: string) => authedFetch<SpotifyNowPlaying>(`/spotify/now-playing/${userId}`),

  getProfile: (userId: string) => authedFetch<SpotifyProfile>(`/spotify/profile/${userId}`),
};
