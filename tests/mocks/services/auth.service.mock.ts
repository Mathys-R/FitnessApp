// tests/mocks/services/auth.service.mock.ts
import { vi } from 'vitest';
import type { User } from '@supabase/supabase-js';

export const mockAuthUser: User = {
  id: '00000000-0000-4000-a000-000000000001',
  app_metadata: {},
  user_metadata: { display_name: 'Alex' },
  aud: 'authenticated',
  created_at: '2026-01-01T08:00:00Z',
  email: 'alex@fitcouple.local',
  role: 'authenticated',
};

export const createAuthServiceMock = () => ({
  signInWithPassword: vi.fn().mockResolvedValue({ user: mockAuthUser, error: null }),
  signOut: vi.fn().mockResolvedValue({ error: null }),
  getSessionUser: vi.fn().mockResolvedValue(mockAuthUser),
  onAuthStateChange: vi.fn().mockReturnValue(() => {}),
});

