import { useState, useEffect, createContext, useContext } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  const signUp = async (email, password, businessName) => {
    return await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { business_name: businessName },
        emailRedirectTo: 'https://docusendwebapp.vercel.app/auth?verified=true',
      },
    })
  }

  const signIn = async (email, password) => {
    return await supabase.auth.signInWithPassword({ email, password })
  }

  const signInWithGoogle = async () => {
    return await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: 'https://docusendwebapp.vercel.app/dashboard' },
    })
  }

  const signOut = async () => {
    await supabase.auth.signOut()
  }

  const resetPassword = async (email) => {
    return await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: 'https://docusendwebapp.vercel.app/auth?reset=true',
    })
  }

  const resendVerification = async (email) => {
    return await supabase.auth.resend({ type: 'signup', email })
  }

  const businessName = user?.user_metadata?.business_name || ''

  return (
    <AuthContext.Provider value={{
      user, loading, businessName,
      signUp, signIn, signInWithGoogle,
      signOut, resetPassword, resendVerification,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
