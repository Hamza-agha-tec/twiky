import { MessagingService } from './messaging.service';
import { EditMessageDto, ToggleReactionDto } from './dto/messaging.dto';
export declare class MessagesController {
    private readonly messagingService;
    constructor(messagingService: MessagingService);
    uploadFile(req: any, file: Express.Multer.File): Promise<{
        fileName: string;
        fileUrl: string;
        fileType: string;
    }>;
    edit(req: any, messageId: string, body: EditMessageDto): Promise<any>;
    delete(req: any, messageId: string): Promise<{
        success: boolean;
    }>;
    react(req: any, messageId: string, body: ToggleReactionDto): Promise<{
        status: string;
        messageId: string;
        emoji: string;
        userId: string;
    }>;
    findByConversation(req: any, conversationId: string, limit?: number, offset?: number): Promise<any[]>;
}
