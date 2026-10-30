// src/lib/supabase/client.ts
import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';
import { getSupabaseUrl, getSupabaseAnonKey, getSupabaseCookieOptions } from './config';

export function createClient(): SupabaseClient<Database> {
  return createBrowserClient(
    getSupabaseUrl(),
    getSupabaseAnonKey(),
    getSupabaseCookieOptions()
  ) as unknown as SupabaseClient<Database>;
}
