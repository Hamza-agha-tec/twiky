import { Controller, Post, Body, UseGuards, Request, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AccessToken } from 'livekit-server-sdk';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

interface AuthenticatedRequest {
  user: { sub: string; [key: string]: any };
}

@Controller('livekit')
@UseGuards(JwtAuthGuard)
export class LiveKitController {
  constructor(private readonly configService: ConfigService) {}

  @Post('token')
  async getToken(
    @Body() body: { roomName: string; participantIdentity: string },
    @Request() req: AuthenticatedRequest,
  ) {
    const { roomName, participantIdentity } = body;
    if (!roomName || !participantIdentity) {
      throw new BadRequestException('roomName and participantIdentity are required');
    }

    const apiKey = this.configService.get<string>('LIVEKIT_API_KEY');
    const apiSecret = this.configService.get<string>('LIVEKIT_API_SECRET');

    if (!apiKey || !apiSecret) {
      throw new BadRequestException('LiveKit is not configured');
    }

    const at = new AccessToken(apiKey, apiSecret, {
      identity: participantIdentity,
      ttl: '4h',
    });
    at.addGrant({ roomJoin: true, room: roomName, canPublish: true, canSubscribe: true });

    const token = await at.toJwt();
    return { token };
  }
}
