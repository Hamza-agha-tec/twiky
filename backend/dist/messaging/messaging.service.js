"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MessagingService = void 0;
const common_1 = require("@nestjs/common");
const supabase_module_1 = require("../supabase/supabase.module");
let MessagingService = class MessagingService {
    supabaseService;
    constructor(supabaseService) {
        this.supabaseService = supabaseService;
    }
    async createConversation(userId, createDto) {
        const { isGroup, name, participantIds } = createDto;
        const { data: conversation, error: convError } = await this.supabaseService
            .getClient()
            .from('conversations')
            .insert({
            is_group: isGroup || false,
            name: name || (isGroup ? 'New Group' : null),
        })
            .select()
            .single();
        if (convError)
            throw new Error(`Failed to create conversation: ${convError.message}`);
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
        if (partError)
            throw new Error(`Failed to add participants: ${partError.message}`);
        return conversation;
    }
    async getConversations(userId) {
        const { data, error } = await this.supabaseService
            .getClient()
            .from('conversation_participants')
            .select('conversation:conversations(*), role, joined_at')
            .eq('user_id', userId)
            .order('joined_at', { ascending: false });
        if (error)
            throw new Error(`Failed to fetch conversations: ${error.message}`);
        return data.map(item => item.conversation);
    }
    async saveMessage(senderId, sendDto) {
        const { conversationId, content, type, fileUrl, metadata } = sendDto;
        const { data: member } = await this.supabaseService
            .getClient()
            .from('conversation_participants')
            .select('*')
            .eq('conversation_id', conversationId)
            .eq('user_id', senderId)
            .maybeSingle();
        if (!member)
            throw new common_1.ForbiddenException('You are not a member of this conversation');
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
        if (error)
            throw new Error(`Failed to save message: ${error.message}`);
        await this.supabaseService
            .getClient()
            .from('conversations')
            .update({ last_message_at: new Date().toISOString() })
            .eq('id', conversationId);
        return data;
    }
    async getMessages(userId, conversationId, limit = 50, offset = 0) {
        const { data: member } = await this.supabaseService
            .getClient()
            .from('conversation_participants')
            .select('*')
            .eq('conversation_id', conversationId)
            .eq('user_id', userId)
            .maybeSingle();
        if (!member)
            throw new common_1.ForbiddenException('Access denied to this conversation history');
        const { data, error } = await this.supabaseService
            .getClient()
            .from('messages')
            .select('*, sender:users!sender_id(id, username, avatar_url)')
            .eq('conversation_id', conversationId)
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);
        if (error)
            throw new Error(`Failed to fetch messages: ${error.message}`);
        return data;
    }
    async uploadFile(userId, file) {
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
};
exports.MessagingService = MessagingService;
exports.MessagingService = MessagingService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [supabase_module_1.SupabaseService])
], MessagingService);
//# sourceMappingURL=messaging.service.js.map