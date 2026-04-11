"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ToggleReactionDto = exports.EditMessageDto = exports.SendMessageDto = exports.CreateConversationDto = void 0;
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
    replyToId;
    isForwarded;
    metadata;
}
exports.SendMessageDto = SendMessageDto;
class EditMessageDto {
    messageId;
    content;
}
exports.EditMessageDto = EditMessageDto;
class ToggleReactionDto {
    messageId;
    emoji;
}
exports.ToggleReactionDto = ToggleReactionDto;
//# sourceMappingURL=messaging.dto.js.map