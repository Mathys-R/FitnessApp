// src/app/(auth)/login/page.tsx
import { Barbell } from '@phosphor-icons/react/dist/ssr';
import { LoginForm } from './LoginForm';

export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4 py-8 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
      <div className="mb-8 flex flex-col items-center text-center">
        <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#1C1C1E] border border-white/[0.08] text-[#0A84FF] shadow-lg">
          <Barbell size={36} weight="duotone" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-white">FitCouple Tracker</h1>
        <p className="mt-1 text-sm text-[#8E8E93]">Suivi Musculation, Nutrition &amp; Poids</p>
      </div>

      <LoginForm />
    </main>
  );
}

