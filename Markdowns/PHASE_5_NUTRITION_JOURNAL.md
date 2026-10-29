# Phase 5 : Le Journal Nutritionnel Quotidien (Quick Add, Aliments, Dépliage de Recettes & Copie Couple)

## 1. Objectif & Périmètre de la Phase
- **Objectif :** Construire le journal alimentaire quotidien découpé en 5 repas, connecté au Snapshot d'objectifs du jour (`daily_logs`), supportant les 3 modes d'ajout (`quick_add`, `food`, `recipe` avec portions décimales), l'édition et la suppression complète des entrées, le dépliage et l'adaptation au gramme près des ingrédients d'un plat composé uniquement sur sa journée personnelle, ainsi que la copie en 1 clic d'un repas d'hier ou du repas du partenaire.
- **Pourquoi après les Phases 2 et 3 :** Nécessite le Snapshot du jour (`getOrCreateDailyLog` — Phase 2) et les catalogues partagés d'aliments et de recettes + [`nutrition.math.ts`](../src/lib/math/nutrition.math.ts) (Phase 3).
- **Prérequis :** Phases 1, 2 et 3 terminées.

---

## 2. Guidelines Strictes & Règles Métier de la Phase 5

1. **Plafond strict de 200 lignes par fichier :** L'écran nutritionnel est découpé en `DailyMacroSummary.tsx`, `MealCard.tsx`, `RecipeSubmenuAccordion.tsx` et `AddNutritionItemDrawer.tsx`. Les services sont scindés en 2 fichiers `< 200 lignes` dans `src/features/nutrition/services/`.
2. **Isolation Totale entre le Rapport Personnel du Jour et le Plat du Catalogue + Portions Décimales :**
   - Lorsqu'on ajoute un plat composé (ex: *"Pâtes Bolo"*) dans un repas, l'utilisateur peut saisir un **nombre de portions décimal** (ex: `1`, `1.5`, `0.5` part). L'application crée une ligne parente dans `meal_entries` (`quantity_value = portions`) et **clone** ses ingrédients multipliés par `portions` dans `meal_entry_items`.
   - Chaque sous-ligne clonée dans `meal_entry_items` conserve ses valeurs de base (`kcal_per_base`, `p_per_base`, `g_per_base`, `l_per_base`, `serving_type`, `unit_weight_g`, `logged_unit`).
   - **Règle d'Override & Suppression locale :** Si tu modifies le riz de `60g` à `75g` ou que tu supprimes un sous-ingrédient dans le sous-menu dépliable de ton déjeuner, la fonction met à jour **uniquement ta ligne `meal_entry_items` du jour**. Le trigger PostgreSQL `trg_sync_parent_meal_entry_totals` recalcule instantanément le total de ton plat pour ce midi, et la recette *"Pâtes Bolo"* dans la base partagée reste intacte.
3. **Édition & Suppression Directe sur Toutes les Lignes (`meal_entries`) :**
   - L'utilisateur peut modifier après coup la quantité d'un aliment simple (`updateFoodMealEntryQuantity`), modifier un Quick Add (`updateQuickMealEntry`), ou supprimer n'importe quelle ligne de repas (`deleteMealEntry`).
4. **Adaptation Dynamique selon l'Aliment (`100g`, `unit` ou `both`) :**
   - Si un aliment (ou sous-ingrédient de recette) est configuré en `100g` : l'utilisateur saisit uniquement des grammes (`g`).
   - S'il est configuré en `unit` : l'utilisateur saisit uniquement des unités (`u`).
   - S'il est configuré en `both` (ex: Banane) : un bouton-bascule **`[ g | u ]`** permet de saisir au choix `120g` ou `1 u`.
5. **Copie Rapide de Repas (Hier & Partenaire) :**
   - Sur l'en-tête de chaque catégorie de repas (`Petit-déjeuner`, `Déjeuner`, `Dîner`, `Collation`, `Pré/Post-workout`), un menu rapide propose :
     - **Copier mon repas d'hier**
     - **Importer le repas de [Partenaire] d'aujourd'hui** (via la fonction RPC `copy_meal_entries`).
6. **Interrupteur d'Exclusion TDEE (`exclude_from_tdee`) :**
   - En bas de la carte `DailyMacroSummary`, un switch iOS permet de marquer la journée comme *"Journée atypique / Exclure du TDEE"*.

---

## 3. Fichiers de Code de la Phase 5 (Déjà Extraits dans le Projet)

- **Couche 1 — Moteur Mathématique Pur :** [`src/lib/math/nutrition.math.ts`](../src/lib/math/nutrition.math.ts) `[OK]` (134 lignes, fonctions TypeScript pures)
- **Couche 2 — Services Supabase Scindés (`< 200 lignes`) :**
  1. **Entrées de Repas, Édition, Suppression & Copie Couple RPC :** [`src/features/nutrition/services/entries.service.ts`](../src/features/nutrition/services/entries.service.ts) `[OK]` (189 lignes)
     - `getDailyNutrition(logDate)`
     - `addQuickMealEntry(params)` & `updateQuickMealEntry(params)`
     - `addFoodMealEntry(params)` & `updateFoodMealEntryQuantity(params)`
     - `deleteMealEntry(entryId)`
     - `getPartnerInfo()` (appel RPC `get_partner_info`) & `copyMealFromSource(params)` (appel RPC `copy_meal_entries`)
  2. **Plats Composés (Portions Décimales) & Sous-Ingrédients Clonés :** [`src/features/nutrition/services/recipes.service.ts`](../src/features/nutrition/services/recipes.service.ts) `[OK]` (145 lignes)
     - `addRecipeMealEntryWithClonedItems(params)` (support des portions décimales via `scaleQuantityByPortions`, ex: `1`, `1.5`, `0.5`)
     - `updateClonedIngredientQuantity(params)` (mise à jour locale du jour, trigger SQL recalculant les totaux du repas parent)
     - `deleteClonedIngredient(itemId)`

---

## 4. Couche 3 — Spécification des Composants UI (`< 200 lignes`) — `[À CODER - UI]`

### 4.1 `src/features/nutrition/components/DailyMacroSummary.tsx` (< 160 lignes) — `[À CODER - UI]`
- **Jauge principale des Calories :** Affiche en grand les calories restantes (`target_kcal - consumed_kcal`) et consommées avec `<NumberFlow />` et anneau/barre de progression Rose-Rouge `#FF375F`.
- **3 Barres de progression Macros (`motion.div` spring) :**
  - Protéines (`#32ADE6`) : `consumed_p / target_p g`
  - Glucides (`#FF9F0A`) : `consumed_g / target_g g`
  - Lipides (`#BF5AF2`) : `consumed_l / target_l g`
- **Pied de carte :** Switch iOS *"Exclure cette journée du calcul TDEE"* (`exclude_from_tdee`).

### 4.2 `src/features/nutrition/components/MealCard.tsx` (< 170 lignes) — `[À CODER - UI]`
- Une carte `.ios-card` pour chacune des 5 catégories : `Petit-déjeuner`, `Déjeuner`, `Dîner`, `Collation`, `Pré/Post-workout`.
- **En-tête du repas :** Nom du repas, total `kcal` du repas (`tabular-nums`), bouton `+` (`44x44px`) pour ouvrir `AddNutritionItemDrawer`, et menu rapide `...` proposant :
  1. **Copier mon repas d'hier**
  2. **Importer le repas de [Prénom Partenaire] d'aujourd'hui**
- **Corps du repas :**
  - Pour un aliment simple (`food`) ou `quick_add` : clic sur la quantité pour l'éditer en direct (`updateFoodMealEntryQuantity` / `updateQuickMealEntry`) + bouton de suppression (`deleteMealEntry`).
  - Pour un plat composé (`recipe`) : rend le sous-composant `RecipeSubmenuAccordion` + bouton de suppression du plat.

### 4.3 `src/features/nutrition/components/RecipeSubmenuAccordion.tsx` (< 165 lignes) — `[À CODER - UI]`
- Affiche la ligne parente du plat composé (ex: *"Pâtes Bolognaise (1,5 part) — 810 kcal | 63P • 90G • 21L"*) avec un chevron animé (`motion`).
- Au clic sur le plat, déplie en douceur (`AnimatePresence`) la liste de ses sous-ingrédients clonés (`meal_entry_items`) sur fond `#2C2C2E`.
- Sur chaque sous-ingrédient (ex: *Riz cru*), l'utilisateur peut modifier directement le grammage (`inputMode="decimal"`) ou supprimer l'ingrédient (`deleteClonedIngredient`) : les macros de la sous-ligne, du plat parent et de la jauge de la journée se mettent à jour en temps réel !

### 4.4 `src/features/nutrition/components/AddNutritionItemDrawer.tsx` (< 190 lignes) — `[À CODER - UI]`
- Bottom Sheet `vaul` avec 3 onglets :
  1. **Aliments** : Recherche instantanée dans `foods`. Au clic sur un aliment, champ de quantité (`g` si `'100g'`, `unité` si `'unit'`, ou sélecteur **`[ g | unité ]`** si `'both'`).
  2. **Mes Plats** : Liste des recettes partagées (`recipes`). Permet de saisir le nombre de parts en décimal (`inputMode="decimal"`, défaut `1`, boutons rapides `0.5`, `1`, `1.5`, `2`) puis clic sur **"Ajouter"** → appelle `addRecipeMealEntryWithClonedItems`.
  3. **Quick Add** : Formulaire libre (`Intitulé`, `Kcal`, et optionnellement `P`, `G`, `L`).

### 4.5 Assemblage de la Page `src/app/(protected)/nutrition/page.tsx` — `[À CODER - UI]`
- Navigation par date, carte `DailyMacroSummary`, et rendu ordonné des 5 `MealCard` selon `MEAL_CATEGORIES_ORDER`.

---

## 5. Checklist de Validation (Definition of Done — Phase 5)

- [x] **Moteur mathématique nutritionnel :** `nutrition.math.ts` implémenté et vérifié `[OK]` (macros au gramme, portions décimales, agrégation).
- [x] **Services Supabase Nutrition :** `entries.service.ts` (189 l., gestion des repas, Quick Add, copie RPC couple) et `recipes.service.ts` (145 l., clonage recette décimale, trigger d'override local) implémentés et vérifiés `[OK]`.
- [ ] **Composants UI Nutrition `[À CODER - UI]` :** Développer `DailyMacroSummary.tsx`, `MealCard.tsx`, `RecipeSubmenuAccordion.tsx`, `AddNutritionItemDrawer.tsx` et assembler la page `src/app/(protected)/nutrition/page.tsx`.
- [ ] **Test Plat Composé avec Portions Décimales & Override :** Ajouter `1,5 part` de *"Pâtes Bolo"* au déjeuner → vérifier que tous les sous-ingrédients sont multipliés par `1,5` → changer le riz dans le sous-menu → vérifier que le total du déjeuner se met à jour sans impacter la recette du catalogue.
- [ ] **Test Édition & Suppression d'Aliment Simple :** Ajouter `100g` de riz simple, modifier la ligne à `130g`, puis supprimer une ligne en doublon.
- [ ] **Test Aliment `'both'` (Banane) :** Ajouter une banane en mode `1 unité` (`120g`) puis une autre en mode `85g`.
- [ ] **Test Copie Partenaire & Hier :** Saisir un dîner sur le compte A → importer le dîner de A depuis le compte B → ajuster les grammages de B sans impacter A.
- [ ] Aucun fichier ne dépasse 200 lignes ; `npx tsc --noEmit` retourne 0 erreur.
