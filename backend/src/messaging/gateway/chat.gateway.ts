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

  constructor(
    private readonly messagingService: MessagingService,
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
    this.logger.log(`User ${userId ?? 'unknown'} disconnected [${client.id}]`);
  }

  @SubscribeMessage('getOnlineUsers')
  handleGetOnlineUsers() {
    return Array.from(this.onlineUsers.keys());
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
      this.server.to(`dm_${payload.conversationId}`).emit('newDirectMessage', message);

      // Alert both users globally (for notification syncing)
      // Since DM has 2 users, we can just fetch the conv and emit to both
      const conv = await this.messagingService.getDirectConversations(senderId);
      const dmConv = conv.find(c => c.id === payload.conversationId);
      if (dmConv) {
        this.server.to(`user_${dmConv.user_one_id}`).to(`user_${dmConv.user_two_id}`).emit('newDirectMessageNotification', message);
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
      this.server.to(`dm_${payload.conversationId}`).emit('directMessageUpdated', updated);
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
      this.server.to(`dm_${payload.conversationId}`).emit('directMessageDeleted', payload.messageId);
    } catch (error) {
      this.logger.error(`Delete DM failed: ${error.message}`);
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
    @MessageBody() payload: { groupId: string; content: string; fileUrl?: string; replyToId?: string; entityMentions?: any[] },
  ) {
    const senderId = client.data.user.userId;
    try {
      const message = await this.messagingService.sendGroupMessage(senderId, payload.groupId, payload);
      this.server.to(`group_${payload.groupId}`).emit('newGroupMessage', message);
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
      this.server.to(`group_${payload.groupId}`).emit('groupMessageUpdated', updated);
    } catch (error) {
      this.logger.error(`Edit Group Msg failed: ${error.message}`);
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
      this.server.to(`group_${payload.groupId}`).emit('groupMessageDeleted', payload.messageId);
    } catch (error) {
      this.logger.error(`Delete Group Msg failed: ${error.message}`);
    }
  }
}
