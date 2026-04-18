// src/lib/auth.js
// Supabase auth with:
//  - Single fetch per auth event (no duplicate profile lookups)
//  - onAuthChange skips the INITIAL_SESSION event so it doesn't race initAuth
//  - Retry on profile fetch so a network hiccup doesn't kick users to login

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

// Retry a few times — handles transient network errors without bouncing
// the user to the login screen on a brief blip.
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

// Longer retry specifically for signup, since the handle_new_user trigger
// needs a moment to write the profile row after auth.users insert.
const waitForProfile = async (userId) => {
  return fetchProfileWithRetry(userId, { retries: 8, delayMs: 250 })
}

// Restore user from an existing persisted session. Used on page refresh.
export const getCurrentUser = async () => {
  const { data, error } = await supabase.auth.getSession()
  if (error) throw new Error(error.message || 'Could not restore your session.')
  const user = data?.session?.user
  if (!user) return null
  return fetchProfileWithRetry(user.id)
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
  return fetchProfileWithRetry(data.user.id)
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
  await supabase.auth.signOut()
}

// Subscribe to auth state changes — but ONLY to changes triggered after mount
// (TOKEN_REFRESHED, SIGNED_OUT, manual sign-ins from OTHER tabs).
// We deliberately skip INITIAL_SESSION because initAuth() in App.jsx handles
// the initial load. Listening to both would double-fetch and race.
export const onAuthChange = (callback) => {
  let isInitial = true
  const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
    // Skip the initial session event. App.jsx's initAuth already handles it.
    if (isInitial && event === 'INITIAL_SESSION') {
      isInitial = false
      return
    }
    isInitial = false

    // Skip token refresh — the user is still logged in, profile hasn't changed
    if (event === 'TOKEN_REFRESHED') return

    if (!session?.user) {
      callback(null)
      return
    }
    try {
      const profile = await fetchProfileWithRetry(session.user.id)
      callback(profile)
    } catch {
      // Don't bounce user to login on a transient error
      // (keeps them logged in; they can try again)
    }
  })
  return () => subscription.unsubscribe()
}