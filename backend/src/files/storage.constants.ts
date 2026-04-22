/** Supabase Storage bucket names — must match buckets in the Supabase dashboard. */
export const STORAGE_BUCKETS = {
  channel: 'channels',
  users: 'users',
  groups: 'groups',
} as const;

export const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8 MiB
export const MAX_GROUP_FILE_BYTES = 25 * 1024 * 1024; // 25 MiB

export const IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/svg+xml',
]);
