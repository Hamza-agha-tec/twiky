import { Injectable, ForbiddenException, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.module';
import { StartDirectConversationDto, SendDirectMessageDto } from './dto/direct-messaging.dto';
import { SendGroupMessageDto } from './dto/group-messaging.dto';

@Injectable()
export class MessagingService {
    private readonly logger = new Logger(MessagingService.name);

    constructor(private supabaseService: SupabaseService) {}

    // ==========================================
    // DIRECT MESSAGING
    // ==========================================

    async createDirectConversation(userId: string, dto: StartDirectConversationDto) {
        // Enforce MUTUAL FOLLOW RULE
        // Ensure A follows B
        const { data: followA } = await this.supabaseService
            .getClient()
            .from('follows')
            .select('*')
            .eq('follower_id', userId)
            .eq('following_id', dto.targetUserId)
            .single();

        // Ensure B follows A
        const { data: followB } = await this.supabaseService
            .getClient()
            .from('follows')
            .select('*')
            .eq('follower_id', dto.targetUserId)
            .eq('following_id', userId)
            .single();

        if (!followA || !followB) {
            throw new ForbiddenException("You can only message mutual followers.");
        }

        // Sort alphabetically to prevent duplicate conversations (A->B and B->A)
        const [userOneId, userTwoId] = [userId, dto.targetUserId].sort();

        // Attempt to select first to avoid conflict error breaking the app flow
        const { data: existing } = await this.supabaseService
            .getClient()
            .from('direct_conversations')
            .select('*')
            .eq('user_one_id', userOneId)
            .eq('user_two_id', userTwoId)
            .single();

        if (existing) return existing;

        const { data, error } = await this.supabaseService
            .getClient()
            .from('direct_conversations')
            .insert({ user_one_id: userOneId, user_two_id: userTwoId })
            .select()
            .single();

        if (error) throw new Error(`Failed to create DM: ${error.message}`);
        return data;
    }

    async getDirectConversations(userId: string) {
        // Find where user is user_one OR user_two
        const { data, error } = await this.supabaseService
            .getClient()
            .from('direct_conversations')
            .select(`
                *,
                user_one:users!direct_conversations_user_one_id_fkey(id, username, avatar_url),
                user_two:users!direct_conversations_user_two_id_fkey(id, username, avatar_url)
            `)
            .or(`user_one_id.eq.${userId},user_two_id.eq.${userId}`)
            .order('created_at', { ascending: false });

        if (error) throw new Error(`Failed to fetch inboxes: ${error.message}`);
        return data;
    }

    async sendDirectMessage(userId: string, conversationId: string, dto: SendDirectMessageDto) {
        // Verify user is part of the conversation
        const { data: conv } = await this.supabaseService
            .getClient()
            .from('direct_conversations')
            .select('*')
            .eq('id', conversationId)
            .single();

        if (!conv || (conv.user_one_id !== userId && conv.user_two_id !== userId)) {
            throw new ForbiddenException("You do not belong to this conversation.");
        }

        const { data, error } = await this.supabaseService
            .getClient()
            .from('direct_messages')
            .insert({
                conversation_id: conversationId,
                sender_id: userId,
                content: dto.content,
                file_url: dto.fileUrl || null,
                file_urls: dto.fileUrls || [],
                reply_to_id: dto.replyToId || null,
                entity_mentions: dto.entityMentions || []
            })
            .select('*, sender:users!direct_messages_sender_id_fkey(id, username, avatar_url)')
            .single();

        if (error) throw new Error(`Failed to send DM: ${error.message}`);
        return data;
    }

    async getDirectMessages(userId: string, conversationId: string) {
        const { data: conv } = await this.supabaseService
            .getClient()
            .from('direct_conversations')
            .select('*')
            .eq('id', conversationId)
            .single();

        if (!conv || (conv.user_one_id !== userId && conv.user_two_id !== userId)) {
            throw new ForbiddenException("Access denied.");
        }

        const { data, error } = await this.supabaseService
            .getClient()
            .from('direct_messages')
            .select('*, sender:users!direct_messages_sender_id_fkey(id, username, avatar_url)')
            .eq('conversation_id', conversationId)
            .order('created_at', { ascending: true }); // typically chronologically ordered

        if (error) throw new Error(`Failed to fetch DMs: ${error.message}`);
        return data;
    }

    async editDirectMessage(userId: string, messageId: string, content: string) {
        const { data, error } = await this.supabaseService
            .getClient()
            .from('direct_messages')
            .update({ content, is_edited: true })
            .eq('id', messageId)
            .eq('sender_id', userId)
            .select('*, sender:users!direct_messages_sender_id_fkey(id, username, avatar_url)')
            .single();

        if (error) throw new Error(`Failed to edit DM: ${error.message}`);
        return data;
    }

    async deleteDirectMessage(userId: string, messageId: string) {
        const { error } = await this.supabaseService
            .getClient()
            .from('direct_messages')
            .delete()
            .eq('id', messageId)
            .eq('sender_id', userId);

        if (error) throw new Error(`Failed to delete DM: ${error.message}`);
        return { success: true };
    }

    async updateDirectMessageStatus(messageId: string, status: 'sent' | 'delivered' | 'read') {
        const { error } = await this.supabaseService
            .getClient()
            .from('direct_messages')
            .update({ status })
            .eq('id', messageId);

        // Optionally, don't throw an error if it fails because read receipts aren't critical
        return { success: !error };
    }

    // ==========================================
    // GROUP MESSAGING
    // ==========================================

    private async createMentionNotification(recipientId: string, actorId: string, messageId: string) {
        if (recipientId === actorId) return;

        const { error } = await this.supabaseService
            .getClient()
            .from('notifications')
            .insert({
                recipient_id: recipientId,
                actor_id: actorId,
                type: 'MENTION',
                entity_id: messageId,
                entity_type: 'group_message',
                metadata: {},
            });

        if (error) {
            this.logger.warn(`Failed to create mention notification: ${error.message}`);
        }
    }

    private async notifyMentionRecipients(userId: string, groupId: string, messageId: string, dto: SendGroupMessageDto) {
        const mentions = dto.entityMentions ?? [];
        if (mentions.length === 0) return;

        const hasAllMention = mentions.some((mention) => mention.type === 'all');
        const userMentionIds = mentions
            .filter((mention) => mention.type === 'user')
            .map((mention) => mention.entityId);

        if (!hasAllMention && userMentionIds.length === 0) return;

        const { data: groupMembers, error } = await this.supabaseService
            .getClient()
            .from('group_members')
            .select('user_id')
            .eq('group_id', groupId);

        if (error) {
            this.logger.warn(`Failed to fetch group members for mention notifications: ${error.message}`);
            return;
        }

        const memberIds = new Set((groupMembers ?? []).map((member) => member.user_id));
        const recipientIds = hasAllMention
            ? memberIds
            : new Set(userMentionIds.filter((recipientId) => memberIds.has(recipientId)));

        recipientIds.delete(userId);

        await Promise.all(
            Array.from(recipientIds).map((recipientId) =>
                this.createMentionNotification(recipientId, userId, messageId),
            ),
        );
    }

    async sendGroupMessage(userId: string, groupId: string, dto: SendGroupMessageDto) {
        // Verify user is in the group_members table
        const { data: member } = await this.supabaseService
            .getClient()
            .from('group_members')
            .select('*')
            .eq('group_id', groupId)
            .eq('user_id', userId)
            .single();

        if (!member) {
            throw new ForbiddenException("You are not a member of this group.");
        }

        const userOrAllMentions = dto.entityMentions?.filter((mention) => mention.type === 'user' || mention.type === 'all') ?? [];
        let groupMemberIds: Set<string> | null = null;

        if (userOrAllMentions.length > 0) {
            const { data: groupMembers, error } = await this.supabaseService
                .getClient()
                .from('group_members')
                .select('user_id')
                .eq('group_id', groupId);

            if (error) throw new Error(`Failed to verify group mentions: ${error.message}`);
            groupMemberIds = new Set((groupMembers ?? []).map((groupMember) => groupMember.user_id));
        }

        // Entity Mentions Validation
        if (dto.entityMentions && dto.entityMentions.length > 0) {
            for (const mention of dto.entityMentions) {
                if (mention.type === 'task') {
                    const { data: task } = await this.supabaseService.getClient().from('tasks').select('*').eq('id', mention.entityId).single();
                    if (!task || task.group_id !== groupId) throw new BadRequestException(`Task not found in this group`);
                } else if (mention.type === 'note') {
                    const { data: note } = await this.supabaseService.getClient().from('notes').select('*').eq('id', mention.entityId).single();
                    if (!note || note.group_id !== groupId) throw new BadRequestException(`Note not found in this group`);
                } else if (mention.type === 'goal') {
                    const { data: goal } = await this.supabaseService.getClient().from('goals').select('*').eq('id', mention.entityId).single();
                    if (!goal || goal.group_id !== groupId) throw new BadRequestException(`Goal not found in this group`);
                } else if (mention.type === 'user') {
                    if (!groupMemberIds?.has(mention.entityId)) {
                        throw new BadRequestException(`Mentioned user is not in this group`);
                    }
                } else if (mention.type === 'all') {
                    if (mention.entityId !== groupId) {
                        throw new BadRequestException(`Invalid @all mention target`);
                    }
                } else {
                    throw new BadRequestException(`Unsupported mention type`);
                }
            }
        }

        const { data, error } = await this.supabaseService
            .getClient()
            .from('group_messages')
            .insert({
                group_id: groupId,
                sender_id: userId,
                content: dto.content,
                file_url: dto.fileUrl || null,
                file_urls: dto.fileUrls || [],
                reply_to_id: dto.replyToId || null,
                entity_mentions: dto.entityMentions || []
            })
            .select('*, sender:users!group_messages_sender_id_fkey(id, username, avatar_url)')
            .single();

        if (error) throw new Error(`Failed to send group message: ${error.message}`);
        await this.notifyMentionRecipients(userId, groupId, data.id, dto);
        return data;
    }

    async getGroupMessages(userId: string, groupId: string) {
        const { data: member } = await this.supabaseService
            .getClient()
            .from('group_members')
            .select('*')
            .eq('group_id', groupId)
            .eq('user_id', userId)
            .single();

        if (!member) {
            throw new ForbiddenException("Access denied.");
        }

        const { data, error } = await this.supabaseService
            .getClient()
            .from('group_messages')
            .select('*, sender:users!group_messages_sender_id_fkey(id, username, avatar_url)')
            .eq('group_id', groupId)
            .order('created_at', { ascending: true });

        if (error) throw new Error(`Failed to fetch group messages: ${error.message}`);
        return data;
    }

    async editGroupMessage(userId: string, messageId: string, content: string) {
        const { data, error } = await this.supabaseService
            .getClient()
            .from('group_messages')
            .update({ content, is_edited: true })
            .eq('id', messageId)
            .eq('sender_id', userId)
            .select('*, sender:users!group_messages_sender_id_fkey(id, username, avatar_url)')
            .single();

        if (error) throw new Error(`Failed to edit group message: ${error.message}`);
        return data;
    }

    async deleteGroupMessage(userId: string, messageId: string) {
        const { error } = await this.supabaseService
            .getClient()
            .from('group_messages')
            .delete()
            .eq('id', messageId)
            .eq('sender_id', userId);

        if (error) throw new Error(`Failed to delete group message: ${error.message}`);
        return { success: true };
    }

    async toggleDirectMessageReaction(userId: string, messageId: string, emoji: string) {
        return this.toggleReactionInternal('direct_messages', userId, messageId, emoji);
    }

    async toggleGroupMessageReaction(userId: string, messageId: string, emoji: string) {
        return this.toggleReactionInternal('group_messages', userId, messageId, emoji);
    }

    async toggleGroupMessagePin(userId: string, messageId: string) {
        // Only allow admins or owners to pin? Actually check if user is admin of the group's channel
        const { data: message } = await this.supabaseService.getClient().from('group_messages').select('group_id, is_pinned').eq('id', messageId).single();
        if (!message) throw new NotFoundException('Message not found');

        const { data: group } = await this.supabaseService.getClient().from('groups').select('channel_id').eq('id', message.group_id).single();
        if (!group) throw new NotFoundException('Group not found');

        const { data: member } = await this.supabaseService.getClient().from('channel_members').select('role').eq('channel_id', group.channel_id).eq('user_id', userId).single();

        if (!member || (member.role !== 'OWNER' && member.role !== 'ADMIN')) {
            throw new ForbiddenException("Only Channel Admins or Owners can pin messages.");
        }

        const { data: updated, error } = await this.supabaseService
            .getClient()
            .from('group_messages')
            .update({ is_pinned: !message.is_pinned })
            .eq('id', messageId)
            .select()
            .single();

        if (error) throw new Error(`Failed to toggle pin: ${error.message}`);
        return updated;
    }

    private async toggleReactionInternal(table: string, userId: string, messageId: string, emoji: string) {
        const { data: message, error: fetchError } = await this.supabaseService
            .getClient()
            .from(table)
            .select('reactions')
            .eq('id', messageId)
            .single();

        if (fetchError || !message) throw new NotFoundException('Message not found');

        let reactions = message.reactions || [];
        const reactionIndex = reactions.findIndex((r: any) => r.emoji === emoji);

        if (reactionIndex > -1) {
            const userIndex = reactions[reactionIndex].users.indexOf(userId);
            if (userIndex > -1) {
                // Remove reaction
                reactions[reactionIndex].users.splice(userIndex, 1);
                // If no users left for this emoji, remove the emoji entry entirely
                if (reactions[reactionIndex].users.length === 0) {
                    reactions.splice(reactionIndex, 1);
                }
            } else {
                // Add user to existing emoji
                reactions[reactionIndex].users.push(userId);
            }
        } else {
            // Add new emoji reaction
            reactions.push({ emoji, users: [userId] });
        }

        const { data: updated, error: updateError } = await this.supabaseService
            .getClient()
            .from(table)
            .update({ reactions })
            .eq('id', messageId)
            .select('*, sender:users(id, username, avatar_url)')
            .single();

        if (updateError) throw new Error(`Failed to update reactions: ${updateError.message}`);
        return updated;
    }

    async sendSystemMessage(groupId: string, content: string) {
        const { data, error } = await this.supabaseService
            .getClient()
            .from('group_messages')
            .insert({
                group_id: groupId,
                sender_id: null, // System message
                content: content,
            })
            .select('*, sender:users!group_messages_sender_id_fkey(id, username, avatar_url)')
            .single();

        if (error) throw new Error(`Failed to send system message: ${error.message}`);
        return data;
    }
}
