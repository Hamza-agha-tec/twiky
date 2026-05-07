import { Injectable, ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.module';
import { UsersService } from '../users/users.service';
import { CreateContactDto, UpdateContactDto } from './dto/contacts.dto';
import { applyAvatarPrivacyBatch } from '../common/avatar-privacy.util';

@Injectable()
export class ContactsService {
  constructor(
    private supabaseService: SupabaseService,
    private usersService: UsersService,
  ) {}

  async findAll(userId: string) {
    const client = this.supabaseService.getClient();
    const { data, error } = await client
      .from('contacts')
      .select('nickname, is_blocked, is_archived, is_favorite, is_pinned, is_muted, contact:users!contact_id(id, username, avatar_url, phone_number)')
      .eq('user_id', userId);

    if (error) {
      throw new Error(`Failed to fetch contacts: ${error.message}`);
    }

    const contactUsers = (data ?? []).map((item: any) => item.contact).filter(Boolean);
    const processed = await applyAvatarPrivacyBatch(client, contactUsers, userId);
    const privacyMap = new Map(processed.map((u: any) => [u.id, u]));

    return (data ?? []).map((item: any) => ({
      nickname: item.nickname,
      is_blocked: item.is_blocked,
      is_archived: item.is_archived,
      is_favorite: item.is_favorite,
      is_pinned: item.is_pinned,
      is_muted: item.is_muted,
      ...(privacyMap.get(item.contact?.id) ?? item.contact),
    }));
  }

  async addContact(userId: string, createContactDto: CreateContactDto) {
    const { phoneNumber, nickname } = createContactDto;

    // Find the user by phone number
    const targetUser = await this.usersService.findByPhone(phoneNumber);
    if (!targetUser) {
      throw new NotFoundException(`User with phone number ${phoneNumber} not found`);
    }

    if (targetUser.id === userId) {
      throw new BadRequestException('You cannot add yourself as a contact');
    }

    // Check if contact already exists
    const { data: existing } = await this.supabaseService
      .getClient()
      .from('contacts')
      .select('*')
      .eq('user_id', userId)
      .eq('contact_id', targetUser.id)
      .maybeSingle();

    if (existing) {
      throw new ConflictException('This user is already in your contacts');
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

    // Flatten the return object
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

  async updateContact(userId: string, contactId: string, updateContactDto: UpdateContactDto) {
    const client = this.supabaseService.getClient();

    // Try UPDATE first
    const { data: updated, error: updateError } = await client
      .from('contacts')
      .update(updateContactDto)
      .eq('user_id', userId)
      .eq('contact_id', contactId)
      .select('*, contact:users!contact_id(id, username, avatar_url, phone_number)')
      .maybeSingle();

    if (updateError) {
      throw new BadRequestException(`Failed to update contact: ${updateError.message}`);
    }

    if (updated) {
      return {
        nickname: updated.nickname ?? null,
        is_blocked: updated.is_blocked ?? false,
        is_archived: updated.is_archived ?? false,
        is_favorite: updated.is_favorite ?? false,
        is_pinned: updated.is_pinned ?? false,
        is_muted: updated.is_muted ?? false,
        ...(updated.contact ?? {}),
      };
    }

    // No existing row — insert one
    const { data: inserted, error: insertError } = await client
      .from('contacts')
      .insert({ user_id: userId, contact_id: contactId, ...updateContactDto })
      .select('*, contact:users!contact_id(id, username, avatar_url, phone_number)')
      .maybeSingle();

    if (insertError) {
      throw new BadRequestException(`Failed to create contact: ${insertError.message}`);
    }

    return {
      nickname: inserted?.nickname ?? null,
      is_blocked: inserted?.is_blocked ?? false,
      is_archived: inserted?.is_archived ?? false,
      is_favorite: inserted?.is_favorite ?? false,
      is_pinned: inserted?.is_pinned ?? false,
      is_muted: inserted?.is_muted ?? false,
      ...(inserted?.contact ?? {}),
    };
  }

  async removeContact(userId: string, contactId: string) {
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
}
