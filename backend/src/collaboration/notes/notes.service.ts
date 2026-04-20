import { Injectable, ForbiddenException, NotFoundException, BadRequestException } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.module';
import { CreateNoteDto, UpdateNoteDto } from '../dto/notes.dto';

@Injectable()
export class NotesService {
    constructor(private supabase: SupabaseService) {}

    async createNote(userId: string, dto: CreateNoteDto) {
        if (dto.groupId) {
            // Verify group access
            const { data: member } = await this.supabase.getClient()
                .from('group_members')
                .select('*')
                .eq('group_id', dto.groupId)
                .eq('user_id', userId)
                .single();
            
            if (!member) throw new ForbiddenException("Not a member of this group");
        }

        const { data, error } = await this.supabase.getClient()
            .from('notes')
            .insert({
                author_id: userId,
                group_id: dto.groupId || null,
                title: dto.title,
                content: dto.content,
                tags: dto.tags || [],
                color: dto.color || '#ffffff'
            })
            .select()
            .single();

        if (error) throw new BadRequestException(error.message);
        return data;
    }

    async getNotes(userId: string, groupId?: string) {
        let query = this.supabase.getClient().from('notes').select('*');

        if (groupId) {
            // Verify group access
            const { data: member } = await this.supabase.getClient()
                .from('group_members')
                .select('*')
                .eq('group_id', groupId)
                .eq('user_id', userId)
                .single();
            
            if (!member) throw new ForbiddenException("Not a member of this group");
            query = query.eq('group_id', groupId);
        } else {
            // Personal notes
            query = query.eq('author_id', userId).is('group_id', null);
        }

        const { data, error } = await query.order('created_at', { ascending: false });
        if (error) throw new BadRequestException(error.message);
        return data;
    }

    async updateNote(userId: string, noteId: string, dto: UpdateNoteDto) {
        // First get note to check permissions
        const { data: note } = await this.supabase.getClient()
            .from('notes')
            .select('*')
            .eq('id', noteId)
            .single();

        if (!note) throw new NotFoundException('Note not found');

        // Allow update if author OR if team member
        if (note.author_id !== userId) {
            if (!note.group_id) throw new ForbiddenException("Not your note");
            
            const { data: member } = await this.supabase.getClient()
                .from('group_members')
                .select('*')
                .eq('group_id', note.group_id)
                .eq('user_id', userId)
                .single();
            if (!member) throw new ForbiddenException("Not authorized to edit this note");
        }

        const { data, error } = await this.supabase.getClient()
            .from('notes')
            .update({
                title: dto.title ?? note.title,
                content: dto.content ?? note.content,
                tags: dto.tags ?? note.tags,
                color: dto.color ?? note.color
            })
            .eq('id', noteId)
            .select()
            .single();

        if (error) throw new BadRequestException(error.message);
        return data;
    }
}
