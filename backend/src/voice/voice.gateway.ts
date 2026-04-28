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
import { randomUUID } from 'crypto';

interface WebRTCSignal {
  type: 'offer' | 'answer' | 'ice-candidate';
  payload: unknown;
  roomId: string;
  targetUserId?: string;
  fromId?: string;
  videoSources?: Array<{ mid: string; source: 'camera' | 'screen' }>;
}

interface VoiceParticipantInfo {
  id: string;
  name: string;
  avatarUrl: string | null;
  isMuted: boolean;
  isSpeaking?: boolean;
  joinedAt: number;
  soundboardFile?: string;
  soundboardStartedAt?: number;
  isScreenSharing?: boolean;
  isCameraOn?: boolean;
  enterSoundUrl?: string | null;
}

interface VoiceRoomParticipant {
  socketId: string;
  socket: Socket;
  user: VoiceParticipantInfo;
}

interface VoiceChatReaction {
  emoji: string;
  users: string[];
}

interface VoiceChatMessage {
  id: string;
  roomId: string;
  userId: string;
  name: string;
  avatar: string | null;
  text: string;
  ts: number;
  reactions: VoiceChatReaction[];
}

interface VoiceRoom {
  id: string;
  participants: Map<string, VoiceRoomParticipant>;
  messages: VoiceChatMessage[];
  hostId: string;
  createdAt: Date;
}

const participantRoom = (id: string) => `voice-room-${id}`;
const presenceRoom = (id: string) => `voice-presence-${id}`;

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
  private userSockets = new Map<string, Set<Socket>>();
  private activeRoomByUser = new Map<string, string>();

  constructor(private readonly configService: ConfigService) {}

  afterInit(server: Server) {
    const supabaseUrl = this.configService.get<string>('NEXT_PUBLIC_SUPABASE_URL') as string;
    server.use(SocketAuthMiddleware(supabaseUrl));
    this.logger.log('Voice Gateway initialized');
  }

  handleConnection(client: Socket) {
    const userId = client.data.user?.userId;
    if (!userId) {
      client.disconnect();
      return;
    }

    if (!this.userSockets.has(userId)) {
      this.userSockets.set(userId, new Set());
    }
    this.userSockets.get(userId)!.add(client);
    client.data.userId = userId;
    this.logger.log(`User ${userId} connected [${client.id}]`);
  }

  handleDisconnect(client: Socket) {
    const userId = client.data.user?.userId;
    if (userId) {
      const sockets = this.userSockets.get(userId);
      sockets?.delete(client);
      if (sockets?.size === 0) {
        this.userSockets.delete(userId);
      }
      this.leaveAllVoiceRooms(userId, client.id);
      this.logger.log(`User ${userId} disconnected [${client.id}]`);
    }
  }

  private leaveAllVoiceRooms(userId: string, socketId?: string) {
    for (const [roomId, room] of this.voiceRooms.entries()) {
      const participant = room.participants.get(userId);
      if (participant && (!socketId || participant.socketId === socketId)) {
        this.leaveVoiceRoom(roomId, userId);
      }
    }
  }

  // Observers: get presence updates without being a participant.
  @SubscribeMessage('subscribe-voice-rooms')
  handleSubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomIds: string[] },
  ) {
    if (!Array.isArray(data?.roomIds)) return;
    for (const roomId of data.roomIds) {
      if (!roomId) continue;
      client.join(presenceRoom(roomId));
      // Send current state immediately
      client.emit('voice-room-users', {
        roomId,
        participants: this.getRoomParticipants(roomId),
      });
    }
  }

  @SubscribeMessage('unsubscribe-voice-rooms')
  handleUnsubscribe(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomIds: string[] },
  ) {
    if (!Array.isArray(data?.roomIds)) return;
    for (const roomId of data.roomIds) {
      if (!roomId) continue;
      client.leave(presenceRoom(roomId));
    }
  }

  @SubscribeMessage('join-voice-room')
  async handleJoinVoiceRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; user?: VoiceParticipantInfo },
  ) {
    const userId = client.data.user?.userId;
    if (!userId) return;
    if (!data.roomId) return { success: false, message: 'Missing roomId' };

    const previousRoomId = this.activeRoomByUser.get(userId);
    if (previousRoomId && previousRoomId !== data.roomId) {
      this.leaveVoiceRoom(previousRoomId, userId);
    }

    let room = this.voiceRooms.get(data.roomId);
    if (!room) {
      room = {
        id: data.roomId,
        participants: new Map(),
        messages: [],
        hostId: userId,
        createdAt: new Date(),
      };
      this.voiceRooms.set(data.roomId, room);
    }

    const participant: VoiceParticipantInfo = {
      id: userId,
      name: data.user?.name ?? 'Unknown',
      avatarUrl: data.user?.avatarUrl ?? null,
      isMuted: data.user?.isMuted ?? false,
      isSpeaking: data.user?.isSpeaking,
      joinedAt: data.user?.joinedAt ?? Date.now(),
      soundboardFile: data.user?.soundboardFile,
      soundboardStartedAt: data.user?.soundboardStartedAt,
      isScreenSharing: data.user?.isScreenSharing ?? false,
      isCameraOn: data.user?.isCameraOn ?? false,
      enterSoundUrl: data.user?.enterSoundUrl ?? null,
    };

    room.participants.set(userId, {
      socketId: client.id,
      socket: client,
      user: participant,
    });
    this.activeRoomByUser.set(userId, data.roomId);
    client.join(participantRoom(data.roomId));
    client.join(presenceRoom(data.roomId));

    // Notify all observers + participants
    this.server.to(presenceRoom(data.roomId)).emit('user-joined-voice', {
      userId,
      roomId: data.roomId,
      user: participant,
    });

    // Send full participant list to the new joiner
    const participants = this.getRoomParticipants(data.roomId).filter((u) => u.id !== userId);
    client.emit('voice-room-participants', {
      roomId: data.roomId,
      participants: participants.map((u) => u.id),
      users: participants,
    });
    this.emitRoomUsers(data.roomId);

    this.logger.log(`User ${userId} joined voice room ${data.roomId}`);
    return { success: true, roomId: data.roomId };
  }

  @SubscribeMessage('voice-chat-history')
  handleVoiceChatHistory(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string },
  ) {
    const userId = client.data.user?.userId;
    if (!userId || !data.roomId) return;

    const room = this.voiceRooms.get(data.roomId);
    if (!room?.participants.has(userId)) return;

    client.emit('voice-chat-history', {
      roomId: data.roomId,
      messages: room.messages,
    });
  }

  @SubscribeMessage('voice-chat-message')
  handleVoiceChatMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; text: string },
  ) {
    const userId = client.data.user?.userId;
    if (!userId || !data.roomId || typeof data.text !== 'string') return;

    const room = this.voiceRooms.get(data.roomId);
    const participant = room?.participants.get(userId);
    if (!room || !participant) return;

    const text = data.text.trim().slice(0, 1000);
    if (!text) return;

    const message: VoiceChatMessage = {
      id: randomUUID(),
      roomId: data.roomId,
      userId,
      name: participant.user.name,
      avatar: participant.user.avatarUrl,
      text,
      ts: Date.now(),
      reactions: [],
    };

    room.messages = [...room.messages, message].slice(-100);
    this.server.to(participantRoom(data.roomId)).emit('voice-chat-message', message);
  }

  @SubscribeMessage('voice-chat-reaction')
  handleVoiceChatReaction(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; messageId: string; emoji: string },
  ) {
    const userId = client.data.user?.userId;
    if (!userId || !data.roomId || !data.messageId || typeof data.emoji !== 'string') return;

    const room = this.voiceRooms.get(data.roomId);
    if (!room?.participants.has(userId)) return;

    const emoji = data.emoji.trim().slice(0, 16);
    if (!emoji) return;

    const message = room.messages.find((m) => m.id === data.messageId);
    if (!message) return;

    const existing = message.reactions.find((r) => r.emoji === emoji);
    if (existing) {
      existing.users = existing.users.includes(userId)
        ? existing.users.filter((id) => id !== userId)
        : [...existing.users, userId];
    } else {
      message.reactions.push({ emoji, users: [userId] });
    }
    message.reactions = message.reactions.filter((r) => r.users.length > 0);

    this.server.to(participantRoom(data.roomId)).emit('voice-chat-message-updated', message);
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

  private getRoomParticipants(roomId: string): VoiceParticipantInfo[] {
    const room = this.voiceRooms.get(roomId);
    if (!room) return [];
    return Array.from(room.participants.values()).map((p) => p.user);
  }

  private emitRoomUsers(roomId: string) {
    this.server.to(presenceRoom(roomId)).emit('voice-room-users', {
      roomId,
      participants: this.getRoomParticipants(roomId),
    });
  }

  private leaveVoiceRoom(roomId: string, userId: string) {
    const room = this.voiceRooms.get(roomId);
    if (!room) return;

    const participant = room.participants.get(userId);
    room.participants.delete(userId);
    if (this.activeRoomByUser.get(userId) === roomId) {
      this.activeRoomByUser.delete(userId);
    }
    // Leave the participant room only — keep observer subscription if still observing
    participant?.socket.leave(participantRoom(roomId));

    this.server.to(presenceRoom(roomId)).emit('user-left-voice', { userId, roomId });
    participant?.socket.emit('user-left-voice', { userId, roomId });

    if (room.participants.size === 0) {
      this.voiceRooms.delete(roomId);
      this.logger.log(`Voice room ${roomId} deleted (empty)`);
    } else {
      this.emitRoomUsers(roomId);
    }
  }

  @SubscribeMessage('webrtc-signal')
  handleWebRTCSignal(
    @ConnectedSocket() client: Socket,
    @MessageBody() signal: WebRTCSignal,
  ) {
    const userId = client.data.user?.userId;
    if (!userId) return;

    if (signal.targetUserId) {
      const room = this.voiceRooms.get(signal.roomId);
      const targetSocket =
        room?.participants.get(signal.targetUserId)?.socket ??
        Array.from(this.userSockets.get(signal.targetUserId) ?? [])[0];
      if (targetSocket) {
        targetSocket.emit('webrtc-signal', { ...signal, senderId: userId });
      }
    } else {
      client.to(participantRoom(signal.roomId)).emit('webrtc-signal', { ...signal, senderId: userId });
    }
  }

  @SubscribeMessage('voice-room-audio-toggle')
  handleAudioToggle(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; muted: boolean },
  ) {
    const userId = client.data.user?.userId;
    if (!userId) return;

    const participant = this.voiceRooms.get(data.roomId)?.participants.get(userId);
    if (participant) {
      participant.user = { ...participant.user, isMuted: data.muted };
      this.emitRoomUsers(data.roomId);
    }
    this.server.to(presenceRoom(data.roomId)).emit('user-audio-toggled', {
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
    const participant = this.voiceRooms.get(data.roomId)?.participants.get(userId);
    if (participant) {
      participant.user = { ...participant.user, isCameraOn: data.enabled };
      this.emitRoomUsers(data.roomId);
    }
    this.server.to(presenceRoom(data.roomId)).emit('user-video-toggled', {
      userId,
      roomId: data.roomId,
      enabled: data.enabled,
    });
  }

  @SubscribeMessage('voice-soundboard')
  handleSoundboard(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; sound: string },
  ) {
    const userId = client.data.user?.userId;
    if (!userId || !data.roomId || !data.sound) return;

    const room = this.voiceRooms.get(data.roomId);
    if (!room) return;

    const startedAt = Date.now();
    const participant = room.participants.get(userId);
    if (participant) {
      participant.user = {
        ...participant.user,
        soundboardFile: data.sound,
        soundboardStartedAt: startedAt,
      };
    }

    client.to(participantRoom(data.roomId)).emit('voice-soundboard', {
      senderId: userId,
      roomId: data.roomId,
      sound: data.sound,
      startedAt,
    });
  }

  @SubscribeMessage('voice-screen-share')
  handleScreenShare(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; enabled: boolean },
  ) {
    const userId = client.data.user?.userId;
    if (!userId || !data.roomId) return;

    const room = this.voiceRooms.get(data.roomId);
    if (!room) return;

    const participant = room.participants.get(userId);
    if (participant) {
      participant.user = { ...participant.user, isScreenSharing: data.enabled };
      this.emitRoomUsers(data.roomId);
    }

    this.server.to(presenceRoom(data.roomId)).emit('user-screen-toggled', {
      userId,
      roomId: data.roomId,
      enabled: data.enabled,
    });
  }

  @SubscribeMessage('voice-soundboard-stop')
  handleSoundboardStop(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string },
  ) {
    const userId = client.data.user?.userId;
    if (!userId || !data.roomId) return;

    const participant = this.voiceRooms.get(data.roomId)?.participants.get(userId);
    if (participant) {
      participant.user = { ...participant.user, soundboardFile: undefined, soundboardStartedAt: undefined };
    }

    client.to(participantRoom(data.roomId)).emit('voice-soundboard-stop', {
      senderId: userId,
      roomId: data.roomId,
    });
  }

  @SubscribeMessage('voice-kick')
  handleKick(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; targetId: string },
  ) {
    const userId = client.data.user?.userId;
    if (!userId || !data.roomId || !data.targetId) return;

    const room = this.voiceRooms.get(data.roomId);
    if (!room) return;

    const targetParticipant = room.participants.get(data.targetId);
    if (targetParticipant) {
      targetParticipant.socket.emit('voice-kicked', { roomId: data.roomId, kickedBy: userId });
    }

    this.leaveVoiceRoom(data.roomId, data.targetId);
  }

  @SubscribeMessage('voice-server-mute')
  handleServerMute(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; targetId: string; muted: boolean },
  ) {
    const userId = client.data.user?.userId;
    if (!userId || !data.roomId || !data.targetId) return;

    const room = this.voiceRooms.get(data.roomId);
    if (!room) return;

    const participant = room.participants.get(data.targetId);
    if (participant) {
      participant.user = { ...participant.user, isMuted: data.muted };
      participant.socket.emit('voice-server-muted', {
        roomId: data.roomId,
        muted: data.muted,
        mutedBy: userId,
      });
      this.emitRoomUsers(data.roomId);
    }
  }

  @SubscribeMessage('voice-move-user')
  handleMoveUser(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { fromRoomId: string; targetRoomId: string; targetId: string },
  ) {
    const userId = client.data.user?.userId;
    if (!userId || !data.fromRoomId || !data.targetRoomId || !data.targetId) return;

    const room = this.voiceRooms.get(data.fromRoomId);
    if (!room) return;

    const targetParticipant = room.participants.get(data.targetId);
    if (targetParticipant) {
      targetParticipant.socket.emit('voice-moved', {
        fromRoomId: data.fromRoomId,
        targetRoomId: data.targetRoomId,
        movedBy: userId,
      });
    }
  }

  @SubscribeMessage('voice-speaking')
  handleSpeaking(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; speaking: boolean },
  ) {
    const userId = client.data.user?.userId;
    if (!userId || !data.roomId) return;

    const participant = this.voiceRooms.get(data.roomId)?.participants.get(userId);
    if (participant) {
      participant.user = { ...participant.user, isSpeaking: data.speaking };
    }

    this.server.to(presenceRoom(data.roomId)).emit('user-speaking', {
      userId,
      roomId: data.roomId,
      speaking: data.speaking,
    });
  }

  @SubscribeMessage('get-voice-room-info')
  handleGetVoiceRoomInfo(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string },
  ) {
    const userId = client.data.user?.userId;
    const room = this.voiceRooms.get(data.roomId);
    if (!room) {
      client.emit('voice-room-error', { message: 'Room not found' });
      return;
    }

    // Send participant list so WebRTC can initialize peer connections
    const participants = this.getRoomParticipants(data.roomId).filter((u) => u.id !== userId);
    client.emit('voice-room-participants', {
      roomId: data.roomId,
      participants: participants.map((u) => u.id),
      users: participants,
    });
  }
}
