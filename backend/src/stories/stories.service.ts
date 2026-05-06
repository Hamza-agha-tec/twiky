import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.module';
import { CreateStoryDto } from './dto/create-story.dto';

@Injectable()
export class StoriesService {
  constructor(private readonly supabaseService: SupabaseService) {}

  private canSeeProfilePhoto(setting: string | null | undefined, viewerFollows: boolean): boolean {
    if (setting === 'nobody') return false;
    if (setting === 'everyone') return true;
    return viewerFollows;
  }

  async createStory(userId: string, dto: CreateStoryDto) {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('stories')
      .insert({
        user_id: userId,
        media_url: dto.media_url,
        type: dto.type,
        caption: dto.caption ?? null,
        ...(dto.music_title ? {
          music_title: dto.music_title,
          music_artist: dto.music_artist ?? null,
          music_preview_url: dto.music_preview_url ?? null,
          music_cover_url: dto.music_cover_url ?? null,
        } : {}),
      })
      .select()
      .single();

    if (error) throw new Error(`Failed to create story: ${error.message}`);
    return data;
  }

  async getFeed(userId: string) {
    // 1. Get mutual followers IDs
    // A follows B
    const { data: following } = await this.supabaseService
      .getClient()
      .from('follows')
      .select('following_id')
      .eq('follower_id', userId);

    // B follows A
    const { data: followers } = await this.supabaseService
      .getClient()
      .from('follows')
      .select('follower_id')
      .eq('following_id', userId);

    const followingIds = following?.map(f => f.following_id) || [];
    const followerIds = followers?.map(f => f.follower_id) || [];

    // Intersection = Mutual
    const mutualIds = followingIds.filter(id => followerIds.includes(id));
    
    // Include self in the IDs to see own stories
    const targetIds = [...mutualIds, userId];

    // 2. Fetch active stories for these IDs
    const { data, error } = await this.supabaseService
      .getClient()
      .from('stories')
      .select(`
        *,
        user:users!stories_user_id_fkey(id, username, avatar_url, sub_plan),
        views_count:story_views(count)
      `)
      .in('user_id', targetIds)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: true });

    if (error) throw new Error(`Failed to fetch story feed: ${error.message}`);

    // Fetch photo visibility settings for all story owners (excluding self)
    const ownerIds = [...new Set(data.map(s => s.user.id))].filter(id => id !== userId);
    let hiddenPhotoIds = new Set<string>();
    if (ownerIds.length > 0) {
      const { data: settingsRows } = await this.supabaseService
        .getClient()
        .from('user_settings')
        .select('user_id, who_can_see_my_profile_photo')
        .in('user_id', ownerIds);

      for (const row of settingsRows ?? []) {
        const visibility = row.who_can_see_my_profile_photo ?? 'everyone';
        if (!this.canSeeProfilePhoto(visibility, followingIds.includes(row.user_id))) {
          hiddenPhotoIds.add(row.user_id);
        }
      }
    }

    // Grouping by user for a better frontend experience
    const grouped = data.reduce((acc, story) => {
      const uId = story.user.id;
      if (!acc[uId]) {
        const user = hiddenPhotoIds.has(uId)
          ? { ...story.user, avatar_url: null }
          : story.user;
        acc[uId] = { user, stories: [] };
      }
      acc[uId].stories.push(story);
      return acc;
    }, {});

    return Object.values(grouped);
  }

  async getStoryById(userId: string, storyId: string) {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('stories')
      .select(`
        *,
        user:users!stories_user_id_fkey(id, username, avatar_url)
      `)
      .eq('id', storyId)
      .single();

    if (error || !data) throw new NotFoundException('Story not found');

    // Check mutual follower rule if not owner
    if (data.user_id !== userId) {
        const { data: isFollowed } = await this.supabaseService.getClient().from('follows').select('*').eq('follower_id', userId).eq('following_id', data.user_id).single();
        const { data: isFollowing } = await this.supabaseService.getClient().from('follows').select('*').eq('follower_id', data.user_id).eq('following_id', userId).single();
        
        if (!isFollowed || !isFollowing) {
            throw new ForbiddenException('You can only view stories of mutual followers.');
        }
    }

    return data;
  }

  async recordView(userId: string, storyId: string) {
    await this.supabaseService
      .getClient()
      .from('story_views')
      .upsert({ story_id: storyId, user_id: userId });

    const { data: story } = await this.supabaseService
      .getClient()
      .from('stories')
      .select('user_id')
      .eq('id', storyId)
      .single();

    const { count } = await this.supabaseService
      .getClient()
      .from('story_views')
      .select('*', { count: 'exact', head: true })
      .eq('story_id', storyId);

    return { success: true, ownerId: story?.user_id ?? null, storyId, viewsCount: count ?? 0 };
  }

  async getStoryViewers(userId: string, storyId: string) {
    // Verify ownership
    const { data: story } = await this.supabaseService
      .getClient()
      .from('stories')
      .select('user_id')
      .eq('id', storyId)
      .single();

    if (!story || story.user_id !== userId) {
      throw new ForbiddenException('Only the owner can see the viewers list.');
    }

    const { data, error } = await this.supabaseService
      .getClient()
      .from('story_views')
      .select(`
        viewed_at,
        user:users!story_views_user_id_fkey(id, username, avatar_url)
      `)
      .eq('story_id', storyId)
      .order('viewed_at', { ascending: false });

    if (error) throw new Error(`Failed to fetch viewers: ${error.message}`);
    return data;
  }

  async deleteStory(userId: string, storyId: string) {
    const { error } = await this.supabaseService
      .getClient()
      .from('stories')
      .delete()
      .eq('id', storyId)
      .eq('user_id', userId);

    if (error) throw new Error(`Failed to delete story: ${error.message}`);
    return { success: true };
  }
}
