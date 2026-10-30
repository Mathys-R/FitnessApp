# Rapport d'Audit Pré-Développement — FitnessApp

**Date** : 2026-10-30 | **Statut** : Validé & Autonome | **Exécution** : Docker Node 20 Alpine  
**Documents détaillés associés** :
- [`docs/audit/technical_inventory_and_dx.md`](./docs/audit/technical_inventory_and_dx.md) : Inventaire technique complet & DX
- [`docs/audit/mock_strategy_and_contracts.md`](./docs/audit/mock_strategy_and_contracts.md) : Stratégie de mocking & contrats Couche 2/3
- [`docs/audit/specs_evaluation_phases_1_6.md`](./docs/audit/specs_evaluation_phases_1_6.md) : Analyse critique des spécifications Phases 1 à 6

---

## 1. Ce qui est fait (État des lieux technique & fondations)

1. **Conteneurisation Docker stricte (`docker-compose.yml:1-32`)** :
   - Conteneur `fitness-app` actif (`ports: 3000:3000`). Volumes nommés `fitness_node_modules` et `fitness_next_cache` isolant le runtime. Zéro pollution du stockage macOS hôte (`ARCHITECTURE_MAP.md:1-12`).
2. **Couche 1 — Mathématiques pures & Fuseau horaire (`src/lib/math/`, `src/lib/`)** :
   - 4 modules de pures fonctions : `weight-ema.math.ts` (lissage EMA $\alpha=0.25$), `workout-kpis.math.ts` (1RM Epley, PRs, tonnage), `nutrition.math.ts` (macros 3 modes, diviseur Meal Prep), `tdee.math.ts` (TDEE 14j révolus, filtre anti-bruit <50%).
   - `src/lib/date.utils.ts` (34 l.) : Calendrier calé sur `Europe/Paris` (anti-décalage UTC sur iPhone).
   - **8 suites de tests unitaires (84 tests 100% GREEN)** sous `tests/unit/`, exécutés en 956 ms (82 ms pur) via `docker compose exec app npm test`.
3. **Couche 2 — Services métier & Store Zustand (`src/features/*/services/`)** :
   - 12 services cloisonnés et store d'entraînement `active-workout.store.ts` (171 l.) persistant en `localStorage` (clé `fitcouple-active-workout-v1`).
   - Règle des 200 lignes respectée à 100% sur l'ensemble des modules.
4. **Schéma SQL & Sécurité RLS (`supabase/migrations/001_initial_schema.sql`, 482 l.)** :
   - 14 tables, 5 enums, 5 triggers automatiques (synchronisation snapshots et repas clonés).
   - 3 RPCs dont `copy_meal_entries` durcie contre les attaques BOLA/IDOR (OWASP API1:2023).
   - RLS hermétique : isolation stricte `auth.uid() = user_id` et partage couple sécurisé.
5. **Qualité statique & Typage** :
   - `docker compose exec app npx tsc --noEmit` : **0 erreur**.
   - `docker compose exec app npm run lint` : **0 warning / erreur**.
   - Composant `BottomNav.tsx` (48 l.) et styles iOS (`globals.css`) opérationnels.

---

## 2. Ce qui est améliorable (DX, configurations & performance)

1. **Scripts `package.json:5-12` incomplets** :
   - Absence de `"typecheck": "tsc --noEmit"` et d'une commande unique de validation (`"check": "npm run lint && tsc --noEmit && npm test"`).
2. **Environnement Vitest restreint à `node` (`config/vitest.config.ts:10`)** :
   - `environment: 'node'` est parfait pour les maths pures (82 ms) mais ne permet pas de tester les composants React 19 nécessitant des événements DOM (`window`, `document`).
3. **Tokens Tailwind non déclarés (`config/tailwind.config.ts:11-13`)** :
   - `theme.extend` est vide (`{}`). Les codes couleurs OLED (`#000000`, `#1C1C1E`, `#2C2C2E`, `#0A84FF`, `#30D158`, etc.) sont dispersés en dur. À centraliser dans Tailwind.
4. **Optimisation réseau Couche 2** :
   - `sessions.service.ts:98-132` : La boucle séquentielle `for` insérant exercices et séries génère 16 allers-retours réseau pour une séance de 8 exercices. À paralléliser via `Promise.all` ou RPC.
   - `ghost-records.service.ts:65-75` : Charge toutes les séances passées de l'exercice pour extraire la dernière en mémoire JS. À optimiser avec un `.limit(1)` PostgREST.
5. **Redondance Dockerfile** :
   - `docker/Dockerfile` et `docker/Dockerfile.dev` sont identiques (27 lignes chacun). À harmoniser.

---

## 3. Ce qui pourrait être ajouté (Outillage de test & Mocks)

1. **Harnais de test React DOM pour la Couche 3** :
   - Dépendances : `@testing-library/react`, `@testing-library/user-event`, `happy-dom`.
   - Utilisation ciblée via l'en-tête `// @vitest-environment happy-dom` pour préserver la vélocité Node sur les maths pures.
2. **Stratégie de Mocking Couche 2 (Règle d'Or #3)** :
   - *Principe* : Ne JAMAIS mocker PostgREST directement dans l'UI. Les composants consomment exclusivement les services métier. On mocke donc directement `src/features/*/services/*.service.ts`.
   - Mettre en place `tests/mocks/services/` avec des implémentations bouchonnées retournant des fixtures typées.
3. **Fixtures standardisées (`tests/fixtures/`)** :
   - `profiles.fixture.ts` : Profils couple avec cibles caloriques et macro-nutritionnelles.
   - `daily-log.fixture.ts` : Historique de pesées 14j, EMA lissé et jours exclus du TDEE.
   - `workout.fixture.ts` : Presets structurés, séances terminées, séries avec ghost values et PRs.
   - `nutrition.fixture.ts` : Aliments des 3 modes (`100g`, `unit`, `both`), recettes avec portions divisées.
4. **Mode Démo Offline (`NEXT_PUBLIC_USE_MOCKS=true`)** :
   - Permet de lancer et tester visuellement la PWA dans le conteneur sans connexion Supabase active.

---

## 4. Ce qui doit être fait ou bloque avant le dev UI

### 4.1 Prérequis Bloquants Immédiats
1. **BLOQUANT RUNTIME : 404 sur `/` et `/login` (Absence totale de routes applicatives)** :
   - Vérification : `docker compose exec app wget -S -O /dev/null http://127.0.0.1:3000/` retourne `HTTP 307` vers `/login` puis **`HTTP 404 Not Found`**.
   - Cause : `src/middleware.ts:41-45` intercepte les accès non connectés, mais `src/app/(auth)/login/page.tsx` n'existe pas.
   - *Action Phase 1 prioritaire* : Créer `login/page.tsx`, `(protected)/layout.tsx` et `(protected)/page.tsx`.
2. **BLOQUANT CONTRAT : Absence totale de `src/features/auth/services/auth.service.ts`** :
   - Aucun service d'authentification n'existe. Pour implémenter `login/page.tsx` sans violer la Règle d'Or #3, il est impératif d'exporter `signInWithPassword`, `signOut` et `getSessionUser`.
3. **BLOQUANT TDD : Dépendances de test de composants absentes** :
   - Installer `happy-dom` et `@testing-library/react` dans Docker avant de lancer les développements UI.

### 4.2 Gaps de Contrats Couche 2 à combler
1. **GAP NUTRITION (`entries.service.ts:37, 134`)** :
   - `updateFoodMealEntryQuantity` exige l'objet `food: FoodRow`. Or `getDailyNutrition` ne fait pas de jointure `food:foods (*)`. `MealCard.tsx` ne peut pas modifier les portions sans requête illicite.
   - *Correction* : Ajouter `food:foods (*)` dans `getDailyNutrition` et enrichir `MealEntryWithItems`.
2. **GAP PESÉE (`log.service.ts:162`, `PHASE_2:48`)** :
   - `WeightQuickInput.tsx` attend la prop `previousEmaKg: number | null`.
   - *Correction* : Exporter `getPreviousWeightEma(logDate: string)` dans `log.service.ts`.
3. **GAP PRESETS (`presets.service.ts`)** :
   - Exporter `createWorkoutPreset` et `updateWorkoutPreset` pour autoriser la gestion de presets hors séance.
4. **TYPAGE RELATIONS (`database.types.ts`)** :
   - Renseigner `Relationships` sur les 8 tables actuellement vides pour supprimer les casts `as unknown as Type`.

### 4.3 Zones d'Ombre des Spécifications (Phases 1 à 6)
1. **Composant `ExercisePickerDrawer` manquant (Phase 4)** : Non spécifié pour l'ajout d'exercice en séance active.
2. **Dialogue de confirmation d'abandon de séance (Phase 4)** : Nécessaire pour sécuriser `clearActiveSession()`.
3. **Téléchargements multiples sur Safari iOS (Phase 6)** : Le téléchargement simultané de 3 CSV est bloqué par iOS. Prévoir 3 boutons séparés ou une archive ZIP.
4. **Ergonomie Mobile** : Ajouter le padding Safe Area haute (`pt-[env(safe-area-inset-top)]`) sur `PageHeader.tsx` (Phase 1) et borner la hauteur des tiroirs Vaul (`max-h-[85vh]`, Phase 5).

---

## 5. Synthèse & Feuille de Route d'Amorçage

| Étape | Action Préalable | Cible |
|---|---|---|
| **Étape 0.1** | Installer dépendances de test UI dans Docker | `@testing-library/react`, `happy-dom` |
| **Étape 0.2** | Créer `src/features/auth/services/auth.service.ts` | Méthodes `signIn`, `signOut`, `getUser` |
| **Étape 0.3** | Résoudre les 2 gaps de contrat Couche 2 | Jointure `foods` (`entries`), helper EMA (`log`) |
| **Étape 1.0** | Lancement Phase 1 (UI Shell & Authentification) | `login/page.tsx`, `(protected)/page.tsx` |

*Vérification d'intégrité : Tous les constats s'appuient sur l'inspection directe des fichiers source et des commandes Docker reproduites avec succès.*

