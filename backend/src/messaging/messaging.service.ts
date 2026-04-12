  import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
  import { SupabaseService } from '../supabase/supabase.module';
  import { CreateConversationDto, SendMessageDto, UpdateGroupDto, AddParticipantsDto } from './dto/messaging.dto';

  @Injectable()
  export class MessagingService {
    constructor(private supabaseService: SupabaseService) { }

    /**
     * CONVERSATIONS
     */

  async createConversation(userId: string, createDto: CreateConversationDto) {
    const { isGroup, name, description, avatarUrl, participantIds } = createDto;

    // 1. Create the conversation record
    const { data: conversation, error: convError } = await this.supabaseService
      .getClient()
      .from('conversations')
      .insert({
        is_group: isGroup || false,
        name: name || (isGroup ? 'New Group' : null),
        description: description || null,
        avatar_url: avatarUrl || null,
      })
      .select()
      .single();

    if (convError) throw new Error(`Failed to create conversation: ${convError.message}`);

    // 2. Add all participants (including the creator)
    const allParticipants = Array.from(new Set([...participantIds, userId]));
    const participantRows = allParticipants.map(pid => ({
      conversation_id: conversation.id,
      user_id: pid,
      role: pid === userId ? 'admin' : 'member',
    }));

    const { error: partError } = await this.supabaseService
      .getClient()
      .from('conversation_participants')
      .insert(participantRows);

    if (partError) throw new Error(`Failed to add participants: ${partError.message}`);

    return conversation;
  }

  async isAdmin(userId: string, conversationId: string): Promise<boolean> {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('conversation_participants')
      .select('role')
      .eq('conversation_id', conversationId)
      .eq('user_id', userId)
      .maybeSingle();

    if (error || !data) return false;
    return data.role === 'admin';
  }

  async updateGroup(userId: string, conversationId: string, updateDto: UpdateGroupDto) {
    const isUserAdmin = await this.isAdmin(userId, conversationId);
    if (!isUserAdmin) throw new ForbiddenException('Only admins can update group information');

    // Only include fields that were actually provided
    const updatePayload: Record<string, any> = {};
    if (updateDto.name !== undefined) updatePayload.name = updateDto.name;
    if (updateDto.description !== undefined) updatePayload.description = updateDto.description;
    if (updateDto.avatarUrl !== undefined) updatePayload.avatar_url = updateDto.avatarUrl;

    const { data, error } = await this.supabaseService
      .getClient()
      .from('conversations')
      .update(updatePayload)
      .eq('id', conversationId)
      .select()
      .single();

    if (error) throw new Error(`Failed to update group: ${error.message}`);
    return data;
  }


  async addParticipants(userId: string, conversationId: string, addDto: AddParticipantsDto) {
    const isUserAdmin = await this.isAdmin(userId, conversationId);
    if (!isUserAdmin) throw new ForbiddenException('Only admins can add participants to this group');

    const participantRows = addDto.participantIds.map(pid => ({
      conversation_id: conversationId,
      user_id: pid,
      role: 'member',
    }));

    const { error } = await this.supabaseService
      .getClient()
      .from('conversation_participants')
      .insert(participantRows);

    if (error) throw new Error(`Failed to add participants: ${error.message}`);
    return { success: true };
  }

  async removeParticipant(userId: string, conversationId: string, targetUserId: string) {
    const isUserAdmin = await this.isAdmin(userId, conversationId);
    const isSelf = userId === targetUserId;

    if (!isUserAdmin && !isSelf) {
      throw new ForbiddenException('You do not have permission to remove this participant');
    }

    const { error } = await this.supabaseService
      .getClient()
      .from('conversation_participants')
      .delete()
      .eq('conversation_id', conversationId)
      .eq('user_id', targetUserId);

    if (error) throw new Error(`Failed to remove participant: ${error.message}`);
    return { success: true };
  }

    async getConversations(userId: string) {
      const { data, error } = await this.supabaseService
        .getClient()
        .from('conversation_participants')
        .select(`
          conversation:conversations(
            *,
            participants:conversation_participants(
              user:users(id, username, avatar_url, phone_number)
            )
          ),
          role,
          joined_at
        `)
        .eq('user_id', userId)
        .order('joined_at', { ascending: false });

      if (error) throw new Error(`Failed to fetch conversations: ${error.message}`);

      const conversations = data.map(item => item.conversation) as any[];
      const convIds = conversations.map((c) => c.id);

      if (convIds.length === 0) return [];

      // Fetch most recent message per conversation in one query
      const { data: messages } = await this.supabaseService
        .getClient()
        .from('messages')
        .select('id, conversation_id, content, type, created_at, sender:users!sender_id(id, username)')
        .in('conversation_id', convIds)
        .order('created_at', { ascending: false })
        .limit(convIds.length * 3);

      const lastMessageMap: Record<string, any> = {};
      for (const msg of messages ?? []) {
        if (!lastMessageMap[msg.conversation_id]) {
          lastMessageMap[msg.conversation_id] = msg;
        }
      }

      return conversations.map((c) => ({
        ...c,
        last_message: lastMessageMap[c.id] ?? null,
      }));
    }

    async getUserUsername(userId: string): Promise<string> {
      const { data } = await this.supabaseService
        .getClient()
        .from('users')
        .select('username')
        .eq('id', userId)
        .single();
      return data?.username ?? 'Someone';
    }

    async getConversationParticipantIds(conversationId: string): Promise<string[]> {
      const { data, error } = await this.supabaseService
        .getClient()
        .from('conversation_participants')
        .select('user_id')
        .eq('conversation_id', conversationId);

      if (error) return [];
      return data.map((r: { user_id: string }) => r.user_id);
    }

    /**
     * MESSAGES
     */

    async saveMessage(senderId: string, sendDto: SendMessageDto) {
      const { conversationId, content, type, fileUrl, metadata } = sendDto;

      // Verify membership
      const { data: member } = await this.supabaseService
        .getClient()
        .from('conversation_participants')
        .select('*')
        .eq('conversation_id', conversationId)
        .eq('user_id', senderId)
        .maybeSingle();

      if (!member) throw new ForbiddenException('You are not a member of this conversation');

      // Save message
      const { data, error } = await this.supabaseService
        .getClient()
        .from('messages')
        .insert({
          conversation_id: conversationId,
          sender_id: senderId,
          content,
          type: type || 'text',
          file_url: fileUrl,
          metadata: metadata || {},
          reply_to_id: sendDto.replyToId ?? null,
        })
        .select('*, sender:users!sender_id(id, username, avatar_url), reply_to:messages!reply_to_id(id, content, sender:users!sender_id(id, username))')
        .single();

      if (error) throw new Error(`Failed to save message: ${error.message}`);

      // Update conversation last_message_at
      await this.supabaseService
        .getClient()
        .from('conversations')
        .update({ last_message_at: new Date().toISOString() })
        .eq('id', conversationId);

      return data;
    }

    async getMessages(userId: string, conversationId: string, limit: number = 50, offset: number = 0) {
      // Verify membership
      const { data: member } = await this.supabaseService
        .getClient()
        .from('conversation_participants')
        .select('*')
        .eq('conversation_id', conversationId)
        .eq('user_id', userId)
        .maybeSingle();

      if (!member) throw new ForbiddenException('Access denied to this conversation history');

      const { data, error } = await this.supabaseService
        .getClient()
        .from('messages')
        .select('*, sender:users!sender_id(id, username, avatar_url), reply_to:messages!reply_to_id(id, content, sender:users!sender_id(id, username))')
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) throw new Error(`Failed to fetch messages: ${error.message}`);
      return data;
    }

    /**
     * EDIT / DELETE
     */

    async editMessage(userId: string, messageId: string, content: string) {
      const { data, error } = await this.supabaseService
        .getClient()
        .from('messages')
        .update({ content, is_edited: true })
        .eq('id', messageId)
        .eq('sender_id', userId)
        .select('*, sender:users!sender_id(id, username, avatar_url), reply_to:messages!reply_to_id(id, content, sender:users!sender_id(id, username))')
        .single();

      if (error) throw new Error(`Failed to edit message: ${error.message}`);
      return data;
    }

    async deleteMessage(userId: string, messageId: string) {
      const { error } = await this.supabaseService
        .getClient()
        .from('messages')
        .delete()
        .eq('id', messageId)
        .eq('sender_id', userId);

      if (error) throw new Error(`Failed to delete message: ${error.message}`);
      return { success: true };
    }

    /**
     * REACTIONS
     */

    async reactToMessage(userId: string, messageId: string, emoji: string) {
      const { data: msg, error: fetchError } = await this.supabaseService
        .getClient()
        .from('messages')
        .select('reactions, type, sender_id')
        .eq('id', messageId)
        .single();

      if (fetchError) throw new Error(`Message not found: ${fetchError.message}`);

      const reactions: { userId: string; emoji: string }[] = msg.reactions ?? [];
      const existingIdx = reactions.findIndex((r) => r.userId === userId && r.emoji === emoji);

      // Remove ALL reactions from this user, then add new one (unless toggling off)
      const withoutUser = reactions.filter((r) => r.userId !== userId);
      const updated = existingIdx >= 0 ? withoutUser : [...withoutUser, { userId, emoji }];

      const { error } = await this.supabaseService
        .getClient()
        .from('messages')
        .update({ reactions: updated })
        .eq('id', messageId);

      if (error) throw new Error(`Failed to update reactions: ${error.message}`);

      return { messageId, reactions: updated, messageType: msg.type, messageSenderId: msg.sender_id, isAdded: existingIdx < 0 };
    }

    /**
     * MESSAGE STATUS
     */

    async updateMessageStatus(messageId: string, status: 'sent' | 'delivered' | 'read') {
      await this.supabaseService
        .getClient()
        .from('messages')
        .update({ status })
        .eq('id', messageId);
    }

    async markConversationRead(userId: string, conversationId: string): Promise<string[]> {
      const { data } = await this.supabaseService
        .getClient()
        .from('messages')
        .update({ status: 'read' })
        .eq('conversation_id', conversationId)
        .neq('sender_id', userId)
        .in('status', ['sent', 'delivered'])
        .select('id');
      return data?.map((m: { id: string }) => m.id) ?? [];
    }

    /**
     * FILE SHARING
     */

    async uploadFile(userId: string, conversationId: string, file: Express.Multer.File) {
      // Verify membership before allowing upload
      const { data: member } = await this.supabaseService
        .getClient()
        .from('conversation_participants')
        .select('user_id')
        .eq('conversation_id', conversationId)
        .eq('user_id', userId)
        .maybeSingle();

      if (!member) throw new ForbiddenException('You are not a member of this conversation');

      const fileExt = file.originalname.split('.').pop();
      const fileName = `${Date.now()}_${file.originalname}`;
      // Each conversation has its own folder
      const filePath = `conversations/${conversationId}/${fileName}`;

      const { error } = await this.supabaseService
        .getClient()
        .storage.from('chat-attachments')
        .upload(filePath, file.buffer, {
          contentType: file.mimetype,
          upsert: false,
        });

      if (error) throw new Error(`Failed to upload file: ${error.message}`);

      const { data: { publicUrl } } = this.supabaseService
        .getClient()
        .storage.from('chat-attachments')
        .getPublicUrl(filePath);

      return {
        fileName: file.originalname,
        fileUrl: publicUrl,
        fileType: file.mimetype,
      };
    }

    async uploadGroupAvatar(userId: string, conversationId: string, file: Express.Multer.File) {
      const isUserAdmin = await this.isAdmin(userId, conversationId);
      if (!isUserAdmin) throw new ForbiddenException('Only admins can update the group avatar');

      const fileExt = file.originalname.split('.').pop();
      // Deterministic path — always overwrite the single avatar file
      const filePath = `group-avatars/${conversationId}/avatar.${fileExt}`;

      const { error } = await this.supabaseService
        .getClient()
        .storage.from('chat-attachments')
        .upload(filePath, file.buffer, {
          contentType: file.mimetype,
          upsert: true, // overwrite existing avatar
        });

      if (error) throw new Error(`Failed to upload group avatar: ${error.message}`);

      const { data: { publicUrl } } = this.supabaseService
        .getClient()
        .storage.from('chat-attachments')
        .getPublicUrl(filePath);

      // Persist the new avatar_url on the conversation
      const { data, error: updateError } = await this.supabaseService
        .getClient()
        .from('conversations')
        .update({ avatar_url: publicUrl })
        .eq('id', conversationId)
        .select()
        .single();

      if (updateError) throw new Error(`Failed to update group avatar: ${updateError.message}`);

      return data;
    }
  }
