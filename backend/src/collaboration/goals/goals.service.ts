import { Injectable, ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.module';
import { CreateGoalDto, UpdateGoalDto, CreateMilestoneDto, GoalNoteDto } from '../dto/goals.dto';

@Injectable()
export class GoalsService {
    constructor(private supabase: SupabaseService) {}

    private async verifyGoalAccess(userId: string, goalId: string) {
        const { data: goal } = await this.supabase.getClient()
            .from('goals')
            .select('*')
            .eq('id', goalId)
            .single();

        if (!goal) throw new NotFoundException('Goal not found');

        if (goal.user_id !== userId) {
            if (!goal.group_id) throw new ForbiddenException("Not your goal");
            const { data: member } = await this.supabase.getClient()
                .from('group_members')
                .select('*')
                .eq('group_id', goal.group_id)
                .eq('user_id', userId)
                .single();
            if (!member) throw new ForbiddenException("Not authorized");
        }
        return goal;
    }

    async createGoal(userId: string, dto: CreateGoalDto) {
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
            .from('goals')
            .insert({
                user_id: userId,
                group_id: dto.groupId || null,
                title: dto.title,
                description: dto.description,
                category: dto.category || 'personal',
                target_date: dto.targetDate || null,
                priority: dto.priority || 'medium'
            })
            .select()
            .single();

        if (error) throw new BadRequestException(error.message);
        return data;
    }

    async getGoals(userId: string, groupId?: string) {
        let query = this.supabase.getClient().from('goals').select('*');

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
            query = query.eq('user_id', userId).is('group_id', null);
        }

        const { data, error } = await query.order('created_at', { ascending: false });
        if (error) throw new BadRequestException(error.message);
        return data;
    }

    async updateGoal(userId: string, goalId: string, dto: UpdateGoalDto) {
        const goal = await this.verifyGoalAccess(userId, goalId);

        const { data, error } = await this.supabase.getClient()
            .from('goals')
            .update({
                title: dto.title ?? goal.title,
                progress: dto.progress ?? goal.progress,
                status: dto.status ?? goal.status,
                milestones: dto.milestones ?? goal.milestones
            })
            .eq('id', goalId)
            .select()
            .single();

        if (error) throw new BadRequestException(error.message);
        return data;
    }

    // Sub-Milestones
    async getMilestones(userId: string, goalId: string) {
        await this.verifyGoalAccess(userId, goalId);
        const { data, error } = await this.supabase.getClient()
            .from('goal_sub_milestones')
            .select('*')
            .eq('goal_id', goalId)
            .order('created_at', { ascending: true });
        if (error) throw new BadRequestException(error.message);
        return data;
    }

    async createMilestone(userId: string, goalId: string, dto: CreateMilestoneDto) {
        await this.verifyGoalAccess(userId, goalId);
        const { data, error } = await this.supabase.getClient()
            .from('goal_sub_milestones')
            .insert({
                user_id: userId,
                goal_id: goalId,
                milestone_id: dto.milestoneId,
                title: dto.title
            })
            .select()
            .single();
        if (error) throw new BadRequestException(error.message);
        return data;
    }

    async toggleMilestone(userId: string, milestoneId: string, completed: boolean) {
        const { data: milestone } = await this.supabase.getClient()
            .from('goal_sub_milestones')
            .select('*')
            .eq('id', milestoneId)
            .single();
        if (!milestone) throw new NotFoundException('Milestone not found');

        await this.verifyGoalAccess(userId, milestone.goal_id);

        const { data, error } = await this.supabase.getClient()
            .from('goal_sub_milestones')
            .update({ completed })
            .eq('id', milestoneId)
            .select()
            .single();
            
        if (error) throw new BadRequestException(error.message);
        return data;
    }

    // Goal Notes
    async getGoalNotes(userId: string, goalId: string) {
        await this.verifyGoalAccess(userId, goalId);
        const { data, error } = await this.supabase.getClient()
            .from('goal_notes')
            .select('*')
            .eq('goal_id', goalId)
            .order('created_at', { ascending: false });
        if (error) throw new BadRequestException(error.message);
        return data;
    }

    async createGoalNote(userId: string, goalId: string, dto: GoalNoteDto) {
        await this.verifyGoalAccess(userId, goalId);
        const { data, error } = await this.supabase.getClient()
            .from('goal_notes')
            .insert({
                user_id: userId,
                goal_id: goalId,
                title: dto.title,
                content: dto.content,
                progress_point: dto.progressPoint || null,
                milestone: dto.milestone || null,
                color: dto.color || '#ffffff'
            })
            .select()
            .single();
        if (error) throw new BadRequestException(error.message);
        return data;
    }
}
