"use server"

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClientForServer() {
  const cookieStore = await cookies()
  return createServerClient(
    "https://qmdfqlvsrpebevswmugt.supabase.co",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFtZGZxbHZzcnBlYmV2c3dtdWd0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2NTM1MTMsImV4cCI6MjA5MTIyOTUxM30.XQOGUMd-wqFq1INxA19Fvqa76oe8HsW1mbDnZvRHOkQ",
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