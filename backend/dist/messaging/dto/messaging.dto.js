"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SendMessageDto = exports.CreateConversationDto = void 0;
class CreateConversationDto {
    isGroup;
    name;
    participantIds;
}
exports.CreateConversationDto = CreateConversationDto;
class SendMessageDto {
    conversationId;
    content;
    type;
    fileUrl;
    metadata;
}
exports.SendMessageDto = SendMessageDto;
//# sourceMappingURL=messaging.dto.js.map