import { Controller, Get, Post, Patch, Delete, Param, Query, Body, UseGuards, Request, UseInterceptors, UploadedFile } from '@nestjs/common';
import { MessagingService } from './messaging.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { FileInterceptor } from '@nestjs/platform-express';

@Controller('messaging/messages')
@UseGuards(JwtAuthGuard)
export class MessagesController {
  constructor(private readonly messagingService: MessagingService) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(@Request() req: any, @UploadedFile() file: Express.Multer.File) {
    return this.messagingService.uploadFile(req.user.userId, file);
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

  @Patch(':id')
  async editMessage(@Request() req: any, @Param('id') id: string, @Body() body: { content: string }) {
    return this.messagingService.editMessage(req.user.userId, id, body.content);
  }

  @Delete(':id')
  async deleteMessage(@Request() req: any, @Param('id') id: string) {
    return this.messagingService.deleteMessage(req.user.userId, id);
  }

  @Post(':id/react')
  async reactToMessage(@Request() req: any, @Param('id') id: string, @Body() body: { emoji: string }) {
    return this.messagingService.reactToMessage(req.user.userId, id, body.emoji);
  }
}
