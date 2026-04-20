import { Controller, Get, Post, Patch, Param, Body, UseGuards, Request, Query } from '@nestjs/common';
import { GoalsService } from './goals.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CreateGoalDto, UpdateGoalDto, CreateMilestoneDto, GoalNoteDto } from '../dto/goals.dto';

@UseGuards(JwtAuthGuard)
@Controller('goals')
export class GoalsController {
    constructor(private service: GoalsService) {}

    @Get()
    getGoals(@Request() req: any, @Query('groupId') groupId?: string) {
        return this.service.getGoals(req.user.userId, groupId);
    }

    @Post()
    createGoal(@Request() req: any, @Body() dto: CreateGoalDto) {
        return this.service.createGoal(req.user.userId, dto);
    }

    @Patch(':id')
    updateGoal(@Request() req: any, @Param('id') goalId: string, @Body() dto: UpdateGoalDto) {
        return this.service.updateGoal(req.user.userId, goalId, dto);
    }

    @Get(':id/milestones')
    getMilestones(@Request() req: any, @Param('id') goalId: string) {
        return this.service.getMilestones(req.user.userId, goalId);
    }

    @Post(':id/milestones')
    createMilestone(@Request() req: any, @Param('id') goalId: string, @Body() dto: CreateMilestoneDto) {
        return this.service.createMilestone(req.user.userId, goalId, dto);
    }

    @Patch('milestones/:milestoneId/toggle')
    toggleMilestone(@Request() req: any, @Param('milestoneId') milestoneId: string, @Body() body: { completed: boolean }) {
        return this.service.toggleMilestone(req.user.userId, milestoneId, body.completed);
    }

    @Get(':id/notes')
    getGoalNotes(@Request() req: any, @Param('id') goalId: string) {
        return this.service.getGoalNotes(req.user.userId, goalId);
    }

    @Post(':id/notes')
    createGoalNote(@Request() req: any, @Param('id') goalId: string, @Body() dto: GoalNoteDto) {
        return this.service.createGoalNote(req.user.userId, goalId, dto);
    }
}
