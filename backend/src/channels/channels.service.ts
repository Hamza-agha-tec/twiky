import { Injectable, UnauthorizedException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.module';
import { CreateChannelDto } from './dto/create-channel.dto';
import { UpdateChannelDto } from './dto/update-channel.dto';
 import { AddMemberDto } from './dto/add-member.dto';
import { GroupsService } from '../groups/groups.service';

@Injectable()
export class ChannelsService {
    constructor(
        private readonly supabaseService: SupabaseService,
        private readonly groupsService: GroupsService
    ) {}

    async createChannel(ownerId: string, createChannelDto: CreateChannelDto) {
        const { data, error } = await this.supabaseService
            .getClient()
            .from('channels')
            .insert({ owner_id: ownerId, ...createChannelDto })
            .select()
            .single();

        if (error) throw new Error(`Failed to create channel: ${error.message}`);

        // Trigger auto-creates #general and adds the owner to channel_members implicitly
        // Now, we must ALSO add the user to the `#general` group's group_members:
        const { data: generalGroup } = await this.supabaseService
            .getClient()
            .from('groups')
            .select('id')
            .eq('channel_id', data.id)
            .eq('name', '#general')
            .single();

        if (generalGroup) {
            await this.supabaseService
                .getClient()
                .from('group_members')
                .insert({ group_id: generalGroup.id, user_id: ownerId, role: 'OWNER' });
            
            await this.groupsService.notifyMemberJoined(generalGroup.id, ownerId);
        }

        return data;
    }

    async getUserChannels(userId: string) {
        const { data, error } = await this.supabaseService
            .getClient()
            .from('channel_members')
            .select('role, channels!inner(*)') // !inner filters out rows where related channel doesn't exist just in case
            .eq('user_id', userId)
            .order('joined_at', { ascending: false });

        if (error) throw new Error(`Failed to list channels: ${error.message}`);
        return data.map(m => ({ ...m.channels, role: m.role }));
    }

    async getChannelDetails(channelId: string) {
        const { data, error } = await this.supabaseService
            .getClient()
            .from('channels')
            .select('*')
            .eq('id', channelId)
            .single();

        if (error || !data) throw new NotFoundException(`Channel not found`);
        return data;
    }

    async updateChannel(channelId: string, updateChannelDto: UpdateChannelDto) {
        const { data, error } = await this.supabaseService
            .getClient()
            .from('channels')
            .update(updateChannelDto)
            .eq('id', channelId)
            .select()
            .single();

        if (error) throw new Error(`Failed to update channel: ${error.message}`);
        return data;
    }

    async deleteChannel(userId: string, channelId: string) {
        // Enforce Owner/Admin restriction
        const { data: member } = await this.supabaseService
            .getClient()
            .from('channel_members')
            .select('role')
            .eq('channel_id', channelId)
            .eq('user_id', userId)
            .single();

        if (!member || (member.role !== 'OWNER' && member.role !== 'ADMIN')) {
            throw new UnauthorizedException("Only Channel Admins or Owners can delete a channel.");
        }

        const { error } = await this.supabaseService
            .getClient()
            .from('channels')
            .delete()
            .eq('id', channelId);

        if (error) throw new Error(`Failed to delete channel: ${error.message}`);
        return { success: true };
    }

    async getMembers(channelId: string) {
        const { data, error } = await this.supabaseService
            .getClient()
            .from('channel_members')
            .select('role, joined_at, users!channel_members_user_id_fkey(id, username, avatar_url, bio)')
            .eq('channel_id', channelId);

        if (error) throw new Error(`Failed to get channel members: ${error.message}`);
        return data.map(m => ({
            role: m.role,
            joined_at: m.joined_at,
            user: m.users
        }));
    }

    async addMember(channelId: string, addMemberDto: AddMemberDto) {
        const { data, error } = await this.supabaseService
            .getClient()
            .from('channel_members')
            .insert({
                channel_id: channelId,
                user_id: addMemberDto.user_id,
                role: addMemberDto.role || 'MEMBER'
            })
            .select()
            .single();

        if (error) throw new Error(`Failed to add user to channel: ${error.message}`);

        // Automatically assign this new channel member to the `#general` group
        const { data: generalGroup } = await this.supabaseService
            .getClient()
            .from('groups')
            .select('id')
            .eq('channel_id', channelId)
            .eq('name', '#general')
            .single();

        if (generalGroup) {
            await this.supabaseService
                .getClient()
                .from('group_members')
                // Always default them to MEMBER role internally in the group
                .insert({ group_id: generalGroup.id, user_id: addMemberDto.user_id, role: 'MEMBER' });
            
            await this.groupsService.notifyMemberJoined(generalGroup.id, addMemberDto.user_id);
        }

        return data;
    }

    async kickMember(channelId: string, requesterUserId: string, targetUserId: string) {
        const { data: requester } = await this.supabaseService
            .getClient()
            .from('channel_members')
            .select('role')
            .eq('channel_id', channelId)
            .eq('user_id', requesterUserId)
            .single();

        if (!requester || (requester.role !== 'OWNER' && requester.role !== 'ADMIN')) {
            throw new UnauthorizedException("Only Admins and Owners can kick members from a channel.");
        }

        const { error } = await this.supabaseService
            .getClient()
            .from('channel_members')
            .delete()
            .match({ channel_id: channelId, user_id: targetUserId });

        if (error) throw new Error(`Failed to kick member: ${error.message}`);
        return { success: true };
    }

    async joinChannel(userId: string, channelId: string) {
        const channel = await this.getChannelDetails(channelId);

        if (channel.access_type === 'PRIVATE') {
            throw new ForbiddenException("This channel is private. You need an invite to join.");
        }

        // Check if already a member
        const { data: existingMember } = await this.supabaseService
            .getClient()
            .from('channel_members')
            .select('role')
            .eq('channel_id', channelId)
            .eq('user_id', userId)
            .maybeSingle();

        if (existingMember) {
            return { message: "You are already a member of this channel" };
        }

        return this.addMember(channelId, { user_id: userId, role: 'MEMBER' });
    }
}
