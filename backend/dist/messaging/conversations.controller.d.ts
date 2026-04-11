import { MessagingService } from './messaging.service';
import { CreateConversationDto } from './dto/messaging.dto';
export declare class ConversationsController {
    private readonly messagingService;
    constructor(messagingService: MessagingService);
    create(req: any, createDto: CreateConversationDto): Promise<any>;
    findAll(req: any): Promise<any[][]>;
}
