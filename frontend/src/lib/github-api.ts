import { createClient } from '@/utils/supabase/client'

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080/api'

async function getToken(): Promise<string> {
  const supabase = createClient()
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token ?? ''
}

async function authedFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await getToken()
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...init.headers,
    },
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.error ?? `Request failed (${res.status})`)
  }
  return res.json()
}

export interface GitHubAuthUrl {
  url: string
}

export interface GitHubProfile {
  login: string
  name: string
  avatar_url: string
  html_url: string
  bio: string
  public_repos: number
  followers: number
  following: number
}

export interface GitHubEvent {
  type: 'PushEvent' | 'PullRequestEvent' | 'IssuesEvent' | 'CreateEvent'
  repo: string
  message?: string
  action?: string
  ref_type?: string
  commit_count?: number
  created_at: string
}

export interface GitHubActivity {
  events: GitHubEvent[]
}

export interface GitHubStatus {
  is_coding: boolean
  username: string
}

export const githubApi = {
  getAuthUrl: () => authedFetch<GitHubAuthUrl>('/github/auth'),

  connect: (code: string) =>
    authedFetch<{ message: string; username: string; name: string }>(
      `/github/callback?code=${encodeURIComponent(code)}`,
    ),

  disconnect: () => authedFetch<{ message: string }>('/github/disconnect', { method: 'DELETE' }),

  getProfile: (userId: string) => authedFetch<GitHubProfile>(`/github/profile/${userId}`),

  getActivity: (userId: string) => authedFetch<GitHubActivity>(`/github/activity/${userId}`),

  getStatus: (userId: string) => authedFetch<GitHubStatus>(`/github/status/${userId}`),
}
