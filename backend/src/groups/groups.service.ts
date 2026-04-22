import { Injectable, UnauthorizedException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.module';
import { CreateGroupDto } from './dto/create-group.dto';
 import { AddGroupMemberDto } from './dto/add-group-member.dto';
import { MessagingService } from '../messaging/messaging.service';

@Injectable()
export class GroupsService {
    constructor(
        private readonly supabaseService: SupabaseService,
        private readonly messagingService: MessagingService
    ) { }

    async createGroup(channelId: string, creatorUserId: string, createGroupDto: CreateGroupDto) {
        // Enforce channel OWNER/ADMIN restriction for creating groups
        const { data: member } = await this.supabaseService
            .getClient()
            .from('channel_members')
            .select('role')
            .eq('channel_id', channelId)
            .eq('user_id', creatorUserId)
            .single();

        if (!member || (member.role !== 'OWNER' && member.role !== 'ADMIN')) {
            throw new UnauthorizedException("Only Channel Admins or Owners can create groups.");
        }

        const { data, error } = await this.supabaseService
            .getClient()
            .from('groups')
            .insert({ channel_id: channelId, ...createGroupDto })
            .select()
            .single();

        if (error) throw new Error(`Failed to create group: ${error.message}`);

        // Auto-assign the creator as ADMIN of this exact private group
        await this.supabaseService
            .getClient()
            .from('group_members')
            .insert({ group_id: data.id, user_id: creatorUserId, role: 'ADMIN' });

        return data;
    }

    async getGroupsInChannel(channelId: string) {
        const { data, error } = await this.supabaseService
            .getClient()
            .from('groups')
            .select('*')
            .eq('channel_id', channelId)
            .order('created_at', { ascending: true });

        if (error) throw new Error(`Failed to fetch groups: ${error.message}`);
        return data;
    }

    async getGroupMembers(groupId: string) {
        const { data, error } = await this.supabaseService
            .getClient()
            .from('group_members')
            .select('role, joined_at, users!group_members_user_id_fkey(id, username, avatar_url, bio)')
            .eq('group_id', groupId);

        if (error) throw new Error(`Failed to fetch group members: ${error.message}`);
        return data.map(m => ({
            role: m.role,
            joined_at: m.joined_at,
            user: m.users
        }));
    }

    async deleteGroup(groupId: string, userId: string) {
        const { data: group, error: groupError } = await this.supabaseService
            .getClient()
            .from('groups')
            .select('channel_id, is_general')
            .eq('id', groupId)
            .single();

        if (groupError || !group) throw new NotFoundException('Group not found');
        if (group.is_general) throw new ForbiddenException('Cannot delete the general group');

        const { data: member } = await this.supabaseService
            .getClient()
            .from('channel_members')
            .select('role')
            .eq('channel_id', group.channel_id)
            .eq('user_id', userId)
            .single();

        if (!member || (member.role !== 'OWNER' && member.role !== 'ADMIN')) {
            throw new UnauthorizedException('Only channel Admins or Owners can delete groups');
        }

        const { error } = await this.supabaseService
            .getClient()
            .from('groups')
            .delete()
            .eq('id', groupId);

        if (error) throw new Error(`Failed to delete group: ${error.message}`);
        return { success: true };
    }

    async addMemberToGroup(groupId: string, creatorUserId: string, addGroupMemberDto: AddGroupMemberDto) {

        const { data: member } = await this.supabaseService
            .getClient()
            .from('group_members')
            .select('role')
            .eq('group_id', groupId)
            .eq('user_id', creatorUserId)
            .single();

        if (!member || (member.role !== 'OWNER' && member.role !== 'ADMIN')) {
            throw new UnauthorizedException("Only Group Admins or Owners can invite memebers to groups.");
        }

        const { data, error } = await this.supabaseService
            .getClient()
            .from('group_members')
            .insert({
                group_id: groupId,
                user_id: addGroupMemberDto.user_id,
                role: addGroupMemberDto.role || 'MEMBER'
            })
            .select()
            .single();

        if (error) throw new Error(`Failed to add user to group: ${error.message}`);
        
        // Send automated message
        await this.notifyMemberJoined(groupId, addGroupMemberDto.user_id);

        return data;
    }

    async updateGroupMemberRole(groupId: string, creatorUserId: string, addGroupMemberDto: AddGroupMemberDto) {

        const { data: member } = await this.supabaseService
            .getClient()
            .from('group_members')
            .select('role')
            .eq('group_id', groupId)
            .eq('user_id', creatorUserId)
            .single();

        if (!member || (member.role !== 'OWNER' && member.role !== 'ADMIN')) {
            throw new UnauthorizedException("Only Group Admins or Owners can promote or demote other members.");
        }

        const { data, error } = await this.supabaseService
            .getClient()
            .from('group_members')
            .update({
                role: addGroupMemberDto.role
            })
            .eq('group_id', groupId)
            .eq('user_id', addGroupMemberDto.user_id)
            .select()
            .single();

        if (error) throw new Error(`Failed to update user role in group: ${error.message}`);
        return data;
    }

    async deleteGroupMember(groupId: string, creatorUserId: string, memberId: string) {

        const { data: member } = await this.supabaseService
            .getClient()
            .from('group_members')
            .select('role')
            .eq('group_id', groupId)
            .eq('user_id', creatorUserId)
            .single();

        if (!member || (member.role !== 'OWNER' && member.role !== 'ADMIN')) {
            throw new UnauthorizedException("Only Group Admins or Owners can remove other members.");
        }

        const { error } = await this.supabaseService
            .getClient()
            .from('group_members')
            .delete()
            .eq('group_id', groupId)
            .eq('user_id', memberId);

        if (error) throw new Error(`Failed to remove user from group: ${error.message}`);
        return { success: true };
    }

    async notifyMemberJoined(groupId: string, userId: string) {
        const client = this.supabaseService.getClient();

        // Fetch user, group and channel info
        const { data: user } = await client.from('users').select('username').eq('id', userId).single();
        const { data: group } = await client.from('groups').select('name, channel_id').eq('id', groupId).single();
        if (!user || !group) return;

        const { data: channel } = await client.from('channels').select('name').eq('id', group.channel_id).single();
        if (!channel) return;

        const content = `@${user.username} is added to @${group.name} @${channel.name}`;
        await this.messagingService.sendSystemMessage(groupId, content);
    }
}
