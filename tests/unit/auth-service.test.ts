// tests/unit/auth-service.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { signInWithPassword, signOut, getSessionUser } from '@/features/auth/services/auth.service';

const mockSignIn = vi.fn();
const mockSignOut = vi.fn();
const mockGetUser = vi.fn();

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      signInWithPassword: mockSignIn,
      signOut: mockSignOut,
      getUser: mockGetUser,
      onAuthStateChange: vi.fn(),
    },
  }),
}));

describe('AuthService (Couche 2)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('signInWithPassword connecte l utilisateur et trim l email', async () => {
    mockSignIn.mockResolvedValueOnce({
      data: { user: { id: 'user-01', email: 'test@fitcouple.local' } },
      error: null,
    });

    const result = await signInWithPassword('  test@fitcouple.local  ', 'secret123');

    expect(mockSignIn).toHaveBeenCalledWith({
      email: 'test@fitcouple.local',
      password: 'secret123',
    });
    expect(result.user?.id).toBe('user-01');
    expect(result.error).toBeNull();
  });

  it('signOut propage l appel de déconnexion', async () => {
    mockSignOut.mockResolvedValueOnce({ error: null });

    const result = await signOut();

    expect(mockSignOut).toHaveBeenCalledTimes(1);
    expect(result.error).toBeNull();
  });

  it('getSessionUser renvoie l utilisateur courant', async () => {
    mockGetUser.mockResolvedValueOnce({
      data: { user: { id: 'user-02' } },
    });

    const user = await getSessionUser();

    expect(mockGetUser).toHaveBeenCalledTimes(1);
    expect(user?.id).toBe('user-02');
  });
});

