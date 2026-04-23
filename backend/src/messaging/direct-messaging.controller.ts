import { Controller, Get, Post, Param, Body, UseGuards, Request } from '@nestjs/common';
import { MessagingService } from './messaging.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { StartDirectConversationDto, SendDirectMessageDto } from './dto/direct-messaging.dto';

@UseGuards(JwtAuthGuard)
@Controller('direct-conversations')
export class DirectMessagingController {
    constructor(private readonly messagingService: MessagingService) {}

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
        return this.messagingService.sendDirectMessage(req.user.userId, conversationId, dto);
    }

    @Post('messages/:messageId/reactions')
    async toggleReaction(@Request() req: any, @Param('messageId') messageId: string, @Body() dto: { emoji: string }) {
        return this.messagingService.toggleDirectMessageReaction(req.user.userId, messageId, dto.emoji);
    }
}
