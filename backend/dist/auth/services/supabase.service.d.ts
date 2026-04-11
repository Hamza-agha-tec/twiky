import { SupabaseClient } from '@supabase/supabase-js';
export declare class SupabaseService {
    private clientInstance;
    constructor();
    getClient(): SupabaseClient;
}
