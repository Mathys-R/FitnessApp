// src/app/not-found.tsx
import Link from 'next/link';
import { PageHeader } from '@/components/layout/PageHeader';

export default function NotFound() {
  return (
    <div className="flex flex-col min-h-dvh bg-black">
      <PageHeader title="Page introuvable" />
      <div className="flex flex-1 flex-col items-center justify-center p-6 text-center space-y-4">
        <p className="text-4xl font-bold text-white">404</p>
        <p className="text-sm text-[#8E8E93]">
          La page que vous recherchez n&apos;existe pas ou a été déplacée.
        </p>
        <Link
          href="/"
          className="flex min-h-[44px] items-center justify-center rounded-xl bg-[#0A84FF] px-6 text-sm font-medium text-white transition-opacity hover:opacity-90 active:scale-[0.98]"
        >
          Retour à l&apos;accueil
        </Link>
      </div>
    </div>
  );
}

