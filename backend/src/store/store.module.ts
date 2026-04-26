import { Module } from '@nestjs/common';
import { StoreController } from './store.controller';
import { StoreService } from './store.service';
import { SupabaseModule } from '../supabase/supabase.module';

@Module({
    imports: [SupabaseModule],
    controllers: [StoreController],
    providers: [StoreService],
    exports: [StoreService],
})
export class StoreModule {}
