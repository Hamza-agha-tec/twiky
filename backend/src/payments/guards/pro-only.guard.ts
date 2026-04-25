import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.module';

@Injectable()
export class ProOnlyGuard implements CanActivate {
    constructor(private readonly supabaseService: SupabaseService) { }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest();
        const userId = request.user?.userId;

        if (!userId) {
            return false;
        }

        const { data, error } = await this.supabaseService
            .getClient()
            .from('user_subscriptions')
            .select('status, plan_type')
            .eq('user_id', userId)
            .eq('status', 'active')
            .in('plan_type', ['PRO', 'GEEK'])
            .maybeSingle();

        if (error || !data) {
            throw new ForbiddenException('This feature is only available for Premium subscribers.');
        }

        return true;
    }
}
