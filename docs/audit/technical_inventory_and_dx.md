# Inventaire Technique & Optimisations DX — FitnessApp

Document d'audit technique détaillé préparatoire aux Phases 1 à 6 de développement UI.
Référence principale : `ARCHITECTURE_MAP.md`, `docker-compose.yml`, `config/vitest.config.ts`.

---

## 1. Inventaire Technique Exhaustif

### 1.1 Conteneurisation & Isolation Runtime
- **Docker Compose (`docker-compose.yml:1-32`)** : Service `app` conteneurisé sur image Node 20 Alpine (`docker/Dockerfile.dev:1`), port mappé `3000:3000`.
- **Volumes isolés (`docker-compose.yml:14-15, 26-29`)** : Deux volumes nommés (`fitness_node_modules`, `fitness_next_cache`) empêchent toute pollution du stockage hôte macOS.
- **Règle Zéro Dépendance Hôte** : Respectée à 100%. Tout le cycle s'exécute dans Docker (`docker compose exec app ...`).

### 1.2 Couche 1 — Moteur Mathématique Pur (`src/lib/math/` & `src/lib/`)
Modules 100% pures fonctions sans dépendance externe, isolés et idempotents :
- `src/lib/math/weight-ema.math.ts` (74 l.) : Lissage EMA 7 jours ($\alpha = 0.25$), recalcul en cascade rétroactif si pesée modifiée.
- `src/lib/math/workout-kpis.math.ts` (137 l.) : 1RM Epley ($W \times (1 + r/30)$), PR dynamique par rapport au record historique, tonnage et volume effectif sur 10 groupes.
- `src/lib/math/nutrition.math.ts` (134 l.) : Calcul macros selon 3 modes de dosage (`100g`, `unit`, `both`), diviseur Meal Prep avec stockage d'une portion de référence.
- `src/lib/math/tdee.math.ts` (120 l.) : Dépense TDEE sur 14 jours révolus ($J-14$ à $J-1$), filtre anti-bruit (< 50% de la cible calorique), seuils de calibration (minimum 10 jours valides, pesées espacées d'au moins 7 jours).
- `src/lib/date.utils.ts` (34 l.) : Gestion stricte des dates locales au fuseau `Europe/Paris` (anti-bug de décalage UTC sur iPhone).
- **Couverture de tests unitaires** : 8 suites de tests, 84 tests passés au vert en 956 ms (temps de test pur : 82 ms) sous `tests/unit/`.

### 1.3 Couche 2 — Services Supabase & Store d'État (`src/features/*/services/`)
12 modules métiers modulaires, respectant tous la limite stricte de 200 lignes :
- `daily-log/services/log.service.ts` (179 l.) : Snapshot journalier, pesées, exclusion TDEE, historique 90j.
- `exercises/services/exercises.service.ts` (64 l.) : Catalogue partagé, toggle favoris, filtrage 10 groupes musculaires.
- `nutrition/services/nutrition.service.ts` (137 l.) : CRUD aliments avec 3 modes de dosage, création de recettes divisées.
- `nutrition/services/entries.service.ts` (166 l.) : Journal journalier, ajout express de macros libres, mise à jour des portions.
- `nutrition/services/couple-sync.service.ts` (45 l.) : Appel RPC `copy_meal_entries` pour cloner les repas du partenaire.
- `nutrition/services/recipes.service.ts` (146 l.) : Détail des recettes et ajout d'une portion au journal (`meal_entry_items`).
- `workout/services/presets.service.ts` (102 l.) : Listing presets avec exercices et injection automatique des ghost values.
- `workout/services/ghost-records.service.ts` (106 l.) : Recherche dernière séance validée et calcul records historiques.
- `workout/services/sessions.service.ts` (176 l.) : Enregistrement complet d'une séance (création/maj preset, suppression orphelins).
- `workout/services/calendar.service.ts` (135 l.) : Calendrier hebdomadaire Lundi-Dimanche, statuts `completed` / `planned`.
- `analytics/services/kpis.service.ts` (170 l.) : Données graphiques 1RM Recharts, volume par muscle, séries hebdo.
- `analytics/services/export.service.ts` (177 l.) : Export JSON complet et 3 fichiers CSV sanitizés (anti-CWE-1236).
- `workout/store/active-workout.store.ts` (171 l.) : Store Zustand persisté en `localStorage` (clé `fitcouple-active-workout-v1`), résistant au rafraîchissement Safari iOS.

### 1.4 Base de Données & Sécurité (`supabase/migrations/001_initial_schema.sql`, 482 l.)
- **Schéma relationnel** : 14 tables couvrant l'ensemble du domaine fonctionnel.
- **Enums & Contraintes** : 5 enums (`workout_session_status:173`, `food_serving_type:229`, `meal_category:275`, `meal_entry_type:276`, check `logged_unit:269`). Colonne générée `workout_sets.epley_1rm` (l.213-218).
- **Triggers automatiques** : 5 triggers (création profil `handle_new_user:29`, snapshot journalier `fill_daily_log_snapshot:78`, sync cibles `sync_today_daily_log_targets:103`, recalcul totaux de repas clonés `sync_parent_meal_entry_totals:326`, horodatage `trg_*_updated_at:24,73`).
- **RPCs sécurisées** : `get_partner_info:391`, `copy_meal_entries:405` (sécurisée contre BOLA/IDOR selon OWASP API1:2023), `keepalive_ping:473`.
- **Politiques RLS** : 14 tables sécurisées (9 privées `auth.uid() = user_id`, 1 sous-requête `workout_preset_exercises:379`, 4 partagées couple : `exercises`, `foods`, `recipes`, `recipe_ingredients`).

---

## 2. Analyse de la DX & Configurations Actuelles

### 2.1 Scripts `package.json:5-12`
- Commandes existantes : `"dev"`, `"build"`, `"start"`, `"lint"`, `"test"`, `"test:watch"`.
- Lacune : Pas de script `"typecheck": "tsc --noEmit"`. Oblige à taper `npx tsc --noEmit`.
- Lacune : Pas de pipeline unique de validation pré-commit/pré-PR (ex: `"check": "npm run lint && npx tsc --noEmit && npm test"`).

### 2.2 Configuration Vitest (`config/vitest.config.ts:1-20`)
- `test.environment: 'node'` (l.10) : Exécution ultra-rapide (82 ms) pour les fonctions pures mathématiques.
- Limite : Empêche l'exécution de tout test de composant React 19 nécessitant des primitives DOM (`window`, `document`, événements de saisie tactile).

### 2.3 Configuration Tailwind (`config/tailwind.config.ts:11-13`)
- `theme.extend` est vide (`{}`).
- Les codes hexadécimaux de la palette OLED iOS (`#000000`, `#1C1C1E`, `#2C2C2E`, `#38383A`, `#8E8E93`, `#0A84FF`, `#30D158`, `#FF375F`, `#32ADE6`, `#FF9F0A`, `#BF5AF2`) sont déclarés en dur de façon dispersée dans `globals.css` et les specs.

### 2.4 Fichiers Dockerfile
- `docker/Dockerfile` (27 l.) et `docker/Dockerfile.dev` (27 l.) sont strictement identiques, ce qui crée une redondance de maintenance.

---

## 3. Recommandations d'Optimisation DX & Performance

### 3.1 Améliorations de Scripts & Outillage
1. **Ajout de scripts dans `package.json`** :
   - `"typecheck": "tsc --noEmit"`
   - `"check": "npm run lint && tsc --noEmit && npm test"`
2. **Support Vitest hybride (Node / DOM)** :
   - Conserver `environment: 'node'` par défaut pour les maths pures.
   - Installer `happy-dom` et utiliser le commentaire d'en-tête `// @vitest-environment happy-dom` pour les futurs tests de composants UI.

### 3.2 Optimisation des Requêtes et de la Performance Réseau
1. **Performance `finishAndSaveWorkoutSession` (`sessions.service.ts:98-132`)** :
   - Actuellement, une boucle séquentielle `for` insère chaque exercice puis chaque série unitairement (16 allers-retours réseau pour une séance de 8 exercices).
   - Recommandation : Regrouper les insertions via des `Promise.all` ou une transaction RPC atomique côté Supabase.
2. **Optimisation des Ghost Values (`ghost-records.service.ts:65-75`)** :
   - Actuellement, toutes les séances historiques terminées de l'exercice sont chargées et triées en mémoire JavaScript pour extraire la dernière séance.
   - Recommandation : Scinder la requête pour récupérer la dernière séance via `.order('session(session_date)', { ascending: false }).limit(1)`, réduisant le payload réseau à mesure que l'historique grandit.
3. **Consolidation des Tokens Tailwind (`config/tailwind.config.ts`)** :
   - Déclarer les couleurs sémantiques iOS (`ios-bg`, `ios-card`, `ios-border`, `ios-blue`, `ios-green`, `ios-red`, `ios-orange`, `ios-cyan`, `ios-purple`) dans `theme.extend.colors`.

---

## 4. Commandes de Vérification Indépendante

Toutes les commandes doivent être lancées exclusivement dans Docker :
```bash
# Vérification du statut du conteneur
docker compose -f FitnessApp/docker-compose.yml ps

# Suite de tests unitaires Couche 1 (84 tests GREEN)
docker compose -f FitnessApp/docker-compose.yml exec app npm test

# Validation stricte du typage TypeScript (0 erreur)
docker compose -f FitnessApp/docker-compose.yml exec app npx tsc --noEmit

# Validation du linter Next.js (0 warning)
docker compose -f FitnessApp/docker-compose.yml exec app npm run lint
```

