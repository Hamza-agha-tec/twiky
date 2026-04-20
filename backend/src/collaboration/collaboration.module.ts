import { Module } from '@nestjs/common';
import { NotesController } from './notes/notes.controller';
import { NotesService } from './notes/notes.service';
import { TasksController } from './tasks/tasks.controller';
import { TasksService } from './tasks/tasks.service';
import { GoalsController } from './goals/goals.controller';
import { GoalsService } from './goals/goals.service';
import { SupabaseModule } from '../supabase/supabase.module';

@Module({
  imports: [SupabaseModule],
  controllers: [NotesController, TasksController, GoalsController],
  providers: [NotesService, TasksService, GoalsService],
  exports: [NotesService, TasksService, GoalsService]
})
export class CollaborationModule {}
