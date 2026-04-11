import { Controller, Get, Post, Patch, Delete, Param, Query, UseGuards, Request, UseInterceptors, UploadedFile, Body } from '@nestjs/common';
import { MessagingService } from './messaging.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { FileInterceptor } from '@nestjs/platform-express';
import { EditMessageDto, ToggleReactionDto } from './dto/messaging.dto';

@Controller('messaging/messages')
@UseGuards(JwtAuthGuard)
export class MessagesController {
  constructor(private readonly messagingService: MessagingService) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(@Request() req: any, @UploadedFile() file: Express.Multer.File) {
    return this.messagingService.uploadFile(req.user.userId, file);
  }

  @Patch(':messageId')
  async edit(@Request() req: any, @Param('messageId') messageId: string, @Body() body: EditMessageDto) {
    return this.messagingService.editMessage(req.user.userId, messageId, body.content);
  }

  @Delete(':messageId')
  async delete(@Request() req: any, @Param('messageId') messageId: string) {
    return this.messagingService.deleteMessage(req.user.userId, messageId);
  }

  @Post(':messageId/react')
  async react(@Request() req: any, @Param('messageId') messageId: string, @Body() body: ToggleReactionDto) {
    return this.messagingService.toggleReaction(req.user.userId, messageId, body.emoji);
  }

  @Get(':conversationId')
  async findByConversation(
    @Request() req: any,
    @Param('conversationId') conversationId: string,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ) {
    return this.messagingService.getMessages(
      req.user.userId,
      conversationId,
      limit ? Number(limit) : 50,
      offset ? Number(offset) : 0,
    );
  }
}
