import { Module } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { SupabaseModule } from '../supabase/supabase.module';
import { ProOnlyGuard } from './guards/pro-only.guard';

@Module({
    imports: [SupabaseModule],
    controllers: [PaymentsController],
    providers: [PaymentsService, ProOnlyGuard],
    exports: [PaymentsService, ProOnlyGuard],
})
export class PaymentsModule { }
