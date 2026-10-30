# Phase 3 : Les Catalogues Partagés (Exercices, Aliments & Plats Composés)

## 1. Objectif & Périmètre de la Phase
- **Objectif :** Construire les 3 référentiels partagés entre les deux comptes du couple (`exercises`, `foods`, `recipes` + `recipe_ingredients`), injecter la base initiale d'exercices ([`public/data/exercises_seed.json`](../public/data/exercises_seed.json)) répartie sur **10 groupes musculaires**, et s'appuyer sur le moteur de calcul nutritionnel pur ([`src/lib/math/nutrition.math.ts`](../src/lib/math/nutrition.math.ts)).
- **Pourquoi avant le tracking (Phases 4 & 5) :** Il est impossible de tester proprement une séance de musculation ou un journal de repas sans disposer des exercices, des aliments et des plats composés de référence.
- **Prérequis :** Phase 1 terminée.

---

## 2. Guidelines Strictes & Règles Métier de la Phase 3

1. **Plafond strict de 200 lignes par fichier :** L'onglet Catalogues (`src/app/(protected)/catalogs/page.tsx`) utilise un Segmented Control (`Exercices` | `Aliments` | `Mes Plats`) et délègue chaque vue et chaque formulaire Drawer `vaul` à un sous-composant dédié `< 200 lignes`. Les services sont scindés en 2 fichiers dans `src/features/catalogs/services/`.
2. **Les 10 Groupes Musculaires Officiels (Jambes détaillées) :**
   - Voir [`src/types/domain.types.ts`](../src/types/domain.types.ts) :
     - **Haut du corps & Tronc (6) :** `Pecs`, `Dos`, `Épaules`, `Biceps`, `Triceps`, `Abdos`
     - **Bas du corps (4) :** `Quadriceps`, `Ischios`, `Fessiers`, `Mollets`
   - Le champ `setup_guide` de chaque exercice précise la portion anatomique ciblée (ex: *Faisceau claviculaire*, *Chef long*, *Grand fessier*, etc.) et 2-3 consignes de placement.
3. **Les 3 Modes de Mesure d'un Aliment (`serving_type` : `'100g' | 'unit' | 'both'`) :**
   - C'est au moment d'enregistrer un aliment dans le catalogue que l'utilisateur choisit comment il se mesure :
     1. **`100g` (Poids uniquement — ex: Riz cru, Pâtes, Pain) :** Les macros de base sont saisies pour `100g`. Lors de l'utilisation, on saisit uniquement des grammes (`g`).
     2. **`unit` (Unité uniquement — ex: Œuf moyen, Gélule Oméga-3, Pot individuel) :** Les macros de base sont saisies directement pour `1 unité`. Lors de l'utilisation, on saisit uniquement un nombre d'unités (`unit`).
     3. **`both` (Grammes OU Unité au choix — ex: Banane, Pomme, Carré de chocolat) :** Les macros de base sont saisies pour `100g` **ET** on renseigne le poids moyen d'une unité dans `unit_weight_g` (ex: `1 banane = 120g`). Ainsi, au moment d'utiliser la banane dans une recette ou un repas, l'utilisateur peut basculer librement entre **`[ g | unité ]`**.
4. **Plat Composé (`recipes`) = 1 Portion Individuelle de Référence :**
   - Dans la base de données (`recipes` + `recipe_ingredients`), un plat composé stocke **toujours les quantités pour 1 portion individuelle (1 repas)**.
   - **Outil Meal Prep à la création :** Dans le formulaire de création de plat (`RecipeBuilderDrawer`), un champ *"Diviser par X parts (Meal Prep)"* (par défaut `1`) permet de saisir les ingrédients totaux d'une grosse préparation (ex: `400g` de pâtes et `600g` de bœuf pour `4 tupps`) : l'application divise automatiquement chaque ingrédient par `4` (`100g` de pâtes et `150g` de bœuf) avant de l'enregistrer en base.
   - **Ré-édition d'un plat existant :** Lorsqu'on rouvre un plat existant du catalogue pour le modifier, les quantités affichées sont directement celles d'**1 portion** (`servingsPrepared = 1` par défaut).
5. **Archivage doux (`is_archived`) :**
   - Supprimer un exercice, un aliment ou une recette dans l'UI exécute un `UPDATE ... SET is_archived = true` afin de ne jamais violer les clés étrangères `ON DELETE RESTRICT` des séances ou recettes privées du partenaire.

---

## 3. Fichiers de Code de la Phase 3 (Déjà Extraits dans le Projet)

- **Seed initial (40 exercices sur les 10 groupes musculaires) :** [`public/data/exercises_seed.json`](../public/data/exercises_seed.json) `[OK]` (présent et prêt pour le peuplement initial)
- **Couche 1 — Moteur Mathématique Pur :** [`src/lib/math/nutrition.math.ts`](../src/lib/math/nutrition.math.ts) `[OK]` (134 lignes, fonctions TypeScript pures)
  - `roundMacro(val)` & `roundQuantity(val)`
  - `computeFoodMultiplier(servingType, unitWeightG, quantityValue, loggedUnit)`
  - `calculateFoodMacros(food, quantityValue, loggedUnit)`
  - `normalizeQuantityPerSingleServing(totalQuantity, servingsDivisor)`
  - `scaleQuantityByPortions(baseSingleServingQuantity, portionsMultiplier)`
  - `sumMacroValues(items)`
- **Couche 2 — Services Supabase Scindés (`< 200 lignes`) :**
  1. **Exercices :** [`src/features/catalogs/services/exercises.service.ts`](../src/features/catalogs/services/exercises.service.ts) `[OK]` (63 lignes)
     - `getActiveExercises()` (injecte automatiquement `exercises_seed.json` si la table est vide)
     - `createOrUpdateExercise(payload)`
     - `archiveExercise(exerciseId)`
  2. **Aliments & Recettes :** [`src/features/catalogs/services/nutrition.service.ts`](../src/features/catalogs/services/nutrition.service.ts) `[OK]` (136 lignes)
     - `getActiveFoods()`, `createOrUpdateFood(payload)`, `archiveFood(foodId)`
     - `getActiveRecipes()`, `saveRecipeSingleServing(params)`, `archiveRecipe(recipeId)`

---

## 4. Couche 3 — Spécification des Composants UI (`< 200 lignes`) — `[À CODER - UI]`

### 4.1 `src/features/catalogs/components/MuscleFilterChips.tsx` (< 80 lignes) — `[À CODER - UI]`
- Barre horizontale scrollable sans barre de défilement (`overflow-x-auto no-scrollbar flex gap-2`) affichant `Tous` suivi des **10 groupes musculaires** (`Pecs`, `Dos`, `Épaules`, `Biceps`, `Triceps`, `Quadriceps`, `Ischios`, `Fessiers`, `Mollets`, `Abdos`).
- Bulle active en `#0A84FF` texte blanc, bulles inactives en `#1C1C1E` texte `#8E8E93`, hauteur minimale `44px`.

### 4.2 `src/features/catalogs/components/ExerciseList.tsx` & `ExerciseFormDrawer.tsx` (< 180 lignes chacun) — `[À CODER - UI]`
- Recherche instantanée par texte combinée au filtre `MuscleFilterChips`.
- Chaque carte d'exercice affiche le nom, le badge du muscle principal (`#0A84FF`), les badges des muscles secondaires (`#3A3A3C`), et un aperçu repliable du `setup_guide`.
- `ExerciseFormDrawer.tsx` : Permet d'ajouter ou modifier un exercice en choisissant 1 muscle principal parmi les 10, 0 à 3 muscles secondaires, et le guide d'exécution.

### 4.3 `src/features/catalogs/components/FoodList.tsx` & `FoodFormDrawer.tsx` (< 180 lignes chacun) — `[À CODER - UI]`
- Dans `FoodFormDrawer.tsx` :
  - Sélecteur à 3 options pour `serving_type` :
    1. **`Par 100g`** (ex: Riz, Pain) → affiche les 4 champs macros pour `100g`.
    2. **`Par Unité`** (ex: Œuf) → affiche les 4 champs macros pour `1 unité` (et un champ optionnel *Poids d'1 unité (g)*).
    3. **`Les deux (100g + Unité)`** (ex: Banane) → affiche les 4 champs macros pour `100g` **ET** rend obligatoire le champ *Poids moyen d'1 unité en grammes (`unit_weight_g`, ex: 120g)*.

### 4.4 `src/features/catalogs/components/RecipeList.tsx` & `RecipeBuilderDrawer.tsx` (< 195 lignes chacun) — `[À CODER - UI]`
- `RecipeBuilderDrawer.tsx` :
  - Nom du plat (ex: *"Pâtes Bolognaise Maison"*).
  - Sélecteur d'ingrédients depuis `foods` :
    - Si l'aliment est `'100g'`, saisie en `g`.
    - Si l'aliment est `'unit'`, saisie en `u`.
    - Si l'aliment est `'both'` (ex: Banane), affiche un mini-switch **`[ g | u ]`** à côté du champ de quantité !
  - **Bandeau "Mode Meal Prep (Diviseur de parts)" :** Champ numérique *"Quantités saisies pour combien de parts ?"* (défaut = `1`). Si l'utilisateur met `4`, l'aperçu en direct affiche : *"Enregistré pour 1 part : 100g Pâtes, 150g Bœuf — 540 kcal / part"* avec animation `<NumberFlow />`. Lors d'une modification d'un plat déjà enregistré, le formulaire s'ouvre directement avec les quantités d'1 portion (`parts = 1`).

### 4.5 Assemblage de la Page `src/app/(protected)/catalogs/page.tsx` — `[À CODER - UI]`
- Segmented Control à 3 onglets iOS (`Exercices` | `Aliments` | `Mes Plats`).
- Intégration respective de `MuscleFilterChips` + `ExerciseList` (avec trigger `ExerciseFormDrawer`), `FoodList` (avec trigger `FoodFormDrawer`), et `RecipeList` (avec trigger `RecipeBuilderDrawer`).

---

## 5. Checklist de Validation (Definition of Done — Phase 3)

- [x] **Seed d'exercices initial :** [`public/data/exercises_seed.json`](../public/data/exercises_seed.json) prêt et vérifié `[OK]` (40 exercices qualifiés sur les 10 groupes musculaires).
- [x] **Moteur mathématique nutritionnel :** `nutrition.math.ts` implémenté et vérifié `[OK]` (règle de trois macros, tool Meal Prep de division, calcul portions décimales).
- [x] **Services Supabase de catalogues :** `exercises.service.ts` (63 lignes) et `nutrition.service.ts` (136 lignes) implémentés et vérifiés `[OK]`.
- [ ] **Composants UI Catalogues `[À CODER - UI]` :** Développer `MuscleFilterChips.tsx`, `ExerciseList.tsx`, `ExerciseFormDrawer.tsx`, `FoodList.tsx`, `FoodFormDrawer.tsx`, `RecipeList.tsx`, `RecipeBuilderDrawer.tsx`, et la page `src/app/(protected)/catalogs/page.tsx`.
- [ ] Au premier chargement de l'onglet Catalogues, `exercises_seed.json` peuple automatiquement la base avec les exercices répartis sur les **10 groupes musculaires** (`Quadriceps`, `Ischios`, `Fessiers`, `Mollets` séparés).
- [ ] Création d'un aliment en mode `'100g'` (Riz), d'un aliment en mode `'unit'` (Œuf), et d'un aliment en mode `'both'` (Banane : 89 kcal/100g, 1 unité = 120g) vérifiée.
- [ ] Création d'un plat composé en saisissant les quantités pour `4 parts` → vérification en base que `recipe_ingredients` stocke bien les quantités divisées par 4 (pour **1 portion individuelle de référence**).
- [ ] Les deux comptes du couple voient et peuvent enrichir les 3 catalogues partagés.
- [ ] Aucun fichier ne dépasse 200 lignes ; `npx tsc --noEmit` retourne 0 erreur.
