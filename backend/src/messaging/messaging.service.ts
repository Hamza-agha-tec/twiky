import { Injectable, NotFoundException, ForbiddenException, Inject, forwardRef } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.module';
import { CreateConversationDto, SendMessageDto } from './dto/messaging.dto';
import { ChatGateway } from './gateway/chat.gateway';

@Injectable()
export class MessagingService {
  constructor(
    private supabaseService: SupabaseService,
    @Inject(forwardRef(() => ChatGateway))
    private chatGateway: ChatGateway,
  ) { }

  /**
   * CONVERSATIONS
   */

  async createConversation(userId: string, createDto: CreateConversationDto) {
    const { isGroup, name, participantIds } = createDto;

    // 1. Create the conversation record
    const { data: conversation, error: convError } = await this.supabaseService
      .getClient()
      .from('conversations')
      .insert({
        is_group: isGroup || false,
        name: name || (isGroup ? 'New Group' : null),
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

    // Notify participants via Socket
    const { data: fullConversation } = await this.supabaseService
      .getClient()
      .from('conversations')
      .select('*, participants:conversation_participants(user:users(id, username, avatar_url, phone_number))')
      .eq('id', conversation.id)
      .single();

    if (fullConversation) {
      this.chatGateway.broadcastNewConversation(allParticipants, fullConversation);
    }

    return fullConversation || conversation;
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

    return data.map(item => item.conversation);
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
      .select('reactions')
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

    return { messageId, reactions: updated };
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

  async uploadFile(userId: string, file: Express.Multer.File) {
    const fileExt = file.originalname.split('.').pop();
    const fileName = `${userId}_${Date.now()}.${fileExt}`;
    const filePath = `uploads/${fileName}`;

    const { error } = await this.supabaseService
      .getClient()
      .storage.from('chat-attachments')
      .upload(filePath, file.buffer, {
        contentType: file.mimetype,
        upsert: true,
      });

    if (error) {
      throw new Error(`Failed to upload file: ${error.message}`);
    }

    // Get public URL
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
}
