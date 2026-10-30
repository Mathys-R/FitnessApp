// src/app/(protected)/layout.tsx
import { BottomNav } from '@/components/layout/BottomNav';

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col bg-black pb-[calc(4rem+env(safe-area-inset-bottom))]">
      <main className="flex-1">{children}</main>
      <BottomNav />
    </div>
  );
}

