"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var ChatGateway_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatGateway = void 0;
const websockets_1 = require("@nestjs/websockets");
const socket_io_1 = require("socket.io");
const messaging_service_1 = require("../messaging.service");
const messaging_dto_1 = require("../dto/messaging.dto");
const config_1 = require("@nestjs/config");
const ws_auth_middleware_1 = require("../middlewares/ws-auth.middleware");
const common_1 = require("@nestjs/common");
let ChatGateway = ChatGateway_1 = class ChatGateway {
    messagingService;
    configService;
    server;
    logger = new common_1.Logger(ChatGateway_1.name);
    constructor(messagingService, configService) {
        this.messagingService = messagingService;
        this.configService = configService;
    }
    afterInit(server) {
        const supabaseUrl = this.configService.get('NEXT_PUBLIC_SUPABASE_URL');
        server.use((0, ws_auth_middleware_1.SocketAuthMiddleware)(supabaseUrl));
        this.logger.log('WS Gateway initialized with Supabase Auth Middleware');
    }
    handleJoinConversation(client, conversationId) {
        client.join(`conv_${conversationId}`);
        this.logger.log(`User ${client.data.user.userId} joined conversation ${conversationId}`);
        return { status: 'joined', conversationId };
    }
    handleLeaveConversation(client, conversationId) {
        client.leave(`conv_${conversationId}`);
        return { status: 'left', conversationId };
    }
    async handleSendMessage(client, payload) {
        const senderId = client.data.user.userId;
        try {
            const message = await this.messagingService.saveMessage(senderId, payload);
            this.server.to(`conv_${payload.conversationId}`).emit('newMessage', message);
            return { status: 'sent', messageId: message.id };
        }
        catch (error) {
            this.logger.error(`Failed to send message: ${error.message}`);
            return { status: 'error', message: error.message };
        }
    }
    handleTyping(client, payload) {
        const userId = client.data.user.userId;
        client.to(`conv_${payload.conversationId}`).emit('userTyping', {
            userId,
            isTyping: payload.isTyping,
        });
    }
};
exports.ChatGateway = ChatGateway;
__decorate([
    (0, websockets_1.WebSocketServer)(),
    __metadata("design:type", socket_io_1.Server)
], ChatGateway.prototype, "server", void 0);
__decorate([
    (0, websockets_1.SubscribeMessage)('joinConversation'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, String]),
    __metadata("design:returntype", void 0)
], ChatGateway.prototype, "handleJoinConversation", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('leaveConversation'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, String]),
    __metadata("design:returntype", void 0)
], ChatGateway.prototype, "handleLeaveConversation", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('sendMessage'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket,
        messaging_dto_1.SendMessageDto]),
    __metadata("design:returntype", Promise)
], ChatGateway.prototype, "handleSendMessage", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('typing'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __param(1, (0, websockets_1.MessageBody)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", void 0)
], ChatGateway.prototype, "handleTyping", null);
exports.ChatGateway = ChatGateway = ChatGateway_1 = __decorate([
    (0, websockets_1.WebSocketGateway)({
        cors: {
            origin: '*',
        },
    }),
    __metadata("design:paramtypes", [messaging_service_1.MessagingService,
        config_1.ConfigService])
], ChatGateway);
//# sourceMappingURL=chat.gateway.js.map