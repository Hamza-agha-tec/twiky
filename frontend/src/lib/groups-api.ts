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

export interface BackendGroup {
  id: string;
  channel_id: string;
  name: string;
  description: string | null;
  is_general: boolean;
  group_type: 'text' | 'board' | 'voice' | 'watch';
  access_type: 'PUBLIC' | 'PRIVATE';
  created_at: string;
  is_member?: boolean;
}

export interface GroupJoinRequest {
  id: string;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED';
  created_at: string;
  user: { id: string; username: string | null; avatar_url: string | null };
}

export interface GroupMember {
  role: 'OWNER' | 'ADMIN' | 'MEMBER';
  joined_at: string;
  user: {
    id: string;
    email?: string | null;
    fullname?: string | null;
    full_name?: string | null;
    username: string | null;
    avatar_url: string | null;
    banner?: string | null;
    bio: string | null;
    is_verified?: boolean | null;
    sub_plan?: 'FREE' | 'PRO' | 'GEEK' | null;
  };
}

export interface GroupMessage {
  id: string;
  group_id: string;
  sender_id: string;
  content: string;
  file_url: string | null;
  type?: 'voice' | 'image' | 'file' | 'gif' | 'sticker' | null;
  mime?: string | null;
  duration?: number | null;
  size?: number | null;
  reply_to_id: string | null;
  is_pinned?: boolean | null;
  created_at: string;
  reactions?: { emoji: string; users: string[] }[] | null;
  sender?: { id: string; email?: string | null; fullname?: string | null; full_name?: string | null; username: string | null; avatar_url: string | null; is_verified?: boolean | null; sub_plan?: 'FREE' | 'PRO' | 'GEEK' | null };
}

export interface GroupMessageMention {
  type: 'user' | 'all' | 'task' | 'note' | 'goal';
  entityId: string;
}

export const groupsApi = {
  getChannelGroups: (channelId: string) =>
    authedFetch<BackendGroup[]>(`/channels/${channelId}/groups`),

  createGroup: (channelId: string, data: { name: string; description?: string; is_general?: boolean; group_type?: 'text' | 'board' | 'voice' | 'watch'; access_type?: 'PUBLIC' | 'PRIVATE' }) =>
    authedFetch<BackendGroup>(`/channels/${channelId}/groups`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  requestJoinGroup: (groupId: string) =>
    authedFetch(`/groups/${groupId}/join-requests`, { method: 'POST' }),

  getGroupJoinRequests: (groupId: string) =>
    authedFetch<GroupJoinRequest[]>(`/groups/${groupId}/join-requests`),

  respondToJoinRequest: (groupId: string, requestId: string, status: 'ACCEPTED' | 'REJECTED') =>
    authedFetch(`/groups/${groupId}/join-requests/${requestId}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),

  getGroupMembers: (groupId: string) =>
    authedFetch<GroupMember[]>(`/groups/${groupId}/members`),

  addGroupMember: (groupId: string, data: { user_id: string; role?: 'OWNER' | 'ADMIN' | 'MEMBER' }) =>
    authedFetch(`/groups/${groupId}/members`, {
      method: 'POST',
      body: JSON.stringify({ role: 'MEMBER', ...data }),
    }),

  updateMemberRole: (groupId: string, data: { user_id: string; role: 'OWNER' | 'ADMIN' | 'MEMBER' }) =>
    authedFetch(`/groups/${groupId}/members`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  removeGroupMember: (groupId: string, memberId: string) =>
    authedFetch(`/groups/${groupId}/members/${memberId}`, { method: 'DELETE' }),

  getGroupMessages: (groupId: string) =>
    authedFetch<GroupMessage[]>(`/groups/${groupId}/messages`),

  sendGroupMessage: (groupId: string, data: {
    content?: string;
    fileUrl?: string;
    replyToId?: string | null;
    entityMentions?: GroupMessageMention[];
    type?: 'voice' | 'image' | 'file' | 'gif' | 'sticker';
    mime?: string;
    duration?: number;
    size?: number;
  }) =>
    authedFetch<GroupMessage>(`/groups/${groupId}/messages`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  toggleGroupMessageReaction: (messageId: string, emoji: string) =>
    authedFetch<GroupMessage>(`/groups/messages/${messageId}/reactions`, {
      method: 'POST',
      body: JSON.stringify({ emoji }),
    }),

  voteGroupPoll: (messageId: string, optionId: string) =>
    authedFetch<GroupMessage>(`/groups/messages/${messageId}/poll-votes`, {
      method: 'POST',
      body: JSON.stringify({ optionId }),
    }),

  toggleGroupMessagePin: (messageId: string) =>
    authedFetch<GroupMessage>(`/groups/messages/${messageId}/pin`, {
      method: 'PATCH',
    }),

  deleteGroupMessage: (messageId: string) =>
    authedFetch<{ success: boolean; groupId: string; messageId: string }>(`/groups/messages/${messageId}`, {
      method: 'DELETE',
    }),

  updateGroup: (groupId: string, data: { name?: string; description?: string; group_type?: 'text' | 'board' | 'voice' | 'watch'; access_type?: 'PUBLIC' | 'PRIVATE' }) =>
    authedFetch<BackendGroup>(`/groups/${groupId}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  deleteGroup: (groupId: string) =>
    authedFetch(`/groups/${groupId}`, { method: 'DELETE' }),
};
