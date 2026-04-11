import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClientForServer() {
  const cookieStore = await cookies()
  const supabaseUrl = "https://qmdfqlvsrpebevswmugt.supabase.co";
  const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFtZGZxbHZzcnBlYmV2c3dtdWd0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2NTM1MTMsImV4cCI6MjA5MTIyOTUxM30.XQOGUMd-wqFq1INxA19Fvqa76oe8HsW1mbDnZvRHOkQ";

  return createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // The `setAll` method was called from a Server Component.
          }
        },
      },
    }
  )
}
