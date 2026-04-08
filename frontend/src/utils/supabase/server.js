"use server"

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClientForServer() {
  const cookieStore = await cookies()
  return createServerClient(
    "https://jcljudjpdnzslwknjzqb.supabase.co",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpjbGp1ZGpwZG56c2x3a25qenFiIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzU1ODAwOCwiZXhwIjoyMDgzMTM0MDA4fQ.iJL7X5_dL4r982yyMXXDwLbhOobELXlQARdy2TWe9Ko",
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            )
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
        get(name) {
          return cookieStore.get(name)?.value;
        },
        set(name, value, options) {
          cookieStore.set(name, value, options);
        },
        remove(name, options) {
          cookieStore.set(name, '', options);
        },
      },
    },
  )
}