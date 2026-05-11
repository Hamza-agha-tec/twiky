'use client'
import { createContext, useContext, useEffect, useState } from 'react'
import { createClient } from '@/utils/supabase/client'
import { disconnectSocket, getSocket } from '@/lib/socket'

const AuthContext = createContext()

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [supabase] = useState(() => createClient())

  const getCallbackUrl = () => {
    if (typeof window !== 'undefined') {
      return `${window.location.origin}/auth/callback`;
    }
    return (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000') + "/auth/callback";
  };
  const auth_callback_url = getCallbackUrl();

  const syncSocketWithSession = async (session) => {
    if (session?.access_token) {
      console.log('JWT Token (syncSocketWithSession):', session.access_token)
      await getSocket(session.access_token)
      return
    }
    disconnectSocket()
  }

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.access_token) {
        console.log('JWT Token (initial session):', session.access_token)
      }
      void syncSocketWithSession(session)
      setSession(session)
      setUser(session?.user ?? null)
      setLoading(false)
    })

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || !session) {
        disconnectSocket()
      }
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        if (session?.access_token) {
          console.log('JWT Token (auth state change -', event, '):', session.access_token)
        }
        void syncSocketWithSession(session)
      }
      setSession(session)
      setUser(session?.user ?? null)
      setLoading(false)
    })

    return () => subscription?.unsubscribe()
  }, [supabase])

  const value = {
    user,
    session,
    signIn: (email, password) => supabase.auth.signInWithPassword({ email, password }),
    // In AuthContext.jsx, update the signInWithGoogle method
    signInWithGoogle: async () => {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: auth_callback_url,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      });

      if (error) {
        // If there's an error about email already registered
        if (error.message.includes('already registered')) {
          // Try to link the accounts
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            const { error: linkError } = await supabase.auth.linkWithOAuth({
              provider: 'google',
              options: {
                redirectTo: auth_callback_url,
              },
            });
            if (!linkError) {
              return { data: { user } };
            }
          }
        }
        return { error };
      }
      return { data };
    },
    signUp: (email, password, name) =>
      supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: name
          }
        }
      }),
    // Add this method to your AuthContext
    linkEmailPassword: async (email, password) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return { error: { message: 'Not authenticated' } };
      }

      // First, sign out the current session
      await supabase.auth.signOut();

      // Sign in with email/password
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        // If the email is already in use, try to link the accounts
        if (signInError.message.includes('already registered')) {
          const { error: linkError } = await supabase.auth.linkWithPassword({
            email,
            password,
          });

          if (linkError) {
            return { error: linkError };
          }

          // If linking is successful, sign in with the original provider
          return { data: { user } };
        }
        return { error: signInError };
      }

      return { data: signInData };
    },
    resetPassword: (email) => supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/account/update-password`
    }),
    updatePassword: (newPassword) => supabase.auth.updateUser({
      password: newPassword
    }),
    signOut: async () => {
      disconnectSocket()
      return supabase.auth.signOut()
    },
    getSession: () => supabase.auth.getSession(),
    refreshSession: () => supabase.auth.refreshSession(),
  }

  return <AuthContext.Provider value={value}>{!loading && children}</AuthContext.Provider>
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
