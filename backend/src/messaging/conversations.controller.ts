import { Controller, Get, Post, Body, UseGuards, Request, Patch, Param, Delete, UseInterceptors, UploadedFile } from '@nestjs/common';
import { MessagingService } from './messaging.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CreateConversationDto, UpdateGroupDto, AddParticipantsDto } from './dto/messaging.dto';
import { FileInterceptor } from '@nestjs/platform-express';

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

  @Patch(':id')
  async update(
    @Request() req: any,
    @Param('id') id: string,
    @Body() updateDto: UpdateGroupDto,
  ) {
    return this.messagingService.updateGroup(req.user.userId, id, updateDto);
  }

  @Post(':id/avatar')
  @UseInterceptors(FileInterceptor('avatar'))
  async uploadGroupAvatar(
    @Request() req: any,
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.messagingService.uploadGroupAvatar(req.user.userId, id, file);
  }

  @Post(':id/participants')
  async addParticipants(
    @Request() req: any,
    @Param('id') id: string,
    @Body() addDto: AddParticipantsDto,
  ) {
    return this.messagingService.addParticipants(req.user.userId, id, addDto);
  }

  @Delete(':id/participants/:userId')
  async removeParticipant(
    @Request() req: any,
    @Param('id') id: string,
    @Param('userId') targetUserId: string,
  ) {
    return this.messagingService.removeParticipant(req.user.userId, id, targetUserId);
  }
}
