"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateContactDto = exports.CreateContactDto = void 0;
class CreateContactDto {
    phoneNumber;
    nickname;
}
exports.CreateContactDto = CreateContactDto;
class UpdateContactDto {
    nickname;
    is_blocked;
    is_archived;
    is_favorite;
    is_pinned;
    is_muted;
}
exports.UpdateContactDto = UpdateContactDto;
//# sourceMappingURL=contacts.dto.js.map