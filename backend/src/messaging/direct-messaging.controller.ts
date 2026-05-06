import { Controller, Get, Post, Param, Body, UseGuards, Request } from '@nestjs/common';
import { MessagingService } from './messaging.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { StartDirectConversationDto, SendDirectMessageDto } from './dto/direct-messaging.dto';
import { ChatGateway } from './gateway/chat.gateway';

@UseGuards(JwtAuthGuard)
@Controller('direct-conversations')
export class DirectMessagingController {
    constructor(
        private readonly messagingService: MessagingService,
        private readonly chatGateway: ChatGateway,
    ) {}

    @Get()
    async getDirectConversations(@Request() req: any) {
        return this.messagingService.getDirectConversations(req.user.userId);
    }

    @Post()
    async createDirectConversation(@Request() req: any, @Body() dto: StartDirectConversationDto) {
        return this.messagingService.createDirectConversation(req.user.userId, dto);
    }

    @Get(':id/messages')
    async getDirectMessages(@Request() req: any, @Param('id') conversationId: string) {
        return this.messagingService.getDirectMessages(req.user.userId, conversationId);
    }

    @Post(':id/messages')
    async sendDirectMessage(@Request() req: any, @Param('id') conversationId: string, @Body() dto: SendDirectMessageDto) {
        const message = await this.messagingService.sendDirectMessage(req.user.userId, conversationId, dto);
        await this.chatGateway.emitDirectMessageCreated(conversationId, message);
        const conversations = await this.messagingService.getDirectConversations(req.user.userId);
        const conversation = conversations.find((item) => item.id === conversationId);
        if (conversation) {
            await this.chatGateway.emitDirectMessageNotification(conversation.user_one_id, conversation.user_two_id, message);
        }
        return message;
    }

    @Post('messages/:messageId/reactions')
    async toggleReaction(@Request() req: any, @Param('messageId') messageId: string, @Body() dto: { emoji: string }) {
        const message = await this.messagingService.toggleDirectMessageReaction(req.user.userId, messageId, dto.emoji);
        await this.chatGateway.emitDirectMessageUpdated(message.conversation_id, message);
        return message;
    }
}
