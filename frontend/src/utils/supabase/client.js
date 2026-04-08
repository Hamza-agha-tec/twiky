import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    "https://qmdfqlvsrpebevswmugt.supabase.co",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFtZGZxbHZzcnBlYmV2c3dtdWd0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2NTM1MTMsImV4cCI6MjA5MTIyOTUxM30.XQOGUMd-wqFq1INxA19Fvqa76oe8HsW1mbDnZvRHOkQ",
    {
      realtime: {
        params: {
          eventsPerSecond: 10,
        }
      }
    }
  )
}