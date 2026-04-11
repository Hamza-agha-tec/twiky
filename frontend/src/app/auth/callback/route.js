import { NextResponse } from 'next/server'
// The client you created from the Server-Side Auth instructions
import { createClientForServer as createClient } from '@/utils/supabase/server'

export async function GET(request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  // if "next" is in param, use it as the redirect URL
  let next = searchParams.get('next') ?? '/'
  if (!next.startsWith('/')) {
    // if "next" is not a relative URL, use the default
    next = '/'
  }

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      // Initialize user data in the database if it doesn't exist
      const { data: { user } } = await supabase.auth.getUser()
      
      if (user) {
        // Check if user already has a profile entry
        const { data: existingUser } = await supabase
          .from('users')
          .select('id')
          .eq('id', user.id)
          .single()

        if (!existingUser) {
          // Extract metadata from Google Auth
          const username = user.user_metadata?.full_name || user.user_metadata?.name || `User_${user.id.substring(0, 5)}`
          const avatar_url = user.user_metadata?.avatar_url || ''

          // Create the main user profile
          await supabase.from('users').insert({
            id: user.id,
            username: username,
            avatar_url: avatar_url
          })

          // Create default settings for the user
          await supabase.from('user_settings').insert({
            user_id: user.id,
            theme: 'dark'
          })
        }
      }

      const forwardedHost = request.headers.get('x-forwarded-host') // original origin before load balancer
      const isLocalEnv = process.env.NODE_ENV === 'development'
      if (isLocalEnv) {
        // we can be sure that there is no load balancer in between, so no need to watch for X-Forwarded-Host
        return NextResponse.redirect(`${origin}${next}`)
      } else if (forwardedHost) {
        return NextResponse.redirect(`https://${forwardedHost}${next}`)
      } else {
        return NextResponse.redirect(`${origin}${next}`)
      }
    }
  }

  // return the user to an error page with instructions
  return NextResponse.redirect(`${origin}/auth/auth-code-error`)
}