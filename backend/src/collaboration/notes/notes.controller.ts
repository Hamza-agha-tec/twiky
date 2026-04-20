import { Controller, Get, Post, Patch, Param, Body, UseGuards, Request, Query } from '@nestjs/common';
import { NotesService } from './notes.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CreateNoteDto, UpdateNoteDto } from '../dto/notes.dto';

@UseGuards(JwtAuthGuard)
@Controller('notes')
export class NotesController {
    constructor(private service: NotesService) {}

    @Get()
    getNotes(@Request() req: any, @Query('groupId') groupId?: string) {
        return this.service.getNotes(req.user.userId, groupId);
    }

    @Post()
    createNote(@Request() req: any, @Body() dto: CreateNoteDto) {
        return this.service.createNote(req.user.userId, dto);
    }

    @Patch(':id')
    updateNote(@Request() req: any, @Param('id') noteId: string, @Body() dto: UpdateNoteDto) {
        return this.service.updateNote(req.user.userId, noteId, dto);
    }
}
