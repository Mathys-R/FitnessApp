# Phase 2 : Profil Utilisateur, Moteur de Snapshot Quotidien & Suivi du Poids (EMA)

## 1. Objectif & Périmètre de la Phase
- **Objectif :** Mettre en place l'entité pivot `daily_logs` (qui fige les objectifs caloriques du jour et enregistre la pesée quotidienne), le profil utilisateur (`profiles`), le moteur mathématique de lissage exponentiel du poids sur 7 jours (`weight-ema.math.ts`) et le graphique d'évolution (`WeightEmaChart.tsx`).
- **Pourquoi en 2e :** Le journal nutritionnel (Phase 5) et le calculateur de maintenance TDEE (Phase 6) dépendent de l'existence d'une ligne `daily_logs` pour la date courante.
- **Prérequis :** Phase 1 terminée (`001_initial_schema.sql` exécuté, `database.types.ts` généré, authentification opérationnelle).

---

## 2. Guidelines Strictes & Règles Métier de la Phase 2

1. **Plafond strict de 200 lignes par fichier :** Chaque composant UI (`WeightQuickInput`, `ProfileTargetsDrawer`, `WeightEmaChart`) est isolé dans son propre fichier `< 200 lignes`.
2. **Zéro appel Supabase dans les `.tsx` :** Toute lecture/écriture passe exclusivement par [`src/features/daily-log/services/log.service.ts`](../src/features/daily-log/services/log.service.ts).
3. **Continuité mathématique de l'EMA 7 jours ($\alpha = 0{,}25$) :**
   - **Jour initial ($J_0$) :** Lors de la toute première pesée historique de l'utilisateur, $EMA_0 = Poids_0$.
   - **Jours sans pesée :** Si l'utilisateur oublie de se peser pendant un ou plusieurs jours, $EMA_{J-1}$ correspond à la **dernière valeur `weight_ema_kg` connue** avant la date $J$. Aucune ligne fictive n'est insérée en base.
   - **Recalcul en cascade (Saisie ou modification rétroactive) :** Si l'utilisateur modifie ou ajoute une pesée à une date passée $D$, le service recalcule automatiquement en mémoire (via [`weight-ema.math.ts`](../src/lib/math/weight-ema.math.ts)) le `weight_ema_kg` de toutes les pesées où `log_date >= D` et met à jour les lignes impactées en base.
4. **Règle d'immuabilité du Snapshot Journalier :**
   - Modifier ses objectifs dans le profil (`current_target_kcal`, `current_target_p`, `current_target_g`, `current_target_l`) met à jour ses cibles futures **et** synchronise automatiquement le `daily_log` d'aujourd'hui (`(NOW() AT TIME ZONE 'Europe/Paris')::date` via le trigger SQL `trg_sync_today_daily_log_targets`), mais ne modifie **jamais** les journées passées.
5. **Ergonomie iOS :**
   - Utiliser [`getLocalTodayIso()`](../src/lib/date.utils.ts) partout pour déterminer la date du jour.
   - Le champ de saisie du poids utilise `type="text" inputMode="decimal"` et accepte aussi bien la virgule `,` que le point `.` via `parseDecimalInput`.
   - Les compteurs de Poids du jour, d'EMA 7j et de variation s'animent avec `<NumberFlow />` et la classe `tabular-nums`.

---

## 3. Fichiers de Code de la Phase 2 (Déjà Extraits dans le Projet)

- **Couche 1 — Moteur Mathématique Pur :** [`src/lib/math/weight-ema.math.ts`](../src/lib/math/weight-ema.math.ts)
  - `roundToTwoDecimals(value)`
  - `computeSingleDayEma(currentWeightKg, previousEmaKg)`
  - `recomputeWeightEmaSeries(points, initialPreviousEmaKg)`
  - `parseDecimalInput(raw)`
- **Couche 2 — Service Supabase :** [`src/features/daily-log/services/log.service.ts`](../src/features/daily-log/services/log.service.ts)
  - `getCurrentProfile()`
  - `updateProfileTargets(targets)`
  - `getOrCreateDailyLog(logDate)`
  - `upsertWeightAndRecalculateEma(logDate, weightKg)`
  - `toggleExcludeFromTdee(dailyLogId, excludeFromTdee)`
  - `getWeightHistory(limitDays)`

---

## 4. Couche 3 — Spécification des Composants UI (`< 200 lignes`)

### 4.1 `src/features/daily-log/components/WeightQuickInput.tsx` (< 140 lignes)
- **Rôle :** Carte iOS (`.ios-card`) affichant le poids brut du jour, la tendance lissée EMA 7 jours et un bouton d'ouverture du Bottom Sheet `vaul` de saisie rapide.
- **Props :** `dailyLog: DailyLogRow`, `previousEmaKg: number | null`, `onWeightUpdated: (updated: DailyLogRow) => void`.
- **Détails UX iOS :**
  - Affiche `<NumberFlow value={dailyLog.weight_kg ?? 0} format={{ minimumFractionDigits: 1, maximumFractionDigits: 2 }} /> kg` en grand (`text-2xl font-semibold tabular-nums`).
  - Affiche en dessous le badge `EMA 7j : <NumberFlow value={dailyLog.weight_ema_kg ?? 0} /> kg` en Bleu iOS `#0A84FF`.
  - Dans le Drawer `vaul` : un champ `.ios-input` avec `inputMode="decimal"`, boutons rapides `-0.1 kg` / `+0.1 kg` (`min-h-[44px]`), sélecteur de date (`getLocalTodayIso()` par défaut, modifiable pour une saisie rétroactive), et notification `toast.success('Pesée enregistrée')` via `sonner`.

### 4.2 `src/features/daily-log/components/ProfileTargetsDrawer.tsx` (< 160 lignes)
- **Rôle :** Bottom Sheet `vaul` permettant de modifier ses cibles actuelles (`current_target_kcal`, `current_target_p`, `current_target_g`, `current_target_l`).
- **Détails UX iOS :**
  - 4 champs numériques (`inputMode="numeric"`) avec code couleur Apple Fitness :
    - Calories : `#FF375F`
    - Protéines (g) : `#32ADE6` (`4 kcal/g`)
    - Glucides (g) : `#FF9F0A` (`4 kcal/g`)
    - Lipides (g) : `#BF5AF2` (`9 kcal/g`)
  - Bouton **"Calculer Kcal depuis les macros"** ($P \times 4 + G \times 4 + L \times 9$) pour aider l'utilisateur à garder des cibles cohérentes.
  - Mention explicite sous le bouton de sauvegarde : *"S'applique à aujourd'hui et aux prochains jours. L'historique passé reste intact."*

### 4.3 `src/features/analytics/components/WeightEmaChart.tsx` (< 180 lignes)
- **Rôle :** Graphique Recharts (`ResponsiveContainer`, `ComposedChart`) superposant :
  1. Les pesées brutes quotidiennes : points discrets (`Scatter` ou `Line` sans trait avec `dot={{ r: 3, fill: '#8E8E93' }}`).
  2. La courbe de tendance EMA 7 jours : ligne continue fluide (`type="monotone"`, `stroke="#0A84FF"`, `strokeWidth={2.5}`, `dot={false}`).
- **Filtres rapides en haut de carte :** Segmented Control iOS (`7j`, `30j`, `90j`, `Tout`).
- **Axe Y dynamique :** `domain={['dataMin - 0.5', 'dataMax + 0.5']}` pour que les variations de 200g soient visuellement lisibles.

### 4.4 Assemblage initial dans `src/app/(protected)/page.tsx` & `analytics/page.tsx`
- Dans `src/app/(protected)/page.tsx` (Onglet 1 — *Aujourd'hui*) : Intégration de l'en-tête de date, du résumé des cibles du Snapshot du jour et du composant `WeightQuickInput`.
- Dans `src/app/(protected)/analytics/page.tsx` (Onglet 5 — *Stats & Profil*) : Intégration de `WeightEmaChart` et du bouton ouvrant `ProfileTargetsDrawer`.

---

## 5. Checklist de Validation (Definition of Done — Phase 2)

- [ ] **Test unitaire `weight-ema.math.ts` :** Vérifier qu'une première pesée à `80.0 kg` donne `EMA = 80.0`, et qu'une deuxième pesée le lendemain à `79.0 kg` donne $79 \times 0{,}25 + 80 \times 0{,}75 = 79{,}75\text{ kg}$.
- [ ] **Test de saisie rétroactive :** Saisir un poids à $J-3$, puis modifier le poids de $J-3$ et vérifier dans Supabase que les colonnes `weight_ema_kg` de $J-2$, $J-1$ et $J$ ont toutes été recalculées automatiquement.
- [ ] **Test du Snapshot Journalier :** Modifier `current_target_kcal` dans `ProfileTargetsDrawer` → vérifier que `daily_logs` d'aujourd'hui prend la nouvelle cible, mais que le `daily_log` d'hier conserve son ancienne cible.
- [ ] **Contrôle qualité code :** Aucun fichier ne dépasse 200 lignes ; `npx tsc --noEmit` retourne 0 erreur.
