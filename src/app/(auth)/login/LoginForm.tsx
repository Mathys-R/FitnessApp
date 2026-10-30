// src/app/(auth)/login/LoginForm.tsx
'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { signInWithPassword } from '@/features/auth/services/auth.service';

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const cleanEmail = email.trim();

    if (!cleanEmail || !password) {
      toast.error('Veuillez renseigner votre email et mot de passe.');
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await signInWithPassword(cleanEmail, password);
      if (error) {
        toast.error(error.message || 'Identifiants invalides.');
        return;
      }

      toast.success('Bienvenue !');
      router.push('/');
      router.refresh();
    } catch {
      toast.error('Une erreur inattendue est survenue.');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="ios-card p-6 space-y-4 w-full">
      <div className="space-y-1.5">
        <label htmlFor="email" className="block text-xs font-medium text-[#8E8E93]">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          inputMode="email"
          autoCapitalize="none"
          autoCorrect="off"
          autoComplete="email"
          placeholder="alex@fitcouple.local"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={isLoading}
          className="ios-input w-full"
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor="password" className="block text-xs font-medium text-[#8E8E93]">
          Mot de passe
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          placeholder="••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={isLoading}
          className="ios-input w-full"
        />
      </div>

      <button
        type="submit"
        disabled={isLoading}
        className="flex min-h-[44px] w-full items-center justify-center rounded-xl bg-[#0A84FF] font-medium text-white transition-opacity hover:opacity-90 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none"
      >
        {isLoading ? 'Connexion en cours...' : 'Se connecter'}
      </button>
    </form>
  );
}

