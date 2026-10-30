// src/lib/supabase/config.ts

/**
 * Détermine si l'application tourne sur le conteneur mock local ou Supabase Cloud.
 */
export function isLocalMock(): boolean {
  return (
    process.env.NEXT_PUBLIC_USE_LOCAL_SUPABASE === '1' ||
    process.env.NEXT_PUBLIC_USE_LOCAL_SUPABASE === 'true'
  );
}

/**
 * Retourne l'URL Supabase appropriée.
 * En local : résout 'mock-supabase' côté SSR (Docker) et 'localhost' côté navigateur.
 */
export function getSupabaseUrl(): string {
  if (!isLocalMock()) {
    return process.env.NEXT_PUBLIC_SUPABASE_URL!;
  }

  return typeof window === 'undefined'
    ? 'http://mock-supabase:8000'
    : (process.env.NEXT_PUBLIC_LOCAL_SUPABASE_URL || 'http://localhost:8000');
}

/**
 * Retourne la clé anon Supabase appropriée.
 */
export function getSupabaseAnonKey(): string {
  if (!isLocalMock()) {
    return process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  }

  return process.env.NEXT_PUBLIC_LOCAL_SUPABASE_ANON_KEY || 'mock-anon-key';
}

/**
 * Options de cookies adaptatives.
 * En prod : undefined (nommage dynamique natif @supabase/ssr).
 * En local mock : cookieOptions unifié entre les noms d'hôtes localhost et mock-supabase.
 */
export function getSupabaseCookieOptions(): { cookieOptions?: { name: string } } {
  return isLocalMock() ? { cookieOptions: { name: 'sb-local-auth-token' } } : {};
}

