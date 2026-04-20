import { Injectable, UnauthorizedException, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.module';
import { CreateGroupDto } from './dto/create-group.dto';
import { AddGroupMemberDto } from './dto/add-group-member.dto';

@Injectable()
export class GroupsService {
    constructor(private readonly supabaseService: SupabaseService) {}

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

    async addMemberToGroup(groupId: string, addGroupMemberDto: AddGroupMemberDto) {
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
        return data;
    }
}
