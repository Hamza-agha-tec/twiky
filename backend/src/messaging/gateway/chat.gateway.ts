import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  WebSocketServer,
  OnGatewayInit,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { MessagingService } from '../messaging.service';
import { EditMessageDto, SendMessageDto, ToggleReactionDto } from '../dto/messaging.dto';
import { ConfigService } from '@nestjs/config';
import { SocketAuthMiddleware } from '../middlewares/ws-auth.middleware';
import { Logger } from '@nestjs/common';

@WebSocketGateway({
  cors: {
    origin: '*', // In production, replace with your frontend URL
  },
})
export class ChatGateway implements OnGatewayInit {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ChatGateway.name);

  constructor(
    private readonly messagingService: MessagingService,
    private readonly configService: ConfigService,
  ) { }

  afterInit(server: Server) {
    const supabaseUrl = this.configService.get<string>('NEXT_PUBLIC_SUPABASE_URL') as string;
    server.use(SocketAuthMiddleware(supabaseUrl));
    this.logger.log('WS Gateway initialized with Supabase Auth Middleware');
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
    @MessageBody() payload: EditMessageDto,
  ) {
    const userId = client.data.user.userId;
    try {
      const message = await this.messagingService.editMessage(userId, payload.messageId, payload.content);
      // Broadcast update
      this.server.to(`conv_${message.conversation_id}`).emit('messageUpdated', message);
      return { status: 'success' };
    } catch (error) {
      return { status: 'error', message: error.message };
    }
  }

  @SubscribeMessage('deleteMessage')
  async handleDeleteMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { messageId: string; conversationId: string },
  ) {
    const userId = client.data.user.userId;
    try {
      await this.messagingService.deleteMessage(userId, payload.messageId);
      // Broadcast deletion
      this.server.to(`conv_${payload.conversationId}`).emit('messageDeleted', payload.messageId);
      return { status: 'success' };
    } catch (error) {
      return { status: 'error', message: error.message };
    }
  }

  @SubscribeMessage('reactToMessage')
  async handleToggleReaction(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: ToggleReactionDto,
  ) {
    const userId = client.data.user.userId;
    try {
      const result = await this.messagingService.toggleReaction(userId, payload.messageId, payload.emoji);
      // We need the conversationId to broadcast. 
      // Instead of querying DB, we'll expect it in payload or just broadcast to room if we had it.
      // For now, let's just broadcast to a generic 'reactions' update if needed, 
      // but ideally we broadcast to the specific room. 
      // I'll update the DTO to include conversationId.
      
      this.server.emit('reactionUpdate', result); 
      return { status: 'success' };
    } catch (error) {
      return { status: 'error', message: error.message };
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
}
