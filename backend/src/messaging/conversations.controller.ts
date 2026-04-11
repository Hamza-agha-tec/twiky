import { Controller, Get, Post, Body, UseGuards, Request } from '@nestjs/common';
import { MessagingService } from './messaging.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateConversationDto } from './dto/messaging.dto';

@Controller('messaging/conversations')
@UseGuards(JwtAuthGuard)
export class ConversationsController {
  constructor(private readonly messagingService: MessagingService) {}

  @Post()
  async create(@Request() req: any, @Body() createDto: CreateConversationDto) {
    return this.messagingService.createConversation(req.user.userId, createDto);
  }

  @Get()
  async findAll(@Request() req: any) {
    return this.messagingService.getConversations(req.user.userId);
  }
}
