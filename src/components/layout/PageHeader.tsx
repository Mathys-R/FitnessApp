// src/components/layout/PageHeader.tsx
import React from 'react';

export interface PageHeaderProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}

export function PageHeader({ title, subtitle, action }: PageHeaderProps) {
  return (
    <header className="sticky top-0 z-30 ios-glass border-b border-white/[0.08] pt-[env(safe-area-inset-top)]">
      <div className="flex h-14 items-center justify-between px-4">
        <div className="flex flex-col justify-center">
          <h1 className="text-lg font-semibold text-white tracking-tight leading-none">{title}</h1>
          {subtitle && (
            <p className="mt-1 text-xs text-[#8E8E93] leading-none">{subtitle}</p>
          )}
        </div>
        {action ? (
          <div className="flex min-h-[44px] min-w-[44px] items-center justify-end">
            {action}
          </div>
        ) : null}
      </div>
    </header>
  );
}

