import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  WebSocketServer,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { SocketAuthMiddleware } from '../messaging/middlewares/ws-auth.middleware';
import { ConfigService } from '@nestjs/config';

interface WebRTCSignal {
  type: 'offer' | 'answer' | 'ice-candidate';
  payload: any;
  roomId: string;
  targetUserId?: string;
}

interface VoiceRoom {
  id: string;
  participants: Map<string, Socket>;
  hostId: string;
  createdAt: Date;
}

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class VoiceGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(VoiceGateway.name);
  private voiceRooms = new Map<string, VoiceRoom>();
  private userSockets = new Map<string, Socket>();

  constructor(private readonly configService: ConfigService) {}

  afterInit(server: Server) {
    const supabaseUrl = this.configService.get<string>('NEXT_PUBLIC_SUPABASE_URL') as string;
    server.use(SocketAuthMiddleware(supabaseUrl));
    this.logger.log('Voice Gateway initialized for WebRTC signaling');
  }

  handleConnection(client: Socket) {
    const userId = client.data.user?.userId;
    if (!userId) {
      client.disconnect();
      return;
    }

    this.userSockets.set(userId, client);
    client.data.userId = userId;
    this.logger.log(`User ${userId} connected to voice gateway [${client.id}]`);
  }

  handleDisconnect(client: Socket) {
    const userId = client.data.user?.userId;
    if (userId) {
      this.userSockets.delete(userId);
      this.leaveAllVoiceRooms(userId);
      this.logger.log(`User ${userId} disconnected from voice gateway [${client.id}]`);
    }
  }

  private leaveAllVoiceRooms(userId: string) {
    for (const [roomId, room] of this.voiceRooms.entries()) {
      if (room.participants.has(userId)) {
        this.leaveVoiceRoom(roomId, userId);
      }
    }
  }

  @SubscribeMessage('join-voice-room')
  async handleJoinVoiceRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string },
  ) {
    const userId = client.data.user?.userId;
    if (!userId) return;

    let room = this.voiceRooms.get(data.roomId);
    if (!room) {
      room = {
        id: data.roomId,
        participants: new Map(),
        hostId: userId,
        createdAt: new Date(),
      };
      this.voiceRooms.set(data.roomId, room);
    }

    room.participants.set(userId, client);
    client.join(`voice-room-${data.roomId}`);

    // Notify other participants
    client.to(`voice-room-${data.roomId}`).emit('user-joined-voice', {
      userId,
      roomId: data.roomId,
    });

    // Send current participants to the new user
    const participants = Array.from(room.participants.keys()).filter(id => id !== userId);
    client.emit('voice-room-participants', {
      roomId: data.roomId,
      participants,
    });

    this.logger.log(`User ${userId} joined voice room ${data.roomId}`);
    return { success: true, roomId: data.roomId };
  }

  @SubscribeMessage('leave-voice-room')
  handleLeaveVoiceRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string },
  ) {
    const userId = client.data.user?.userId;
    if (!userId) return;

    this.leaveVoiceRoom(data.roomId, userId);
    return { success: true };
  }

  private leaveVoiceRoom(roomId: string, userId: string) {
    const room = this.voiceRooms.get(roomId);
    if (!room) return;

    room.participants.delete(userId);
    this.server.to(`voice-room-${roomId}`).emit('user-left-voice', {
      userId,
      roomId,
    });

    // Clean up empty rooms
    if (room.participants.size === 0) {
      this.voiceRooms.delete(roomId);
      this.logger.log(`Voice room ${roomId} deleted (empty)`);
    }
  }

  @SubscribeMessage('webrtc-signal')
  handleWebRTCSignal(
    @ConnectedSocket() client: Socket,
    @MessageBody() signal: WebRTCSignal,
  ) {
    const userId = client.data.user?.userId;
    if (!userId) return;

    // Forward signal to target user or broadcast to room
    if (signal.targetUserId) {
      const targetSocket = this.userSockets.get(signal.targetUserId);
      if (targetSocket) {
        targetSocket.emit('webrtc-signal', {
          ...signal,
          senderId: userId,
        });
      }
    } else {
      client.to(`voice-room-${signal.roomId}`).emit('webrtc-signal', {
        ...signal,
        senderId: userId,
      });
    }
  }

  @SubscribeMessage('voice-room-audio-toggle')
  handleAudioToggle(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; muted: boolean },
  ) {
    const userId = client.data.user?.userId;
    if (!userId) return;

    client.to(`voice-room-${data.roomId}`).emit('user-audio-toggled', {
      userId,
      roomId: data.roomId,
      muted: data.muted,
    });
  }

  @SubscribeMessage('voice-room-video-toggle')
  handleVideoToggle(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; enabled: boolean },
  ) {
    const userId = client.data.user?.userId;
    if (!userId) return;

    client.to(`voice-room-${data.roomId}`).emit('user-video-toggled', {
      userId,
      roomId: data.roomId,
      enabled: data.enabled,
    });
  }

  @SubscribeMessage('get-voice-room-info')
  handleGetVoiceRoomInfo(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string },
  ) {
    const room = this.voiceRooms.get(data.roomId);
    if (!room) {
      client.emit('voice-room-error', { message: 'Room not found' });
      return;
    }

    client.emit('voice-room-info', {
      roomId: data.roomId,
      participants: Array.from(room.participants.keys()),
      hostId: room.hostId,
      createdAt: room.createdAt,
    });
  }
}
