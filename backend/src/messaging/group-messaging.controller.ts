import { Controller, Get, Post, Param, Body, UseGuards, Request } from '@nestjs/common';
import { MessagingService } from './messaging.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SendGroupMessageDto } from './dto/group-messaging.dto';

@UseGuards(JwtAuthGuard)
@Controller('groups')
export class GroupMessagingController {
    constructor(private readonly messagingService: MessagingService) {}

    @Get(':groupId/messages')
    async getGroupMessages(@Request() req: any, @Param('groupId') groupId: string) {
        return this.messagingService.getGroupMessages(req.user.userId, groupId);
    }

    @Post(':groupId/messages')
    async sendGroupMessage(@Request() req: any, @Param('groupId') groupId: string, @Body() dto: SendGroupMessageDto) {
        return this.messagingService.sendGroupMessage(req.user.userId, groupId, dto);
    }
}
