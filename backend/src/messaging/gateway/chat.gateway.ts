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
    origin: '*',
  },
})
export class ChatGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ChatGateway.name);
  // Track online users: Map<userId, Set<socketId>>
  private onlineUsers = new Map<string, Set<string>>();

  constructor(
    private readonly messagingService: MessagingService,
    private readonly configService: ConfigService,
  ) {}

  afterInit(server: Server) {
    const supabaseUrl = this.configService.get<string>('NEXT_PUBLIC_SUPABASE_URL') as string;
    server.use(SocketAuthMiddleware(supabaseUrl));
    this.logger.log('WS Gateway initialized');
  }

  handleConnection(client: Socket) {
    const userId = client.data.user?.userId;
    if (userId) {
      // Personal room — receives events for all conversations without explicit joins
      client.join(`user_${userId}`);
      
      // Track online status
      if (!this.onlineUsers.has(userId)) {
        this.onlineUsers.set(userId, new Set());
        // Broadcast that user is now online
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
        // Broadcast that user is now offline
        this.server.emit('userStatusChange', { userId, status: 'offline' });
      }
    }
    this.logger.log(`User ${userId ?? 'unknown'} disconnected [${client.id}]`);
  }

  /**
   * Online Status
   */

  @SubscribeMessage('getOnlineUsers')
  handleGetOnlineUsers() {
    return Array.from(this.onlineUsers.keys());
  }

  /**
   * Room Management (used for typing indicators in active conversation)
   */

  @SubscribeMessage('joinConversation')
  handleJoinConversation(
    @ConnectedSocket() client: Socket,
    @MessageBody() conversationId: string,
  ) {
    client.join(`conv_${conversationId}`);
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
      const message = await this.messagingService.saveMessage(senderId, payload);

      // Emit to the active conversation room (for open chat windows)
      this.server.to(`conv_${payload.conversationId}`).emit('newMessage', message);

      // Also emit to every participant's personal room (for sidebar updates)
      const participantIds = await this.messagingService.getConversationParticipantIds(payload.conversationId);
      for (const participantId of participantIds) {
        // Skip if already in conversation room (would double-receive)
        const convRoom = this.server.sockets.adapter.rooms.get(`conv_${payload.conversationId}`);
        const userRoom = this.server.sockets.adapter.rooms.get(`user_${participantId}`);
        if (!userRoom) continue;

        for (const socketId of userRoom) {
          if (!convRoom?.has(socketId)) {
            this.server.to(socketId).emit('newMessage', message);
          }
        }
      }

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
    client.to(`conv_${payload.conversationId}`).emit('userTyping', {
      userId,
      isTyping: payload.isTyping,
    });
  }
}
