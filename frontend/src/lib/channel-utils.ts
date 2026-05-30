export type ChannelKind = 'NORMAL' | 'WORKSPACE';

export function normalizeChannelType(type?: string | null): ChannelKind {
  const t = (type ?? 'NORMAL').toUpperCase();
  return t === 'WORKSPACE' ? 'WORKSPACE' : 'NORMAL';
}

export function isWorkspaceChannel(type?: string | null): boolean {
  return normalizeChannelType(type) === 'WORKSPACE';
}

export const CHANNEL_TONES = [
  'from-sky-500 via-cyan-500 to-blue-600',
  'from-emerald-500 via-teal-500 to-cyan-600',
  'from-orange-500 via-amber-500 to-yellow-500',
  'from-fuchsia-500 via-violet-500 to-indigo-600',
];

export function getChannelTone(seed: string) {
  const index =
    seed.split('').reduce((total, char) => total + char.charCodeAt(0), 0) %
    CHANNEL_TONES.length;
  return CHANNEL_TONES[index];
}

export function getChannelMonogram(label: string) {
  const words = label.split(/\s+/).filter(Boolean);
  if (words.length >= 2) return `${words[0][0]}${words[1][0]}`.toUpperCase();
  return label.slice(0, 2).toUpperCase() || 'CH';
}

export function versionedAssetUrl(url: string) {
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}v=${Date.now()}`;
}
