import { Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.module';
import { CreatePostDto } from './dto/create-post.dto';
import { CreateCommentDto } from './dto/create-comment.dto';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class PostsService {
    constructor(
        private readonly supabaseService: SupabaseService,
        private readonly notificationsService: NotificationsService
    ) { }

    async createPost(userId: string, createPostDto: CreatePostDto) {
        const { data, error } = await this.supabaseService
            .getClient()
            .from('user_posts')
            .insert({ user_id: userId, ...createPostDto })
            .select()
            .single();

        if (error) throw new Error(`Failed to create post: ${error.message}`);
        return data;
    }

    async getFeed(userId: string) {
        const { data, error } = await this.supabaseService
            .getClient()
            .from('user_posts')
            .select('*, users!user_posts_user_id_fkey(id, username, avatar_url)')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (error) throw new Error(`Failed to get feed: ${error.message}`);
        return data;
    }

    async addComment(userId: string, postId: string, createCommentDto: CreateCommentDto) {
        const { data, error } = await this.supabaseService
            .getClient()
            .from('post_comments')
            .insert({ user_id: userId, post_id: postId, ...createCommentDto })
            .select()
            .single();

        if (error) throw new Error(`Failed to add comment: ${error.message}`);

        // Trigger Notification
        const post = await this.getPostById(postId);
        await this.notificationsService.notify(post.user_id, userId, 'COMMENT', postId, 'post');

        return data;
    }

    async likePost(userId: string, postId: string) {
        const { data, error } = await this.supabaseService
            .getClient()
            .from('post_likes')
            .insert({ user_id: userId, post_id: postId })
            .select()
            .single();

        if (error) throw new Error(`Failed to like post: ${error.message}`);

        // Trigger Notification (Grouped)
        const post = await this.getPostById(postId);
        await this.notificationsService.notify(post.user_id, userId, 'LIKE', postId, 'post');

        return data;
    }

    private async getPostById(postId: string) {
        const { data, error } = await this.supabaseService
            .getClient()
            .from('user_posts')
            .select('*')
            .eq('id', postId)
            .single();
        if (error || !data) throw new NotFoundException('Post not found');
        return data;
    }

    async unlikePost(userId: string, postId: string) {
        const { error } = await this.supabaseService
            .getClient()
            .from('post_likes')
            .delete()
            .match({ user_id: userId, post_id: postId });

        if (error) throw new Error(`Failed to unlike post: ${error.message}`);
        return { success: true };
    }
}
