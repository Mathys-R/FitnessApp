// src/features/catalogs/services/exercises.service.ts
import { createClient } from '@/lib/supabase/client';
import type { Database } from '@/types/database.types';

export type ExerciseRow = Database['public']['Tables']['exercises']['Row'];

/**
 * 1. Récupère tous les exercices actifs + injecte le seed initial si la table est vide
 */
export async function getActiveExercises(): Promise<ExerciseRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('exercises')
    .select('*')
    .eq('is_archived', false)
    .order('name', { ascending: true });

  if (error) throw new Error(`Erreur chargement exercices : ${error.message}`);

  if (!data || data.length === 0) {
    const res = await fetch('/data/exercises_seed.json');
    if (res.ok) {
      const seedItems = await res.json();
      const { data: inserted, error: seedErr } = await supabase
        .from('exercises')
        .insert(seedItems)
        .select('*');
      if (!seedErr && inserted) return inserted;
    }
  }

  return data ?? [];
}

/**
 * 2. Crée ou met à jour un exercice dans le catalogue partagé
 */
export async function createOrUpdateExercise(
  payload: Database['public']['Tables']['exercises']['Insert']
): Promise<ExerciseRow> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('exercises')
    .upsert(payload)
    .select('*')
    .single();

  if (error || !data) throw new Error(`Erreur sauvegarde exercice : ${error?.message}`);
  return data;
}

/**
 * 3. Archive doucement un exercice (ne casse jamais l'historique croisé du couple)
 */
export async function archiveExercise(exerciseId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from('exercises')
    .update({ is_archived: true })
    .eq('id', exerciseId);
  if (error) throw new Error(`Erreur archivage exercice : ${error.message}`);
}

