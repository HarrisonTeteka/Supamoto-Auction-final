// src/lib/auth.js
import { supabase } from './supabase'

const fetchProfileByUserId = async (userId) => {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, name, role')
    .eq('id', userId)
    .single()
  if (error || !data) throw new Error('Could not load your profile. Please try again.')
  return { id: data.id, name: data.name, role: data.role }
}

const fetchProfileWithRetry = async (userId, { retries = 3, delayMs = 300 } = {}) => {
  let lastErr
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      return await fetchProfileByUserId(userId)
    } catch (err) {
      lastErr = err
      if (attempt < retries - 1) await new Promise((r) => setTimeout(r, delayMs))
    }
  }
  throw lastErr
}

const waitForProfile = async (userId) => {
  return fetchProfileWithRetry(userId, { retries: 8, delayMs: 250 })
}

// No longer used for session restore — onAuthChange handles everything now.
// Kept only as a fallback for explicit session checks.
export const getCurrentUser = async () => {
  const { data } = await supabase.auth.getSession()
  const user = data?.session?.user
  if (!user) return null
  // Try to get profile for role — fall back to session metadata instantly
  try {
    return await fetchProfileByUserId(user.id)
  } catch {
    return {
      id: user.id,
      name: user.user_metadata?.name || user.email,
      role: user.user_metadata?.role || 'user',
    }
  }
}

export const signIn = async (email, password) => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  })
  if (error) {
    if (error.message?.toLowerCase().includes('invalid')) {
      throw new Error('Account not found or incorrect password. Please try again.')
    }
    throw new Error(error.message)
  }
  // Return immediately from auth session — no profiles query on login.
  // Profile data (name, role) is loaded lazily in the background via onAuthChange.
  const u = data.user
  return {
    id: u.id,
    name: u.user_metadata?.name || u.email,
    role: u.user_metadata?.role || 'user',
  }
}

export const signUp = async (name, email, password) => {
  const { data, error } = await supabase.auth.signUp({
    email: email.trim(),
    password,
    options: { data: { name } },
  })
  if (error) {
    if (error.message?.toLowerCase().includes('already registered')) {
      throw new Error('That email is already registered. Please log in instead.')
    }
    throw new Error(error.message)
  }
  return waitForProfile(data.user.id)
}

export const signOut = async () => {
  await supabase.auth.signOut().catch(() => {})
}

// Single source of truth for auth state.
// Fires INITIAL_SESSION on mount with the stored session (or null).
// This replaces getCurrentUser for session restore — no hanging getSession() call.
export const onAuthChange = (callback) => {
  const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
    // TOKEN_REFRESHED — user is still logged in, profile unchanged, skip
    if (event === 'TOKEN_REFRESHED') return

    if (!session?.user) {
      callback(null)
      return
    }
<<<<<<< HEAD
    // Return from session immediately so UI never hangs
    const u = session.user
    const minimal = {
      id: u.id,
      name: u.user_metadata?.name || u.email,
      role: u.user_metadata?.role || 'user',
=======

    try {
      const profile = await fetchProfileWithRetry(session.user.id)
      callback(profile)
    } catch {
      // Transient error — don't bounce to login
>>>>>>> af806dc62e8f74e887c28b28843dc8b18e1a6677
    }
    callback(minimal)
    // Then try to enrich with DB profile (role) in background
    fetchProfileByUserId(u.id)
      .then((profile) => callback(profile))
      .catch(() => {/* keep minimal profile */})
  })
  return () => subscription.unsubscribe()
}