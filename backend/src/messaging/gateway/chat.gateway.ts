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
import { SendMessageDto } from '../dto/messaging.dto';
import { ConfigService } from '@nestjs/config';
import { SocketAuthMiddleware } from '../middlewares/ws-auth.middleware';
import { Logger } from '@nestjs/common';

@WebSocketGateway({
  cors: {
    origin: '*', // In production, replace with your frontend URL
  },
})
export class ChatGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ChatGateway.name);
  private activeUsers = new Map<string, Set<string>>(); // userId -> Set of socketIds

  constructor(
    private readonly messagingService: MessagingService,
    private readonly configService: ConfigService,
  ) { }

  afterInit(server: Server) {
    const supabaseUrl = this.configService.get<string>('NEXT_PUBLIC_SUPABASE_URL') as string;
    server.use(SocketAuthMiddleware(supabaseUrl));
    this.logger.log('WS Gateway initialized with Supabase Auth Middleware');
  }

  async handleConnection(client: Socket) {
    const userId = client.data?.user?.userId;
    if (!userId) {
      // In some cases, handlesConnection might be called before middleware attaches user data
      // but the middleware should have run. Log for debugging.
      this.logger.warn(`Connection attempt without user data: ${client.id}`);
      return;
    }

    if (!this.activeUsers.has(userId)) {
      this.activeUsers.set(userId, new Set());
      this.server.emit('userStatus', { userId, isOnline: true });
    }
    this.activeUsers.get(userId).add(client.id);
    this.logger.log(`User ${userId} online. Total active: ${this.activeUsers.size}`);
  }

  async handleDisconnect(client: Socket) {
    const userId = client.data?.user?.userId;
    if (!userId) return;

    const userSockets = this.activeUsers.get(userId);
    if (userSockets) {
      userSockets.delete(client.id);
      if (userSockets.size === 0) {
        this.activeUsers.delete(userId);
        this.server.emit('userStatus', { userId, isOnline: false });
      }
    }
    this.logger.log(`User ${userId} disconnected. Remaining active: ${this.activeUsers.size}`);
  }

  @SubscribeMessage('getOnlineUsers')
  handleGetOnlineUsers() {
    return Array.from(this.activeUsers.keys());
  }

  /**
   * Room Management
   */

  @SubscribeMessage('joinConversation')
  handleJoinConversation(
    @ConnectedSocket() client: Socket,
    @MessageBody() conversationId: string,
  ) {
    client.join(`conv_${conversationId}`);
    this.logger.log(`User ${client.data.user.userId} joined conversation ${conversationId}`);
    return { status: 'joined', conversationId };
  }

  @SubscribeMessage('leaveConversation')
  handleLeaveConversation(
    @ConnectedSocket() client: Socket,
    @MessageBody() conversationId: string,
  ) {
    client.leave(`conv_${conversationId}`);
    return { status: 'left', conversationId };
  }

  /**
   * Messaging
   */

  @SubscribeMessage('sendMessage')
  async handleSendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: SendMessageDto,
  ) {
    const senderId = client.data.user.userId;

    try {
      // 1. Save to DB
      const message = await this.messagingService.saveMessage(senderId, payload);

      // 2. Broadcast to everyone in the room (including sender on other devices)
      this.server.to(`conv_${payload.conversationId}`).emit('newMessage', message);

      return { status: 'sent', messageId: message.id };
    } catch (error) {
      this.logger.error(`Failed to send message: ${error.message}`);
      return { status: 'error', message: error.message };
    }
  }

  @SubscribeMessage('editMessage')
  async handleEditMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { messageId: string; conversationId: string; content: string },
  ) {
    const userId = client.data.user.userId;
    const updated = await this.messagingService.editMessage(userId, payload.messageId, payload.content);
    this.server.to(`conv_${payload.conversationId}`).emit('messageUpdated', updated);
  }

  @SubscribeMessage('deleteMessage')
  async handleDeleteMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { messageId: string; conversationId: string },
  ) {
    const userId = client.data.user.userId;
    await this.messagingService.deleteMessage(userId, payload.messageId);
    this.server.to(`conv_${payload.conversationId}`).emit('messageDeleted', payload.messageId);
  }

  @SubscribeMessage('reactToMessage')
  async handleReactToMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { messageId: string; conversationId: string; emoji: string },
  ) {
    const userId = client.data.user.userId;
    const result = await this.messagingService.reactToMessage(userId, payload.messageId, payload.emoji);
    this.server.to(`conv_${payload.conversationId}`).emit('reactionUpdate', result);
  }

  /**
   * Message Status
   */

  @SubscribeMessage('messageDelivered')
  async handleMessageDelivered(
    @ConnectedSocket() _client: Socket,
    @MessageBody() payload: { messageId: string; conversationId: string },
  ) {
    await this.messagingService.updateMessageStatus(payload.messageId, 'delivered');
    this.server.to(`conv_${payload.conversationId}`).emit('messageStatusUpdate', {
      messageId: payload.messageId,
      status: 'delivered',
    });
  }

  @SubscribeMessage('markRead')
  async handleMarkRead(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { conversationId: string },
  ) {
    const userId = client.data.user.userId;
    const messageIds = await this.messagingService.markConversationRead(userId, payload.conversationId);
    if (messageIds.length > 0) {
      this.server.to(`conv_${payload.conversationId}`).emit('messagesRead', {
        conversationId: payload.conversationId,
        readBy: userId,
        messageIds,
      });
    }
  }

  /**
   * Typing Indicators
  */

  @SubscribeMessage('typing')
  handleTyping(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { conversationId: string; isTyping: boolean },
  ) {
    const userId = client.data.user.userId;
    // Broadcast to others in the room
    client.to(`conv_${payload.conversationId}`).emit('userTyping', {
      userId,
      isTyping: payload.isTyping,
    });
  }

  /**
   * External Trigger for Service Layer
   */

  broadcastNewConversation(participantIds: string[], conversation: any) {
    participantIds.forEach(pid => {
      const userSockets = this.activeUsers.get(pid);
      if (userSockets) {
        userSockets.forEach(sid => {
          this.server.to(sid).emit('newConversation', conversation);
        });
      }
    });
  }
}
