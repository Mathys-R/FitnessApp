// @vitest-environment happy-dom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import ProtectedLayout from '@/app/(protected)/layout';

vi.mock('next/navigation', () => ({
  usePathname: () => '/',
}));

describe('ProtectedLayout Component (Couche 3 UI)', () => {
  it('projette les enfants dans le conteneur principal', () => {
    render(
      <ProtectedLayout>
        <div data-testid="dashboard-content">Contenu Dashboard</div>
      </ProtectedLayout>
    );

    expect(screen.getByTestId('dashboard-content')).toBeDefined();
    expect(screen.getByText('Contenu Dashboard')).toBeDefined();
  });

  it('inclut la BottomNav avec ses 5 onglets', () => {
    render(
      <ProtectedLayout>
        <div>Page</div>
      </ProtectedLayout>
    );

    expect(screen.getByText("Aujourd'hui")).toBeDefined();
    expect(screen.getByText('Muscu')).toBeDefined();
    expect(screen.getByText('Nutrition')).toBeDefined();
    expect(screen.getByText('Catalogues')).toBeDefined();
    expect(screen.getByText('Stats')).toBeDefined();
  });
});

