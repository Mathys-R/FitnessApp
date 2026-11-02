// docker/mock-server/db.mjs
// Base de données en mémoire vive (in-memory state) pour le développement local

export const mockUser = {
  id: '00000000-0000-4000-a000-000000000001',
  aud: 'authenticated',
  role: 'authenticated',
  email: 'alex@fitcouple.local',
  created_at: '2026-01-01T08:00:00Z',
  user_metadata: { display_name: 'Alex' },
};

export const partnerUser = {
  id: '00000000-0000-4000-a000-000000000002',
  display_name: 'Camille',
};

export function getTodayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export const DB = {
  profiles: [
    {
      id: mockUser.id,
      display_name: 'Alex',
      partner_id: partnerUser.id,
      current_target_kcal: 2200,
      current_target_p: 160,
      current_target_g: 220,
      current_target_l: 65,
      created_at: '2026-01-01T08:00:00Z',
      updated_at: '2026-01-01T08:00:00Z',
    },
  ],

  daily_logs: [
    {
      id: `log-${getTodayIso()}`,
      user_id: mockUser.id,
      log_date: getTodayIso(),
      weight_kg: 81.2,
      weight_ema_kg: 81.5,
      target_kcal: 2200,
      target_p: 160,
      target_g: 220,
      target_l: 65,
      exclude_from_tdee: false,
      energy_rating: 5,
      daily_note: 'Bonne énergie matinale',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ],

  exercises: [
    { id: 'ex-01', name: 'Développé couché barre', primary_muscle: 'Pecs', default_rest_seconds: 120, is_custom: false, created_by: null },
    { id: 'ex-02', name: 'Développé incliné haltères', primary_muscle: 'Pecs', default_rest_seconds: 90, is_custom: false, created_by: null },
    { id: 'ex-03', name: 'Tractions pronation', primary_muscle: 'Dos', default_rest_seconds: 120, is_custom: false, created_by: null },
    { id: 'ex-04', name: 'Rowing barre buste penché', primary_muscle: 'Dos', default_rest_seconds: 90, is_custom: false, created_by: null },
    { id: 'ex-05', name: 'Squat barre nuque', primary_muscle: 'Quadriceps', default_rest_seconds: 150, is_custom: false, created_by: null },
    { id: 'ex-06', name: 'Presse à cuisses 45°', primary_muscle: 'Quadriceps', default_rest_seconds: 90, is_custom: false, created_by: null },
    { id: 'ex-07', name: 'Soulevé de terre roumain', primary_muscle: 'Ischios', default_rest_seconds: 120, is_custom: false, created_by: null },
    { id: 'ex-08', name: 'Développé militaire haltères', primary_muscle: 'Épaules', default_rest_seconds: 90, is_custom: false, created_by: null },
    { id: 'ex-09', name: 'Élévations latérales haltères', primary_muscle: 'Épaules', default_rest_seconds: 60, is_custom: false, created_by: null },
    { id: 'ex-10', name: 'Curl incliné haltères', primary_muscle: 'Biceps', default_rest_seconds: 60, is_custom: false, created_by: null },
    { id: 'ex-11', name: 'Barre au front EZ', primary_muscle: 'Triceps', default_rest_seconds: 60, is_custom: false, created_by: null },
    { id: 'ex-12', name: 'Crunch poulie haute', primary_muscle: 'Abdos', default_rest_seconds: 60, is_custom: false, created_by: null },
  ],

  user_exercise_notes: [
    { id: 'note-01', user_id: mockUser.id, exercise_id: 'ex-01', pinned_note: 'Banc au cran 1, prise largeur d épaules' },
  ],

  workout_presets: [
    { id: 'preset-01', user_id: mockUser.id, name: 'Push A (Pecs / Épaules / Triceps)', description: 'Séance axée sur la poussée et les faisceaux antérieurs', created_at: '2026-01-01T08:00:00Z', updated_at: '2026-01-01T08:00:00Z' },
    { id: 'preset-02', user_id: mockUser.id, name: 'Pull A (Dos / Biceps)', description: 'Séance axée sur le tirage vertical et horizontal', created_at: '2026-01-01T08:00:00Z', updated_at: '2026-01-01T08:00:00Z' },
  ],

  workout_preset_exercises: [
    { id: 'pre-ex-01', preset_id: 'preset-01', exercise_id: 'ex-01', order_index: 0, target_sets: 4, default_weight_kg: 80, default_reps: 8, target_rest_seconds: 120 },
    { id: 'pre-ex-02', preset_id: 'preset-01', exercise_id: 'ex-02', order_index: 1, target_sets: 3, default_weight_kg: 28, default_reps: 10, target_rest_seconds: 90 },
    { id: 'pre-ex-03', preset_id: 'preset-01', exercise_id: 'ex-08', order_index: 2, target_sets: 3, default_weight_kg: 22, default_reps: 10, target_rest_seconds: 90 },
    { id: 'pre-ex-04', preset_id: 'preset-02', exercise_id: 'ex-03', order_index: 0, target_sets: 4, default_weight_kg: 0, default_reps: 8, target_rest_seconds: 120 },
  ],

  workout_sessions: [],
  workout_session_exercises: [],
  workout_sets: [],

  foods: [
    { id: 'food-01', name: 'Flocons d avoine bio', brand: 'Bio Village', barcode: null, serving_type: '100g', unit_weight_g: 100, kcal_per_base: 375, proteins_per_base: 13.5, carbs_per_base: 62.0, fats_per_base: 7.0, is_archived: false, created_by: null, created_at: '2026-01-01T08:00:00Z' },
    { id: 'food-02', name: 'Blanc de poulet rôti', brand: 'Fleury Michon', barcode: null, serving_type: '100g', unit_weight_g: 100, kcal_per_base: 110, proteins_per_base: 24.0, carbs_per_base: 0.5, fats_per_base: 1.5, is_archived: false, created_by: null, created_at: '2026-01-01T08:00:00Z' },
    { id: 'food-03', name: 'Banane mûre', brand: null, barcode: null, serving_type: 'both', unit_weight_g: 120, kcal_per_base: 89, proteins_per_base: 1.1, carbs_per_base: 22.8, fats_per_base: 0.3, is_archived: false, created_by: null, created_at: '2026-01-01T08:00:00Z' },
    { id: 'food-04', name: 'Œuf entier plein air', brand: null, barcode: null, serving_type: 'unit', unit_weight_g: 50, kcal_per_base: 70, proteins_per_base: 6.3, carbs_per_base: 0.4, fats_per_base: 4.8, is_archived: false, created_by: null, created_at: '2026-01-01T08:00:00Z' },
    { id: 'food-05', name: 'Riz basmati cuit', brand: 'Taureau Ailé', barcode: null, serving_type: '100g', unit_weight_g: 100, kcal_per_base: 130, proteins_per_base: 2.7, carbs_per_base: 28.0, fats_per_base: 0.4, is_archived: false, created_by: null, created_at: '2026-01-01T08:00:00Z' },
    { id: 'food-06', name: 'Huile d olive vierge extra', brand: 'Bio', barcode: null, serving_type: '100g', unit_weight_g: 10, kcal_per_base: 900, proteins_per_base: 0.0, carbs_per_base: 0.0, fats_per_base: 100.0, is_archived: false, created_by: null, created_at: '2026-01-01T08:00:00Z' },
  ],

  recipes: [
    { id: 'recipe-01', name: 'Porridge Protéiné Express', description: 'Flocons d avoine, banane et cannelle', created_by: mockUser.id, is_archived: false, created_at: '2026-01-01T08:00:00Z', updated_at: '2026-01-01T08:00:00Z' },
  ],

  recipe_ingredients: [
    { id: 'ing-01', recipe_id: 'recipe-01', food_id: 'food-01', quantity_value: 60, logged_unit: 'g' },
    { id: 'ing-02', recipe_id: 'recipe-01', food_id: 'food-03', quantity_value: 1, logged_unit: 'unit' },
  ],

  meal_entries: [],
  meal_entry_items: [],
};

