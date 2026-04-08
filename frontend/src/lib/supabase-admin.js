import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

let supabaseAdminInstance = null;

export const getSupabaseAdmin = () => {
    if (!supabaseAdminInstance) {
        if (!supabaseUrl || !supabaseAnonKey) {
            throw new Error('Supabase environment variables are missing');
        }
        supabaseAdminInstance = createClient(supabaseUrl, supabaseAnonKey, {
            auth: {
                autoRefreshToken: false,
                persistSession: false
            }
        });
    }
    return supabaseAdminInstance;
};

export const supabaseAdmin = getSupabaseAdmin();
