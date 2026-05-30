import { createClient } from '@/utils/supabase/client';
import type { BackendGroup } from '@/lib/groups-api';

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
    throw new Error((body as { error?: string }).error ?? `Request failed (${res.status})`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export interface WorkspaceProject {
  id: string;
  channel_id: string;
  name: string;
  description: string | null;
  access_type: 'PUBLIC' | 'PRIVATE';
  owner_id: string;
  created_at: string;
  updated_at: string;
  role?: 'OWNER' | 'ADMIN' | 'MEMBER';
}

export interface Whiteboard {
  id: string;
  project_id: string;
  title: string;
  data: Record<string, unknown>;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface ProjectJoinRequest {
  id: string;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED';
  created_at: string;
  user: {
    id: string;
    username: string;
    avatar_url: string | null;
  };
}

export interface ProjectMember {
  role: 'OWNER' | 'ADMIN' | 'MEMBER';
  joined_at: string;
  user: {
    id: string;
    username: string | null;
    avatar_url: string | null;
    sub_plan: string;
    is_verified: boolean | null;
    bio: string | null;
    banner: string | null;
  };
}

export const projectApi = {
  list: (channelId: string) =>
    authedFetch<WorkspaceProject[]>(`/channels/${channelId}/projects`),

  get: (channelId: string, projectId: string) =>
    authedFetch<WorkspaceProject>(`/channels/${channelId}/projects/${projectId}`),

  create: (
    channelId: string,
    body: { name: string; description?: string; access_type?: 'PUBLIC' | 'PRIVATE' },
  ) =>
    authedFetch<WorkspaceProject>(`/channels/${channelId}/projects`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  update: (channelId: string, projectId: string, body: { name?: string; description?: string; access_type?: 'PUBLIC' | 'PRIVATE' }) =>
    authedFetch<WorkspaceProject>(`/channels/${channelId}/projects/${projectId}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),

  delete: (channelId: string, projectId: string) =>
    authedFetch<void>(`/channels/${channelId}/projects/${projectId}`, {
      method: 'DELETE',
    }),

  listGroups: (channelId: string, projectId: string) =>
    authedFetch<BackendGroup[]>(`/channels/${channelId}/projects/${projectId}/groups`),

  createGroup: (
    channelId: string,
    projectId: string,
    body: {
      name: string;
      description?: string;
      group_type: 'text' | 'board' | 'voice' | 'watch';
      access_type: 'PUBLIC' | 'PRIVATE';
    },
  ) =>
    authedFetch<BackendGroup>(`/channels/${channelId}/projects/${projectId}/groups`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  join: (projectId: string) =>
    authedFetch<{ message: string }>(`/projects/${projectId}/join`, {
      method: 'POST',
    }),

  requestJoin: (projectId: string) =>
    authedFetch<{ message: string }>(`/projects/${projectId}/request-join`, {
      method: 'POST',
    }),

  listJoinRequests: (projectId: string) =>
    authedFetch<ProjectJoinRequest[]>(`/projects/${projectId}/join-requests`),

  respondToJoinRequest: (requestId: string, action: 'ACCEPT' | 'REJECT') =>
    authedFetch<{ message: string }>(`/projects/join-requests/${requestId}?action=${action}`, {
      method: 'PATCH',
    }),

  listMembers: (projectId: string) =>
    authedFetch<ProjectMember[]>(`/projects/${projectId}/members`),

  addMember: (projectId: string, userId: string, role: string) =>
    authedFetch<void>(`/projects/${projectId}/members`, {
      method: 'POST',
      body: JSON.stringify({ user_id: userId, role }),
    }),

  removeMember: (projectId: string, userId: string) =>
    authedFetch<void>(`/projects/${projectId}/members/${userId}`, {
      method: 'DELETE',
    }),

  listWhiteboards: (channelId: string, projectId: string) =>
    authedFetch<Whiteboard[]>(`/channels/${channelId}/projects/${projectId}/whiteboards`),

  createWhiteboard: (
    channelId: string,
    projectId: string,
    body: { title?: string; data?: Record<string, unknown> },
  ) =>
    authedFetch<Whiteboard>(`/channels/${channelId}/projects/${projectId}/whiteboards`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  updateWhiteboard: (
    channelId: string,
    projectId: string,
    boardId: string,
    body: { title?: string; data?: Record<string, unknown> },
  ) =>
    authedFetch<Whiteboard>(
      `/channels/${channelId}/projects/${projectId}/whiteboards/${boardId}`,
      { method: 'PATCH', body: JSON.stringify(body) },
    ),

  deleteWhiteboard: (channelId: string, projectId: string, boardId: string) =>
    authedFetch<void>(
      `/channels/${channelId}/projects/${projectId}/whiteboards/${boardId}`,
      { method: 'DELETE' },
    ),
};
