// tests/fixtures/profiles.fixture.ts
import type { Database } from '@/types/database.types';

export type ProfileRow = Database['public']['Tables']['profiles']['Row'];

export const mockUserA: ProfileRow = {
  id: '00000000-0000-4000-a000-000000000001',
  display_name: 'Alex',
  current_target_kcal: 2400,
  current_target_p: 170,
  current_target_g: 260,
  current_target_l: 75,
  created_at: '2026-01-01T08:00:00Z',
  updated_at: '2026-01-01T08:00:00Z',
};

export const mockUserB: ProfileRow = {
  id: '00000000-0000-4000-a000-000000000002',
  display_name: 'Sam',
  current_target_kcal: 1900,
  current_target_p: 130,
  current_target_g: 210,
  current_target_l: 60,
  created_at: '2026-01-01T08:00:00Z',
  updated_at: '2026-01-01T08:00:00Z',
};

export const mockPartnerInfo = {
  partner_id: mockUserB.id,
  partner_name: mockUserB.display_name,
};
