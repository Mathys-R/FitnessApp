import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  isLocalMock,
  getSupabaseUrl,
  getSupabaseAnonKey,
  getSupabaseCookieOptions,
} from '@/lib/supabase/config';

describe('Supabase Environment Config', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('active le mode mock quand NEXT_PUBLIC_USE_LOCAL_SUPABASE vaut 1', () => {
    process.env.NEXT_PUBLIC_USE_LOCAL_SUPABASE = '1';
    expect(isLocalMock()).toBe(true);
    expect(getSupabaseCookieOptions()).toEqual({
      cookieOptions: { name: 'sb-local-auth-token' },
    });
  });

  it('désactive le mode mock et passe en prod quand NEXT_PUBLIC_USE_LOCAL_SUPABASE vaut 0', () => {
    process.env.NEXT_PUBLIC_USE_LOCAL_SUPABASE = '0';
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://prod-project.supabase.co';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'prod-anon-key';

    expect(isLocalMock()).toBe(false);
    expect(getSupabaseUrl()).toBe('https://prod-project.supabase.co');
    expect(getSupabaseAnonKey()).toBe('prod-anon-key');
    expect(getSupabaseCookieOptions()).toEqual({});
  });
});

