import { Injectable, ForbiddenException, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.module';
import { applyAvatarPrivacyBatch } from '../common/avatar-privacy.util';
import { StartDirectConversationDto, SendDirectMessageDto } from './dto/direct-messaging.dto';
import { SendGroupMessageDto } from './dto/group-messaging.dto';

@Injectable()
export class MessagingService {
    private readonly logger = new Logger(MessagingService.name);
    private readonly feedPollPrefix = '__twiky_poll__:';

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
        const client = this.supabaseService.getClient();
        const { data, error } = await client
            .from('direct_conversations')
            .select(`
                *,
                user_one:users!direct_conversations_user_one_id_fkey(id, username, avatar_url, banner, sub_plan, is_verified, last_seen_at),
                user_two:users!direct_conversations_user_two_id_fkey(id, username, avatar_url, banner, sub_plan, is_verified, last_seen_at),
                last_message:direct_messages!direct_messages_conversation_id_fkey(id, content, type, file_url, sender_id, created_at)
            `)
            .or(`user_one_id.eq.${userId},user_two_id.eq.${userId}`)
            .order('created_at', { foreignTable: 'direct_messages', ascending: false })
            .limit(1, { foreignTable: 'direct_messages' })
            .order('created_at', { ascending: false });

        if (error) throw new Error(`Failed to fetch inboxes: ${error.message}`);

        // Apply avatar privacy: collect both participants, filter, re-attach
        const allPartners = (data ?? []).flatMap((c: any) => [c.user_one, c.user_two]).filter(Boolean);
        const privacyApplied = await applyAvatarPrivacyBatch(client, allPartners, userId);
        const privacyMap = new Map(privacyApplied.map((u: any) => [u.id, u]));
        const privacyData = (data ?? []).map((c: any) => ({
            ...c,
            user_one: privacyMap.get(c.user_one?.id) ?? c.user_one,
            user_two: privacyMap.get(c.user_two?.id) ?? c.user_two,
        }));

        const conversations = await this.applyLastSeenVisibility(userId, privacyData);
        const conversationIds = conversations.map((conversation) => conversation.id);
        if (!conversationIds.length) return conversations;

        const { data: unreadMessages, error: unreadError } = await client
            .from('direct_messages')
            .select('conversation_id')
            .in('conversation_id', conversationIds)
            .neq('sender_id', userId)
            .or('status.is.null,status.neq.read');

        if (unreadError) throw new Error(`Failed to fetch unread counts: ${unreadError.message}`);

        const unreadByConversation = new Map<string, number>();
        for (const message of unreadMessages ?? []) {
            unreadByConversation.set(
                message.conversation_id,
                (unreadByConversation.get(message.conversation_id) ?? 0) + 1,
            );
        }

        return conversations.map((conversation) => ({
            ...conversation,
            unread_count: unreadByConversation.get(conversation.id) ?? 0,
        }));
    }

    async updateUserLastSeen(userId: string, lastSeenAt = new Date().toISOString()) {
        const { error } = await this.supabaseService
            .getClient()
            .from('users')
            .update({ last_seen_at: lastSeenAt })
            .eq('id', userId);

        if (error) {
            this.logger.warn(`Failed to update last_seen_at for ${userId}: ${error.message}`);
        }

        return lastSeenAt;
    }

    async getVisibleLastSeenMap(viewerUserId: string, targetUserIds: string[]) {
        const targetIds = Array.from(new Set(targetUserIds.filter((id) => id && id !== viewerUserId)));
        if (!targetIds.length) return {};

        const client = this.supabaseService.getClient();
        const [{ data: users }, { data: settings }, { data: follows }] = await Promise.all([
            client
                .from('users')
                .select('id, last_seen_at')
                .in('id', targetIds),
            client
                .from('user_settings')
                .select('user_id, who_can_see_my_last_seen')
                .in('user_id', targetIds),
            client
                .from('follows')
                .select('following_id')
                .eq('follower_id', viewerUserId)
                .in('following_id', targetIds),
        ]);

        const settingsByUserId = new Map((settings ?? []).map((setting: any) => [setting.user_id, setting]));
        const followedIds = new Set((follows ?? []).map((follow: any) => follow.following_id));
        const result: Record<string, string> = {};

        for (const user of users ?? []) {
            const visibility = settingsByUserId.get(user.id)?.who_can_see_my_last_seen ?? 'followers';
            if (user.last_seen_at && this.canSeeLastSeen(visibility, followedIds.has(user.id))) {
                result[user.id] = user.last_seen_at;
            }
        }

        return result;
    }

    async getVisibleOnlineUserIds(viewerUserId: string, onlineUserIds: string[]) {
        const targetIds = Array.from(new Set(onlineUserIds.filter((id) => id && id !== viewerUserId)));
        if (!targetIds.length) return [];

        const client = this.supabaseService.getClient();
        const [{ data: settings }, { data: follows }] = await Promise.all([
            client
                .from('user_settings')
                .select('user_id, who_can_see_me_online')
                .in('user_id', targetIds),
            client
                .from('follows')
                .select('following_id')
                .eq('follower_id', viewerUserId)
                .in('following_id', targetIds),
        ]);

        const settingsByUserId = new Map((settings ?? []).map((setting: any) => [setting.user_id, setting]));
        const followedIds = new Set((follows ?? []).map((follow: any) => follow.following_id));

        return targetIds.filter((id) => {
            const visibility = settingsByUserId.get(id)?.who_can_see_me_online ?? 'everyone';
            if (visibility === 'nobody') return false;
            if (visibility === 'followers') return followedIds.has(id);
            return true;
        });
    }

    private canSeeLastSeen(setting: string | null | undefined, viewerFollowsTarget: boolean) {
        if (setting === 'nobody') return false;
        if (setting === 'everyone') return true;
        return viewerFollowsTarget;
    }

    async applyMessageSenderAvatarPrivacy<T extends { sender?: any | null }>(
        message: T,
        viewerId?: string | null,
    ): Promise<T> {
        if (!message?.sender?.id) return message;
        const [sender] = await applyAvatarPrivacyBatch(
            this.supabaseService.getClient(),
            [message.sender],
            viewerId,
        );
        return { ...message, sender };
    }

    async applyMessageSenderAvatarPrivacyBatch<T extends { sender?: any | null }>(
        messages: T[],
        viewerId?: string | null,
    ): Promise<T[]> {
        const senders = messages.map((message) => message.sender).filter((sender) => sender?.id);
        if (!senders.length) return messages;

        const filtered = await applyAvatarPrivacyBatch(this.supabaseService.getClient(), senders, viewerId);
        const senderMap = new Map(filtered.map((sender: any) => [sender.id, sender]));

        return messages.map((message) => ({
            ...message,
            sender: message.sender?.id ? (senderMap.get(message.sender.id) ?? message.sender) : message.sender,
        }));
    }

    private async applyLastSeenVisibility(userId: string, conversations: any[]) {
        const targetIds = Array.from(new Set(
            conversations
                .flatMap((conversation) => [conversation.user_one_id, conversation.user_two_id])
                .filter((id) => id && id !== userId),
        ));

        if (targetIds.length === 0) return conversations;

        const client = this.supabaseService.getClient();
        const [{ data: settings }, { data: follows }] = await Promise.all([
            client
                .from('user_settings')
                .select('user_id, who_can_see_my_last_seen')
                .in('user_id', targetIds),
            client
                .from('follows')
                .select('following_id')
                .eq('follower_id', userId)
                .in('following_id', targetIds),
        ]);

        const settingsByUserId = new Map((settings ?? []).map((setting: any) => [setting.user_id, setting]));
        const followedIds = new Set((follows ?? []).map((follow: any) => follow.following_id));

        const decorateUser = (user: any) => {
            if (!user?.id || user.id === userId) return user;

            const lastSeenVisibility = settingsByUserId.get(user.id)?.who_can_see_my_last_seen ?? 'followers';
            const canSee = this.canSeeLastSeen(lastSeenVisibility, followedIds.has(user.id));

            return {
                ...user,
                who_can_see_my_last_seen: lastSeenVisibility,
                last_seen_at: canSee ? user.last_seen_at ?? null : null,
                last_seen_hidden: !canSee,
            };
        };

        return conversations.map((conversation) => ({
            ...conversation,
            user_one: decorateUser(conversation.user_one),
            user_two: decorateUser(conversation.user_two),
        }));
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
                content: dto.content ?? '',
                type: dto.type ?? null,
                file_url: dto.fileUrl || null,
                mime: dto.mime ?? null,
                duration: dto.duration ?? null,
                size: dto.size ?? null,
                file_urls: dto.fileUrls || [],
                reply_to_id: dto.replyToId || null,
                entity_mentions: dto.entityMentions || [],
                is_forwarded: dto.isForwarded ?? false
            })
            .select('*, sender:users!direct_messages_sender_id_fkey(id, username, fullname, avatar_url, is_verified, sub_plan)')
            .single();

        if (error) throw new Error(`Failed to send DM: ${error.message}`);
        return this.applyMessageSenderAvatarPrivacy(data, userId);
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
            .select('*, sender:users!direct_messages_sender_id_fkey(id, username, fullname, avatar_url, is_verified, sub_plan), reply_to:reply_to_id(id, content, sender:users!direct_messages_sender_id_fkey(id, username))')
            .eq('conversation_id', conversationId)
            .order('created_at', { ascending: true });

        if (error) throw new Error(`Failed to fetch DMs: ${error.message}`);
        return this.applyMessageSenderAvatarPrivacyBatch(data ?? [], userId);
    }

    async editDirectMessage(userId: string, messageId: string, content: string) {
        const { data, error } = await this.supabaseService
            .getClient()
            .from('direct_messages')
            .update({ content, is_edited: true })
            .eq('id', messageId)
            .eq('sender_id', userId)
            .select('*, sender:users!direct_messages_sender_id_fkey(id, username, fullname, avatar_url, is_verified, sub_plan)')
            .single();

        if (error) throw new Error(`Failed to edit DM: ${error.message}`);
        return this.applyMessageSenderAvatarPrivacy(data, userId);
    }

    async toggleDirectMessagePin(userId: string, messageId: string, conversationId: string) {
        const { data: msg } = await this.supabaseService
            .getClient()
            .from('direct_messages')
            .select('is_pinned, conversation_id')
            .eq('id', messageId)
            .eq('conversation_id', conversationId)
            .single();

        if (!msg) throw new Error('Message not found');

        const { data, error } = await this.supabaseService
            .getClient()
            .from('direct_messages')
            .update({ is_pinned: !msg.is_pinned })
            .eq('id', messageId)
            .select('*, sender:users!direct_messages_sender_id_fkey(id, username, fullname, avatar_url, is_verified, sub_plan)')
            .single();

        if (error) throw new Error(`Failed to pin DM: ${error.message}`);
        return this.applyMessageSenderAvatarPrivacy(data, userId);
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
        const { data: message } = await this.supabaseService
            .getClient()
            .from('direct_messages')
            .select('id, conversation_id, status')
            .eq('id', messageId)
            .single();

        if (!message) return { success: false };
        if (message.status === 'read' && status === 'delivered') {
            return this.getDirectMessageStatusPayload(message.conversation_id, messageId, 'read');
        }

        const { error } = await this.supabaseService
            .getClient()
            .from('direct_messages')
            .update({ status })
            .eq('id', messageId);

        if (error) return { success: false };
        return this.getDirectMessageStatusPayload(message.conversation_id, messageId, status);
    }

    private async getDirectMessageStatusPayload(conversationId: string, messageId: string, status: 'sent' | 'delivered' | 'read') {
        const { data: conversation } = await this.supabaseService
            .getClient()
            .from('direct_conversations')
            .select('user_one_id, user_two_id')
            .eq('id', conversationId)
            .single();

        return {
            success: true,
            conversationId,
            messageId,
            status,
            userOneId: conversation?.user_one_id,
            userTwoId: conversation?.user_two_id,
        };
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
        this.logger.debug(`sendGroupMessage dto=${JSON.stringify(dto)}`);
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

        const payload: any = {
            group_id: groupId,
            sender_id: userId,
            content: dto.content ?? '',
            file_url: dto.fileUrl || null,
            type: dto.type ?? null,
            mime: dto.mime ?? null,
            duration: dto.duration ?? null,
            size: dto.size ?? null,
            file_urls: dto.fileUrls || [],
            reply_to_id: dto.replyToId || null,
            entity_mentions: dto.entityMentions || []
        };

        this.logger.debug(`sendGroupMessage payload=${JSON.stringify(payload)}`);

        const { data, error } = await this.supabaseService
            .getClient()
            .from('group_messages')
            .insert(payload)
            .select('*, sender:users!group_messages_sender_id_fkey(id, username, fullname, avatar_url, is_verified, sub_plan)')
            .single();

        if (error) throw new Error(`Failed to send group message: ${error.message}`);
        await this.notifyMentionRecipients(userId, groupId, data.id, dto);
        return this.applyMessageSenderAvatarPrivacy(data, userId);
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
            .select('*, sender:users!group_messages_sender_id_fkey(id, username, fullname, avatar_url, is_verified, sub_plan)')
            .eq('group_id', groupId)
            .order('created_at', { ascending: true });

        if (error) throw new Error(`Failed to fetch group messages: ${error.message}`);
        return this.applyMessageSenderAvatarPrivacyBatch(data ?? [], userId);
    }

    async editGroupMessage(userId: string, messageId: string, content: string) {
        const { data, error } = await this.supabaseService
            .getClient()
            .from('group_messages')
            .update({ content, is_edited: true })
            .eq('id', messageId)
            .eq('sender_id', userId)
            .select('*, sender:users!group_messages_sender_id_fkey(id, username, fullname, avatar_url, is_verified, sub_plan)')
            .single();

        if (error) throw new Error(`Failed to edit group message: ${error.message}`);
        return this.applyMessageSenderAvatarPrivacy(data, userId);
    }

    async deleteGroupMessage(userId: string, messageId: string) {
        const { data: message, error: fetchError } = await this.supabaseService
            .getClient()
            .from('group_messages')
            .select('group_id')
            .eq('id', messageId)
            .eq('sender_id', userId)
            .single();

        if (fetchError || !message) throw new NotFoundException('Message not found');

        const { error } = await this.supabaseService
            .getClient()
            .from('group_messages')
            .delete()
            .eq('id', messageId)
            .eq('sender_id', userId);

        if (error) throw new Error(`Failed to delete group message: ${error.message}`);
        return { success: true, groupId: message.group_id, messageId };
    }

    async deleteDirectConversation(userId: string, conversationId: string) {
        const client = this.supabaseService.getClient();
        const { data: conv } = await client
            .from('direct_conversations')
            .select('user_one_id, user_two_id')
            .eq('id', conversationId)
            .single();

        if (!conv || (conv.user_one_id !== userId && conv.user_two_id !== userId)) {
            throw new ForbiddenException('Access denied.');
        }

        const { error } = await client
            .from('direct_conversations')
            .delete()
            .eq('id', conversationId);

        if (error) throw new Error(`Failed to delete conversation: ${error.message}`);
        return { success: true };
    }

    async toggleDirectMessageReaction(userId: string, messageId: string, emoji: string) {
        const { data: message, error } = await this.supabaseService
            .getClient()
            .from('direct_messages')
            .select('conversation_id')
            .eq('id', messageId)
            .single();

        if (error || !message) throw new NotFoundException('Message not found');

        const { data: conv } = await this.supabaseService
            .getClient()
            .from('direct_conversations')
            .select('user_one_id, user_two_id')
            .eq('id', message.conversation_id)
            .single();

        if (!conv || (conv.user_one_id !== userId && conv.user_two_id !== userId)) {
            throw new ForbiddenException('Access denied.');
        }

        return this.toggleReactionInternal(
            'direct_messages',
            userId,
            messageId,
            emoji,
            '*, sender:users!direct_messages_sender_id_fkey(id, username, fullname, avatar_url, is_verified, sub_plan)',
        );
    }

    async getDirectConversationParticipantIds(conversationId: string) {
        const { data: conversation, error } = await this.supabaseService
            .getClient()
            .from('direct_conversations')
            .select('user_one_id, user_two_id')
            .eq('id', conversationId)
            .single();

        if (error || !conversation) throw new NotFoundException('Conversation not found');

        return [conversation.user_one_id, conversation.user_two_id].filter(Boolean);
    }

    async toggleGroupMessageReaction(userId: string, messageId: string, emoji: string) {
        const { data: message, error } = await this.supabaseService
            .getClient()
            .from('group_messages')
            .select('group_id')
            .eq('id', messageId)
            .single();

        if (error || !message) throw new NotFoundException('Message not found');

        const { data: member } = await this.supabaseService
            .getClient()
            .from('group_members')
            .select('user_id')
            .eq('group_id', message.group_id)
            .eq('user_id', userId)
            .single();

        if (!member) throw new ForbiddenException('You are not a member of this group.');

        return this.toggleReactionInternal(
            'group_messages',
            userId,
            messageId,
            emoji,
            '*, sender:users!group_messages_sender_id_fkey(id, username, fullname, avatar_url, is_verified, sub_plan)',
        );
    }

    async voteGroupPoll(userId: string, messageId: string, optionId: string) {
        const { data: message, error } = await this.supabaseService
            .getClient()
            .from('group_messages')
            .select('group_id, content')
            .eq('id', messageId)
            .single();

        if (error || !message) throw new NotFoundException('Message not found');

        const { data: member } = await this.supabaseService
            .getClient()
            .from('group_members')
            .select('user_id')
            .eq('group_id', message.group_id)
            .eq('user_id', userId)
            .single();

        if (!member) throw new ForbiddenException('You are not a member of this group.');

        const poll = this.parseFeedPollContent(message.content);
        const target = poll.options.find((option) => option.id === optionId);
        if (!target) throw new BadRequestException('Poll option not found');

        if (poll.allowMultiple) {
            target.voters = target.voters.includes(userId)
                ? target.voters.filter((id) => id !== userId)
                : [...target.voters, userId];
        } else {
            const alreadyVoted = target.voters.includes(userId);
            poll.options = poll.options.map((option) => ({
                ...option,
                voters: option.voters.filter((id) => id !== userId),
            }));
            if (!alreadyVoted) {
                poll.options = poll.options.map((option) =>
                    option.id === optionId ? { ...option, voters: [...option.voters, userId] } : option,
                );
            }
        }

        const content = this.encodeFeedPollContent(poll);
        const { data: updated, error: updateError } = await this.supabaseService
            .getClient()
            .from('group_messages')
            .update({ content })
            .eq('id', messageId)
            .select('*, sender:users!group_messages_sender_id_fkey(id, username, fullname, avatar_url, is_verified, sub_plan)')
            .single();

        if (updateError) throw new Error(`Failed to vote on poll: ${updateError.message}`);
        return this.applyMessageSenderAvatarPrivacy(updated, userId);
    }

    private parseFeedPollContent(content: string | null): {
        allowMultiple: boolean;
        question: string;
        options: { id: string; text: string; voters: string[] }[];
    } {
        if (!content?.startsWith(this.feedPollPrefix)) {
            throw new BadRequestException('Message is not a poll');
        }

        try {
            const parsed = JSON.parse(content.slice(this.feedPollPrefix.length));
            const question = typeof parsed.question === 'string' ? parsed.question.trim() : '';
            const options = Array.isArray(parsed.options)
                ? parsed.options
                    .map((option: any, index: number) => ({
                        id: typeof option?.id === 'string' ? option.id : `option-${index + 1}`,
                        text: typeof option?.text === 'string' ? option.text.trim() : '',
                        voters: Array.isArray(option?.voters)
                            ? option.voters.filter((id: unknown): id is string => typeof id === 'string')
                            : [],
                    }))
                    .filter((option: any) => option.text)
                : [];

            if (!question || options.length < 2) throw new Error('Invalid poll');
            return { allowMultiple: Boolean(parsed.allowMultiple), options, question };
        } catch {
            throw new BadRequestException('Invalid poll payload');
        }
    }

    private encodeFeedPollContent(poll: { allowMultiple?: boolean; question: string; options: { id: string; text: string; voters: string[] }[] }) {
        return `${this.feedPollPrefix}${JSON.stringify({
            allowMultiple: Boolean(poll.allowMultiple),
            question: poll.question,
            options: poll.options.map((option) => ({
                id: option.id,
                text: option.text,
                voters: option.voters,
                votes: option.voters.length,
            })),
        })}`;
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
            .select('*, sender:users!group_messages_sender_id_fkey(id, username, fullname, avatar_url, is_verified, sub_plan)')
            .single();

        if (error) throw new Error(`Failed to toggle pin: ${error.message}`);
        return this.applyMessageSenderAvatarPrivacy(updated, userId);
    }

    private async toggleReactionInternal(
        table: string,
        userId: string,
        messageId: string,
        emoji: string,
        selectQuery: string,
    ): Promise<any> {
        const { data: message, error: fetchError } = await this.supabaseService
            .getClient()
            .from(table)
            .select('reactions')
            .eq('id', messageId)
            .single();

        if (fetchError || !message) throw new NotFoundException('Message not found');

        let reactions: { emoji: string; users: string[] }[] = message.reactions || [];
        if (!Array.isArray(reactions)) reactions = [];

        const reactionIndex = reactions.findIndex((r) => r.emoji === emoji);
        const alreadyReacted = reactionIndex > -1 && reactions[reactionIndex].users.includes(userId);

        // Remove user from all emoji groups (enforce one reaction per user)
        reactions = reactions
            .map((r) => ({ ...r, users: r.users.filter((u: string) => u !== userId) }))
            .filter((r) => r.users.length > 0);

        if (!alreadyReacted) {
            // Add user to the target emoji (toggle on)
            const idx = reactions.findIndex((r) => r.emoji === emoji);
            if (idx > -1) {
                reactions[idx].users.push(userId);
            } else {
                reactions.push({ emoji, users: [userId] });
            }
        }
        // If alreadyReacted, user's reaction is now fully removed (toggle off)

        const { data: updated, error: updateError } = await this.supabaseService
            .getClient()
            .from(table)
            .update({ reactions })
            .eq('id', messageId)
            .select(selectQuery)
            .single();

        if (updateError) throw new Error(`Failed to update reactions: ${updateError.message}`);
        return this.applyMessageSenderAvatarPrivacy(updated as any, userId);
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
            .select('*, sender:users!group_messages_sender_id_fkey(id, username, fullname, avatar_url, is_verified, sub_plan)')
            .single();

        if (error) throw new Error(`Failed to send system message: ${error.message}`);
        return data;
    }
}
