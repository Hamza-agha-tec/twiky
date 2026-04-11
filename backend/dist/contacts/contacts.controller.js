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
exports.ContactsController = void 0;
const common_1 = require("@nestjs/common");
const contacts_service_1 = require("./contacts.service");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const contacts_dto_1 = require("./dto/contacts.dto");
let ContactsController = class ContactsController {
    contactsService;
    constructor(contactsService) {
        this.contactsService = contactsService;
    }
    async findAll(req) {
        return this.contactsService.findAll(req.user.userId);
    }
    async create(req, createContactDto) {
        return this.contactsService.addContact(req.user.userId, createContactDto);
    }
    async update(req, contactId, updateContactDto) {
        return this.contactsService.updateContact(req.user.userId, contactId, updateContactDto);
    }
    async block(req, contactId, is_blocked) {
        return this.contactsService.updateContact(req.user.userId, contactId, { is_blocked });
    }
    async archive(req, contactId, is_archived) {
        return this.contactsService.updateContact(req.user.userId, contactId, { is_archived });
    }
    async favorite(req, contactId, is_favorite) {
        return this.contactsService.updateContact(req.user.userId, contactId, { is_favorite });
    }
    async pin(req, contactId, is_pinned) {
        return this.contactsService.updateContact(req.user.userId, contactId, { is_pinned });
    }
    async mute(req, contactId, is_muted) {
        return this.contactsService.updateContact(req.user.userId, contactId, { is_muted });
    }
    async remove(req, contactId) {
        return this.contactsService.removeContact(req.user.userId, contactId);
    }
};
exports.ContactsController = ContactsController;
__decorate([
    (0, common_1.Get)(),
    __param(0, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ContactsController.prototype, "findAll", null);
__decorate([
    (0, common_1.Post)(),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, contacts_dto_1.CreateContactDto]),
    __metadata("design:returntype", Promise)
], ContactsController.prototype, "create", null);
__decorate([
    (0, common_1.Patch)(':contactId'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)('contactId')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, contacts_dto_1.UpdateContactDto]),
    __metadata("design:returntype", Promise)
], ContactsController.prototype, "update", null);
__decorate([
    (0, common_1.Patch)(':contactId/block'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)('contactId')),
    __param(2, (0, common_1.Body)('is_blocked')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Boolean]),
    __metadata("design:returntype", Promise)
], ContactsController.prototype, "block", null);
__decorate([
    (0, common_1.Patch)(':contactId/archive'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)('contactId')),
    __param(2, (0, common_1.Body)('is_archived')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Boolean]),
    __metadata("design:returntype", Promise)
], ContactsController.prototype, "archive", null);
__decorate([
    (0, common_1.Patch)(':contactId/favorite'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)('contactId')),
    __param(2, (0, common_1.Body)('is_favorite')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Boolean]),
    __metadata("design:returntype", Promise)
], ContactsController.prototype, "favorite", null);
__decorate([
    (0, common_1.Patch)(':contactId/pin'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)('contactId')),
    __param(2, (0, common_1.Body)('is_pinned')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Boolean]),
    __metadata("design:returntype", Promise)
], ContactsController.prototype, "pin", null);
__decorate([
    (0, common_1.Patch)(':contactId/mute'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)('contactId')),
    __param(2, (0, common_1.Body)('is_muted')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, Boolean]),
    __metadata("design:returntype", Promise)
], ContactsController.prototype, "mute", null);
__decorate([
    (0, common_1.Delete)(':contactId'),
    __param(0, (0, common_1.Request)()),
    __param(1, (0, common_1.Param)('contactId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], ContactsController.prototype, "remove", null);
exports.ContactsController = ContactsController = __decorate([
    (0, common_1.Controller)('contacts'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    __metadata("design:paramtypes", [contacts_service_1.ContactsService])
], ContactsController);
//# sourceMappingURL=contacts.controller.js.map