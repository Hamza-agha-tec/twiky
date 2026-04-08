import { createBrowserClient } from '@supabase/ssr'


const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_SERVICE_ROLE_KEY;


export function createClient() {
  return createBrowserClient(
    "https://jcljudjpdnzslwknjzqb.supabase.co",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpjbGp1ZGpwZG56c2x3a25qenFiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzU1ODAwOCwiZXhwIjoyMDgzMTM0MDA4fQ.iJL7X5_dL4r982yyMXXDwLbhOobELXlQARdy2TWe9Ko",
    {
      realtime: {
        params: {
          eventsPerSecond: 10,
        }
      }
    }
  )
}