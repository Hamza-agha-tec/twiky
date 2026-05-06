import { SupabaseClient } from '@supabase/supabase-js';

function canSee(setting: string | null | undefined, viewerFollows: boolean): boolean {
  if (setting === 'nobody') return false;
  if (setting === 'everyone') return true;
  return viewerFollows;
}

/**
 * Nulls out avatar_url on user objects whose privacy settings hide it from viewerId.
 * users: array of objects with at least { id, avatar_url }
 * viewerId: the person looking
 */
export async function applyAvatarPrivacyBatch<T extends { id: string; avatar_url?: string | null }>(
  client: SupabaseClient,
  users: T[],
  viewerId?: string | null,
): Promise<T[]> {
  const targets = viewerId ? users.filter((u) => u.id !== viewerId) : users;
  if (!targets.length) return users;

  const ids = [...new Set(targets.map((u) => u.id))];

  const followsQuery = viewerId
    ? client.from('follows').select('following_id').eq('follower_id', viewerId).in('following_id', ids)
    : Promise.resolve({ data: [] });

  const [{ data: settings }, { data: follows }] = await Promise.all([
    client.from('user_settings').select('user_id, who_can_see_my_profile_photo').in('user_id', ids),
    followsQuery,
  ]);

  const settingMap = new Map<string, string>(
    (settings ?? []).map((s) => [s.user_id, s.who_can_see_my_profile_photo ?? 'everyone']),
  );
  const followingSet = new Set((follows ?? []).map((f) => f.following_id));

  return users.map((u) => {
    if (viewerId && u.id === viewerId) return u;
    const visible = canSee(settingMap.get(u.id), followingSet.has(u.id));
    return visible ? u : { ...u, avatar_url: null };
  });
}
