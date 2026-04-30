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
import { MessagingService } from '../messaging.service';
import { SpotifyService } from '../../spotify/spotify.service';
import { ConfigService } from '@nestjs/config';
import { SocketAuthMiddleware } from '../middlewares/ws-auth.middleware';
import { Logger } from '@nestjs/common';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class ChatGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ChatGateway.name);
  private onlineUsers = new Map<string, Set<string>>();
  // targetUserId → Set of watcher socketIds
  private spotifyWatchers = new Map<string, Set<string>>();

  constructor(
    private readonly messagingService: MessagingService,
    private readonly spotifyService: SpotifyService,
    private readonly configService: ConfigService,
  ) { }

  afterInit(server: Server) {
    const supabaseUrl = this.configService.get<string>('NEXT_PUBLIC_SUPABASE_URL') as string;
    server.use(SocketAuthMiddleware(supabaseUrl));
    this.logger.log('WS Gateway initialized built for Direct and Group architecture');
  }

  handleConnection(client: Socket) {
    const userId = client.data.user?.userId;
    if (userId) {
      client.join(`user_${userId}`);
      if (!this.onlineUsers.has(userId)) {
        this.onlineUsers.set(userId, new Set());
        this.server.emit('userStatusChange', { userId, status: 'online' });
      }
      this.onlineUsers.get(userId)!.add(client.id);
      this.logger.log(`User ${userId} connected [${client.id}]`);
    } else {
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    const userId = client.data.user?.userId;
    if (userId && this.onlineUsers.has(userId)) {
      const userSockets = this.onlineUsers.get(userId)!;
      userSockets.delete(client.id);

      if (userSockets.size === 0) {
        this.onlineUsers.delete(userId);
        this.server.emit('userStatusChange', { userId, status: 'offline' });
      }
    }

    // Clean up any Spotify subscriptions this socket had
    for (const [targetUserId, watchers] of this.spotifyWatchers) {
      if (watchers.has(client.id)) {
        this.removeSpotifyWatcher(targetUserId, client.id);
      }
    }

    this.logger.log(`User ${userId ?? 'unknown'} disconnected [${client.id}]`);
  }

  private removeSpotifyWatcher(targetUserId: string, socketId: string) {
    const watchers = this.spotifyWatchers.get(targetUserId);
    if (!watchers) return;
    watchers.delete(socketId);
    if (watchers.size === 0) {
      this.spotifyWatchers.delete(targetUserId);
      this.spotifyService.stopWatching(targetUserId);
    }
  }

  emitGroupMessageCreated(groupId: string, message: any) {
    this.server?.to(`group_${groupId}`).emit('newGroupMessage', message);
  }

  emitGroupMessageUpdated(groupId: string, message: any) {
    this.server?.to(`group_${groupId}`).emit('groupMessageUpdated', message);
  }

  emitGroupMessageDeleted(groupId: string, messageId: string) {
    this.server?.to(`group_${groupId}`).emit('groupMessageDeleted', { groupId, messageId });
  }

  emitDirectMessageCreated(conversationId: string, message: any) {
    this.server?.to(`dm_${conversationId}`).emit('newDirectMessage', message);
  }

  emitDirectMessageNotification(userOneId: string, userTwoId: string, message: any) {
    this.server?.to(`user_${userOneId}`).to(`user_${userTwoId}`).emit('newDirectMessageNotification', message);
  }

  emitDirectMessageUpdated(conversationId: string, message: any) {
    this.server?.to(`dm_${conversationId}`).emit('directMessageUpdated', message);
  }

  emitDirectMessageDeleted(conversationId: string, messageId: string) {
    this.server?.to(`dm_${conversationId}`).emit('directMessageDeleted', { conversationId, messageId });
  }

  @SubscribeMessage('getOnlineUsers')
  handleGetOnlineUsers() {
    return Array.from(this.onlineUsers.keys());
  }

  // ==========================================
  // SPOTIFY NOW PLAYING
  // ==========================================

  @SubscribeMessage('subscribeSpotifyStatus')
  handleSubscribeSpotify(
    @ConnectedSocket() client: Socket,
    @MessageBody() targetUserId: string,
  ) {
    const viewerUserId = client.data.user?.userId;
    if (!viewerUserId || !targetUserId) return;

    client.join(`spotify_${targetUserId}`);

    if (!this.spotifyWatchers.has(targetUserId)) {
      this.spotifyWatchers.set(targetUserId, new Set());
    }
    this.spotifyWatchers.get(targetUserId)!.add(client.id);

    // Emit cached data instantly (no await)
    const cached = this.spotifyService.getCachedNowPlaying(targetUserId);
    if (cached) {
      client.emit('spotifyNowPlaying', { userId: targetUserId, ...cached });
    }

    // Start background polling — emits via socket only when track changes
    this.spotifyService.startWatching(targetUserId, (data) => {
      this.server.to(`spotify_${targetUserId}`).emit('spotifyNowPlaying', { userId: targetUserId, ...data });
    });

    return { status: 'subscribed', targetUserId };
  }

  @SubscribeMessage('unsubscribeSpotifyStatus')
  handleUnsubscribeSpotify(
    @ConnectedSocket() client: Socket,
    @MessageBody() targetUserId: string,
  ) {
    client.leave(`spotify_${targetUserId}`);
    this.removeSpotifyWatcher(targetUserId, client.id);
    return { status: 'unsubscribed', targetUserId };
  }

  // ==========================================
  // ROOM MANAGEMENT & TYPING
  // ==========================================

  @SubscribeMessage('joinDirectRoom')
  handleJoinDirectConversation(
    @ConnectedSocket() client: Socket,
    @MessageBody() conversationId: string,
  ) {
    client.join(`dm_${conversationId}`);
    return { status: 'joined_dm', conversationId };
  }

  @SubscribeMessage('joinGroupRoom')
  handleJoinGroupConversation(
    @ConnectedSocket() client: Socket,
    @MessageBody() groupId: string,
  ) {
    client.join(`group_${groupId}`);
    return { status: 'joined_group', groupId };
  }

  @SubscribeMessage('leaveRoom')
  handleLeaveRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() roomId: string, // Provide exact string 'dm_XX' or 'group_XX'
  ) {
    client.leave(roomId);
    return { status: 'left', roomId };
  }

  @SubscribeMessage('typing')
  handleTyping(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { roomId: string; isTyping: boolean }, // roomId should be prefixed e.g. 'dm_uuid'
  ) {
    const userId = client.data.user.userId;
    client.to(payload.roomId).emit('userTyping', {
      userId,
      isTyping: payload.isTyping,
    });
  }

  // ==========================================
  // DIRECT MESSAGING
  // ==========================================

  @SubscribeMessage('sendDirectMessage')
  async handleSendDirectMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { conversationId: string; content: string; fileUrl?: string; replyToId?: string; entityMentions?: any[] },
  ) {
    const senderId = client.data.user.userId;
    try {
      const message = await this.messagingService.sendDirectMessage(senderId, payload.conversationId, payload);

      // Broadcast to local room
      this.emitDirectMessageCreated(payload.conversationId, message);

      // Alert both users globally (for notification syncing)
      // Since DM has 2 users, we can just fetch the conv and emit to both
      const conv = await this.messagingService.getDirectConversations(senderId);
      const dmConv = conv.find(c => c.id === payload.conversationId);
      if (dmConv) {
        this.emitDirectMessageNotification(dmConv.user_one_id, dmConv.user_two_id, message);
      }

      return { status: 'sent', messageId: message.id };
    } catch (error) {
      this.logger.error(`Send DM failed: ${error.message}`);
      return { status: 'error', message: error.message };
    }
  }

  @SubscribeMessage('editDirectMessage')
  async handleEditDirectMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { messageId: string; conversationId: string; content: string },
  ) {
    const userId = client.data.user.userId;
    try {
      const updated = await this.messagingService.editDirectMessage(userId, payload.messageId, payload.content);
      this.emitDirectMessageUpdated(payload.conversationId, updated);
    } catch (error) {
      this.logger.error(`Edit DM failed: ${error.message}`);
    }
  }

  @SubscribeMessage('deleteDirectMessage')
  async handleDeleteDirectMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { messageId: string; conversationId: string },
  ) {
    const userId = client.data.user.userId;
    try {
      await this.messagingService.deleteDirectMessage(userId, payload.messageId);
      this.emitDirectMessageDeleted(payload.conversationId, payload.messageId);
    } catch (error) {
      this.logger.error(`Delete DM failed: ${error.message}`);
    }
  }

  @SubscribeMessage('reactToDirectMessage')
  async handleReactToDirectMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { messageId: string; conversationId: string; emoji: string },
  ) {
    const userId = client.data.user.userId;
    try {
      const updated = await this.messagingService.toggleDirectMessageReaction(userId, payload.messageId, payload.emoji);
      this.emitDirectMessageUpdated(payload.conversationId, updated);
      return { status: 'updated', messageId: updated.id };
    } catch (error) {
      this.logger.error(`DM reaction failed: ${error.message}`);
      return { status: 'error', message: error.message };
    }
  }

  @SubscribeMessage('directMessageDelivered')
  async handleDirectMessageDelivered(
    @ConnectedSocket() _client: Socket,
    @MessageBody() payload: { messageId: string; conversationId: string },
  ) {
    await this.messagingService.updateDirectMessageStatus(payload.messageId, 'delivered');
    this.server.to(`dm_${payload.conversationId}`).emit('directMessageStatusUpdate', {
      messageId: payload.messageId,
      status: 'delivered',
    });
  }

  @SubscribeMessage('markDirectRead')
  async handleMarkDirectRead(
    @ConnectedSocket() _client: Socket,
    @MessageBody() payload: { messageId: string; conversationId: string },
  ) {
    await this.messagingService.updateDirectMessageStatus(payload.messageId, 'read');
    this.server.to(`dm_${payload.conversationId}`).emit('directMessageStatusUpdate', {
      messageId: payload.messageId,
      status: 'read',
    });
  }

  // ==========================================
  // GROUP MESSAGING
  // ==========================================

  @SubscribeMessage('sendGroupMessage')
  async handleSendGroupMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { groupId: string; content: string; fileUrl?: string; replyToId?: string; entityMentions?: any[]; type?: 'voice' | 'image' | 'file'; mime?: string; duration?: number; size?: number },
  ) {
    const senderId = client.data.user.userId;
    try {
      const message = await this.messagingService.sendGroupMessage(senderId, payload.groupId, payload);
      this.emitGroupMessageCreated(payload.groupId, message);
      return { status: 'sent', messageId: message.id };
    } catch (error) {
      this.logger.error(`Send Group Message failed: ${error.message}`);
      return { status: 'error', message: error.message };
    }
  }

  @SubscribeMessage('editGroupMessage')
  async handleEditGroupMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { messageId: string; groupId: string; content: string },
  ) {
    const userId = client.data.user.userId;
    try {
      const updated = await this.messagingService.editGroupMessage(userId, payload.messageId, payload.content);
      this.emitGroupMessageUpdated(payload.groupId, updated);
    } catch (error) {
      this.logger.error(`Edit Group Msg failed: ${error.message}`);
    }
  }

  @SubscribeMessage('reactToGroupMessage')
  async handleReactToGroupMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { messageId: string; groupId: string; emoji: string },
  ) {
    const userId = client.data.user.userId;
    try {
      const updated = await this.messagingService.toggleGroupMessageReaction(userId, payload.messageId, payload.emoji);
      this.emitGroupMessageUpdated(payload.groupId, updated);
      return { status: 'updated', messageId: updated.id };
    } catch (error) {
      this.logger.error(`Group reaction failed: ${error.message}`);
      return { status: 'error', message: error.message };
    }
  }

  @SubscribeMessage('toggleGroupMessagePin')
  async handleToggleGroupMessagePin(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { messageId: string; groupId: string },
  ) {
    const userId = client.data.user.userId;
    try {
      const updated = await this.messagingService.toggleGroupMessagePin(userId, payload.messageId);
      this.emitGroupMessageUpdated(payload.groupId, updated);
      return { status: 'updated', messageId: updated.id };
    } catch (error) {
      this.logger.error(`Group pin failed: ${error.message}`);
      return { status: 'error', message: error.message };
    }
  }

  @SubscribeMessage('deleteGroupMessage')
  async handleDeleteGroupMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { messageId: string; groupId: string },
  ) {
    const userId = client.data.user.userId;
    try {
      await this.messagingService.deleteGroupMessage(userId, payload.messageId);
      this.emitGroupMessageDeleted(payload.groupId, payload.messageId);
    } catch (error) {
      this.logger.error(`Delete Group Msg failed: ${error.message}`);
    }
  }
}
