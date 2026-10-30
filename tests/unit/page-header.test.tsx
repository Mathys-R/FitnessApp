// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PageHeader } from '@/components/layout/PageHeader';

describe('PageHeader Component (Couche 3 UI)', () => {
  it('affiche le titre dans un h1 et le sous-titre optionnel', () => {
    render(<PageHeader title="Aujourd'hui" subtitle="30 octobre" />);

    const heading = screen.getByRole('heading', { level: 1, name: "Aujourd'hui" });
    expect(heading).toBeDefined();
    expect(screen.getByText('30 octobre')).toBeDefined();
  });

  it('rend l action contextuelle optionnelle si fournie', () => {
    render(
      <PageHeader
        title="Musculation"
        action={<button data-testid="header-action">Filtre</button>}
      />
    );

    expect(screen.getByTestId('header-action')).toBeDefined();
  });

  it('applique la classe critique Safe Area haute pt-[env(safe-area-inset-top)]', () => {
    const { container } = render(<PageHeader title="Test" />);
    const header = container.querySelector('header');

    expect(header?.className).toContain('pt-[env(safe-area-inset-top)]');
  });
});

