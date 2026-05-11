import { Body, Controller, Delete, Get, Param, Patch, Post, Request, UseGuards } from '@nestjs/common';
import { MessagingService } from './messaging.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SendGroupMessageDto } from './dto/group-messaging.dto';
import { ChatGateway } from './gateway/chat.gateway';

@UseGuards(JwtAuthGuard)
@Controller('groups')
export class GroupMessagingController {
    constructor(
        private readonly messagingService: MessagingService,
        private readonly chatGateway: ChatGateway,
    ) {}

    @Get(':groupId/messages')
    async getGroupMessages(@Request() req: any, @Param('groupId') groupId: string) {
        return this.messagingService.getGroupMessages(req.user.userId, groupId);
    }

    @Post(':groupId/messages')
    async sendGroupMessage(@Request() req: any, @Param('groupId') groupId: string, @Body() dto: SendGroupMessageDto) {
        const message = await this.messagingService.sendGroupMessage(req.user.userId, groupId, dto);
        await this.chatGateway.emitGroupMessageCreated(groupId, message);
        return message;
    }

    @Post('messages/:messageId/reactions')
    async toggleReaction(@Request() req: any, @Param('messageId') messageId: string, @Body() dto: { emoji: string }) {
        const message = await this.messagingService.toggleGroupMessageReaction(req.user.userId, messageId, dto.emoji);
        await this.chatGateway.emitGroupMessageUpdated(message.group_id, message);
        return message;
    }

    @Post('messages/:messageId/poll-votes')
    async votePoll(@Request() req: any, @Param('messageId') messageId: string, @Body() dto: { optionId: string }) {
        const message = await this.messagingService.voteGroupPoll(req.user.userId, messageId, dto.optionId);
        await this.chatGateway.emitGroupMessageUpdated(message.group_id, message);
        return message;
    }

    @Patch('messages/:messageId/pin')
    async togglePin(@Request() req: any, @Param('messageId') messageId: string) {
        const message = await this.messagingService.toggleGroupMessagePin(req.user.userId, messageId);
        await this.chatGateway.emitGroupMessageUpdated(message.group_id, message);
        return message;
    }

    @Delete('messages/:messageId')
    async deleteMessage(@Request() req: any, @Param('messageId') messageId: string) {
        const result = await this.messagingService.deleteGroupMessage(req.user.userId, messageId);
        this.chatGateway.emitGroupMessageDeleted(result.groupId, messageId);
        return result;
    }
}
