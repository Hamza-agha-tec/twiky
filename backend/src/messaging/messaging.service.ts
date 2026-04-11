import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.module';
import { CreateConversationDto, SendMessageDto } from './dto/messaging.dto';

@Injectable()
export class MessagingService {
  constructor(private supabaseService: SupabaseService) { }

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

    return conversation;
  }

  async getConversations(userId: string) {
    // We want conversations where the user is a participant
    const { data, error } = await this.supabaseService
      .getClient()
      .from('conversation_participants')
      .select('conversation:conversations(*), role, joined_at')
      .eq('user_id', userId)
      .order('joined_at', { ascending: false });

    if (error) throw new Error(`Failed to fetch conversations: ${error.message}`);

    // Transform to return conversation objects with participant info
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
      })
      .select('*, sender:users!sender_id(id, username, avatar_url)')
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
      .select('*, sender:users!sender_id(id, username, avatar_url)')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw new Error(`Failed to fetch messages: ${error.message}`);
    return data;
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
