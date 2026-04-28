/** Supabase Storage bucket names — must match buckets in the Supabase dashboard. */
export const STORAGE_BUCKETS = {
  channel: 'channels',
  users: 'users',
  groups: 'groups',
  messages: 'messages',
} as const;

export const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8 MiB
export const MAX_BANNER_BYTES = 20 * 1024 * 1024; // 20 MiB to support animated GIF banners
export const MAX_GROUP_FILE_BYTES = 25 * 1024 * 1024; // 25 MiB
export const MAX_ENTER_SOUND_BYTES = 10 * 1024 * 1024; // 10 MiB — ~1 min at good quality

export const IMAGE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/svg+xml',
]);

export const AUDIO_MIME_TYPES = new Set([
  'audio/mpeg',
  'audio/mp3',
  'audio/ogg',
  'audio/wav',
  'audio/wave',
  'audio/x-wav',
  'audio/aac',
  'audio/mp4',
  'audio/x-m4a',
  'audio/webm',
  'audio/flac',
]);
