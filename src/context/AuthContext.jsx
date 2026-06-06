import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext({})

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [profileError, setProfileError] = useState(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      if (session?.user) fetchProfile(session.user.id)
      else setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) {
        setLoading(true) // Prevent flash of unauthenticated content
        fetchProfile(session.user.id)
      } else {
        setProfile(null)
        setProfileError(null)
        setLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function fetchProfile(userId, retries = 3) {
    try {
      setProfileError(null)
      const { data, error } = await supabase
        .from('profiles').select('*').eq('id', userId).single()
      
      if (error) {
        // Profile may not exist yet if trigger is slow — retry
        if (retries > 0 && error.code === 'PGRST116') {
          await new Promise(r => setTimeout(r, 800))
          return fetchProfile(userId, retries - 1)
        }
        throw error
      }
      setProfile(data)
    } catch (err) {
      console.error('Error fetching profile:', err)
      setProfileError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    return data
  }

  async function signUp(email, password, metadata) {
    const { data, error } = await supabase.auth.signUp({
      email, password, options: { data: metadata }
    })
    if (error) throw error
    return data
  }

  async function signOut() {
    await supabase.auth.signOut()
    setUser(null); setProfile(null)
  }

  async function resetPassword(email) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`
    })
    if (error) throw error
  }

  return (
    <AuthContext.Provider value={{
      user, profile, loading, role: profile?.role ?? null,
      signIn, signUp, signOut, resetPassword,
      refreshProfile: () => user && fetchProfile(user.id)
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
