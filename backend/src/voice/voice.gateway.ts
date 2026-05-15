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
import { SupabaseService } from '../supabase/supabase.module';
import { randomUUID } from 'crypto';
import { applyAvatarPrivacyBatch } from '../common/avatar-privacy.util';

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
  bannerUrl?: string | null;
  subPlan?: 'FREE' | 'PRO' | 'GEEK' | string | null;
  isVerified?: boolean | null;
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

interface DmCallInvite {
  conversationId: string;
  calleeId: string;
  type: 'audio' | 'video';
}

interface PendingDmCall {
  callerId: string;
  calleeId: string;
  type: 'audio' | 'video';
  timeout: ReturnType<typeof setTimeout>;
}

interface ActiveCallMeta {
  startedAt: number;
  callerId: string;
  calleeId: string;
  type: 'audio' | 'video';
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
  private userSockets = new Map<string, Set<Socket>>();
  private activeRoomByUser = new Map<string, string>();
  private pendingDmCalls = new Map<string, PendingDmCall>();
  private activeCallMeta = new Map<string, ActiveCallMeta>();

  // watch rooms: roomId → Map<userId, { socketId, username, avatarUrl, isHost, joinedAt }>
  private watchRooms = new Map<string, Map<string, { socketId: string; username: string; avatarUrl?: string | null; isHost: boolean; joinedAt: number }>>();
  // reverse index: socketId → [roomId, userId]
  private watchSocketIndex = new Map<string, [string, string]>();

  constructor(
    private readonly configService: ConfigService,
    private readonly supabaseService: SupabaseService,
  ) {}

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
      this.leaveAllWatchRooms(client.id);
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
  async handleSubscribe(
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
        participants: await this.getVisibleRoomParticipants(roomId, client.data.user?.userId ?? null),
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
      bannerUrl: data.user?.bannerUrl ?? null,
      subPlan: data.user?.subPlan ?? null,
      isVerified: data.user?.isVerified ?? null,
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

    await this.emitUserJoinedVoice(data.roomId, userId, participant);

    // Send full participant list to the new joiner
    const participants = (await this.getVisibleRoomParticipants(data.roomId, userId)).filter((u) => u.id !== userId);
    client.emit('voice-room-participants', {
      roomId: data.roomId,
      participants: participants.map((u) => u.id),
      users: participants,
    });
    await this.emitRoomUsers(data.roomId);

    this.logger.log(`User ${userId} joined voice room ${data.roomId}`);
    return { success: true, roomId: data.roomId };
  }

  @SubscribeMessage('voice-chat-history')
  async handleVoiceChatHistory(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string },
  ) {
    const userId = client.data.user?.userId;
    if (!userId || !data.roomId) return;

    const room = this.voiceRooms.get(data.roomId);
    if (!room?.participants.has(userId)) return;

    client.emit('voice-chat-history', {
      roomId: data.roomId,
      messages: await Promise.all(
        room.messages.map((message) => this.applyVoiceMessageAvatarPrivacy(message, userId)),
      ),
    });
  }

  @SubscribeMessage('voice-chat-message')
  async handleVoiceChatMessage(
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
    await this.emitVoiceChatMessage(data.roomId, 'voice-chat-message', message);
  }

  @SubscribeMessage('voice-chat-reaction')
  async handleVoiceChatReaction(
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

    await this.emitVoiceChatMessage(data.roomId, 'voice-chat-message-updated', message);
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

  private async applyParticipantAvatarPrivacy(
    participants: VoiceParticipantInfo[],
    viewerId?: string | null,
  ): Promise<VoiceParticipantInfo[]> {
    const users = participants.map((participant) => ({
      id: participant.id,
      avatar_url: participant.avatarUrl,
    }));
    const filtered = await applyAvatarPrivacyBatch(this.supabaseService.getClient(), users, viewerId);
    const avatarMap = new Map(filtered.map((user) => [user.id, user.avatar_url ?? null]));

    return participants.map((participant) => ({
      ...participant,
      avatarUrl: avatarMap.get(participant.id) ?? null,
    }));
  }

  private async applyVoiceMessageAvatarPrivacy(
    message: VoiceChatMessage,
    viewerId?: string | null,
  ): Promise<VoiceChatMessage> {
    const [user] = await applyAvatarPrivacyBatch(
      this.supabaseService.getClient(),
      [{ id: message.userId, avatar_url: message.avatar }],
      viewerId,
    );

    return { ...message, avatar: user.avatar_url ?? null };
  }

  private async emitVoiceChatMessage(roomId: string, event: string, message: VoiceChatMessage) {
    const sockets = await this.server.in(participantRoom(roomId)).fetchSockets();
    await Promise.all(sockets.map(async (socket: any) => {
      socket.emit(event, await this.applyVoiceMessageAvatarPrivacy(message, socket.data?.user?.userId ?? null));
    }));
  }

  private async getVisibleRoomParticipants(roomId: string, viewerId?: string | null) {
    return this.applyParticipantAvatarPrivacy(this.getRoomParticipants(roomId), viewerId);
  }

  private async emitRoomUsers(roomId: string) {
    const sockets = await this.server.in(presenceRoom(roomId)).fetchSockets();
    await Promise.all(sockets.map(async (socket: any) => {
      socket.emit('voice-room-users', {
        roomId,
        participants: await this.getVisibleRoomParticipants(roomId, socket.data?.user?.userId ?? null),
      });
    }));
  }

  private async emitUserJoinedVoice(roomId: string, userId: string, user: VoiceParticipantInfo) {
    const sockets = await this.server.in(presenceRoom(roomId)).fetchSockets();
    await Promise.all(sockets.map(async (socket: any) => {
      const [visibleUser] = await this.applyParticipantAvatarPrivacy([user], socket.data?.user?.userId ?? null);
      socket.emit('user-joined-voice', {
        userId,
        roomId,
        user: visibleUser,
      });
    }));
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
      void this.emitRoomUsers(roomId);
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
      void this.emitRoomUsers(data.roomId);
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
      void this.emitRoomUsers(data.roomId);
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
      void this.emitRoomUsers(data.roomId);
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
      void this.emitRoomUsers(data.roomId);
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
  async handleGetVoiceRoomInfo(
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
    const participants = (await this.getVisibleRoomParticipants(data.roomId, userId)).filter((u) => u.id !== userId);
    client.emit('voice-room-participants', {
      roomId: data.roomId,
      participants: participants.map((u) => u.id),
      users: participants,
    });
  }

  // ── Watch Room Handlers ───────────────────────────────────────────────────

  private emitWatchParticipants(roomId: string) {
    const room = this.watchRooms.get(roomId);
    if (!room) return;
    const participants = Array.from(room.entries()).map(([uid, p]) => ({
      userId: uid,
      username: p.username,
      avatarUrl: p.avatarUrl ?? null,
      isHost: p.isHost,
      joinedAt: p.joinedAt,
    }));
    this.server.to(`watch-${roomId}`).emit('watch:participants', { participants });
  }

  private leaveAllWatchRooms(socketId: string) {
    const entry = this.watchSocketIndex.get(socketId);
    if (!entry) return;
    const [roomId, userId] = entry;
    this.watchSocketIndex.delete(socketId);
    const room = this.watchRooms.get(roomId);
    if (!room) return;
    room.delete(userId);
    if (room.size === 0) this.watchRooms.delete(roomId);
    else this.emitWatchParticipants(roomId);
  }

  @SubscribeMessage('watch:join')
  handleWatchJoin(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; userId: string; username?: string; avatarUrl?: string; isHost?: boolean },
  ) {
    if (!data.roomId || !data.userId) return;
    const roomId = data.roomId;
    const userId = data.userId;

    // Remove from previous watch room if any
    const prev = this.watchSocketIndex.get(client.id);
    if (prev) {
      const [prevRoomId, prevUserId] = prev;
      this.watchRooms.get(prevRoomId)?.delete(prevUserId);
      this.emitWatchParticipants(prevRoomId);
    }

    if (!this.watchRooms.has(roomId)) this.watchRooms.set(roomId, new Map());
    this.watchRooms.get(roomId)!.set(userId, {
      socketId: client.id,
      username: data.username ?? userId,
      avatarUrl: data.avatarUrl ?? null,
      isHost: data.isHost ?? false,
      joinedAt: Date.now(),
    });
    this.watchSocketIndex.set(client.id, [roomId, userId]);
    client.join(`watch-${roomId}`);
    this.emitWatchParticipants(roomId);
  }

  @SubscribeMessage('watch:leave')
  handleWatchLeave(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; userId: string },
  ) {
    this.leaveAllWatchRooms(client.id);
  }

  @SubscribeMessage('watch:play')
  handleWatchPlay(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; timestamp: number; serverNow: number },
  ) {
    if (!data.roomId) return;
    client.to(`watch-${data.roomId}`).emit('watch:play', {
      timestamp: data.timestamp,
      serverNow: Date.now(),
    });
  }

  @SubscribeMessage('watch:pause')
  handleWatchPause(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; timestamp: number; serverNow: number },
  ) {
    if (!data.roomId) return;
    client.to(`watch-${data.roomId}`).emit('watch:pause', {
      timestamp: data.timestamp,
      serverNow: Date.now(),
    });
  }

  @SubscribeMessage('watch:seek')
  handleWatchSeek(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; timestamp: number; serverNow: number },
  ) {
    if (!data.roomId) return;
    client.to(`watch-${data.roomId}`).emit('watch:seek', {
      timestamp: data.timestamp,
      serverNow: Date.now(),
    });
  }

  @SubscribeMessage('watch:sync-request')
  handleWatchSyncRequest(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string },
  ) {
    if (!data.roomId) return;
    // Relay to host (all others) — host responds via watch:sync-response
    client.to(`watch-${data.roomId}`).emit('watch:sync-request', { roomId: data.roomId });
  }

  @SubscribeMessage('watch:sync-response')
  handleWatchSyncResponse(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; timestamp: number; paused: boolean; serverNow: number },
  ) {
    if (!data.roomId) return;
    client.to(`watch-${data.roomId}`).emit('watch:sync-response', {
      timestamp: data.timestamp,
      paused: data.paused,
      serverNow: Date.now(),
    });
  }

  private emitToUser(userId: string, event: string, data: unknown) {
    const sockets = this.userSockets.get(userId);
    if (!sockets) return;
    for (const s of sockets) s.emit(event, data);
  }

  private async saveCallLog(
    conversationId: string,
    callerId: string,
    calleeId: string,
    callType: 'audio' | 'video',
    outcome: 'ended' | 'missed' | 'declined' | 'cancelled',
    durationSeconds?: number,
  ) {
    try {
      const { data: message, error } = await this.supabaseService
        .getClient()
        .from('direct_messages')
        .insert({
          conversation_id: conversationId,
          sender_id: callerId,
          content: outcome,
          type: 'call',
          mime: callType,
          duration: durationSeconds ?? null,
          file_urls: [],
          entity_mentions: [],
        })
        .select('*, sender:users!direct_messages_sender_id_fkey(id, username, fullname, avatar_url, is_verified, sub_plan)')
        .single();

      if (error || !message) {
        this.logger.error(`Failed to save call log: ${error?.message}`);
        return;
      }

      this.server.to(`dm_${conversationId}`).emit('newDirectMessage', message);
      this.server
        .to(`user_${callerId}`)
        .to(`user_${calleeId}`)
        .emit('newDirectMessageNotification', message);
    } catch (err) {
      this.logger.error('Error saving call log', err);
    }
  }

  @SubscribeMessage('dm-call-invite')
  handleDmCallInvite(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: DmCallInvite,
  ) {
    const callerId = client.data.user?.userId;
    if (!callerId || !data.conversationId || !data.calleeId) return;
    if (callerId === data.calleeId) return;

    const roomKey = `dm-${data.conversationId}`;

    // Cancel any existing pending call for this conversation
    const existing = this.pendingDmCalls.get(roomKey);
    if (existing) {
      clearTimeout(existing.timeout);
      this.pendingDmCalls.delete(roomKey);
    }

    const callType = data.type ?? 'audio';
    const timeout = setTimeout(() => {
      this.pendingDmCalls.delete(roomKey);
      client.emit('dm-call-rejected', { conversationId: data.conversationId, reason: 'timeout' });
      void this.saveCallLog(data.conversationId, callerId, data.calleeId, callType, 'missed');
    }, 65_000);

    this.pendingDmCalls.set(roomKey, {
      callerId,
      calleeId: data.calleeId,
      type: data.type ?? 'audio',
      timeout,
    });

    this.emitToUser(data.calleeId, 'dm-call-invite', {
      conversationId: data.conversationId,
      callerId,
      type: data.type ?? 'audio',
    });
  }

  @SubscribeMessage('dm-call-accepted')
  handleDmCallAccepted(
    @ConnectedSocket() _client: Socket,
    @MessageBody() data: { conversationId: string; callerId: string },
  ) {
    const calleeId = _client.data.user?.userId;
    if (!calleeId || !data.conversationId || !data.callerId) return;

    const roomKey = `dm-${data.conversationId}`;
    const pending = this.pendingDmCalls.get(roomKey);
    if (!pending || pending.callerId !== data.callerId) return;

    clearTimeout(pending.timeout);
    this.pendingDmCalls.delete(roomKey);

    this.activeCallMeta.set(roomKey, {
      startedAt: Date.now(),
      callerId: data.callerId,
      calleeId,
      type: pending.type,
    });

    this.emitToUser(data.callerId, 'dm-call-accepted', {
      conversationId: data.conversationId,
      calleeId,
    });
  }

  @SubscribeMessage('dm-call-rejected')
  async handleDmCallRejected(
    @ConnectedSocket() _client: Socket,
    @MessageBody() data: { conversationId: string; callerId: string },
  ) {
    const calleeId = _client.data.user?.userId;
    if (!calleeId || !data.conversationId || !data.callerId) return;

    const roomKey = `dm-${data.conversationId}`;
    const pending = this.pendingDmCalls.get(roomKey);
    if (pending) {
      clearTimeout(pending.timeout);
      this.pendingDmCalls.delete(roomKey);
      await this.saveCallLog(data.conversationId, data.callerId, calleeId, pending.type, 'declined');
    }

    this.emitToUser(data.callerId, 'dm-call-rejected', {
      conversationId: data.conversationId,
      reason: 'declined',
    });
  }

  @SubscribeMessage('dm-call-cancelled')
  async handleDmCallCancelled(
    @ConnectedSocket() _client: Socket,
    @MessageBody() data: { conversationId: string; calleeId: string },
  ) {
    const callerId = _client.data.user?.userId;
    if (!callerId || !data.conversationId || !data.calleeId) return;

    const roomKey = `dm-${data.conversationId}`;
    const pending = this.pendingDmCalls.get(roomKey);
    if (pending) {
      clearTimeout(pending.timeout);
      this.pendingDmCalls.delete(roomKey);
      await this.saveCallLog(data.conversationId, callerId, data.calleeId, pending.type, 'cancelled');
    }

    this.emitToUser(data.calleeId, 'dm-call-cancelled', {
      conversationId: data.conversationId,
    });
  }

  @SubscribeMessage('dm-call-ended')
  async handleDmCallEnded(
    @ConnectedSocket() _client: Socket,
    @MessageBody() data: { conversationId: string; peerId: string },
  ) {
    const userId = _client.data.user?.userId;
    if (!userId || !data.conversationId || !data.peerId) return;

    const roomKey = `dm-${data.conversationId}`;
    const meta = this.activeCallMeta.get(roomKey);
    if (meta) {
      this.activeCallMeta.delete(roomKey);
      const durationSeconds = Math.round((Date.now() - meta.startedAt) / 1000);
      await this.saveCallLog(data.conversationId, meta.callerId, meta.calleeId, meta.type, 'ended', durationSeconds);
    }

    this.emitToUser(data.peerId, 'dm-call-ended', {
      conversationId: data.conversationId,
    });
  }
}
