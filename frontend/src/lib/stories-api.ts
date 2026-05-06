import { createClient } from '@/utils/supabase/client';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3500';

async function getToken(): Promise<string> {
  const supabase = createClient();
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? '';
}

async function apiFetch<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const token = await getToken();
  const res = await fetch(`${API_URL}${path}`, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...opts.headers,
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message ?? `Request failed (${res.status})`);
  }
  return res.json();
}

export interface StoryRaw {
  id: string;
  user_id: string;
  media_url: string;
  type: 'image' | 'video';
  caption?: string | null;
  created_at: string;
  expires_at: string;
  views_count?: Array<{ count: number }>;
  music_preview_url?: string | null;
  music_title?: string | null;
  music_artist?: string | null;
  music_cover_url?: string | null;
}

export interface SpotifyTrack {
  id: string;
  title: string;
  artist: string;
  cover_url: string | null;
  preview_url: string | null;
  duration_ms: number;
}

export async function searchMusicTracks(query: string): Promise<SpotifyTrack[]> {
  const res = await fetch(
    `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=song&limit=12&media=music`,
  );
  if (!res.ok) return [];
  const json = await res.json();
  return (json.results ?? []).map((t: any) => ({
    id: String(t.trackId),
    title: t.trackName ?? '',
    artist: t.artistName ?? '',
    cover_url: t.artworkUrl100?.replace('100x100', '300x300') ?? null,
    preview_url: t.previewUrl ?? null,
    duration_ms: t.trackTimeMillis ?? 0,
  }));
}

export interface FeedGroup {
  user: { id: string; username: string; avatar_url?: string | null; sub_plan?: string | null };
  stories: StoryRaw[];
}

export const storiesApi = {
  async uploadMedia(file: File): Promise<{ publicUrl: string; type: 'image' | 'video' }> {
    const token = await getToken();
    const form = new FormData();
    form.append('file', file);
    const res = await fetch(`${API_URL}/files/stories/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.message ?? `Upload failed (${res.status})`);
    }
    return res.json();
  },

  getFeed(): Promise<FeedGroup[]> {
    return apiFetch('/stories/feed');
  },

  createStory(dto: {
    media_url: string;
    type: 'image' | 'video';
    caption?: string;
    music_preview_url?: string;
    music_title?: string;
    music_artist?: string;
    music_cover_url?: string;
  }): Promise<StoryRaw> {
    return apiFetch('/stories', { method: 'POST', body: JSON.stringify(dto) });
  },

  searchSpotify(q: string): Promise<SpotifyTrack[]> {
    return apiFetch(`/spotify/search?q=${encodeURIComponent(q)}`);
  },

  recordView(storyId: string): Promise<{ success: boolean }> {
    return apiFetch(`/stories/${storyId}/view`, { method: 'POST' });
  },

  deleteStory(storyId: string): Promise<{ success: boolean }> {
    return apiFetch(`/stories/${storyId}`, { method: 'DELETE' });
  },
};
