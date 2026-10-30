// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { LoginForm } from '@/app/(auth)/login/LoginForm';
import { signInWithPassword } from '@/features/auth/services/auth.service';
import type { User, AuthError } from '@supabase/supabase-js';
import { toast } from 'sonner';

const mockPush = vi.fn();
const mockRefresh = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    refresh: mockRefresh,
  }),
}));

vi.mock('@/features/auth/services/auth.service', () => ({
  signInWithPassword: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

describe('LoginForm Component (Couche 3 UI)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rend les champs email, mot de passe et le bouton de soumission', () => {
    render(<LoginForm />);

    expect(screen.getByLabelText(/email/i)).toBeDefined();
    expect(screen.getByLabelText(/mot de passe/i)).toBeDefined();
    expect(screen.getByRole('button', { name: /se connecter/i })).toBeDefined();
  });

  it('bloque la soumission si les champs sont vides', async () => {
    render(<LoginForm />);

    fireEvent.click(screen.getByRole('button', { name: /se connecter/i }));

    expect(toast.error).toHaveBeenCalledWith('Veuillez renseigner votre email et mot de passe.');
    expect(signInWithPassword).not.toHaveBeenCalled();
  });

  it('appelle signInWithPassword avec email assaini et redirige en cas de succes', async () => {
    vi.mocked(signInWithPassword).mockResolvedValueOnce({
      user: { id: 'user-01' } as User,
      error: null,
    });

    render(<LoginForm />);

    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: '  alex@fitcouple.local  ' },
    });
    fireEvent.change(screen.getByLabelText(/mot de passe/i), {
      target: { value: 'secret123' },
    });
    fireEvent.click(screen.getByRole('button', { name: /se connecter/i }));

    await waitFor(() => {
      expect(signInWithPassword).toHaveBeenCalledWith('alex@fitcouple.local', 'secret123');
      expect(toast.success).toHaveBeenCalledWith('Bienvenue !');
      expect(mockPush).toHaveBeenCalledWith('/');
      expect(mockRefresh).toHaveBeenCalled();
    });
  });

  it('affiche un toast d erreur si la connexion echoue', async () => {
    vi.mocked(signInWithPassword).mockResolvedValueOnce({
      user: null,
      error: { message: 'Identifiants invalides.' } as AuthError,
    });

    render(<LoginForm />);

    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: 'bad@fitcouple.local' },
    });
    fireEvent.change(screen.getByLabelText(/mot de passe/i), {
      target: { value: 'wrong' },
    });
    fireEvent.click(screen.getByRole('button', { name: /se connecter/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Identifiants invalides.');
      expect(mockPush).not.toHaveBeenCalled();
    });
  });
});

