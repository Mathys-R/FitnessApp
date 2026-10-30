# Stratégie de Mocking & Analyse des Contrats d'Interface

Document d'audit approfondi sur la stratégie de test et les contrats Couche 2 / Couche 3 de FitnessApp.
Référence : `ORIGINAL_REQUEST.md`, `ARCHITECTURE_MAP.md`, `tests/`, `src/features/*/services/`.

---

## 1. État des Lieux de la Couverture de Mocking

### 1.1 Constat Actuel : Zéro Mock Applicatif
- **Couverture de tests actuelle** : 8 suites de tests unitaires sous `tests/unit/` (84 tests GREEN). Ces tests couvrent exclusivement les fonctions mathématiques pures et de dates de la Couche 1 (`src/lib/math/`, `src/lib/date.utils.ts`).
- **Absence totale de mocks** : Aucun mock de client Supabase, aucun handler MSW (Mock Service Worker), aucune fixture standardisée ni mock de service n'existe dans le projet (`grep_search` = 0 occurrence).
- **Conséquence pour le développement UI (Phases 1 à 6)** :
  - Tout composant React appelant un service de la Couche 2 (`src/features/*/services/`) tentera d'instancier `createBrowserClient` (`src/lib/supabase/client.ts:7`).
  - Comme `.env.local` contient des variables fictives (`ton-projet-id.supabase.co`), toute interaction UI non mockée se solde par un échec réseau (`FetchError`).
  - L'environnement Vitest configuré sur `node` (`config/vitest.config.ts:10`) et l'absence de `@testing-library/react` bloquent l'écriture de tests de composants (TDD).

---

## 2. Stratégie de Mocking Cible pour l'UI (Couche 3)

### 2.1 Mocker la Couche 2 (Services) plutôt que PostgREST
La **Règle d'Or #3** de l'architecture FitnessApp stipule : *"Zéro appel Supabase dans l'UI. Les composants consomment exclusivement les services métier (Couche 2)."*

Cette règle offre un avantage architectural déterminant pour les tests :
1. **Fragilité du mock PostgREST direct** : Mocker la chaîne fluide de Supabase (`supabase.from().select().eq().order().limit()`) est complexe, verbeux et sujet à casse dès qu'un filtre change.
2. **Robustesse du mock des Services Métier** : Les services de Couche 2 exposent des fonctions asynchrones à typage fort (`getDailyNutrition(date)`, `saveWorkoutSession(params)`). Il est infiniment plus fiable et maintenable de mocker ces fonctions TypeScript avec Vitest (`vi.mock('@/features/.../services/...')`).

### 2.2 Architecture des Fixtures Standardisées (`tests/fixtures/`)
Pour alimenter les tests unitaires de composants et le mode démo, quatre modules de fixtures doivent être introduits sous `tests/fixtures/` :
- `profiles.fixture.ts` : Profils utilisateur et partenaire (objectifs kcal, cibles P/G/L, liaison couple).
- `daily-log.fixture.ts` : Historique de pesées sur 14 jours, valeurs EMA lissées, états d'exclusion TDEE.
- `workout.fixture.ts` : Presets structurés, séances `completed` avec charges/reps/RPE, séries fantômes et PRs.
- `nutrition.fixture.ts` : Aliments des 3 catégories de dosage (`100g`, `unit`, `both`), recettes avec ingrédients divisés, entrées de journal avec sous-ingrédients clonés.

### 2.3 Mocks Réutilisables de Couche 2 (`tests/mocks/services/`)
Implémentations bouchonnées des 12 services de Couche 2 :
- Exporter des versions mockées pré-configurées avec les fixtures ci-dessus.
- Permettre la simulation immédiate des cas nominaux, des états vides (`[]`, `null`) et des cas d'erreur réseau (`throw new Error('Network error')`).

### 2.4 Mode Démo Offline PWA (`NEXT_PUBLIC_USE_MOCKS=true`)
Pour permettre le test visuel autonome de la PWA sur iPhone ou navigateur sans connexion Supabase distante :
- Créer un `MockDataProvider` optionnel en Couche 3 ou aiguiller les services vers un stockage mémoire/localStorage lorsque `NEXT_PUBLIC_USE_MOCKS=true`.

---

## 3. Analyse des Écarts de Contrats (Couche 2 ➔ Couche 3)

L'audit détaillé des signatures de services face aux besoins des écrans des Phases 1 à 6 a révélé 5 écarts critiques qui doivent être comblés :

### 3.1 Gap Critique 1 : Absence de `auth.service.ts` (Phase 1)
- **Localisation** : `src/features/auth/` n'existe pas.
- **Problème** : `PHASE_1_FOUNDATION.md:114` prescrit la page `src/app/(auth)/login/page.tsx`. Sans service d'authentification, le composant `LoginForm.tsx` serait contraint d'appeler `createClient().auth.signInWithPassword(...)` directement dans l'UI, violant la Règle d'Or #3.
- **Action requise** : Créer `src/features/auth/services/auth.service.ts` exportant `signInWithPassword(email, password)`, `signOut()` et `getSessionUser()`.

### 3.2 Gap Critique 2 : Jointure `foods` manquante dans `getDailyNutrition` (Phase 5)
- **Localisation** : `src/features/nutrition/services/entries.service.ts:37-40` & `l.134-139`.
- **Observation** :
  ```typescript
  // entries.service.ts:37
  .select(`*, meal_entry_items (*)`) // Manque: food:foods (*)
  // entries.service.ts:134
  export async function updateFoodMealEntryQuantity(params: {
    entryId: string; food: FoodRow; newQuantityValue: number; newLoggedUnit: LoggedUnit;
  })
  ```
- **Problème** : `MealCard.tsx` (Phase 5) permet à l'utilisateur d'éditer la quantité d'un aliment. Pour appeler `updateFoodMealEntryQuantity`, le composant a besoin de l'objet `food: FoodRow`. Comme `getDailyNutrition` ne joint pas la table `foods`, l'UI ne dispose pas de `FoodRow` et ne peut pas exécuter l'action.
- **Action requise** : Modifier le `.select()` dans `entries.service.ts:37` pour inclure `food:foods (*)` et enrichir l'interface `MealEntryWithItems`.

### 3.3 Gap Critique 3 : Absence de fonction `getPreviousWeightEma` (Phase 2)
- **Localisation** : `src/features/daily-log/services/log.service.ts:162-177` & `PHASE_2:48`.
- **Problème** : `WeightQuickInput.tsx` attend la prop `previousEmaKg: number | null`. Or, `log.service.ts` n'expose que `getWeightHistory(limitDays)`.
- **Action requise** : Exporter un helper léger `getPreviousWeightEma(logDate: string): Promise<number | null>` dans `log.service.ts`.

### 3.4 Gap Critique 4 : Méthodes CRUD directes manquantes sur les Presets (Phase 4)
- **Localisation** : `src/features/workout/services/presets.service.ts:26,97`.
- **Problème** : `presets.service.ts` n'expose que `getWorkoutPresets`, `buildActiveExercisesFromPreset`, et `deleteWorkoutPreset`. La création et mise à jour de presets ne sont possibles qu'en fin de séance via `finishAndSaveWorkoutSession`. L'utilisateur ne peut pas créer ou modifier un preset hors entraînement.
- **Action requise** : Exporter `createWorkoutPreset` et `updateWorkoutPreset` dans `presets.service.ts`.

### 3.5 Gap 5 : Typage des Relations dans `database.types.ts`
- **Localisation** : `src/types/database.types.ts:45,96,132,156,183,270,438,468`.
- **Problème** : 8 tables ont `Relationships: []`. Les jointures PostgREST dans les services (`daily-log`, `presets`, `ghost-records`, `entries`, `recipes`) nécessitent des assertions `as unknown as CustomType`.
- **Action requise** : Mettre à jour les définitions `Relationships` dans `database.types.ts` pour sécuriser le typage statique de bout en bout.

---

## 4. Prérequis pour le Démarrage des Tests UI

Avant de coder les composants React en TDD lors des Phases 1 à 6 :
1. Installer dans Docker les bibliothèques de test DOM :
   ```bash
   docker compose -f FitnessApp/docker-compose.yml exec app npm install -D @testing-library/react @testing-library/dom @testing-library/user-event happy-dom
   ```
2. Ajouter le docblock `// @vitest-environment happy-dom` en tête des fichiers `*.test.tsx`.
3. Mettre à disposition les fixtures `tests/fixtures/` pour que chaque composant UI soit testable immédiatement sans dépendance réseau.

