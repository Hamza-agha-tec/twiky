import { Injectable, ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.module';
import { CreateTaskDto, UpdateTaskDto } from '../dto/tasks.dto';

@Injectable()
export class TasksService {
    constructor(private supabase: SupabaseService) {}

    async createTask(userId: string, dto: CreateTaskDto) {
        if (dto.groupId) {
            const { data: member } = await this.supabase.getClient()
                .from('group_members')
                .select('*')
                .eq('group_id', dto.groupId)
                .eq('user_id', userId)
                .single();
            if (!member) throw new ForbiddenException("Not a member of this group");
        }

        const { data, error } = await this.supabase.getClient()
            .from('tasks')
            .insert({
                creator_id: userId,
                group_id: dto.groupId || null,
                title: dto.title,
                description: dto.description,
                assignee_id: dto.assigneeId || null,
                due_date: dto.dueDate || null,
                priority: dto.priority || 'medium',
                tags: dto.tags || [],
                attachments: dto.attachments || []
            })
            .select()
            .single();

        if (error) throw new BadRequestException(error.message);
        return data;
    }

    async getTasks(userId: string, groupId?: string) {
        let query = this.supabase.getClient().from('tasks').select('*, assignee:users!tasks_assignee_id_fkey(id, username, avatar_url)');

        if (groupId) {
            const { data: member } = await this.supabase.getClient()
                .from('group_members')
                .select('*')
                .eq('group_id', groupId)
                .eq('user_id', userId)
                .single();
            if (!member) throw new ForbiddenException("Not a member of this group");
            query = query.eq('group_id', groupId);
        } else {
            // Personal tasks (created by me OR assigned to me) where group_id is null
            query = query.or(`creator_id.eq.${userId},assignee_id.eq.${userId}`).is('group_id', null);
        }

        const { data, error } = await query.order('created_at', { ascending: false });
        if (error) throw new BadRequestException(error.message);
        return data;
    }

    async updateTask(userId: string, taskId: string, dto: UpdateTaskDto) {
        const { data: task } = await this.supabase.getClient()
            .from('tasks')
            .select('*')
            .eq('id', taskId)
            .single();

        if (!task) throw new NotFoundException('Task not found');

        if (task.creator_id !== userId && task.assignee_id !== userId) {
            if (!task.group_id) throw new ForbiddenException("Not your task");
            const { data: member } = await this.supabase.getClient()
                .from('group_members')
                .select('*')
                .eq('group_id', task.group_id)
                .eq('user_id', userId)
                .single();
            if (!member) throw new ForbiddenException("Not authorized");
        }

        const { data, error } = await this.supabase.getClient()
            .from('tasks')
            .update({
                title: dto.title ?? task.title,
                description: dto.description ?? task.description,
                status: dto.status ?? task.status,
                assignee_id: dto.assigneeId !== undefined ? dto.assigneeId : task.assignee_id,
                due_date: dto.dueDate !== undefined ? dto.dueDate : task.due_date,
                priority: dto.priority ?? task.priority,
                tags: dto.tags ?? task.tags,
                attachments: dto.attachments ?? task.attachments
            })
            .eq('id', taskId)
            .select()
            .single();

        if (error) throw new BadRequestException(error.message);
        return data;
    }
}
