// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ProfileTargetsDrawer } from '@/features/daily-log/components/ProfileTargetsDrawer';
import {
  getCurrentProfile,
  updateProfileTargets,
  type ProfileRow,
} from '@/features/daily-log/services/profile.service';
import { toast } from 'sonner';

vi.mock('@/features/daily-log/services/profile.service', () => ({
  getCurrentProfile: vi.fn(),
  updateProfileTargets: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const mockProfile: ProfileRow = {
  id: '00000000-0000-4000-a000-000000000001',
  display_name: 'Alex',
  current_target_kcal: 2400,
  current_target_p: 170,
  current_target_g: 260,
  current_target_l: 75,
  created_at: '2026-01-01T08:00:00Z',
  updated_at: '2026-01-01T08:00:00Z',
};

describe('ProfileTargetsDrawer Component', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('affiche les valeurs initiales du profil (kcal, p, g, l)', () => {
    render(
      <ProfileTargetsDrawer
        open={true}
        onOpenChange={vi.fn()}
        initialProfile={mockProfile}
      />
    );

    expect(screen.getByText('Objectifs nutritionnels')).toBeDefined();
    expect(screen.getByDisplayValue(2400)).toBeDefined();
    expect(screen.getByDisplayValue(170)).toBeDefined();
    expect(screen.getByDisplayValue(260)).toBeDefined();
    expect(screen.getByDisplayValue(75)).toBeDefined();
  });

  it('charge le profil via getCurrentProfile si initialProfile n est pas fourni', async () => {
    vi.mocked(getCurrentProfile).mockResolvedValueOnce(mockProfile);

    render(
      <ProfileTargetsDrawer
        open={true}
        onOpenChange={vi.fn()}
      />
    );

    await waitFor(() => {
      expect(getCurrentProfile).toHaveBeenCalledTimes(1);
      expect(screen.getByDisplayValue(2400)).toBeDefined();
    });
  });

  it('calcule les Kcal depuis les macros (150*4 + 200*4 + 50*9 = 1850)', () => {
    render(
      <ProfileTargetsDrawer
        open={true}
        onOpenChange={vi.fn()}
        initialProfile={mockProfile}
      />
    );

    const inputs = screen.getAllByRole('spinbutton') as HTMLInputElement[];
    const [kcalInput, pInput, gInput, lInput] = inputs;

    fireEvent.change(pInput, { target: { value: '150' } });
    fireEvent.change(gInput, { target: { value: '200' } });
    fireEvent.change(lInput, { target: { value: '50' } });

    const calcButton = screen.getByRole('button', {
      name: /calculer kcal depuis les macros/i,
    });
    fireEvent.click(calcButton);

    expect(kcalInput.value).toBe('1850');
  });

  it('soumet les objectifs et appelle updateProfileTargets, toast.success et fermeture', async () => {
    const onOpenChange = vi.fn();
    const onTargetsUpdated = vi.fn();
    const updatedProfile: ProfileRow = {
      ...mockProfile,
      current_target_kcal: 1850,
      current_target_p: 150,
      current_target_g: 200,
      current_target_l: 50,
    };
    vi.mocked(updateProfileTargets).mockResolvedValueOnce(updatedProfile);

    render(
      <ProfileTargetsDrawer
        open={true}
        onOpenChange={onOpenChange}
        initialProfile={mockProfile}
        onTargetsUpdated={onTargetsUpdated}
      />
    );

    const inputs = screen.getAllByRole('spinbutton') as HTMLInputElement[];
    const [kcalInput, pInput, gInput, lInput] = inputs;

    fireEvent.change(kcalInput, { target: { value: '1850' } });
    fireEvent.change(pInput, { target: { value: '150' } });
    fireEvent.change(gInput, { target: { value: '200' } });
    fireEvent.change(lInput, { target: { value: '50' } });

    const submitBtn = screen.getByRole('button', {
      name: /enregistrer les objectifs/i,
    });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(updateProfileTargets).toHaveBeenCalledWith({
        current_target_kcal: 1850,
        current_target_p: 150,
        current_target_g: 200,
        current_target_l: 50,
      });
      expect(toast.success).toHaveBeenCalledWith('Objectifs mis à jour');
      expect(onTargetsUpdated).toHaveBeenCalledWith(updatedProfile);
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });
});
