import { Module } from '@nestjs/common';
import { SupabaseModule } from '../supabase/supabase.module';
import { FilesController } from './files.controller';
import { FilesService } from './files.service';

@Module({
  imports: [SupabaseModule],
  controllers: [FilesController],
  providers: [FilesService],
  exports: [FilesService],
})
export class FilesModule {}
