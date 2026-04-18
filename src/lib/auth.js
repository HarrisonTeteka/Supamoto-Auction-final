// src/lib/auth.js
import { supabase } from './supabase';

// Sign in with email + password.
export const signIn = async (email, password) => {
  const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
  if (error) {
    if (error.message.includes('Invalid login')) {
      throw new Error('Account not found or incorrect password. Please try again.');
    }
    throw new Error(error.message);
  }

  const { data: profile, error: profErr } = await supabase
    .from('profiles')
    .select('id, name, role')
    .eq('id', data.user.id)
    .single();
  if (profErr) throw new Error('Could not load your profile. Please try again.');

  return { id: profile.id, name: profile.name, role: profile.role };
};

// Register with name + email + password.
export const signUp = async (name, email, password) => {
  const { data, error } = await supabase.auth.signUp({
    email: email.trim(),
    password,
    options: {
      data: { name },
    },
  });

  if (error) {
    if (error.message.includes('already registered')) {
      throw new Error('That email is already registered. Please log in instead.');
    }
    throw new Error(error.message);
  }

  await new Promise(r => setTimeout(r, 500));

  const { data: profile, error: profErr } = await supabase
    .from('profiles')
    .select('id, name, role')
    .eq('id', data.user.id)
    .single();

  if (profErr) {
    return { id: data.user.id, name, role: 'user' };
  }

  return { id: profile.id, name: profile.name, role: profile.role };
};

// Sign out.
export const signOut = async () => {
  await supabase.auth.signOut();
};

// Subscribe to auth state changes. Calls callback with { id, name, role } or null.
export const onAuthChange = (callback) => {
  const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
    if (!session?.user) {
      callback(null);
      return;
    }

    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, name, role')
        .eq('id', session.user.id)
        .single();

      if (profile) {
        callback({ id: profile.id, name: profile.name, role: profile.role });
      } else {
        // Profile row missing — fall back to session metadata
        callback({
          id: session.user.id,
          name: session.user.user_metadata?.name || session.user.email,
          role: 'user',
        });
      }
    } catch {
      // Network/DB error but session is valid — keep user logged in
      callback({
        id: session.user.id,
        name: session.user.user_metadata?.name || session.user.email,
        role: 'user',
      });
    }
  });

  return () => subscription.unsubscribe();
};