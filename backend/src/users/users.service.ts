import { Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.module';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateSettingsDto } from './dto/update-settings.dto';

@Injectable()
export class UsersService {
    constructor(private readonly supabaseService: SupabaseService) { }

    async getUserById(id: string) {
        const { data, error } = await this.supabaseService
            .getClient()
            .from('users')
            .select('*')
            .eq('id', id)
            .single();

        if (error || !data) {
            throw new NotFoundException('User not found');
        }

        return data;
    }

    async updateProfile(id: string, updateData: UpdateUserDto) {
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

    async getSettings(userId: string) {
        const { data, error } = await this.supabaseService
            .getClient()
            .from('user_settings')
            .select('*')
            .eq('user_id', userId)
            .single();

        if (error || !data) {
            throw new NotFoundException('Settings not found');
        }
        return data;
    }

    async updateSettings(userId: string, updateData: UpdateSettingsDto) {
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

    async findByPhone(phone: string) {
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

    async searchByPhone(phone: string) {
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
}
