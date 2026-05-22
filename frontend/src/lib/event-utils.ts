import type { VoiceEvent } from '@/lib/groups-api'

export function buildEventShareLink(
  channelId: string,
  groupId: string,
  eventId: string,
  origin?: string,
): string {
  const base =
    origin ??
    (typeof window !== 'undefined' ? window.location.origin : '') ??
    process.env.NEXT_PUBLIC_APP_URL ??
    'http://localhost:3000'
  return `${base.replace(/\/$/, '')}/channels/${channelId}/group/${groupId}?event=${eventId}`
}

export function getEventShareLink(ev: VoiceEvent): string {
  if (ev.share_link) return ev.share_link
  const channelId = ev.channel_id
  if (!channelId) return ''
  return buildEventShareLink(channelId, ev.group_id, ev.id)
}

export function isEventLive(ev: VoiceEvent): boolean {
  return !!ev.started_at
}

export function getPendingEventForGroup(events: VoiceEvent[], groupId: string): VoiceEvent | null {
  return events.find((e) => e.group_id === groupId && !e.started_at) ?? null
}

export function resolveActiveEvent(
  events: VoiceEvent[],
  groupId: string,
  eventId: string | null,
): VoiceEvent | null {
  if (eventId) {
    const byId = events.find((e) => e.id === eventId)
    if (byId) return byId
  }
  return getPendingEventForGroup(events, groupId)
}
