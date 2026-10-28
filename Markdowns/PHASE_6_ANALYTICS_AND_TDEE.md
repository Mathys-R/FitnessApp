# Phase 6 : Tableaux de Bord, Analytics Muscu, Calculateur TDEE 14j & Export (JSON + 3 CSV)

## 1. Objectif & Périmètre de la Phase
- **Objectif :** Consolider en lecture seule (*Read-Only*) les données collectées en Phases 2 (Poids EMA), 4 (Séances & 1RM) et 5 (Calories ingérées) pour calculer la Maintenance Calorique Réelle (TDEE dynamique sur 14 jours révolus), tracer les courbes de progression 1RM par exercice (selon `session_date`), visualiser le volume hebdomadaire sur les **10 groupes musculaires** (semaine Lundi → Dimanche), finaliser le cockpit de l'Onglet 1 (*Aujourd'hui*) et proposer l'export complet en JSON ainsi qu'en **3 fichiers CSV dédiés**.
- **Pourquoi en dernier :** Ce module dépend de toutes les briques de saisie précédentes pour croiser mathématiquement l'énergie ingérée et la variation de masse corporelle lissée.
- **Prérequis :** Phases 1 à 5 terminées.

---

## 2. Guidelines Strictes & Règles Métier de la Phase 6

1. **Plafond strict de 200 lignes par fichier :** Chaque graphique et carte analytique (`TdeeBanner.tsx`, `OneRmChart.tsx`, `MuscleRadar.tsx`, `ExportDataCard.tsx`) est isolé dans un fichier `< 200 lignes`. Les services sont scindés en 2 fichiers `< 200 lignes` dans `src/features/analytics/services/`.
2. **Règles Mathématiques & Stabilité du Calculateur TDEE 14 Jours (`tdee.math.ts`) :**
   - **Fenêtre nutritionnelle sur les 14 derniers jours révolus ($J-14$ à $J-1$) :** La journée en cours (`todayIso`, $J$) est systématiquement exclue de la moyenne calorique $\overline{Kcal}_{14j}$ et du compteur `excludedDaysCount`. Ainsi, la valeur de TDEE affichée dès le matin reste **100 % fixe toute la journée** et ne subit aucune variation aberrante entre le petit-déjeuner et le dîner.
   - **Double filtre d'exclusion anti-bruit sur les journées révolues :** Une journée passée ($< J$) est exclue de $\overline{Kcal}_{14j}$ si :
     1. L'utilisateur a coché manuellement `exclude_from_tdee = true`, **OU**
     2. Le total calorique enregistré ce jour-là est inférieur à **50 % de l'objectif du jour (`total_kcal < target_kcal * 0.5`)**.
   - **Seuil de calibration avant affichage :** Le TDEE chiffré est débloqué dès que :
     - Au moins **10 journées nutritionnelles révolues valides** sont présentes sur les 14 derniers jours passés, **ET**
     - Au moins **2 pesées EMA valides espacées d'au moins 7 jours** existent dans la fenêtre ($J-14$ à $J$) pour calculer la pente de poids $\Delta EMA_{14j}$.
   - **Formule thermodynamique ($1\text{ kg} \approx 7700\text{ kcal}$) :**
     $$TDEE_{réel} = \overline{Kcal}_{14j} - \left( \frac{\Delta EMA_{14j} \times 7700}{14} \right)$$
3. **Volume Hebdomadaire sur les 10 Groupes Musculaires (Semaine Lundi → Dimanche) & 1RM par `session_date` :**
   - Le volume hebdomadaire (`getWeeklyMuscleVolume`) est calculé sur la **semaine calendaire du Lundi au Dimanche** (via `getWeekDatesIso`, aligné sur le split et l'agenda hebdomadaire) en filtrant sur `workout_sessions.session_date`.
   - De même, l'historique de 1RM et de Tonnage (`getExerciseOneRmHistory`) regroupe les performances selon la date de l'agenda (`workout_sessions.session_date`), jamais selon l'heure technique du clic.
4. **Export Complet : 1 JSON + 3 Fichiers CSV Dédiés (`export.service.ts`) :**
   - L'utilisateur peut exporter son historique en `.json` complet ou télécharger les **3 fichiers CSV** compatibles Excel / Numbers iOS :
     1. `daily_logs.csv` : Date, Poids brut, Poids EMA 7j, Objectifs du Snapshot (`kcal`, `p`, `g`, `l`), Exclusion TDEE.
     2. `nutrition_history.csv` : Date, Catégorie de repas, Type d'entrée, Libellé, Quantité, Unité, Kcal, Protéines, Glucides, Lipides.
     3. `workout_history.csv` : Date de séance (`session_date`), Nom de séance, Exercice, Groupe musculaire principal, N° Série, Poids (kg), Reps, 1RM Epley (kg), Échauffement, PR, Note de séance.

---

## 3. Fichiers de Code de la Phase 6 (Déjà Extraits dans le Projet)

- **Couche 1 — Moteur Mathématique Pur :** [`src/lib/math/tdee.math.ts`](../src/lib/math/tdee.math.ts)
  - `isDayValidForTdee(day)`
  - `computeDynamicTdee14Days(daysWindow, todayIso)`
- **Couche 2 — Services Supabase Scindés (`< 200 lignes`) :**
  1. **KPIs, TDEE 14j Révolus, 1RM & Volume Lundi→Dimanche :** [`src/features/analytics/services/kpis.service.ts`](../src/features/analytics/services/kpis.service.ts)
     - `getTdee14DaysAnalysis()`
     - `getExerciseOneRmHistory(exerciseId)`
     - `getWeeklyMuscleVolume(referenceDateIso)`
  2. **Export JSON & Bundle des 3 CSV :** [`src/features/analytics/services/export.service.ts`](../src/features/analytics/services/export.service.ts)
     - `exportUserDataJson()`
     - `exportUserDataCsvBundle()`

---

## 4. Couche 3 — Spécification des Composants UI (`< 200 lignes`) & Assemblage Final

### 4.1 `src/features/analytics/components/TdeeBanner.tsx` (< 140 lignes)
- **Si `status === 'calibrating'` :** Affiche une barre de progression *"Calibration de ta Maintenance Réelle : `validNutritionDays / 10` jours complets"* et indique combien de jours passés exclus (`excludedDaysCount`) ont été ignorés.
- **Si `status === 'ready'` :**
  - Affiche en grand avec `<NumberFlow />` : **`estimatedTdeeKcal` kcal / jour** (*Maintenance Réelle 14j*).
  - Affiche en sous-ligne : `Moyenne ingérée (14j passés) : averageIntakeKcal kcal/j` • `Tendance EMA 14j : deltaEma14dKg kg` (`excludedDaysCount` jour(s) exclu(s)).

### 4.2 `src/features/analytics/components/OneRmChart.tsx` (< 170 lignes)
- Sélecteur d'exercice en haut de carte (filtrable par groupe musculaire).
- Graphique Recharts `AreaChart` / `LineChart` permettant de basculer entre la courbe de **1RM Théorique (kg)** et la courbe de **Tonnage par séance (kg)**, indexées sur `session_date`.

### 4.3 `src/features/analytics/components/MuscleRadar.tsx` (< 160 lignes)
- En-tête avec sélecteur de semaine (`Lundi -> Dimanche`, semaine courante par défaut).
- Barres horizontales progressives (ou radar) affichant le volume hebdomadaire de séries effectives sur les **10 groupes musculaires** (`Pecs`, `Dos`, `Épaules`, `Biceps`, `Triceps`, `Quadriceps`, `Ischios`, `Fessiers`, `Mollets`, `Abdos`), avec repère visuel de la zone optimale (`10–20 séries/semaine`).

### 4.4 `src/features/analytics/components/ExportDataCard.tsx` (< 120 lignes)
- Carte `.ios-card` proposant :
  - Bouton **"Exporter les 3 CSV (Poids, Nutrition, Muscu)"** déclenchant le téléchargement de `daily_logs.csv`, `nutrition_history.csv` et `workout_history.csv`.
  - Bouton **"Exporter la sauvegarde complète (.JSON)"**.

### 4.5 Assemblage Final de l'Onglet 1 (`src/app/(protected)/page.tsx` — *Aujourd'hui*)
L'écran d'accueil unifie en un seul coup d'œil les 4 piliers quotidiens :
1. **En-tête Date & Bandeau TDEE compact** (`TdeeBanner`).
2. **Anneau & Barres de Macros du jour** (`DailyMacroSummary` + bouton rapide `+ Ajouter un repas`).
3. **Carte Poids du matin & EMA 7j** (`WeightQuickInput`).
4. **Carte Séance du jour** :
   - Si une séance est active dans `useActiveWorkoutStore` : Bandeau vert pulsant *"Séance en cours — Reprendre"*.
   - Sinon si une séance est `planned` aujourd'hui : Bouton *"Lancer [Nom de la séance prévue]"*.
   - Sinon si `completed` : Résumé de la séance terminée (Durée, Tonnage, PR).

---

## 5. Checklist de Validation Finale (Definition of Done — Phase 6 & Projet V1)

- [ ] **Test Stabilité & Exclusion TDEE :**
  - Vérifier que saisir un petit-déjeuner ou un déjeuner aujourd'hui ($J$) ne fait pas fluctuer le TDEE du jour (calculé sur $J-14 \dots J-1$).
  - Vérifier qu'une journée passée avec `< 50 %` de la cible ou avec `exclude_from_tdee = true` est écartée de la moyenne 14j.
- [ ] **Test Volume 10 Groupes Musculaires (Lundi → Dimanche) :** Valider une séance sur la semaine en cours contenant 4 séries effectives de Squat (`Quadriceps` primaire, `Fessiers` secondaire) et 4 séries de Hip Thrust (`Fessiers` primaire, `Ischios` secondaire) → vérifier que le compteur affiche `Quadriceps: 4`, `Fessiers: 6`, `Ischios: 2`.
- [ ] **Test Export (JSON + 3 CSV) :** Télécharger `daily_logs.csv`, `nutrition_history.csv`, `workout_history.csv` et le `.json` complet.
- [ ] **Audit Final des 4 Règles d'Or (`ARCHITECTURE.md`) :**
  - Aucun fichier applicatif (`.ts`, `.tsx`, `.css`) ne dépasse 200 lignes.
  - Aucun appel `supabase.from()` n'existe dans un fichier `.tsx`.
  - Tous les calculs résident dans `src/lib/math/*.ts`.
  - `npx tsc --noEmit` et `npm run build` compilent avec 0 erreur et 0 `any`.
