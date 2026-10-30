# Phase 4 : Le Moteur de Musculation (Agenda Daté, Presets, Séance Active, Ghost Values & PR)

## 1. Objectif & Périmètre de la Phase
- **Objectif :** Implémenter l'agenda hebdomadaire daté (Lundi → Dimanche), le gestionnaire complet de Presets, le moteur de séance active résilient aux fermetures de Safari iOS (`Zustand` + `localStorage`), la récupération automatique des performances précédentes (*Ghost Values* avec validation en 1 clic), le double système de notes par exercice, la ré-édition/suppression de séances passées et la détection dynamique des records (PR).
- **Pourquoi indépendant :** Il s'appuie uniquement sur l'Auth (Phase 1) et le Catalogue d'exercices à 10 groupes musculaires (Phase 3).
- **Prérequis :** Phases 1 et 3 terminées.

---

## 2. Guidelines Strictes & Règles Métier de la Phase 4

1. **Plafond strict de 200 lignes par fichier :** L'interface de séance est découpée en `ActiveSession.tsx` (conteneur), `ExerciseCard.tsx` (carte d'un exercice + double note), `SetRow.tsx` (ligne d'une série) et `FinishSessionDrawer.tsx` (modale de fin à 3 choix). Les services sont scindés en 3 fichiers `< 200 lignes` dans `src/features/workout/services/`.
2. **Persistance Anti-Crash iOS (`active-workout.store.ts`) :**
   - Toute séance en cours vit dans `localStorage` via `Zustand` (`persist`, clé `fitcouple-active-workout-v1`). Si Safari iOS libère la mémoire pendant que l'utilisateur change de musique sur Spotify, la séance se restaure instantanément à la réouverture.
3. **Validation en 1 clic des *Ghost Values* (1-Tap Validation) & Tri par `session_date` :**
   - Lorsqu'un exercice est chargé dans la séance, le service interroge la **dernière séance validée (`status = 'completed'`) triée par `session_date DESC` (date de l'agenda)** contenant cet exercice et affiche ses charges et répétitions en filigrane (`#8E8E93`) sur chaque série correspondante.
   - **Règle UX critique :** Si l'utilisateur clique directement sur le bouton **✓ (Valider la série)** alors que les champs Poids et/ou Répétitions sont encore vides, le store **copie automatiquement le poids et les répétitions de la *Ghost Value* comme valeurs réelles** avant de marquer `is_completed = true`.
4. **Correctif PostgREST sur jointure aliasée (`presets.service.ts:72`) :**
   - Lors de la requête sur `workout_session_exercises` joignant `workout_sessions` sous l'alias `session:workout_sessions!inner`, PostgREST exige que le filtre cible le nom de l'alias déclaré.
   - **Code appliqué :** `.eq('session.status', 'completed')` (et non `workout_sessions.status`, qui lève une erreur 400 PostgREST).
5. **Redéfinition Dynamique des PR (Personal Records) en Séance et à l'Enregistrement :**
   - Seules les séries effectives (`is_completed = true` et `is_warmup = false`) sont éligibles au 1RM et aux PR.
   - **Règle PR (`recomputeSessionSetsPrFlags`) :** À chaque validation ou modification d'une série (ainsi qu'à l'enregistrement de la séance), les séries de l'exercice sont évaluées dans l'ordre en comparant chaque série au **maximum courant** (`max(record_historique_avant_séance, meilleures_séries_précédentes_de_la_séance)`). Ainsi, si la Série 1 bat le record historique (`82.5 kg x 8`), une Série 2 moins bonne (`82.5 kg x 6`) ne déclenche pas de faux PR, tandis qu'une Série 2 encore meilleure (`85 kg x 8`) devient à son tour un nouveau PR !
6. **Notes Épinglées (Nettoyage propre par suppression si vidée) :**
   - Dans [`sessions.service.ts`](../src/features/workout/services/sessions.service.ts) : Si l'utilisateur modifie ou ajoute une `pinned_note`, elle est sauvegardée (`upsert`) dans `user_exercise_notes`.
   - Si l'utilisateur efface le texte de la `pinned_note` (chaîne vide `""` ou uniquement des espaces), le service exécute un **`DELETE FROM user_exercise_notes WHERE user_id = ... AND exercise_id = ...`** au lieu d'enregistrer une chaîne vide, évitant ainsi toute résurgence indésirable de la note à la séance suivante.
7. **Workflow de Fin de Séance à 3 Choix sur les Presets (`FinishSessionDrawer.tsx`) & Ré-édition de Séance :**
   - Au clic sur **"Terminer la séance"**, un Drawer `vaul` propose 3 options :
     1. **Écraser le preset de base** *(si lancé depuis un preset)*
     2. **Créer un nouveau preset avec cette séance**
     3. **Enregistrer uniquement la séance**
   - **Correction / Suppression d'une séance passée :** Depuis l'agenda ou l'historique, l'utilisateur peut supprimer une séance (`deleteWorkoutSession`) ou la rouvrir en mode édition (`loadSessionForEditing`) pour corriger une faute de frappe (ex: `800 kg` au lieu de `80 kg`).

---

## 3. Fichiers de Code de la Phase 4 (Déjà Extraits dans le Projet)

- **Couche 1 — Moteur Mathématique Pur :** [`src/lib/math/workout-kpis.math.ts`](../src/lib/math/workout-kpis.math.ts) `[OK]` (137 lignes, fonctions TypeScript pures)
  - `computeEpley1Rm(weightKg, reps, isWarmup)`
  - `isSetPersonalRecord(set, referenceMaxWeightKg, referenceMax1RmKg)`
  - `recomputeSessionSetsPrFlags(sets, historicalMaxWeightKg, historicalMax1RmKg)`
  - `computeEffectiveTonnage(sets)`
  - `computeMuscleGroupSetVolumes(items)`
- **Couche 2 — Store Anti-Crash & Services Supabase Scindés (`< 200 lignes`) :**
  1. **Store Zustand Persisté :** [`src/features/workout/store/active-workout.store.ts`](../src/features/workout/store/active-workout.store.ts) `[OK]` (195 lignes, persist localStorage `fitcouple-active-workout-v1`)
  2. **Presets & Ghost Values :** [`src/features/workout/services/presets.service.ts`](../src/features/workout/services/presets.service.ts) `[OK]` (198 lignes, tri strict `session_date DESC`, patch PostgREST `.eq('session.status', 'completed')`)
     - `getExerciseGhostAndRecords(exerciseId, excludeSessionId)`
     - `getWorkoutPresets()`
     - `buildActiveExercisesFromPreset(preset)`
     - `deleteWorkoutPreset(presetId)`
  3. **Enregistrement & Suppression de Séance :** [`src/features/workout/services/sessions.service.ts`](../src/features/workout/services/sessions.service.ts) `[OK]` (175 lignes, gestion du nettoyage `DELETE` sur `user_exercise_notes`, recalcul PR, 3 choix presets)
     - `finishAndSaveWorkoutSession(params)`
     - `deleteWorkoutSession(sessionId)`
  4. **Agenda Hebdomadaire & Chargement pour Ré-édition :** [`src/features/workout/services/calendar.service.ts`](../src/features/workout/services/calendar.service.ts) `[OK]` (134 lignes, planification Lundi->Dimanche et rechargement)
     - `getWeekSessions(mondayIso, sundayIso)`
     - `scheduleOrMoveWeekSession(params)`
     - `loadSessionForEditing(sessionId)`

---

## 4. Couche 3 — Spécification des Composants UI (`< 200 lignes`) — `[À CODER - UI]`

### 4.1 `src/features/workout/components/WeeklyCalendar.tsx` (< 150 lignes) — `[À CODER - UI]`
- Bandeau agenda daté des 7 jours de la semaine (`Lun` → `Dim`, via `getWeekDatesIso`) avec navigation semaine précédente / suivante.
- Code visuel par jour :
  - Pastille verte `#30D158` : Séance `completed` (cliquer dessus permet de voir le détail, de **Modifier la séance** via `loadSessionForEditing` ou de la **Supprimer** via `deleteWorkoutSession`).
  - Pastille bleue `#0A84FF` en pointillés : Séance `planned` (cliquer dessus propose *"Lancer la séance"*, *"Déplacer à un autre jour"* ou *"Passer en Repos"*).
  - Icône Lune `#8E8E93` : Jour de repos (`rest_day`).

### 4.2 `src/features/workout/components/ActiveSession.tsx` (< 180 lignes) — `[À CODER - UI]`
- Conteneur principal de la séance en cours connecté au store Zustand `useActiveWorkoutStore`.
- Gère le minuteur de repos, l'affichage de la liste des exercices (`ExerciseCard`), et l'en-tête d'action (bouton "Terminer" ouvrant `FinishSessionDrawer`).

### 4.3 `src/features/workout/components/ExerciseCard.tsx` (< 170 lignes) — `[À CODER - UI]`
- En-tête avec nom de l'exercice, badge du groupe musculaire et bouton de suppression de l'exercice.
- **Zone Double Note :**
  - Bandeau permanent : icône Épingle `PushPin` + input transparent pour la `pinned_note` (*"Réglage machine / note permanente — vider pour effacer"*).
  - Champ secondaire sous l'en-tête : icône `NotePencil` pour la `session_note` (*"Ressenti du jour uniquement"*).
- Liste des `SetRow` + bouton `+ Ajouter une série`.

### 4.4 `src/features/workout/components/SetRow.tsx` (< 140 lignes) — `[À CODER - UI]`
- Colonnes alignées (`tabular-nums`) :
  1. **N° Série** (ou badge `W` orange si `is_warmup = true`, cliquable pour basculer Échauffement / Série effective).
  2. **Précédent** : Affiche en texte `#8E8E93` `80kg × 10` (ou `—` si 1ère fois).
  3. **Kg** : `.ios-input` (`inputMode="decimal"`, `placeholder={ghost_weight_kg}`).
  4. **Reps** : `.ios-input` (`inputMode="numeric"`, `placeholder={ghost_reps}`).
  5. **Bouton ✓ (`44x44px`)** : Gris `#2C2C2E` quand non validé, Vert `#30D158` quand validé. Appelle `toggleCompleteSetWithGhostFallback` et déclenche un toast `sonner` avec badge trophée doré si `becamePr === true`.

### 4.5 `src/features/workout/components/FinishSessionDrawer.tsx` (< 150 lignes) — `[À CODER - UI]`
- S'ouvre au clic sur **"Terminer"** en haut à droite de la séance active.
- Affiche le résumé (Durée, Tonnage total calculé via `computeEffectiveTonnage`, Nombre de PR battus).
- Propose les **3 choix explicites** :
  1. Bouton `Enregistrer la séance uniquement` (Action principale `#0A84FF`).
  2. Bouton `Mettre à jour le preset "[Nom du Preset]"` (si `sourcePresetId` est présent).
  3. Bouton `Enregistrer + Créer un nouveau preset à partir de cette séance` (affiche un input pour nommer le nouveau preset).

### 4.6 Assemblage de la Page `src/app/(protected)/workout/page.tsx` — `[À CODER - UI]`
- Navigation entre vue Agenda (`WeeklyCalendar`), gestion des Presets (`WorkoutPresetList`) et bascule vers l'écran de séance active (`ActiveSession`).

---

## 5. Checklist de Validation (Definition of Done — Phase 4)

- [x] **Moteur mathématique des séries & records :** `workout-kpis.math.ts` implémenté et vérifié `[OK]` (1RM Epley, détection dynamique des PRs, tonnage effectif, volume musculaire).
- [x] **Store Zustand de séance active :** `active-workout.store.ts` implémenté et vérifié `[OK]` (persistance `localStorage` anti-crash Safari iOS, 1-Tap Ghost validation, gestion d'état).
- [x] **Services Supabase Musculation :** `presets.service.ts` (198 l. avec patch PostgREST `.eq('session.status', 'completed')`), `sessions.service.ts` (175 l. avec suppression `user_exercise_notes` vides) et `calendar.service.ts` (134 l.) implémentés et vérifiés `[OK]`.
- [ ] **Composants UI Musculation `[À CODER - UI]` :** Développer `WeeklyCalendar.tsx`, `ActiveSession.tsx`, `ExerciseCard.tsx`, `SetRow.tsx`, `FinishSessionDrawer.tsx`, et la page `src/app/(protected)/workout/page.tsx`.
- [ ] **Test Persistance iOS :** Lancer une séance, saisir 3 séries, rafraîchir/fermer complètement l'onglet Safari, rouvrir → toutes les séries, notes et le chrono sont intacts.
- [ ] **Test 1-Tap Ghost Values (par `session_date`) :** Lors d'une 2e séance sur le même exercice, cliquer directement sur **✓** sans toucher au clavier → les champs se remplissent automatiquement avec les valeurs de la dernière séance selon l'agenda.
- [ ] **Test PR Dynamique :** Sur un exercice où le record est `80 kg × 8`, valider Série 1 à `82.5 kg × 8` (PR activé), puis Série 2 à `82.5 kg × 6` (pas de faux PR sur Série 2), puis Série 3 à `85 kg × 8` (nouveau PR sur Série 3).
- [ ] **Test Ré-édition / Suppression de séance & Note épinglée vide :** Corriger une charge erronée sur une séance passée et vérifier la mise à jour du record ; effacer une `pinned_note` et vérifier qu'elle est bien supprimée en base.
- [ ] Aucun fichier ne dépasse 200 lignes ; `npx tsc --noEmit` retourne 0 erreur.

---

## ⚠️ Points d'Attention pour le Développement UI (Issus de l'Audit Pré-Dev)
1. **Composant `ExercisePickerDrawer`** : Prévoir un tiroir Vaul dédié permettant de rechercher et sélectionner un exercice du catalogue pendant une séance en cours (bouton "Ajouter un exercice").
2. **Dialogue de confirmation d'abandon** : Sécuriser impérativement l'action d'abandon de séance (`clearActiveSession()`) avec une modale ou une alerte de confirmation iOS native pour éviter toute perte accidentelle des séries saisies.
