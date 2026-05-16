import { createClient } from '@/utils/supabase/client';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080/api';

export type UploadSlotResult = { path: string; publicUrl: string };
export const BANNER_ACCEPT = 'image/png,image/jpeg,image/webp,image/gif,image/svg+xml';

async function getToken(): Promise<string> {
  const supabase = createClient();
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? '';
}

function sanitizeFilename(name: string): string {
  const ext = name.includes('.') ? '.' + name.split('.').pop() : ''
  const base = name.slice(0, name.length - ext.length)
  const clean = base
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\w\s.-]/g, '')
    .replace(/\s+/g, '_')
    .replace(/_{2,}/g, '_')
    .slice(0, 80)
    || 'file'
  return clean + ext
}

function sanitizedFile(file: File): File {
  const safe = sanitizeFilename(file.name)
  if (safe === file.name) return file
  return new File([file], safe, { type: file.type })
}

async function uploadForm(path: string, file: File): Promise<UploadSlotResult> {
  const token = await getToken();
  const form = new FormData();
  form.append('file', sanitizedFile(file));
  const res = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message ?? `Upload failed (${res.status})`);
  }
  const json = await res.json();
  return { path: json.path ?? '', publicUrl: json.publicUrl ?? json.url ?? '' };
}

export const filesApi = {
  uploadChannelBanner: (channelId: string, file: File) =>
    uploadForm(`/files/channels/${channelId}/banner`, file),

  uploadChannelLogo: (channelId: string, file: File) =>
    uploadForm(`/files/channels/${channelId}/logo`, file),

  uploadUserAvatar: (file: File) => uploadForm('/files/users/me/avatar_url', file),

  uploadUserEnterSound: (file: File) => uploadForm('/files/users/me/enter_sound', file),

  /** `users` bucket `logo` slot; use with `users.banner` when that is your header image. */
  uploadUserLogo: (file: File) => uploadForm('/files/users/me/logo', file),
  uploadUserBanner: (file: File) => uploadForm('/files/users/me/logo', file),

  uploadGroupBanner: (groupId: string, file: File) =>
    uploadForm(`/files/groups/${groupId}/banner`, file),

  uploadGroupLogo: (groupId: string, file: File) =>
    uploadForm(`/files/groups/${groupId}/logo`, file),

  uploadGroupPrimaryFile: (groupId: string, file: File) =>
    uploadForm(`/files/groups/${groupId}/file`, file),

  uploadGroupExtra: (groupId: string, file: File) =>
    uploadForm(`/files/groups/${groupId}/files`, file),

  uploadMessageFile: (file: File) =>
    uploadForm('/files/messages/upload', file).then((r) => ({ url: r.publicUrl, path: r.path })),
};
