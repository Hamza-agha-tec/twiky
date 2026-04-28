import { Injectable, UnauthorizedException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.module';
import { CreateGroupDto } from './dto/create-group.dto';
 import { AddGroupMemberDto } from './dto/add-group-member.dto';
import { MessagingService } from '../messaging/messaging.service';
import { ChatGateway } from '../messaging/gateway/chat.gateway';

@Injectable()
export class GroupsService {
    constructor(
        private readonly supabaseService: SupabaseService,
        private readonly messagingService: MessagingService,
        private readonly chatGateway: ChatGateway,
    ) { }

    private async isGroupAdmin(groupId: string, userId: string): Promise<boolean> {
        const { data: groupMember } = await this.supabaseService
            .getClient()
            .from('group_members')
            .select('role')
            .eq('group_id', groupId)
            .eq('user_id', userId)
            .single();

        if (groupMember && (groupMember.role === 'OWNER' || groupMember.role === 'ADMIN')) return true;

        const { data: group } = await this.supabaseService
            .getClient()
            .from('groups')
            .select('channel_id')
            .eq('id', groupId)
            .single();

        if (!group) return false;

        const { data: channelMember } = await this.supabaseService
            .getClient()
            .from('channel_members')
            .select('role')
            .eq('channel_id', group.channel_id)
            .eq('user_id', userId)
            .single();

        return !!channelMember && (channelMember.role === 'OWNER' || channelMember.role === 'ADMIN');
    }

    private async emitChannelGroupEvent(
        channelId: string,
        event: 'channelGroupCreated' | 'channelGroupUpdated' | 'channelGroupDeleted',
        payload: Record<string, unknown>,
    ) {
        const { data: members } = await this.supabaseService
            .getClient()
            .from('channel_members')
            .select('user_id')
            .eq('channel_id', channelId);

        for (const member of (members ?? [])) {
            this.chatGateway.server?.to(`user_${member.user_id}`).emit(event, {
                channelId,
                ...payload,
            });
        }
    }

    async createGroup(channelId: string, creatorUserId: string, createGroupDto: CreateGroupDto) {
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
            .insert({
                channel_id: channelId,
                name: createGroupDto.name,
                description: createGroupDto.description,
                is_general: createGroupDto.is_general,
                group_type: createGroupDto.group_type ?? 'text',
                access_type: createGroupDto.access_type ?? 'PUBLIC',
            })
            .select()
            .single();

        if (error) throw new Error(`Failed to create group: ${error.message}`);

        // Auto-assign the creator as ADMIN of this exact private group
        await this.supabaseService
            .getClient()
            .from('group_members')
            .insert({ group_id: data.id, user_id: creatorUserId, role: 'ADMIN' });

        await this.emitChannelGroupEvent(channelId, 'channelGroupCreated', { group: data });

        return data;
    }

    async getGroupsInChannel(channelId: string, userId?: string) {
        const { data, error } = await this.supabaseService
            .getClient()
            .from('groups')
            .select('*')
            .eq('channel_id', channelId)
            .order('created_at', { ascending: true });

        if (error) throw new Error(`Failed to fetch groups: ${error.message}`);

        if (!userId || !data?.length) return data;

        const groupIds = data.map((g: any) => g.id);
        const { data: memberships } = await this.supabaseService
            .getClient()
            .from('group_members')
            .select('group_id')
            .eq('user_id', userId)
            .in('group_id', groupIds);

        const memberSet = new Set((memberships ?? []).map((m: any) => m.group_id));
        return data.map((g: any) => ({ ...g, is_member: memberSet.has(g.id) }));
    }

    async getGroupMembers(groupId: string) {
        const { data, error } = await this.supabaseService
            .getClient()
            .from('group_members')
            .select('role, joined_at, users!group_members_user_id_fkey(id, username, avatar_url, bio, sub_plan)')
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
        await this.emitChannelGroupEvent(group.channel_id, 'channelGroupDeleted', { groupId });
        return { success: true };
    }

    async updateGroup(groupId: string, userId: string, data: { name?: string; description?: string; group_type?: 'text' | 'voice'; access_type?: 'PUBLIC' | 'PRIVATE' }) {
        const { data: group, error: groupError } = await this.supabaseService
            .getClient()
            .from('groups')
            .select('channel_id')
            .eq('id', groupId)
            .single();

        if (groupError || !group) throw new NotFoundException('Group not found');

        const { data: member } = await this.supabaseService
            .getClient()
            .from('channel_members')
            .select('role')
            .eq('channel_id', group.channel_id)
            .eq('user_id', userId)
            .single();

        if (!member || (member.role !== 'OWNER' && member.role !== 'ADMIN')) {
            throw new UnauthorizedException('Only channel Admins or Owners can update groups');
        }

        const { data: updated, error } = await this.supabaseService
            .getClient()
            .from('groups')
            .update(data)
            .eq('id', groupId)
            .select()
            .single();

        if (error) throw new Error(`Failed to update group: ${error.message}`);
        await this.emitChannelGroupEvent(group.channel_id, 'channelGroupUpdated', { group: updated });
        return updated;
    }

    async addMemberToGroup(groupId: string, creatorUserId: string, addGroupMemberDto: AddGroupMemberDto) {
        if (!(await this.isGroupAdmin(groupId, creatorUserId))) {
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
        if (!(await this.isGroupAdmin(groupId, creatorUserId))) {
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
        if (!(await this.isGroupAdmin(groupId, creatorUserId))) {
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

    async requestJoinGroup(groupId: string, userId: string) {
        const { data: group } = await this.supabaseService
            .getClient()
            .from('groups')
            .select('channel_id, access_type, name')
            .eq('id', groupId)
            .single();

        if (!group) throw new NotFoundException('Group not found');
        if (group.access_type !== 'PRIVATE') throw new ForbiddenException('Group is public — join directly');

        const { data: channelMember } = await this.supabaseService
            .getClient()
            .from('channel_members')
            .select('role')
            .eq('channel_id', group.channel_id)
            .eq('user_id', userId)
            .single();

        if (!channelMember) throw new UnauthorizedException('Must be a channel member to request joining');

        const alreadyMember = await this.supabaseService
            .getClient()
            .from('group_members')
            .select('user_id')
            .eq('group_id', groupId)
            .eq('user_id', userId)
            .single();

        if (alreadyMember.data) throw new ForbiddenException('Already a member of this group');

        const { data, error } = await this.supabaseService
            .getClient()
            .from('group_join_requests')
            .upsert({ group_id: groupId, user_id: userId, status: 'PENDING' }, { onConflict: 'group_id,user_id' })
            .select()
            .single();

        if (error) throw new Error(`Failed to create join request: ${error.message}`);

        // Emit real-time event to group admins + channel admins/owners
        const [{ data: groupAdmins }, { data: channelAdmins }, { data: requestUser }] = await Promise.all([
            this.supabaseService.getClient()
                .from('group_members')
                .select('user_id')
                .eq('group_id', groupId)
                .in('role', ['OWNER', 'ADMIN']),
            this.supabaseService.getClient()
                .from('channel_members')
                .select('user_id')
                .eq('channel_id', group.channel_id)
                .in('role', ['OWNER', 'ADMIN']),
            this.supabaseService.getClient()
                .from('users')
                .select('id, username, avatar_url')
                .eq('id', userId)
                .single(),
        ]);

        const notified = new Set<string>();
        for (const admin of [...(groupAdmins ?? []), ...(channelAdmins ?? [])]) {
            if (notified.has(admin.user_id)) continue;
            notified.add(admin.user_id);
            this.chatGateway.server?.to(`user_${admin.user_id}`).emit('groupJoinRequest', {
                requestId: data.id,
                groupId,
                groupName: (group as any).name ?? 'Unknown',
                user: requestUser,
                createdAt: data.created_at,
            });
        }

        return data;
    }

    async getJoinRequests(groupId: string, adminUserId: string) {
        if (!(await this.isGroupAdmin(groupId, adminUserId))) {
            throw new UnauthorizedException('Only group admins can view join requests');
        }

        const { data, error } = await this.supabaseService
            .getClient()
            .from('group_join_requests')
            .select('id, status, created_at, users!group_join_requests_user_id_fkey(id, username, avatar_url)')
            .eq('group_id', groupId)
            .eq('status', 'PENDING')
            .order('created_at', { ascending: true });

        if (error) throw new Error(`Failed to fetch join requests: ${error.message}`);
        return data.map(r => ({ id: r.id, status: r.status, created_at: r.created_at, user: r.users }));
    }

    async respondToJoinRequest(groupId: string, requestId: string, status: 'ACCEPTED' | 'REJECTED', adminUserId: string) {
        if (!(await this.isGroupAdmin(groupId, adminUserId))) {
            throw new UnauthorizedException('Only group admins can respond to join requests');
        }

        const { data: request, error: fetchErr } = await this.supabaseService
            .getClient()
            .from('group_join_requests')
            .select('user_id')
            .eq('id', requestId)
            .eq('group_id', groupId)
            .single();

        if (fetchErr || !request) throw new NotFoundException('Join request not found');

        await this.supabaseService
            .getClient()
            .from('group_join_requests')
            .update({ status })
            .eq('id', requestId);

        if (status === 'ACCEPTED') {
            await this.supabaseService
                .getClient()
                .from('group_members')
                .insert({ group_id: groupId, user_id: request.user_id, role: 'MEMBER' });
            await this.notifyMemberJoined(groupId, request.user_id);

            const { data: groupData } = await this.supabaseService
                .getClient()
                .from('groups')
                .select('channel_id')
                .eq('id', groupId)
                .single();

            this.chatGateway.server?.to(`user_${request.user_id}`).emit('groupJoinAccepted', {
                groupId,
                channelId: groupData?.channel_id ?? null,
            });
        }

        return { success: true, status };
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
