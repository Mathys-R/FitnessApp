# Phase 1 : Schéma Base de Données SQL, Sécurité RLS & Socle PWA

## 0. Étape 0 (Prérequis Bloquant pour l'Agent IA) — Vérification de l'Infra Supabase en Amont

> **INSTRUCTION CRITIQUE POUR L'AGENT IA :**
> Avant d'écrire la moindre ligne de code UI de la Phase 1, tu **DOIS** impérativement vérifier avec l'utilisateur que l'infrastructure Supabase est prête et opérationnelle :
> 1. **Demander / Vérifier les accès :** Confirmer que le projet Supabase est créé et récupérer `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` et le `PROJECT_ID` dans `.env.local`.
> 2. **Exécution du Schéma SQL :** Exécuter le fichier [`supabase/migrations/001_initial_schema.sql`](../supabase/migrations/001_initial_schema.sql) dans le SQL Editor de Supabase.
> 3. **Test de santé de l'infra :** Appeler la fonction RPC `keepalive_ping()` et vérifier qu'elle retourne `{"status": "ok"}`.
> 4. **Génération des types SQL (`database.types.ts`) :** Le fichier `src/types/database.types.ts` est déjà généré et présent `[Créé]` (14 tables, 5 enums, 3 RPCs).

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
5. **Synthèse du Schéma SQL, Types ENUM & Fonctions RPC :**
   - **14 tables relationnelles :** `profiles`, `daily_logs`, `exercises`, `user_exercise_notes`, `workout_presets`, `workout_preset_exercises`, `workout_sessions`, `workout_session_exercises`, `workout_sets`, `foods`, `recipes`, `recipe_ingredients`, `meal_entries`, `meal_entry_items`.
   - **5 types `ENUM` :**
     - `food_serving_type` : `'100g' | 'unit' | 'both'`
     - `logged_unit_type` : `'g' | 'unit'`
     - `meal_category` : `'breakfast' | 'lunch' | 'dinner' | 'snack' | 'pre_post_workout'`
     - `meal_entry_type` : `'quick_add' | 'food' | 'recipe'`
     - `workout_session_status` : `'planned' | 'in_progress' | 'completed' | 'rest_day'`
     *(Note : Correction de la mention initiale erronée de "4 types ENUM" en 5 types réels).*
   - **3 fonctions RPC :**
     - `get_partner_info()` : Récupère l'UUID et le nom d'affichage du partenaire du couple (`SECURITY DEFINER`).
     - `copy_meal_entries(...)` : Duplique en cascade les entrées d'un repas et leurs éventuels sous-ingrédients vers le journal cible de l'utilisateur actif.
     - `keepalive_ping()` : Ping de santé anti-mise en veille Supabase renvoyant `{"status": "ok", "timestamp": NOW()}`.
   - **0 vues SQL :** Aucune vue n'est définie dans le schéma public (`Views: {}`).

---

## 2. Fichiers de Code de la Phase 1 (Déjà Extraits dans le Projet)

### 2.1 Configurations Racine Créées (`[Créé]`)

Les 7 fichiers de configuration à la racine du dépôt sont déjà en place et fonctionnels :

1. **`package.json` :** Dépendances applicatives verrouillées (`next: 15.1.6`, `react: ^19.0.0`, `@supabase/ssr: ^0.5.2`, `@supabase/supabase-js: ^2.48.1`, `zustand: ^5.0.3`, `motion: ^12.4.2`, `recharts: ^2.15.1`, `date-fns: ^4.1.0`, `@number-flow/react: ^0.5.4`, `sonner: ^2.0.1`, `@phosphor-icons/react: ^2.1.7`, `vaul: ^1.1.2`, `lucide-react: ^0.475.0`, `clsx: ^2.1.1`, `tailwind-merge: ^3.0.1`, `tailwindcss: ^3.4.17`, `typescript: ^5.7.3`) et scripts standards (`dev`, `build`, `start`, `lint`).
2. **`tsconfig.json` :** Configuration TypeScript stricte (`strict: true`, `noEmit: true`), cible `ES2022`, moduleResolution `bundler`, et alias de chemin `@/*` pointant vers `./src/*`.
3. **`tailwind.config.ts` :** Configuration Tailwind CSS avec mode sombre activé par classe (`darkMode: ['class']`) et balayage exhaustif des chemins `src/` (`pages`, `components`, `features`, `app`).
4. **`postcss.config.mjs` :** Configuration PostCSS déclarant les plugins `tailwindcss` et `autoprefixer`.
5. **`next.config.mjs` :** Configuration Next.js avec `reactStrictMode: true`.
6. **`.gitignore` :** Règles d'exclusion Git pour `/node_modules`, `/.next/`, `/out/`, `/build`, `.env*.local`, `.env`, `*.tsbuildinfo`, et `.DS_Store`.
7. **`.env.local` :** Gabarit des variables d'environnement locales avec les clés `NEXT_PUBLIC_SUPABASE_URL` et `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

### 2.2 Fichiers du Socle Applicatif

Tous les fichiers techniques et SQL du socle de la Phase 1 sont prêts dans l'arborescence :

- **Migration SQL complète :** [`supabase/migrations/001_initial_schema.sql`](../supabase/migrations/001_initial_schema.sql) `[Créé]`
  - 14 tables, 5 types `ENUM`, triggers de Snapshot (`Europe/Paris`) et de synchronisation des recettes, politiques `RLS` privées/partagées, et 3 fonctions RPC (`get_partner_info`, `copy_meal_entries`, `keepalive_ping`).
- **Typage TypeScript SQL :** [`src/types/database.types.ts`](../src/types/database.types.ts) `[Créé]`
  - 565 lignes auto-générées reflétant exactement les 14 tables, 5 enums, 3 RPCs et 0 vues du schéma.
- **Configuration PWA iOS :** [`public/manifest.json`](../public/manifest.json) `[Créé]`
- **Cron Anti-Veille GitHub Actions :** [`.github/workflows/supabase-keepalive.yml`](../.github/workflows/supabase-keepalive.yml) `[Créé]`
- **Utilitaires Dates Locales & Types Métier :**
  - [`src/lib/date.utils.ts`](../src/lib/date.utils.ts) `[OK]`
  - [`src/types/domain.types.ts`](../src/types/domain.types.ts) `[OK]`
- **Clients Supabase & Middleware Auth :**
  - [`src/lib/supabase/client.ts`](../src/lib/supabase/client.ts) `[OK]`
  - [`src/lib/supabase/server.ts`](../src/lib/supabase/server.ts) `[OK]`
  - [`src/middleware.ts`](../src/middleware.ts) `[OK]`
- **Design System iOS & Navigation :**
  - [`src/app/globals.css`](../src/app/globals.css) `[OK]`
  - [`src/app/layout.tsx`](../src/app/layout.tsx) `[OK]`
  - [`src/components/layout/BottomNav.tsx`](../src/components/layout/BottomNav.tsx) `[OK]`

> **Note de sécurité importante :** Une fois les deux comptes du couple créés dans Supabase, aller dans *Authentication -> Providers -> Email* et désactiver **"Allow new users to sign up"**.

---

## 3. Commandes d'Initialisation du Projet (Versions du Dépôt)

> **État actuel du projet :** Le socle racine, les fichiers de configuration et les dépendances sont déjà configurés dans le dépôt (`package.json`, `tsconfig.json`, `tailwind.config.ts`, etc.) et `src/types/database.types.ts` est déjà généré `[Créé]`.

Les dépendances verrouillées dans `package.json` correspondent aux versions suivantes :

```bash
# 1. Next.js 15.1.6, TypeScript et App Router
# (Déjà configuré dans package.json & tsconfig.json avec alias "@/*" -> "./src/*")

# 2. Tailwind CSS v3.4.17 et PostCSS
npm install -D tailwindcss@^3.4.17 postcss@^8.5.1 autoprefixer@^10.4.20 typescript@^5.7.3

# 3. Supabase SSR, Zustand, Recharts et date-fns aux versions installées
npm install @supabase/supabase-js@^2.48.1 @supabase/ssr@^0.5.2 zustand@^5.0.3 recharts@^2.15.1 date-fns@^4.1.0

# 4. Stack UI iOS Native Feel
npm install motion@^12.4.2 @number-flow/react@^0.5.4 sonner@^2.0.1 @phosphor-icons/react@^2.1.7 vaul@^1.1.2 lucide-react@^0.475.0 clsx@^2.1.1 tailwind-merge@^3.0.1

# 5. Primitives shadcn/ui à intégrer selon les besoins
npx shadcn@latest add button input card dialog drawer accordion tabs badge switch

# 6. Commande de régénération des types TypeScript (déjà exécutée, fichier présent dans src/types/)
npx supabase gen types typescript --project-id "<TON_PROJECT_ID>" --schema public > src/types/database.types.ts
```

---

## 4. Composants UI à Créer en Phase 1 (`< 200 lignes`) — `[À CODER - UI]`

1. **`src/app/(auth)/login/page.tsx` (< 120 lignes) — `[À CODER - UI]` :**
   - Formulaire épuré OLED (`#000000` / `.ios-card`) avec `email` et `password` (`.ios-input`), connexion via `supabase.auth.signInWithPassword`, redirection vers `/`.
2. **`src/app/(protected)/layout.tsx` (< 50 lignes) — `[À CODER - UI]` :**
   - Conteneur mobile (`max-w-md mx-auto pb-24`) intégrant [`BottomNav`](../src/components/layout/BottomNav.tsx).
3. **`src/components/layout/PageHeader.tsx` (< 60 lignes) — `[À CODER - UI]` :**
   - En-tête collant (`sticky top-0 z-30 ios-glass`) avec titre de page et action contextuelle à droite.

---

## 5. Checklist de Validation (Definition of Done — Phase 1)

- [x] **Configurations racine créées :** Les 7 fichiers (`package.json`, `tsconfig.json`, `tailwind.config.ts`, `postcss.config.mjs`, `next.config.mjs`, `.gitignore`, `.env.local`) sont initialisés et opérationnels `[Créé]`.
- [x] **Schéma de base de données complet :** Le script [`supabase/migrations/001_initial_schema.sql`](../supabase/migrations/001_initial_schema.sql) définit 14 tables, 5 enums, 3 RPCs, triggers Europe/Paris et politiques RLS `[Créé]`.
- [x] **Typage TypeScript SQL :** Le fichier [`src/types/database.types.ts`](../src/types/database.types.ts) est déjà généré et synchronisé `[Créé]` (14 tables, 5 enums, 3 RPCs).
- [x] **Socle technique & Navigation :** `date.utils.ts`, `domain.types.ts`, clients Supabase, `middleware.ts`, `globals.css`, `layout.tsx` et `BottomNav.tsx` sont en place `[OK]`.
- [ ] **Étape 0 Infra Supabase :** Projet Supabase lié via `.env.local`, schéma exécuté dans l'instance active et ping vérifié (`keepalive_ping()` retourne `{"status": "ok"}`).
- [ ] **Composants UI Phase 1 `[À CODER - UI]` :** Développer `src/app/(auth)/login/page.tsx`, `src/app/(protected)/layout.tsx` et `src/components/layout/PageHeader.tsx`.
- [ ] Les 2 comptes du couple peuvent se connecter sur `/login` et l'inscription publique est désactivée dans Supabase.
- [ ] La navigation entre les 5 onglets fonctionne en mode plein écran sur iOS avec fond `#000000` et respect de la Safe Area basse.

---

## ⚠️ Points d'Attention pour le Développement UI (Issus de l'Audit Pré-Dev)
1. **Safe Area Haute sur `PageHeader.tsx`** : Appliquer systématiquement le padding supérieur dynamique `pt-[env(safe-area-inset-top)]` pour éviter que les titres et boutons d'en-tête n'entrent en collision avec l'encoche iPhone ou la Dynamic Island.
2. **Dimensionnement des Bottom Sheets Vaul** : Pour tous les tiroirs de formulaires et de saisie (ex: `AddItemDrawer`, `ProfileTargetsDrawer`), borner la hauteur maximale avec `max-h-[85vh]` pour conserver le geste de balayage naturel vers le bas et dégager la barre de statut iOS.
