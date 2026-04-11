import { ConfigService } from '@nestjs/config';
import { SupabaseClient } from '@supabase/supabase-js';
export declare class SupabaseService {
    private configService;
    private readonly logger;
    private clientInstance;
    constructor(configService: ConfigService);
    getClient(): SupabaseClient<any, "public", "public", any, any>;
}
export declare class SupabaseModule {
}
