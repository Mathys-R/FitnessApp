// src/types/domain.types.ts

export const MUSCLE_GROUPS = [
  'Pecs',
  'Dos',
  'Épaules',
  'Biceps',
  'Triceps',
  'Quadriceps',
  'Ischios',
  'Fessiers',
  'Mollets',
  'Abdos',
] as const;

export type MuscleGroup = (typeof MUSCLE_GROUPS)[number];

export const MEAL_CATEGORIES_ORDER = [
  { key: 'breakfast', label: 'Petit-déjeuner' },
  { key: 'lunch', label: 'Déjeuner' },
  { key: 'dinner', label: 'Dîner' },
  { key: 'snack', label: 'Collation' },
  { key: 'pre_post_workout', label: 'Pré / Post-Workout' },
] as const;

