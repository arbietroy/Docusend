import { useState, useEffect, useCallback, createContext, useContext } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

// Redirects follow whatever domain the app is served from (localhost, Vercel
// previews, production). Each origin must be in Supabase → Auth → URL Configuration.
const origin = () => window.location.origin

export function AuthProvider({ children }) {
  const [user, setUser]             = useState(null)
  const [loading, setLoading]       = useState(true)
  const [recovering, setRecovering] = useState(false)

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') setRecovering(true)
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
        emailRedirectTo: `${origin()}/auth?verified=true`,
      },
    })
  }

  const signIn = async (email, password) => {
    return await supabase.auth.signInWithPassword({ email, password })
  }

  const signInWithGoogle = async () => {
    return await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${origin()}/app` },
    })
  }

  const signOut = async () => {
    await supabase.auth.signOut()
  }

  const resetPassword = async (email) => {
    return await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${origin()}/auth?reset=true`,
    })
  }

  const updatePassword = async (password) => {
    const result = await supabase.auth.updateUser({ password })
    if (!result.error) setRecovering(false)
    return result
  }

  // Merges fields into the user's Supabase metadata
  const updateProfile = useCallback(async (data) => {
    const result = await supabase.auth.updateUser({ data })
    if (result.data?.user) setUser(result.data.user)
    return result
  }, [])

  const resendVerification = async (email) => {
    return await supabase.auth.resend({
      type: 'signup',
      email,
      options: { emailRedirectTo: `${origin()}/auth?verified=true` },
    })
  }

  const deleteAccount = async () => {
    const { error } = await supabase.functions.invoke('delete-account', { method: 'POST' })
    if (!error) await supabase.auth.signOut()
    return { error }
  }

  const meta = user?.user_metadata || {}
  const businessName = meta.business_name || meta.full_name || ''

  return (
    <AuthContext.Provider value={{
      user, loading, businessName, recovering,
      signUp, signIn, signInWithGoogle,
      signOut, resetPassword, updatePassword, updateProfile,
      resendVerification, deleteAccount,
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
