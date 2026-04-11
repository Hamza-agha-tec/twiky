import { OnGatewayInit } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { MessagingService } from '../messaging.service';
import { EditMessageDto, SendMessageDto, ToggleReactionDto } from '../dto/messaging.dto';
import { ConfigService } from '@nestjs/config';
export declare class ChatGateway implements OnGatewayInit {
    private readonly messagingService;
    private readonly configService;
    server: Server;
    private readonly logger;
    constructor(messagingService: MessagingService, configService: ConfigService);
    afterInit(server: Server): void;
    handleJoinConversation(client: Socket, conversationId: string): {
        status: string;
        conversationId: string;
    };
    handleLeaveConversation(client: Socket, conversationId: string): {
        status: string;
        conversationId: string;
    };
    handleSendMessage(client: Socket, payload: SendMessageDto): Promise<{
        status: string;
        messageId: any;
        message?: undefined;
    } | {
        status: string;
        message: any;
        messageId?: undefined;
    }>;
    handleEditMessage(client: Socket, payload: EditMessageDto): Promise<{
        status: string;
        message?: undefined;
    } | {
        status: string;
        message: any;
    }>;
    handleDeleteMessage(client: Socket, payload: {
        messageId: string;
        conversationId: string;
    }): Promise<{
        status: string;
        message?: undefined;
    } | {
        status: string;
        message: any;
    }>;
    handleToggleReaction(client: Socket, payload: ToggleReactionDto): Promise<{
        status: string;
        message?: undefined;
    } | {
        status: string;
        message: any;
    }>;
    handleTyping(client: Socket, payload: {
        conversationId: string;
        isTyping: boolean;
    }): void;
}
