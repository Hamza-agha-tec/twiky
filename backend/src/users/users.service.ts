import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.module';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { NotificationsService } from '../notifications/notifications.service';
import { InvitationsService } from '../invitations/invitations.service';

@Injectable()
export class UsersService {
    constructor(
        private readonly supabaseService: SupabaseService,
        private readonly notificationsService: NotificationsService,
        private readonly invitationsService: InvitationsService,
    ) { }

    async getUserById(id: string) {
        const { data, error } = await this.supabaseService
            .getClient()
            .from('users')
            .select('*')
            .eq('id', id)
            .single();

        if (error || !data) {
            throw new NotFoundException('User not found');
        }

        return data;
    }

    async getUserByUsername(username: string) {
        const { data, error } = await this.supabaseService
            .getClient()
            .from('users')
            .select('*')
            .eq('username', username)
            .single();

        if (error || !data) {
            throw new NotFoundException('User not found');
        }

        return data;
    }

    async updateProfile(id: string, updateData: UpdateUserDto) {
        const { data, error } = await this.supabaseService
            .getClient()
            .from('users')
            .update(updateData)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            throw new Error(`Failed to update profile: ${error.message}`);
        }
        return data;
    }

    async getSettings(userId: string) {
        const { data, error } = await this.supabaseService
            .getClient()
            .from('user_settings')
            .select('*')
            .eq('user_id', userId)
            .single();

        if (error || !data) {
            throw new NotFoundException('Settings not found');
        }
        return data;
    }

    async updateSettings(userId: string, updateData: UpdateSettingsDto) {
        const { data, error } = await this.supabaseService
            .getClient()
            .from('user_settings')
            .update(updateData)
            .eq('user_id', userId)
            .select()
            .single();

        if (error) {
            throw new Error(`Failed to update settings: ${error.message}`);
        }
        return data;
    }

    async followUser(followerId: string, followingId: string) {
        if (followerId === followingId) {
            throw new BadRequestException("You cannot follow yourself.");
        }

        // Check if there is already a follow or a pending invitation
        const { data: existingFollow } = await this.supabaseService
            .getClient()
            .from('follows')
            .select('*')
            .eq('follower_id', followerId)
            .eq('following_id', followingId)
            .maybeSingle();

        if (existingFollow) {
            throw new BadRequestException("You are already following this user.");
        }

        const { data: existingInvite } = await this.supabaseService
            .getClient()
            .from('invitations')
            .select('*')
            .eq('inviter_id', followerId)
            .eq('invitee_id', followingId)
            .eq('entity_type', 'FOLLOW')
            .eq('status', 'PENDING')
            .maybeSingle();

        if (existingInvite) {
            throw new BadRequestException("A follow request is already pending.");
        }

        // Create Invitation instead of direct follow
        return this.invitationsService.createInvitation(followerId, {
            inviteeId: followingId,
            entityType: 'FOLLOW',
            entityId: followerId // We use followerId as entityId for follow requests
        });
    }

    async unfollowUser(followerId: string, followingId: string) {
        const { error } = await this.supabaseService
            .getClient()
            .from('follows')
            .delete()
            .match({ follower_id: followerId, following_id: followingId });

        if (error) throw new Error(`Failed to unfollow user: ${error.message}`);
        return { success: true };
    }

    async getFollowers(userId: string) {
        const { data, error } = await this.supabaseService
            .getClient()
            .from('follows')
            // Using raw select here, client might need to adjust specific relationship alias based on Supabase generated types
            .select('follower_id, users!follows_follower_id_fkey(id, username, avatar_url, bio, sub_plan)')
            .eq('following_id', userId);

        if (error) throw new Error(`Failed to get followers: ${error.message}`);
        return data;
    }

    async getFollowing(userId: string) {
        const { data, error } = await this.supabaseService
            .getClient()
            .from('follows')
            .select('following_id, users!follows_following_id_fkey(id, username, avatar_url, bio, sub_plan)')
            .eq('follower_id', userId);

        if (error) throw new Error(`Failed to get following: ${error.message}`);
        return data;
    }

    async getUsers() {
        const { data, error } = await this.supabaseService
            .getClient()
            .from('users')
            .select('*');

        if (error) {
            throw new Error(error.message);
        }

        return data;
    }

    async findByPhone(phone: string) {
        const { data, error } = await this.supabaseService
            .getClient()
            .from('users')
            .select('*')
            .eq('phone_number', phone)
            .maybeSingle();

        if (error) {
            throw new Error(`Error searching for user: ${error.message}`);
        }
        return data;
    }

    async searchByUsername(username: string, userId: string) {
        const { data, error } = await this.supabaseService
            .getClient()
            .from('users')
            .select('id, username, avatar_url, fullname')
            .ilike('username', `${username}%`)
            .neq('id', userId);

        if (error) {
            throw new Error(`Error searching for users: ${error.message}`);
        }
        return data;
    }

    async getMutualFollowers(userId: string) {
        // Step 1: Get IDs of people I follow
        const { data: following, error: followingError } = await this.supabaseService
            .getClient()
            .from('follows')
            .select('following_id')
            .eq('follower_id', userId);

        if (followingError) throw new Error(followingError.message);
        const followingIds = following.map(f => f.following_id);

        if (followingIds.length === 0) return [];

        // Step 2: From those people, find who also follows me
        const { data: mutuals, error: mutualError } = await this.supabaseService
            .getClient()
            .from('follows')
            .select('follower_id, users!follows_follower_id_fkey(id, username, avatar_url, bio)')
            .in('follower_id', followingIds)
            .eq('following_id', userId);

        if (mutualError) throw new Error(mutualError.message);

        // Map to return the user objects directly
        return mutuals.map((m: any) => m.users);
    }
}
