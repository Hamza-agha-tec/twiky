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
exports.UsersService = void 0;
const common_1 = require("@nestjs/common");
const supabase_module_1 = require("../supabase/supabase.module");
let UsersService = class UsersService {
    supabaseService;
    constructor(supabaseService) {
        this.supabaseService = supabaseService;
    }
    async getUserById(id) {
        const { data, error } = await this.supabaseService
            .getClient()
            .from('users')
            .select('*')
            .eq('id', id)
            .single();
        if (error || !data) {
            throw new common_1.NotFoundException('User not found');
        }
        return data;
    }
    async updateProfile(id, updateData) {
        const { data, error } = await this.supabaseService
            .getClient()
            .from('users')
            .update(updateData)
            .eq('id', id)
            .select()
            .single();
        if (error) {
            throw new Error(`Failed to update profile: ${error.message}`);
        }
        return data;
    }
    async getSettings(userId) {
        const { data, error } = await this.supabaseService
            .getClient()
            .from('user_settings')
            .select('*')
            .eq('user_id', userId)
            .single();
        if (error || !data) {
            throw new common_1.NotFoundException('Settings not found');
        }
        return data;
    }
    async updateSettings(userId, updateData) {
        const { data, error } = await this.supabaseService
            .getClient()
            .from('user_settings')
            .update(updateData)
            .eq('user_id', userId)
            .select()
            .single();
        if (error) {
            throw new Error(`Failed to update settings: ${error.message}`);
        }
        return data;
    }
    async getUsers() {
        const { data, error } = await this.supabaseService
            .getClient()
            .from('users')
            .select('*');
        if (error) {
            throw new Error(error.message);
        }
        return data;
    }
    async findByPhone(phone) {
        const { data, error } = await this.supabaseService
            .getClient()
            .from('users')
            .select('*')
            .eq('phone_number', phone)
            .maybeSingle();
        if (error) {
            throw new Error(`Error searching for user: ${error.message}`);
        }
        return data;
    }
    async searchByPhone(phone) {
        const { data, error } = await this.supabaseService
            .getClient()
            .from('users')
            .select('id, username, avatar_url, phone_number')
            .ilike('phone_number', `%${phone}%`);
        if (error) {
            throw new Error(`Error searching for users: ${error.message}`);
        }
        return data;
    }
};
exports.UsersService = UsersService;
exports.UsersService = UsersService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [supabase_module_1.SupabaseService])
], UsersService);
//# sourceMappingURL=users.service.js.map