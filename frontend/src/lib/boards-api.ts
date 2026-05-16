'use client';

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
    throw new Error(body.message ?? body.error ?? `Request failed (${res.status})`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

// ─── Types ───────────────────────────────────────────────────────────────────

export interface BoardTag {
  id: string;
  group_id: string;
  name: string;
  color: string;
  created_at: string;
}

export interface BoardAuthor {
  id: string;
  username: string;
  avatar_url: string | null;
  is_verified: boolean | null;
  sub_plan: string | null;
}

export interface BoardPost {
  id: string;
  group_id: string;
  author_id: string;
  title: string;
  content: string | null;
  media_urls: string[];
  is_pinned: boolean;
  is_locked: boolean;
  last_activity_at: string;
  created_at: string;
  author: BoardAuthor;
  tags: BoardTag[];
  like_count: number;
  comment_count: number;
  is_liked: boolean;
}

export interface BoardComment {
  id: string;
  post_id: string;
  author_id: string;
  content: string;
  media_urls: string[];
  parent_comment_id: string | null;
  created_at: string;
  author: BoardAuthor;
  replies: BoardComment[];
}

// ─── API ─────────────────────────────────────────────────────────────────────

export const boardsApi = {
  // Tags
  getTags: (groupId: string) =>
    authedFetch<BoardTag[]>(`/groups/${groupId}/board-tags`),

  createTag: (groupId: string, data: { name: string; color?: string }) =>
    authedFetch<BoardTag>(`/groups/${groupId}/board-tags`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  deleteTag: (groupId: string, tagId: string) =>
    authedFetch<void>(`/groups/${groupId}/board-tags/${tagId}`, { method: 'DELETE' }),

  // Posts
  getPosts: (groupId: string) =>
    authedFetch<BoardPost[]>(`/groups/${groupId}/board-posts`),

  createPost: (groupId: string, data: { title: string; content?: string; media_urls?: string[]; tag_ids?: string[] }) =>
    authedFetch<BoardPost>(`/groups/${groupId}/board-posts`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getPost: (postId: string) =>
    authedFetch<BoardPost>(`/board-posts/${postId}`),

  updatePost: (postId: string, data: { title?: string; content?: string; is_pinned?: boolean; is_locked?: boolean }) =>
    authedFetch<BoardPost>(`/board-posts/${postId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  deletePost: (postId: string) =>
    authedFetch<void>(`/board-posts/${postId}`, { method: 'DELETE' }),

  likePost: (postId: string) =>
    authedFetch<{ like_count: number }>(`/board-posts/${postId}/likes`, { method: 'POST' }),

  unlikePost: (postId: string) =>
    authedFetch<{ like_count: number }>(`/board-posts/${postId}/likes`, { method: 'DELETE' }),

  // Comments
  getComments: (postId: string) =>
    authedFetch<BoardComment[]>(`/board-posts/${postId}/comments`),

  addComment: (postId: string, data: { content: string; media_urls?: string[]; parent_comment_id?: string | null }) =>
    authedFetch<BoardComment>(`/board-posts/${postId}/comments`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateComment: (commentId: string, content: string) =>
    authedFetch<BoardComment>(`/board-comments/${commentId}`, {
      method: 'PATCH',
      body: JSON.stringify({ content }),
    }),

  deleteComment: (commentId: string) =>
    authedFetch<void>(`/board-comments/${commentId}`, { method: 'DELETE' }),
};
