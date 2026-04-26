import { Controller, Get, Post, Param, Body, UseGuards, Request } from '@nestjs/common';
import { VoiceService } from './voice.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

interface AuthenticatedRequest {
  user: {
    sub: string;
    [key: string]: any;
  };
}

@Controller('voice')
@UseGuards(JwtAuthGuard)
export class VoiceController {
  constructor(private readonly voiceService: VoiceService) {}

  @Get('rooms')
  async getUserVoiceRooms(@Request() req: AuthenticatedRequest) {
    const userId = req.user.sub;
    return this.voiceService.getUserVoiceGroups(userId);
  }

  @Get('rooms/:roomId')
  async getVoiceRoom(@Param('roomId') roomId: string, @Request() req: AuthenticatedRequest) {
    const userId = req.user.sub;
    return this.voiceService.getVoiceRoomInfo(roomId, userId);
  }

  @Post('rooms')
  async createVoiceRoom(
    @Body() createData: {
      channelId: string;
      name: string;
      description?: string;
      access_type?: 'PUBLIC' | 'PRIVATE';
    },
    @Request() req: AuthenticatedRequest
  ) {
    const userId = req.user.sub;
    return this.voiceService.createVoiceRoom(
      createData.channelId,
      userId,
      createData
    );
  }

  @Post('rooms/:roomId/validate-access')
  async validateRoomAccess(@Param('roomId') roomId: string, @Request() req: AuthenticatedRequest) {
    const userId = req.user.sub;
    const hasAccess = await this.voiceService.validateVoiceRoomAccess(roomId, userId);
    return { hasAccess };
  }
}
