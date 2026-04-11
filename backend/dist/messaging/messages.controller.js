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
Object.defineProperty(exports, "__esModule", { value: true });
exports.MessagesController = void 0;
const common_1 = require("@nestjs/common");
const messaging_service_1 = require("./messaging.service");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const platform_express_1 = require("@nestjs/platform-express");
const messaging_dto_1 = require("./dto/messaging.dto");
let MessagesController = class MessagesController {
    messagingService;
    constructor(messagingService) {
        this.messagingService = messagingService;
    }
    async uploadFile(req, file) {
        return this.messagingService.uploadFile(req.user.userId, file);
    }
    async edit(req, messageId, body) {
        return this.messagingService.editMessage(req.user.userId, messageId, body.content);
    }
    async delete(req, messageId) {
        return this.messagingService.deleteMessage(req.user.userId, messageId);
    }
    async react(req, messageId, body) {
        return this.messagingService.toggleReaction(req.user.userId, messageId, body.emoji);
    }
    async findByConversation(req, conversationId, limit, offset) {
        return this.messagingService.getMessages(req.user.userId, conversationId, limit ? Number(limit) : 50, offset ? Number(offset) : 0);
    }
};
exports.MessagesController = MessagesController;
__decorate([
    (0, common_1.Post)('upload'),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file')),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.UploadedFile)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], MessagesController.prototype, "uploadFile", null);
__decorate([
    (0, common_1.Patch)(':messageId'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)('messageId')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, messaging_dto_1.EditMessageDto]),
    __metadata("design:returntype", Promise)
], MessagesController.prototype, "edit", null);
__decorate([
    (0, common_1.Delete)(':messageId'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)('messageId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], MessagesController.prototype, "delete", null);
__decorate([
    (0, common_1.Post)(':messageId/react'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)('messageId')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, messaging_dto_1.ToggleReactionDto]),
    __metadata("design:returntype", Promise)
], MessagesController.prototype, "react", null);
__decorate([
    (0, common_1.Get)(':conversationId'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)('conversationId')),
    __param(2, (0, common_1.Query)('limit')),
    __param(3, (0, common_1.Query)('offset')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Number, Number]),
    __metadata("design:returntype", Promise)
], MessagesController.prototype, "findByConversation", null);
exports.MessagesController = MessagesController = __decorate([
    (0, common_1.Controller)('messaging/messages'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __metadata("design:paramtypes", [messaging_service_1.MessagingService])
], MessagesController);
//# sourceMappingURL=messages.controller.js.map