import { Injectable, UnauthorizedException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.module';
import { CreateChannelDto } from './dto/create-channel.dto';
import { UpdateChannelDto } from './dto/update-channel.dto';
 import { AddMemberDto } from './dto/add-member.dto';
import { GroupsService } from '../groups/groups.service';
import { ChatGateway } from '../messaging/gateway/chat.gateway';

@Injectable()
export class ChannelsService {
    constructor(
        private readonly supabaseService: SupabaseService,
        private readonly groupsService: GroupsService,
        private readonly chatGateway: ChatGateway,
    ) {}

    async createChannel(ownerId: string, createChannelDto: CreateChannelDto) {
        const { randomUUID } = await import('crypto');
        const { data, error } = await this.supabaseService
            .getClient()
            .from('channels')
            .insert({ owner_id: ownerId, invite_code: randomUUID(), ...createChannelDto })
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

    async getInviteLink(channelId: string) {
        const { data, error } = await this.supabaseService
            .getClient()
            .from('channels')
            .select('id, name, invite_code')
            .eq('id', channelId)
            .single();

        if (error || !data) throw new NotFoundException(`Channel not found`);
        return {
            channel_id: data.id,
            channel_name: data.name,
            invite_code: data.invite_code,
            path: `/join/${data.invite_code}`,
        };
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

    async discoverChannels(userId: string) {
        const [{ data: memberships }, { data: pendingRequests }] = await Promise.all([
            this.supabaseService.getClient()
                .from('channel_members')
                .select('channel_id')
                .eq('user_id', userId),
            this.supabaseService.getClient()
                .from('invitations')
                .select('entity_id')
                .eq('inviter_id', userId)
                .eq('entity_type', 'CHANNEL_JOIN_REQUEST')
                .eq('status', 'PENDING'),
        ]);

        const joinedIds = new Set((memberships ?? []).map((m: { channel_id: string }) => m.channel_id));
        const requestedIds = new Set((pendingRequests ?? []).map((r: { entity_id: string }) => r.entity_id));

        const { data, error } = await this.supabaseService
            .getClient()
            .from('channels')
            .select('*, channel_members(count)')
            .order('created_at', { ascending: false });

        if (error) throw new Error(`Failed to discover channels: ${error.message}`);

        return (data ?? []).map((ch: any) => ({
            ...ch,
            member_count: ch.channel_members?.[0]?.count ?? 0,
            channel_members: undefined,
            membership_status: joinedIds.has(ch.id) ? 'member' : requestedIds.has(ch.id) ? 'requested' : 'none',
        }));
    }

    async requestJoinChannel(userId: string, channelId: string) {
        const channel = await this.getChannelDetails(channelId);

        if (channel.access_type !== 'PRIVATE') {
            throw new Error('Channel is public. Use the join endpoint instead.');
        }

        const { data: existingMember } = await this.supabaseService
            .getClient()
            .from('channel_members')
            .select('role')
            .eq('channel_id', channelId)
            .eq('user_id', userId)
            .maybeSingle();

        if (existingMember) {
            return { message: 'Already a member of this channel' };
        }

        const { data: existing } = await this.supabaseService
            .getClient()
            .from('invitations')
            .select('id')
            .eq('inviter_id', userId)
            .eq('entity_id', channelId)
            .eq('entity_type', 'CHANNEL_JOIN_REQUEST')
            .eq('status', 'PENDING')
            .maybeSingle();

        if (existing) {
            return { message: 'Join request already pending' };
        }

        const { data, error } = await this.supabaseService
            .getClient()
            .from('invitations')
            .insert({
                inviter_id: userId,
                invitee_id: channel.owner_id,
                entity_type: 'CHANNEL_JOIN_REQUEST',
                entity_id: channelId,
                status: 'PENDING',
            })
            .select()
            .single();

        if (error) throw new Error(`Failed to create join request: ${error.message}`);

        // Emit real-time to channel owner
        const { data: requestUser } = await this.supabaseService.getClient()
            .from('users')
            .select('id, username, avatar_url')
            .eq('id', userId)
            .single();

        this.chatGateway.server?.to(`user_${channel.owner_id}`).emit('channelJoinRequest', {
            requestId: data.id,
            channelId,
            channelName: (channel as any).name ?? 'Unknown',
            user: requestUser,
            createdAt: data.created_at,
        });

        return data;
    }

    async getChannelJoinRequests(channelId: string, adminUserId: string) {
        const { data: member } = await this.supabaseService.getClient()
            .from('channel_members')
            .select('role')
            .eq('channel_id', channelId)
            .eq('user_id', adminUserId)
            .single();

        if (!member || (member.role !== 'OWNER' && member.role !== 'ADMIN')) {
            throw new UnauthorizedException('Only channel admins can view join requests');
        }

        const { data, error } = await this.supabaseService.getClient()
            .from('invitations')
            .select('id, status, created_at, users!invitations_inviter_id_fkey(id, username, avatar_url)')
            .eq('entity_id', channelId)
            .eq('entity_type', 'CHANNEL_JOIN_REQUEST')
            .eq('status', 'PENDING')
            .order('created_at', { ascending: true });

        if (error) throw new Error(`Failed to fetch channel join requests: ${error.message}`);
        return (data ?? []).map((r: any) => ({ id: r.id, status: r.status, created_at: r.created_at, user: r.users }));
    }

    async respondToChannelJoinRequest(channelId: string, requestId: string, status: 'ACCEPTED' | 'REJECTED', adminUserId: string) {
        const { data: member } = await this.supabaseService.getClient()
            .from('channel_members')
            .select('role')
            .eq('channel_id', channelId)
            .eq('user_id', adminUserId)
            .single();

        if (!member || (member.role !== 'OWNER' && member.role !== 'ADMIN')) {
            throw new UnauthorizedException('Only channel admins can respond to join requests');
        }

        const { data: request, error: fetchErr } = await this.supabaseService.getClient()
            .from('invitations')
            .select('inviter_id')
            .eq('id', requestId)
            .eq('entity_id', channelId)
            .eq('entity_type', 'CHANNEL_JOIN_REQUEST')
            .single();

        if (fetchErr || !request) throw new NotFoundException('Join request not found');

        await this.supabaseService.getClient()
            .from('invitations')
            .update({ status })
            .eq('id', requestId);

        if (status === 'ACCEPTED') {
            await this.addMember(channelId, { user_id: (request as any).inviter_id, role: 'MEMBER' });
            this.chatGateway.server?.to(`user_${(request as any).inviter_id}`).emit('channelJoinAccepted', {
                channelId,
            });
        }

        return { success: true, status };
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
