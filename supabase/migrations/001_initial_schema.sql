-- ============================================================================
-- 0. EXTENSIONS & FONCTIONS UTILITAIRES
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Fonction générique pour mettre à jour automatiquement la colonne updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$ LANGUAGE plpgsql;

-- ============================================================================
-- 1. PROFILS UTILISATEURS (Privé par utilisateur)
-- ============================================================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  current_target_kcal INTEGER NOT NULL DEFAULT 2000,
  current_target_p INTEGER NOT NULL DEFAULT 150,
  current_target_g INTEGER NOT NULL DEFAULT 200,
  current_target_l INTEGER NOT NULL DEFAULT 65,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Création automatique du profil lors de l'inscription d'un utilisateur
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- 2. JOURNAL QUOTIDIEN : SNAPSHOT OBJECTIFS & POIDS EMA (Privé)
-- ============================================================================
CREATE TABLE public.daily_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  log_date DATE NOT NULL,
  
  -- Suivi corporel
  weight_kg NUMERIC(5,2),
  weight_ema_kg NUMERIC(5,2), -- Moyenne mobile exponentielle 7 jours
  steps_count INTEGER,        -- Prévu pour TODO V2 (Apple Santé)
  
  -- Snapshot des objectifs du jour (figés à la création de la journée ; DEFAULT 0 rend le champ optionnel dans le type Insert TS)
  target_kcal INTEGER NOT NULL DEFAULT 0,
  target_p INTEGER NOT NULL DEFAULT 0,
  target_g INTEGER NOT NULL DEFAULT 0,
  target_l INTEGER NOT NULL DEFAULT 0,
  
  -- Exclusion manuelle de la journée pour le calculateur TDEE 14 jours (ex: resto, oubli de saisie)
  exclude_from_tdee BOOLEAN NOT NULL DEFAULT FALSE,
  
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(user_id, log_date)
);

CREATE INDEX idx_daily_logs_user_date ON public.daily_logs(user_id, log_date DESC);

CREATE TRIGGER trg_daily_logs_updated_at
BEFORE UPDATE ON public.daily_logs
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger 1 : Remplit automatiquement le Snapshot avec les objectifs actuels du profil à la création de la journée
CREATE OR REPLACE FUNCTION public.fill_daily_log_snapshot()
RETURNS TRIGGER AS $$
DECLARE
  v_profile RECORD;
BEGIN
  IF NEW.target_kcal IS NULL OR NEW.target_kcal <= 0 THEN
    SELECT current_target_kcal, current_target_p, current_target_g, current_target_l
    INTO v_profile
    FROM public.profiles
    WHERE id = NEW.user_id;

    NEW.target_kcal := COALESCE(v_profile.current_target_kcal, 2000);
    NEW.target_p := COALESCE(v_profile.current_target_p, 150);
    NEW.target_g := COALESCE(v_profile.current_target_g, 200);
    NEW.target_l := COALESCE(v_profile.current_target_l, 65);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_fill_daily_log_snapshot
BEFORE INSERT ON public.daily_logs
FOR EACH ROW EXECUTE FUNCTION public.fill_daily_log_snapshot();

-- Trigger 2 : Si l'utilisateur modifie ses objectifs dans son Profil, met à jour uniquement le Snapshot d'AUJOURD'HUI au fuseau Europe/Paris (jamais le passé)
CREATE OR REPLACE FUNCTION public.sync_today_daily_log_targets()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.daily_logs
  SET
    target_kcal = NEW.current_target_kcal,
    target_p = NEW.current_target_p,
    target_g = NEW.current_target_g,
    target_l = NEW.current_target_l
  WHERE user_id = NEW.id
    AND log_date = (NOW() AT TIME ZONE 'Europe/Paris')::date;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_sync_today_daily_log_targets
AFTER UPDATE OF current_target_kcal, current_target_p, current_target_g, current_target_l ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.sync_today_daily_log_targets();

-- ============================================================================
-- 3. CATALOGUE D'EXERCICES (Partagé Couple) & NOTES ÉPINGLÉES (Privées)
-- ============================================================================
CREATE TABLE public.exercises (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  primary_muscle TEXT NOT NULL,             -- ex: 'Pecs', 'Dos', 'Quadriceps', 'Fessiers'...
  secondary_muscles JSONB DEFAULT '[]'::jsonb, -- ex: ["Triceps", "Épaules"]
  image_url TEXT,
  setup_guide TEXT,                         -- Guide général d'exécution (2-3 indications)
  is_archived BOOLEAN NOT NULL DEFAULT FALSE, -- Soft delete pour ne jamais casser l'historique croisé
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_exercises_primary_muscle ON public.exercises(primary_muscle);

-- Note permanente épinglée par chaque utilisateur sur un exercice (ex: réglage siège perso)
CREATE TABLE public.user_exercise_notes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  exercise_id UUID NOT NULL REFERENCES public.exercises(id) ON DELETE CASCADE,
  pinned_note TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  UNIQUE(user_id, exercise_id)
);

-- ============================================================================
-- 4. PRESETS DE SÉANCES & HISTORIQUE MUSCULATION (Privé)
-- ============================================================================
CREATE TABLE public.workout_presets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.workout_preset_exercises (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  preset_id UUID NOT NULL REFERENCES public.workout_presets(id) ON DELETE CASCADE,
  exercise_id UUID NOT NULL REFERENCES public.exercises(id) ON DELETE RESTRICT,
  order_index INTEGER NOT NULL DEFAULT 0,
  target_sets INTEGER NOT NULL DEFAULT 3,
  target_rest_seconds INTEGER NOT NULL DEFAULT 120,
  default_reps INTEGER,
  default_weight_kg NUMERIC(6,2)
);

CREATE TYPE workout_session_status AS ENUM ('planned', 'in_progress', 'completed', 'rest_day');

CREATE TABLE public.workout_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  session_date DATE NOT NULL,
  name TEXT NOT NULL,
  status workout_session_status NOT NULL DEFAULT 'completed',
  preset_id UUID REFERENCES public.workout_presets(id) ON DELETE SET NULL,
  duration_seconds INTEGER,
  session_comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_workout_sessions_user_date ON public.workout_sessions(user_id, session_date DESC);

CREATE TABLE public.workout_session_exercises (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES public.workout_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  exercise_id UUID NOT NULL REFERENCES public.exercises(id) ON DELETE RESTRICT,
  order_index INTEGER NOT NULL DEFAULT 0,
  session_note TEXT, -- Note temporaire de ressenti liée uniquement à la séance du jour
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.workout_sets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_exercise_id UUID NOT NULL REFERENCES public.workout_session_exercises(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  exercise_id UUID NOT NULL REFERENCES public.exercises(id) ON DELETE RESTRICT,
  set_number INTEGER NOT NULL,
  weight_kg NUMERIC(6,2) NOT NULL DEFAULT 0,
  reps INTEGER NOT NULL DEFAULT 0,
  rest_seconds INTEGER NOT NULL DEFAULT 120,
  is_warmup BOOLEAN NOT NULL DEFAULT FALSE,
  is_completed BOOLEAN NOT NULL DEFAULT TRUE,
  
  -- Calcul automatique du 1RM théorique (Formule d'Epley : Poids * (1 + Reps/30))
  epley_1rm NUMERIC(6,2) GENERATED ALWAYS AS (
    CASE WHEN reps > 0 AND is_warmup = FALSE
         THEN ROUND(weight_kg * (1.0 + (reps::numeric / 30.0)), 2)
         ELSE 0
    END
  ) STORED,
  
  is_pr BOOLEAN NOT NULL DEFAULT FALSE,
  performed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_workout_sets_user_exercise ON public.workout_sets(user_id, exercise_id, performed_at DESC);

-- ============================================================================
-- 5. CATALOGUE NUTRITION : ALIMENTS & PLATS COMPOSÉS (Partagé Couple)
-- ============================================================================
CREATE TYPE food_serving_type AS ENUM ('100g', 'unit', 'both');

CREATE TABLE public.foods (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  brand TEXT,
  barcode TEXT, -- Prêt pour TODO V2 (OpenFoodFacts)
  serving_type food_serving_type NOT NULL DEFAULT '100g',
  unit_weight_g NUMERIC(6,2) NOT NULL DEFAULT 100,
  
  -- Valeurs nutritionnelles stockées pour 100g (si '100g' ou 'both') ou pour 1 unité (si 'unit')
  kcal_per_base NUMERIC(6,1) NOT NULL DEFAULT 0,
  proteins_per_base NUMERIC(6,1) NOT NULL DEFAULT 0,
  carbs_per_base NUMERIC(6,1) NOT NULL DEFAULT 0,
  fats_per_base NUMERIC(6,1) NOT NULL DEFAULT 0,
  
  is_archived BOOLEAN NOT NULL DEFAULT FALSE,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_foods_name ON public.foods(name);
CREATE INDEX idx_foods_barcode ON public.foods(barcode);

-- Un plat composé représente toujours 1 portion individuelle de référence dans le catalogue
CREATE TABLE public.recipes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  is_archived BOOLEAN NOT NULL DEFAULT FALSE,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.recipe_ingredients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  recipe_id UUID NOT NULL REFERENCES public.recipes(id) ON DELETE CASCADE,
  food_id UUID NOT NULL REFERENCES public.foods(id) ON DELETE RESTRICT,
  quantity_value NUMERIC(6,2) NOT NULL, -- Quantité de référence pour 1 portion
  logged_unit TEXT NOT NULL DEFAULT 'g' CHECK (logged_unit IN ('g', 'unit'))
);

-- ============================================================================
-- 6. JOURNAL NUTRITIONNEL QUOTIDIEN & SOUS-MENUS RECETTES (Privé)
-- ============================================================================
CREATE TYPE meal_category AS ENUM ('breakfast', 'lunch', 'dinner', 'snack', 'pre_post_workout');
CREATE TYPE meal_entry_type AS ENUM ('quick_add', 'food', 'recipe');

CREATE TABLE public.meal_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  daily_log_id UUID NOT NULL REFERENCES public.daily_logs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  meal_type meal_category NOT NULL,
  entry_type meal_entry_type NOT NULL,
  
  label TEXT NOT NULL,
  food_id UUID REFERENCES public.foods(id) ON DELETE SET NULL,
  recipe_id UUID REFERENCES public.recipes(id) ON DELETE SET NULL,
  quantity_value NUMERIC(6,2), -- Quantité si aliment simple ou nombre de portions (ex: 1.5) si recette
  logged_unit TEXT DEFAULT 'g' CHECK (logged_unit IN ('g', 'unit')),
  
  -- Totaux consolidés de la ligne (synchronisés automatiquement par trigger si entry_type = 'recipe')
  total_kcal NUMERIC(6,1) NOT NULL DEFAULT 0,
  total_p NUMERIC(6,1) NOT NULL DEFAULT 0,
  total_g NUMERIC(6,1) NOT NULL DEFAULT 0,
  total_l NUMERIC(6,1) NOT NULL DEFAULT 0,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_meal_entries_daily_log ON public.meal_entries(daily_log_id, meal_type);

CREATE TABLE public.meal_entry_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  meal_entry_id UUID NOT NULL REFERENCES public.meal_entries(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  food_id UUID REFERENCES public.foods(id) ON DELETE SET NULL,
  ingredient_name TEXT NOT NULL,
  serving_type food_serving_type NOT NULL DEFAULT '100g',
  unit_weight_g NUMERIC(6,2) NOT NULL DEFAULT 100,
  logged_unit TEXT NOT NULL DEFAULT 'g' CHECK (logged_unit IN ('g', 'unit')),
  
  -- Densité nutritionnelle figée au clonage
  kcal_per_base NUMERIC(6,1) NOT NULL DEFAULT 0,
  p_per_base NUMERIC(6,1) NOT NULL DEFAULT 0,
  g_per_base NUMERIC(6,1) NOT NULL DEFAULT 0,
  l_per_base NUMERIC(6,1) NOT NULL DEFAULT 0,
  
  quantity_value NUMERIC(6,2) NOT NULL,
  kcal NUMERIC(6,1) NOT NULL DEFAULT 0,
  p NUMERIC(6,1) NOT NULL DEFAULT 0,
  g NUMERIC(6,1) NOT NULL DEFAULT 0,
  l NUMERIC(6,1) NOT NULL DEFAULT 0
);

-- Trigger : Recalcule automatiquement les totaux de la ligne parente (meal_entries) dès qu'un sous-ingrédient du jour est modifié/ajouté/supprimé
CREATE OR REPLACE FUNCTION public.sync_parent_meal_entry_totals()
RETURNS TRIGGER AS $$
DECLARE
  v_parent_id UUID;
BEGIN
  v_parent_id := COALESCE(NEW.meal_entry_id, OLD.meal_entry_id);

  UPDATE public.meal_entries
  SET
    total_kcal = COALESCE((SELECT SUM(kcal) FROM public.meal_entry_items WHERE meal_entry_id = v_parent_id), 0),
    total_p    = COALESCE((SELECT SUM(p)    FROM public.meal_entry_items WHERE meal_entry_id = v_parent_id), 0),
    total_g    = COALESCE((SELECT SUM(g)    FROM public.meal_entry_items WHERE meal_entry_id = v_parent_id), 0),
    total_l    = COALESCE((SELECT SUM(l)    FROM public.meal_entry_items WHERE meal_entry_id = v_parent_id), 0)
  WHERE id = v_parent_id
    AND entry_type = 'recipe';

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_sync_parent_meal_entry_totals
AFTER INSERT OR UPDATE OR DELETE ON public.meal_entry_items
FOR EACH ROW EXECUTE FUNCTION public.sync_parent_meal_entry_totals();

-- ============================================================================
-- 7. SÉCURITÉ ROW LEVEL SECURITY (RLS), DUPLICATION REPAS & KEEP-ALIVE
-- ============================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_exercise_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workout_presets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workout_preset_exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workout_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workout_session_exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workout_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.foods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recipe_ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meal_entry_items ENABLE ROW LEVEL SECURITY;

-- A. Politiques PRIVÉES
CREATE POLICY "Private access profiles" ON public.profiles FOR ALL USING (auth.uid() = id);
CREATE POLICY "Private access daily_logs" ON public.daily_logs FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Private access user_exercise_notes" ON public.user_exercise_notes FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Private access workout_presets" ON public.workout_presets FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Private access workout_sessions" ON public.workout_sessions FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Private access workout_session_exercises" ON public.workout_session_exercises FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Private access workout_sets" ON public.workout_sets FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Private access meal_entries" ON public.meal_entries FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Private access meal_entry_items" ON public.meal_entry_items FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Private access workout_preset_exercises" ON public.workout_preset_exercises
FOR ALL USING (
  EXISTS (SELECT 1 FROM public.workout_presets p WHERE p.id = preset_id AND p.user_id = auth.uid())
);

-- B. Politiques PARTAGÉES COUPLE
CREATE POLICY "Shared access exercises" ON public.exercises FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Shared access foods" ON public.foods FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Shared access recipes" ON public.recipes FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Shared access recipe_ingredients" ON public.recipe_ingredients FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- C. RPC Couple : Récupérer l'ID et le prénom du partenaire
CREATE OR REPLACE FUNCTION public.get_partner_info()
RETURNS TABLE(partner_id UUID, partner_name TEXT) AS $$
BEGIN
  RETURN QUERY
  SELECT p.id, COALESCE(p.display_name, 'Partenaire')
  FROM public.profiles p
  WHERE p.id <> auth.uid()
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

GRANT EXECUTE ON FUNCTION public.get_partner_info() TO authenticated;

-- D. RPC Couple & Habitudes : Copier un repas complet (depuis hier ou depuis le partenaire)
CREATE OR REPLACE FUNCTION public.copy_meal_entries(
  p_source_user_id UUID,
  p_source_date DATE,
  p_source_meal_type meal_category,
  p_target_daily_log_id UUID,
  p_target_meal_type meal_category
) RETURNS INTEGER AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_source_entry RECORD;
  v_new_entry_id UUID;
  v_copied_count INTEGER := 0;
BEGIN
  -- Contrôle d'autorisation strict BOLA/IDOR (OWASP API1:2023)
  IF p_source_user_id <> v_caller_id 
     AND NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_source_user_id AND id <> v_caller_id) THEN
    RAISE EXCEPTION 'Accès refusé aux données de cet utilisateur';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.daily_logs WHERE id = p_target_daily_log_id AND user_id = v_caller_id) THEN
    RAISE EXCEPTION 'Accès refusé au journal cible';
  END IF;

  FOR v_source_entry IN
    SELECT me.*
    FROM public.meal_entries me
    JOIN public.daily_logs dl ON dl.id = me.daily_log_id
    WHERE dl.user_id = p_source_user_id
      AND dl.log_date = p_source_date
      AND me.meal_type = p_source_meal_type
    ORDER BY me.created_at ASC
  LOOP
    INSERT INTO public.meal_entries (
      daily_log_id, user_id, meal_type, entry_type, label,
      food_id, recipe_id, quantity_value, logged_unit,
      total_kcal, total_p, total_g, total_l
    ) VALUES (
      p_target_daily_log_id, v_caller_id, p_target_meal_type, v_source_entry.entry_type, v_source_entry.label,
      v_source_entry.food_id, v_source_entry.recipe_id, v_source_entry.quantity_value, v_source_entry.logged_unit,
      v_source_entry.total_kcal, v_source_entry.total_p, v_source_entry.total_g, v_source_entry.total_l
    ) RETURNING id INTO v_new_entry_id;

    IF v_source_entry.entry_type = 'recipe' THEN
      INSERT INTO public.meal_entry_items (
        meal_entry_id, user_id, food_id, ingredient_name,
        serving_type, unit_weight_g, logged_unit,
        kcal_per_base, p_per_base, g_per_base, l_per_base,
        quantity_value, kcal, p, g, l
      )
      SELECT
        v_new_entry_id, v_caller_id, mei.food_id, mei.ingredient_name,
        mei.serving_type, mei.unit_weight_g, mei.logged_unit,
        mei.kcal_per_base, mei.p_per_base, mei.g_per_base, mei.l_per_base,
        mei.quantity_value, mei.kcal, mei.p, mei.g, mei.l
      FROM public.meal_entry_items mei
      WHERE mei.meal_entry_id = v_source_entry.id;
    END IF;

    v_copied_count := v_copied_count + 1;
  END LOOP;

  RETURN v_copied_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

GRANT EXECUTE ON FUNCTION public.copy_meal_entries(UUID, DATE, meal_category, UUID, meal_category) TO authenticated;

-- E. Fonction RPC légère pour le cron GitHub Actions Anti-Veille
CREATE OR REPLACE FUNCTION public.keepalive_ping()
RETURNS JSONB AS $$
BEGIN
  RETURN jsonb_build_object('status', 'ok', 'timestamp', NOW());
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION public.keepalive_ping() TO anon, authenticated;

