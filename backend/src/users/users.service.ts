import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.module';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class UsersService {
    constructor(
        private readonly supabaseService: SupabaseService,
        private readonly notificationsService: NotificationsService
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

        const { data, error } = await this.supabaseService
            .getClient()
            .from('follows')
            .insert({ follower_id: followerId, following_id: followingId })
            .select()
            .single();

        if (error) throw new Error(`Failed to follow user: ${error.message}`);

        // Trigger Notification
        await this.notificationsService.notify(followingId, followerId, 'FOLLOW', followerId, 'user');

        return data;
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
            .select('follower_id, users!follows_follower_id_fkey(id, username, avatar_url, bio)')
            .eq('following_id', userId);

        if (error) throw new Error(`Failed to get followers: ${error.message}`);
        return data;
    }

    async getFollowing(userId: string) {
        const { data, error } = await this.supabaseService
            .getClient()
            .from('follows')
            .select('following_id, users!follows_following_id_fkey(id, username, avatar_url, bio)')
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

    async searchByPhone(phone: string) {
        const { data, error } = await this.supabaseService
            .getClient()
            .from('users')
            .select('id, username, avatar_url, phone_number')
            .ilike('phone_number', `%${phone}%`);

        if (error) {
            throw new Error(`Error searching for users: ${error.message}`);
        }
        return data;
    }
}
