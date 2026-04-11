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
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContactsService = void 0;
const common_1 = require("@nestjs/common");
const supabase_module_1 = require("../supabase/supabase.module");
const users_service_1 = require("../users/users.service");
let ContactsService = class ContactsService {
    supabaseService;
    usersService;
    constructor(supabaseService, usersService) {
        this.supabaseService = supabaseService;
        this.usersService = usersService;
    }
    async findAll(userId) {
        const { data, error } = await this.supabaseService
            .getClient()
            .from('contacts')
            .select('nickname, is_blocked, is_archived, is_favorite, is_pinned, is_muted, contact:users!contact_id(id, username, avatar_url, phone_number)')
            .eq('user_id', userId);
        if (error) {
            throw new Error(`Failed to fetch contacts: ${error.message}`);
        }
        return data.map((item) => ({
            nickname: item.nickname,
            is_blocked: item.is_blocked,
            is_archived: item.is_archived,
            is_favorite: item.is_favorite,
            is_pinned: item.is_pinned,
            is_muted: item.is_muted,
            ...item.contact,
        }));
    }
    async addContact(userId, createContactDto) {
        const { phoneNumber, nickname } = createContactDto;
        const targetUser = await this.usersService.findByPhone(phoneNumber);
        if (!targetUser) {
            throw new common_1.NotFoundException(`User with phone number ${phoneNumber} not found`);
        }
        if (targetUser.id === userId) {
            throw new common_1.BadRequestException('You cannot add yourself as a contact');
        }
        const { data: existing } = await this.supabaseService
            .getClient()
            .from('contacts')
            .select('*')
            .eq('user_id', userId)
            .eq('contact_id', targetUser.id)
            .maybeSingle();
        if (existing) {
            throw new common_1.ConflictException('This user is already in your contacts');
        }
        const { data, error } = await this.supabaseService
            .getClient()
            .from('contacts')
            .insert({
            user_id: userId,
            contact_id: targetUser.id,
            nickname,
        })
            .select('*, contact:users!contact_id(id, username, avatar_url, phone_number)')
            .single();
        if (error) {
            throw new Error(`Failed to add contact: ${error.message}`);
        }
        return {
            nickname: data.nickname,
            is_blocked: data.is_blocked,
            is_archived: data.is_archived,
            is_favorite: data.is_favorite,
            is_pinned: data.is_pinned,
            is_muted: data.is_muted,
            ...data.contact,
        };
    }
    async updateContact(userId, contactId, updateContactDto) {
        const { data, error } = await this.supabaseService
            .getClient()
            .from('contacts')
            .update(updateContactDto)
            .eq('user_id', userId)
            .eq('contact_id', contactId)
            .select('*, contact:users!contact_id(id, username, avatar_url, phone_number)')
            .maybeSingle();
        if (error) {
            throw new Error(`Failed to update contact: ${error.message}`);
        }
        if (!data) {
            throw new common_1.NotFoundException(`Contact with ID ${contactId} not found in your list`);
        }
        return {
            nickname: data.nickname,
            is_blocked: data.is_blocked,
            is_archived: data.is_archived,
            is_favorite: data.is_favorite,
            is_pinned: data.is_pinned,
            is_muted: data.is_muted,
            ...data.contact,
        };
    }
    async removeContact(userId, contactId) {
        const { error } = await this.supabaseService
            .getClient()
            .from('contacts')
            .delete()
            .eq('user_id', userId)
            .eq('contact_id', contactId);
        if (error) {
            throw new Error(`Failed to delete contact: ${error.message}`);
        }
        return { success: true };
    }
};
exports.ContactsService = ContactsService;
exports.ContactsService = ContactsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [supabase_module_1.SupabaseService,
        users_service_1.UsersService])
], ContactsService);
//# sourceMappingURL=contacts.service.js.map