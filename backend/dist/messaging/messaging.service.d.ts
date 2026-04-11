import { SupabaseService } from '../supabase/supabase.module';
import { CreateConversationDto, SendMessageDto } from './dto/messaging.dto';
export declare class MessagingService {
    private supabaseService;
    constructor(supabaseService: SupabaseService);
    createConversation(userId: string, createDto: CreateConversationDto): Promise<any>;
    getConversations(userId: string): Promise<any[][]>;
    saveMessage(senderId: string, sendDto: SendMessageDto): Promise<any>;
    editMessage(userId: string, messageId: string, content: string): Promise<any>;
    deleteMessage(userId: string, messageId: string): Promise<{
        success: boolean;
    }>;
    toggleReaction(userId: string, messageId: string, emoji: string): Promise<{
        status: string;
        messageId: string;
        emoji: string;
        userId: string;
    }>;
    getMessages(userId: string, conversationId: string, limit?: number, offset?: number): Promise<any[]>;
    uploadFile(userId: string, file: Express.Multer.File): Promise<{
        fileName: string;
        fileUrl: string;
        fileType: string;
    }>;
}
