import { Controller, Get, Post, Patch, Param, Body, UseGuards, Request, Query } from '@nestjs/common';
import { TasksService } from './tasks.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CreateTaskDto, UpdateTaskDto } from '../dto/tasks.dto';

@UseGuards(JwtAuthGuard)
@Controller('tasks')
export class TasksController {
    constructor(private service: TasksService) {}

    @Get()
    getTasks(@Request() req: any, @Query('groupId') groupId?: string) {
        return this.service.getTasks(req.user.userId, groupId);
    }

    @Post()
    createTask(@Request() req: any, @Body() dto: CreateTaskDto) {
        return this.service.createTask(req.user.userId, dto);
    }

    @Patch(':id')
    updateTask(@Request() req: any, @Param('id') taskId: string, @Body() dto: UpdateTaskDto) {
        return this.service.updateTask(req.user.userId, taskId, dto);
    }
}
