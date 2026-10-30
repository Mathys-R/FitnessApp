// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BottomNav } from '@/components/layout/BottomNav';

vi.mock('next/navigation', () => ({
  usePathname: () => '/workout',
}));

describe('BottomNav Component (Couche 3 UI)', () => {
  it('affiche les 5 onglets de navigation iOS', () => {
    render(<BottomNav />);

    expect(screen.getByText("Aujourd'hui")).toBeDefined();
    expect(screen.getByText('Muscu')).toBeDefined();
    expect(screen.getByText('Nutrition')).toBeDefined();
    expect(screen.getByText('Catalogues')).toBeDefined();
    expect(screen.getByText('Stats')).toBeDefined();
  });

  it('applique la classe active bleue sur l onglet actif', () => {
    render(<BottomNav />);

    const activeLink = screen.getByText('Muscu').closest('a');
    expect(activeLink?.className).toContain('text-[#0A84FF]');
  });
});

