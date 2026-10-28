// src/components/layout/BottomNav.tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  House,
  Barbell,
  ForkKnife,
  BookOpenText,
  ChartLineUp,
} from '@phosphor-icons/react';

const NAV_ITEMS = [
  { href: '/', label: "Aujourd'hui", Icon: House },
  { href: '/workout', label: 'Muscu', Icon: Barbell },
  { href: '/nutrition', label: 'Nutrition', Icon: ForkKnife },
  { href: '/catalogs', label: 'Catalogues', Icon: BookOpenText },
  { href: '/analytics', label: 'Stats', Icon: ChartLineUp },
] as const;

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 inset-x-0 z-40 ios-glass border-t border-white/[0.08] pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto flex max-w-md items-center justify-around px-1 pt-1.5 pb-1">
        {NAV_ITEMS.map(({ href, label, Icon }) => {
          const isActive = href === '/' ? pathname === '/' : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex min-h-[48px] min-w-[60px] flex-col items-center justify-center gap-0.5 rounded-xl transition-colors ${
                isActive ? 'text-[#0A84FF]' : 'text-[#8E8E93]'
              }`}
            >
              <Icon size={24} weight={isActive ? 'fill' : 'regular'} />
              <span className="text-[10px] font-medium tracking-tight">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

