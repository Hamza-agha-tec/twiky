import { Module } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { SupabaseModule } from '../supabase/supabase.module';
import { ProOnlyGuard } from './guards/pro-only.guard';
import { ProductPaymentsService } from './product-payments.service';

@Module({
  imports: [SupabaseModule],
  controllers: [PaymentsController],
  providers: [PaymentsService, ProductPaymentsService, ProOnlyGuard],
  exports: [PaymentsService, ProductPaymentsService, ProOnlyGuard],
})
export class PaymentsModule { }
