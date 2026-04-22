import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.module';
import { NotificationsService } from '../notifications/notifications.service';
 import { CreateInvitationDto, InvitationStatus } from './dto/invitation.dto';
import { GroupsService } from '../groups/groups.service';

@Injectable()
export class InvitationsService {
    constructor(
        private readonly supabaseService: SupabaseService,
        private readonly notificationsService: NotificationsService,
        private readonly groupsService: GroupsService,
    ) { }

    async createInvitation(inviterId: string, dto: CreateInvitationDto) {
        if (inviterId === dto.inviteeId) {
            throw new BadRequestException("You cannot invite yourself.");
        }

        // 1. Create the invitation in DB
        const { data: invitation, error } = await this.supabaseService
            .getClient()
            .from('invitations')
            .insert({
                inviter_id: inviterId,
                invitee_id: dto.inviteeId,
                entity_type: dto.entityType,
                entity_id: dto.entityId,
                status: 'PENDING'
            })
            .select()
            .single();

        if (error) throw new Error(`Failed to create invitation: ${error.message}`);

        // 2. Fetch entity name for the notification
        let entityName = 'something';
        if (dto.entityType === 'CHANNEL') {
            const { data: channel } = await this.supabaseService.getClient().from('channels').select('name').eq('id', dto.entityId).single();
            entityName = channel?.name || 'a channel';
        } else if (dto.entityType === 'GROUP') {
            const { data: group } = await this.supabaseService.getClient().from('groups').select('name').eq('id', dto.entityId).single();
            entityName = group?.name || 'a group';
        } else if (dto.entityType === 'FOLLOW') {
            entityName = 'follow request';
        }

        // 3. Create notification
        await this.notificationsService.notify(
            dto.inviteeId,
            inviterId,
            'INVITATION',
            invitation.id,
            'invitation'
        );

        return invitation;
    }

    async respondToInvitation(inviteeId: string, invitationId: string, status: InvitationStatus) {
        // 1. Get invitation
        const { data: invitation, error: fetchError } = await this.supabaseService
            .getClient()
            .from('invitations')
            .select('*')
            .eq('id', invitationId)
            .single();

        if (fetchError || !invitation) throw new NotFoundException('Invitation not found');
        if (invitation.invitee_id !== inviteeId) throw new ForbiddenException('This invitation is not for you');
        if (invitation.status !== 'PENDING') throw new BadRequestException('Invitation already processed');

        // 2. Update status
        const { data: updated, error: updateError } = await this.supabaseService
            .getClient()
            .from('invitations')
            .update({ status, updated_at: new Date().toISOString() })
            .eq('id', invitationId)
            .select()
            .single();

        if (updateError) throw new Error(`Failed to update invitation: ${updateError.message}`);

        if (status === InvitationStatus.ACCEPTED) {
            await this.handleAcceptance(inviteeId, invitation);
            await this.notificationsService.notify(
                invitation.inviter_id,
                inviteeId,
                'INVITATION_ACCEPTED',
                invitation.id,
                'invitation'
            );
        } else if (status === InvitationStatus.REJECTED) {
            await this.notificationsService.notify(
                invitation.inviter_id,
                inviteeId,
                'INVITATION_REJECTED',
                invitation.id,
                'invitation'
            );
        }

        return updated;
    }

    async getInvitations(userId: string) {
        const { data, error } = await this.supabaseService
            .getClient()
            .from('invitations')
            .select(`
                *,
                inviter:users!invitations_inviter_id_fkey(id, username, avatar_url)
            `)
            .eq('invitee_id', userId)
            .eq('status', 'PENDING')
            .order('created_at', { ascending: false });

        if (error) throw new Error(`Failed to fetch invitations: ${error.message}`);
        return data;
    }

    private async handleAcceptance(userId: string, invitation: any) {
        const client = this.supabaseService.getClient();

        if (invitation.entity_type === 'CHANNEL') {
            await this.joinChannelInternal(userId, invitation.entity_id);
        } else if (invitation.entity_type === 'CHANNEL_JOIN_REQUEST') {
            // inviter_id is the requester; add them to the channel
            await this.joinChannelInternal(invitation.inviter_id, invitation.entity_id);
        } else if (invitation.entity_type === 'GROUP') {
            // Join channel, #general group, and this specific group
            const { data: group } = await client.from('groups').select('channel_id, is_general').eq('id', invitation.entity_id).single();
            if (!group) throw new NotFoundException('Group not found');

            await this.joinChannelInternal(userId, group.channel_id);

            if (!group.is_general) {
                // Also join the specific group
                await client.from('group_members').upsert({
                    group_id: invitation.entity_id,
                    user_id: userId,
                    role: 'MEMBER'
                });
                
                await this.groupsService.notifyMemberJoined(invitation.entity_id, userId);
            }
        } else if (invitation.entity_type === 'FOLLOW') {
            // MUTUAL FOLLOW: User A follows B AND User B follows A
            const userA = invitation.inviter_id;
            const userB = invitation.invitee_id;

            await client.from('follows').upsert([
                { follower_id: userA, following_id: userB },
                { follower_id: userB, following_id: userA }
            ]);
        }
    }

    private async joinChannelInternal(userId: string, channelId: string) {
        const client = this.supabaseService.getClient();

        // 1. Join channel
        await client.from('channel_members').upsert({
            channel_id: channelId,
            user_id: userId,
            role: 'MEMBER'
        });

        // 2. Join #general group
        const { data: generalGroup } = await client
            .from('groups')
            .select('id')
            .eq('channel_id', channelId)
            .eq('is_general', true)
            .single();

        if (generalGroup) {
            await client.from('group_members').upsert({
                group_id: generalGroup.id,
                user_id: userId,
                role: 'MEMBER'
            });

            await this.groupsService.notifyMemberJoined(generalGroup.id, userId);
        }
    }
}
