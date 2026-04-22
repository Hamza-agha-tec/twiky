import { createClient } from '@/utils/supabase/client';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3500';

export type UploadSlotResult = { path: string; publicUrl: string };

async function getToken(): Promise<string> {
  const supabase = createClient();
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? '';
}

async function uploadForm(path: string, file: File): Promise<UploadSlotResult> {
  const token = await getToken();
  const form = new FormData();
  form.append('file', file);
  const res = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message ?? `Upload failed (${res.status})`);
  }
  return res.json();
}

export const filesApi = {
  uploadChannelBanner: (channelId: string, file: File) =>
    uploadForm(`/files/channels/${channelId}/banner`, file),

  uploadChannelLogo: (channelId: string, file: File) =>
    uploadForm(`/files/channels/${channelId}/logo`, file),

  uploadUserAvatar: (file: File) => uploadForm('/files/users/me/avatar_url', file),

  /** `users` bucket `logo` slot; use with `users.banner` when that is your header image. */
  uploadUserLogo: (file: File) => uploadForm('/files/users/me/logo', file),

  uploadGroupBanner: (groupId: string, file: File) =>
    uploadForm(`/files/groups/${groupId}/banner`, file),

  uploadGroupLogo: (groupId: string, file: File) =>
    uploadForm(`/files/groups/${groupId}/logo`, file),

  uploadGroupPrimaryFile: (groupId: string, file: File) =>
    uploadForm(`/files/groups/${groupId}/file`, file),

  uploadGroupExtra: (groupId: string, file: File) =>
    uploadForm(`/files/groups/${groupId}/files`, file),
};
