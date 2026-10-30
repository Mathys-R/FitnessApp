// src/features/auth/services/auth.service.ts
import { createClient } from '@/lib/supabase/client';
import type { User, AuthError } from '@supabase/supabase-js';

export interface AuthResult {
  user: User | null;
  error: AuthError | null;
}

/**
 * Connecte un utilisateur via son email et mot de passe.
 * Respecte la Règle d'Or #3 (zéro appel direct à Supabase dans l'UI).
 */
export async function signInWithPassword(email: string, password: string): Promise<AuthResult> {
  const supabase = createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  });

  return {
    user: data.user,
    error,
  };
}

/**
 * Déconnecte la session active de l'utilisateur.
 */
export async function signOut(): Promise<{ error: AuthError | null }> {
  const supabase = createClient();
  const { error } = await supabase.auth.signOut();
  return { error };
}

/**
 * Récupère l'utilisateur actuellement authentifié.
 */
export async function getSessionUser(): Promise<User | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/**
 * Écoute les changements d'état d'authentification (connexion, déconnexion, expiration).
 */
export function onAuthStateChange(callback: (user: User | null) => void): () => void {
  const supabase = createClient();
  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((_event, session) => {
    callback(session?.user ?? null);
  });

  return () => {
    subscription.unsubscribe();
  };
}

