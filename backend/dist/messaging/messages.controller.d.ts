import { MessagingService } from './messaging.service';
export declare class MessagesController {
    private readonly messagingService;
    constructor(messagingService: MessagingService);
    uploadFile(req: any, file: Express.Multer.File): Promise<{
        fileName: string;
        fileUrl: string;
        fileType: string;
    }>;
    findByConversation(req: any, conversationId: string, limit?: number, offset?: number): Promise<any[]>;
}
