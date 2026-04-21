import { Injectable, Logger, forwardRef, Inject } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.module';
import { ChatGateway } from '../messaging/gateway/chat.gateway';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly supabaseService: SupabaseService,
    @Inject(forwardRef(() => ChatGateway))
    private readonly chatGateway: ChatGateway,
  ) {}

  async notify(
    recipientId: string,
    actorId: string,
    type: string,
    entityId?: string,
    entityType?: string,
  ) {
    if (recipientId === actorId) return; // Don't notify self

    let notification: any;

    if (type === 'LIKE' && entityId) {
      // Aggregation logic for Likes
      const { data: existing } = await this.supabaseService
        .getClient()
        .from('notifications')
        .select('*')
        .eq('recipient_id', recipientId)
        .eq('type', 'LIKE')
        .eq('entity_id', entityId)
        .eq('is_read', false)
        .single();

      if (existing) {
        const othersCount = (existing.metadata?.others_count || 0) + 1;
        const { data: updated } = await this.supabaseService
          .getClient()
          .from('notifications')
          .update({
            actor_id: actorId, // Update to most recent actor
            metadata: { ...existing.metadata, others_count: othersCount },
            created_at: new Date().toISOString(),
          })
          .eq('id', existing.id)
          .select()
          .single();
        notification = updated;
      }
    }

    if (!notification) {
      // Create new notification (for comments, follows, or new likes)
      const { data: created, error } = await this.supabaseService
        .getClient()
        .from('notifications')
        .insert({
          recipient_id: recipientId,
          actor_id: actorId,
          type,
          entity_id: entityId,
          entity_type: entityType,
          metadata: type === 'LIKE' ? { others_count: 0 } : {},
        })
        .select(`
            *,
            actor:users!notifications_actor_id_fkey(id, username, avatar_url)
        `)
        .single();

      if (error) {
        this.logger.error(`Failed to create notification: ${error.message}`);
        return;
      }
      notification = created;
    }

    // Real-time emission
    this.chatGateway.server?.to(`user_${recipientId}`).emit('newNotification', notification);
    
    return notification;
  }

  async getNotifications(userId: string) {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('notifications')
      .select(`
        *,
        actor:users!notifications_actor_id_fkey(id, username, avatar_url)
      `)
      .eq('recipient_id', userId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw new Error(`Failed to fetch notifications: ${error.message}`);
    return data;
  }

  async markAsRead(userId: string, notificationId: string) {
    const { data, error } = await this.supabaseService
      .getClient()
      .from('notifications')
      .update({ is_read: true })
      .eq('id', notificationId)
      .eq('recipient_id', userId)
      .select()
      .single();

    if (error) throw new Error(`Failed to mark notification as read: ${error.message}`);
    return data;
  }

  async markAllAsRead(userId: string) {
    const { error } = await this.supabaseService
      .getClient()
      .from('notifications')
      .update({ is_read: true })
      .eq('recipient_id', userId)
      .eq('is_read', false);

    if (error) throw new Error(`Failed to mark all as read: ${error.message}`);
    return { success: true };
  }
}
