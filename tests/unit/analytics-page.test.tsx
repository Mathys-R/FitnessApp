// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, render, screen, fireEvent, waitFor } from '@testing-library/react';
import AnalyticsPage from '@/app/(protected)/analytics/page';
import { getCurrentProfile } from '@/features/daily-log/services/profile.service';

const h = vi.hoisted(() => ({
  tdeeProps: [] as Array<{ variant?: string; refreshKey?: number }>,
  drawerProps: { current: null as null | { open: boolean; onTargetsUpdated?: (p: unknown) => void; initialProfile?: unknown } },
  profile: {
    id: 'user-01',
    display_name: 'Alex',
    current_target_kcal: 2400,
    current_target_p: 170,
    current_target_g: 260,
    current_target_l: 75,
    created_at: '2026-01-01T08:00:00Z',
    updated_at: '2026-01-01T08:00:00Z',
  },
}));

vi.mock('@/features/analytics/components/TdeeBanner', () => ({
  TdeeBanner: (props: { variant?: string; refreshKey?: number }) => {
    h.tdeeProps.push(props);
    return <div data-testid="tdee-banner" data-variant={props.variant} data-refresh={props.refreshKey} />;
  },
}));
vi.mock('@/features/analytics/components/WeightEmaChart', () => ({
  WeightEmaChart: () => <div data-testid="weight-ema-chart" />,
}));
vi.mock('@/features/analytics/components/OneRmChart', () => ({
  OneRmChart: () => <div data-testid="one-rm-chart" />,
}));
vi.mock('@/features/analytics/components/MuscleRadar', () => ({
  MuscleRadar: () => <div data-testid="muscle-radar" />,
}));
vi.mock('@/features/analytics/components/ExportDataCard', () => ({
  ExportDataCard: () => <div data-testid="export-data-card" />,
}));
vi.mock('@/features/daily-log/components/ProfileTargetsDrawer', () => ({
  ProfileTargetsDrawer: (props: { open: boolean; onTargetsUpdated?: (p: unknown) => void; initialProfile?: unknown }) => {
    h.drawerProps.current = props;
    return props.open ? <div role="dialog" aria-label="Objectifs nutritionnels" /> : null;
  },
}));
vi.mock('@/features/daily-log/services/profile.service', () => ({
  getCurrentProfile: vi.fn(),
}));

describe('AnalyticsPage — assemblage Statistiques', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.tdeeProps.length = 0;
    h.drawerProps.current = null;
    vi.mocked(getCurrentProfile).mockResolvedValue({ ...h.profile });
  });

  it('rend les 5 cartes dans l’ordre du plan, TdeeBanner en variante full', async () => {
    render(<AnalyticsPage />);
    await waitFor(() => expect(h.drawerProps.current?.initialProfile).toEqual(h.profile));
    expect(screen.getByRole('heading', { name: 'Statistiques' })).toBeDefined();
    const ids = ['tdee-banner', 'weight-ema-chart', 'one-rm-chart', 'muscle-radar', 'export-data-card'];
    const nodes = ids.map((id) => screen.getByTestId(id));
    for (let i = 1; i < nodes.length; i++) {
      // DOCUMENT_POSITION_FOLLOWING = 4
      expect(nodes[i - 1].compareDocumentPosition(nodes[i]) & 4).toBe(4);
    }
    expect(screen.getByTestId('tdee-banner').getAttribute('data-variant')).toBe('full');
  });

  it('ouvre le tiroir des cibles avec le profil chargé', async () => {
    render(<AnalyticsPage />);
    await waitFor(() => expect(h.drawerProps.current?.initialProfile).toEqual(h.profile));
    expect(screen.queryByRole('dialog')).toBeNull();

    fireEvent.click(screen.getByLabelText('Modifier mes objectifs nutritionnels'));
    expect(screen.getByRole('dialog', { name: 'Objectifs nutritionnels' })).toBeDefined();
  });

  it('tolère un échec de chargement du profil (tiroir accessible, profil null)', async () => {
    vi.mocked(getCurrentProfile).mockRejectedValue(new Error('RLS'));
    render(<AnalyticsPage />);
    await waitFor(() => expect(getCurrentProfile).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByLabelText('Modifier mes objectifs nutritionnels'));
    expect(screen.getByRole('dialog')).toBeDefined();
    expect(h.drawerProps.current?.initialProfile).toBeNull();
  });

  it('une mise à jour des cibles incrémente le refreshKey du TdeeBanner', async () => {
    render(<AnalyticsPage />);
    expect(screen.getByTestId('tdee-banner').getAttribute('data-refresh')).toBe('0');
    await waitFor(() => expect(h.drawerProps.current?.initialProfile).toEqual(h.profile));
    act(() => {
      h.drawerProps.current?.onTargetsUpdated?.({ ...h.profile, current_target_kcal: 2200 });
    });
    expect(screen.getByTestId('tdee-banner').getAttribute('data-refresh')).toBe('1');
  });
});
