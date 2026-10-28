# Phase 1 : Schéma Base de Données SQL, Sécurité RLS & Socle PWA

## 0. Étape 0 (Prérequis Bloquant pour l'Agent IA) — Vérification de l'Infra Supabase en Amont

> **INSTRUCTION CRITIQUE POUR L'AGENT IA :**
> Avant d'écrire la moindre ligne de code UI de la Phase 1, tu **DOIS** impérativement vérifier avec l'utilisateur que l'infrastructure Supabase est prête et opérationnelle :
> 1. **Demander / Vérifier les accès :** Confirmer que le projet Supabase est créé et récupérer `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` et le `PROJECT_ID` dans `.env.local`.
> 2. **Exécution du Schéma SQL :** Exécuter le fichier [`supabase/migrations/001_initial_schema.sql`](../supabase/migrations/001_initial_schema.sql) dans le SQL Editor de Supabase.
> 3. **Test de santé de l'infra :** Appeler la fonction RPC `keepalive_ping()` et vérifier qu'elle retourne `{"status": "ok"}`.
> 4. **Génération des types SQL (`database.types.ts`) :** Générer `src/types/database.types.ts` depuis le projet Supabase actif.

---

## 1. Architecture des Données (Points Clés)
1. **Séparation Privé / Partagé & Archivage Doux (`is_archived`) :**
   - Les catalogues (`exercises`, `foods`, `recipes`, `recipe_ingredients`) sont **partagés** en lecture et écriture entre les 2 comptes authentifiés du couple, avec un booléen `is_archived` permettant de masquer un élément obsolète sans jamais casser l'historique privé de l'autre utilisateur (`ON DELETE RESTRICT`).
   - Toutes les données de suivi (`profiles`, `daily_logs`, `user_exercise_notes`, `workout_presets`, `workout_sessions`, `meal_entries`, `meal_entry_items`) sont **strictement privées** (`auth.uid() = user_id`).
2. **Mécanisme de Snapshot Journalier (`daily_logs`) au fuseau `Europe/Paris` & Exclusion TDEE :**
   - Lorsqu'une journée est créée, le trigger SQL `fill_daily_log_snapshot()` copie automatiquement les objectifs actuels du profil (`current_target_kcal`, etc.) dans la ligne du jour (`target_kcal`, etc.).
   - Si le profil est modifié en cours de journée, le trigger `sync_today_daily_log_targets()` met à jour uniquement la journée courante au fuseau français (`(NOW() AT TIME ZONE 'Europe/Paris')::date`) ; les journées passées restent immuables.
   - Chaque journée inclut un booléen `exclude_from_tdee` permettant d'exclure manuellement une journée atypique du calculateur de maintenance 14 jours.
3. **Plat Composé (1 portion de référence) avec Portions Décimales & Surcharge Locale (`meal_entries` + `meal_entry_items`) :**
   - Dans le catalogue, un plat (`recipes`) stocke toujours les quantités de référence pour **1 portion individuelle**.
   - Ajouter ce plat dans un repas du jour (avec un multiplicateur de portion décimal, ex: `1`, `1.5`, `0.5`) crée une ligne parente dans `meal_entries` et **clone** ses ingrédients dans `meal_entry_items`. Modifier ou supprimer un ingrédient le jour J recalcule automatiquement le total du repas parent via le trigger SQL `trg_sync_parent_meal_entry_totals`, sans jamais toucher au plat de référence dans le catalogue.
4. **Dénormalisation Stratégique pour les Ghost Values & Analytics (`workout_sets`) :**
   - La table `workout_sets` conserve `user_id` et `exercise_id` directement sur chaque série, ainsi que le `epley_1rm` calculé automatiquement par PostgreSQL (`GENERATED ALWAYS AS`).

---

## 2. Fichiers de Code de la Phase 1 (Déjà Extraits dans le Projet)

Tous les fichiers du socle de la Phase 1 sont prêts dans l'arborescence :

- **Migration SQL complète :** [`supabase/migrations/001_initial_schema.sql`](../supabase/migrations/001_initial_schema.sql)
  - 14 tables, 4 types `ENUM`, triggers de Snapshot (`Europe/Paris`) et de synchronisation des recettes, politiques `RLS` privées/partagées, et 3 fonctions RPC (`get_partner_info`, `copy_meal_entries`, `keepalive_ping`).
- **Configuration PWA iOS :** [`public/manifest.json`](../public/manifest.json)
- **Cron Anti-Veille GitHub Actions :** [`.github/workflows/supabase-keepalive.yml`](../.github/workflows/supabase-keepalive.yml)
- **Utilitaires Dates Locales & Types Métier :**
  - [`src/lib/date.utils.ts`](../src/lib/date.utils.ts)
  - [`src/types/domain.types.ts`](../src/types/domain.types.ts)
- **Clients Supabase & Middleware Auth :**
  - [`src/lib/supabase/client.ts`](../src/lib/supabase/client.ts)
  - [`src/lib/supabase/server.ts`](../src/lib/supabase/server.ts)
  - [`src/middleware.ts`](../src/middleware.ts)
- **Design System iOS & Navigation :**
  - [`src/app/globals.css`](../src/app/globals.css)
  - [`src/app/layout.tsx`](../src/app/layout.tsx)
  - [`src/components/layout/BottomNav.tsx`](../src/components/layout/BottomNav.tsx)

> **Note de sécurité importante :** Une fois les deux comptes du couple créés dans Supabase, aller dans *Authentication -> Providers -> Email* et désactiver **"Allow new users to sign up"**.

---

## 3. Commandes d'Initialisation du Projet (Versions Verrouillées)

```bash
# 1. Initialiser Next.js 15.2 (TypeScript, App Router, dossier src/) si non initialisé
npx create-next-app@15.2.0 . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"

# 2. Verrouiller Tailwind CSS en v3.4.17
npm install -D tailwindcss@^3.4.17 postcss@^8.4.49 autoprefixer@^10.4.20 tailwindcss-animate@^1.0.7

# 3. Installer Supabase SSR, Zustand, Recharts et date-fns aux versions cibles
npm install @supabase/supabase-js@^2.49.0 @supabase/ssr@^0.6.1 zustand@^5.0.3 recharts@^2.15.1 date-fns@^4.1.0

# 4. Installer la stack UI iOS Native Feel
npm install motion@^12.4.0 @number-flow/react@^0.5.10 sonner@^2.0.1 @phosphor-icons/react@^2.1.7 vaul@^1.1.2

# 5. Initialiser shadcn/ui et ajouter les composants mobiles essentiels
npx shadcn@latest init -d
npx shadcn@latest add button input card dialog drawer accordion tabs badge switch

# 6. Générer automatiquement les types TypeScript depuis le projet Supabase
npx supabase gen types typescript --project-id "<TON_PROJECT_ID>" --schema public > src/types/database.types.ts
```

---

## 4. Composants UI à Créer en Phase 1 (`< 200 lignes`)

1. **`src/app/(auth)/login/page.tsx` (< 120 lignes) :**
   - Formulaire épuré OLED (`#000000` / `.ios-card`) avec `email` et `password` (`.ios-input`), connexion via `supabase.auth.signInWithPassword`, redirection vers `/`.
2. **`src/app/(protected)/layout.tsx` (< 50 lignes) :**
   - Conteneur mobile (`max-w-md mx-auto pb-24`) intégrant [`BottomNav`](../src/components/layout/BottomNav.tsx).
3. **`src/components/layout/PageHeader.tsx` (< 60 lignes) :**
   - En-tête collant (`sticky top-0 z-30 ios-glass`) avec titre de page et action contextuelle à droite.

---

## 5. Checklist de Validation (Definition of Done — Phase 1)
- [ ] **Étape 0 validée :** L'infrastructure Supabase a été vérifiée et `keepalive_ping()` répond `{"status": "ok"}`.
- [ ] Le script [`supabase/migrations/001_initial_schema.sql`](../supabase/migrations/001_initial_schema.sql) est exécuté sans erreur dans Supabase.
- [ ] Le fichier `src/types/database.types.ts` est généré et `npx tsc --noEmit` retourne 0 erreur.
- [ ] Les 2 comptes du couple peuvent se connecter sur `/login` et l'inscription publique est désactivée dans Supabase.
- [ ] La navigation entre les 5 onglets fonctionne en mode plein écran sur iOS avec fond `#000000` et respect de la Safe Area basse.
