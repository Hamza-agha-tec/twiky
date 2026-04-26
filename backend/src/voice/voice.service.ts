import { Injectable, Logger, UnauthorizedException, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.module';

@Injectable()
export class VoiceService {
  private readonly logger = new Logger(VoiceService.name);

  constructor(private readonly supabaseService: SupabaseService) {}

  async validateVoiceRoomAccess(roomId: string, userId: string): Promise<boolean> {
    try {
      const { data: group, error } = await this.supabaseService
        .getClient()
        .from('groups')
        .select(`
          id,
          channel_id,
          group_type,
          access_type,
          group_members!inner(user_id)
        `)
        .eq('id', roomId)
        .eq('group_type', 'voice')
        .eq('group_members.user_id', userId)
        .single();

      if (error || !group) {
        this.logger.warn(`User ${userId} denied access to voice room ${roomId}`);
        return false;
      }

      return true;
    } catch (error) {
      this.logger.error(`Error validating voice room access: ${error.message}`);
      return false;
    }
  }

  async getVoiceRoomInfo(roomId: string, userId: string) {
    const hasAccess = await this.validateVoiceRoomAccess(roomId, userId);
    if (!hasAccess) {
      throw new UnauthorizedException('Access denied to voice room');
    }

    const { data: group, error } = await this.supabaseService
      .getClient()
      .from('groups')
      .select(`
        id,
        name,
        description,
        channel_id,
        access_type,
        created_at,
        group_members(
          user_id,
          role,
          joined_at,
          users!group_members_user_id_fkey(
            id,
            username,
            avatar_url,
            full_name
          )
        )
      `)
      .eq('id', roomId)
      .single();

    if (error || !group) {
      throw new NotFoundException('Voice room not found');
    }

    return group;
  }

  async getUserVoiceGroups(userId: string) {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('groups')
      .select(`
        id,
        name,
        description,
        channel_id,
        access_type,
        created_at,
        group_members!inner(
          user_id,
          role,
          joined_at
        )
      `)
      .eq('group_type', 'voice')
      .eq('group_members.user_id', userId)
      .order('created_at', { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch voice groups: ${error.message}`);
    }

    return data;
  }

  async createVoiceRoom(channelId: string, creatorUserId: string, createData: {
    name: string;
    description?: string;
    access_type?: 'PUBLIC' | 'PRIVATE';
  }) {
    // Verify user is channel member
    const { data: member } = await this.supabaseService
      .getClient()
      .from('channel_members')
      .select('role')
      .eq('channel_id', channelId)
      .eq('user_id', creatorUserId)
      .single();

    if (!member || (member.role !== 'OWNER' && member.role !== 'ADMIN')) {
      throw new UnauthorizedException('Only channel admins can create voice rooms');
    }

    const { data, error } = await this.supabaseService
      .getClient()
      .from('groups')
      .insert({
        channel_id: channelId,
        name: createData.name,
        description: createData.description,
        group_type: 'voice',
        access_type: createData.access_type || 'PUBLIC',
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create voice room: ${error.message}`);
    }

    // Add creator as admin
    await this.supabaseService
      .getClient()
      .from('group_members')
      .insert({
        group_id: data.id,
        user_id: creatorUserId,
        role: 'ADMIN',
      });

    this.logger.log(`Voice room ${data.id} created by user ${creatorUserId}`);
    return data;
  }
}
