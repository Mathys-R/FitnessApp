# Cartographie Vivante du Projet (`ARCHITECTURE_MAP.md`)

> **Source Unique de Vérité Technique pour les Agents IA**  
> Ce document consolide l'état réel du dépôt `FitnessApp` (`fitness-pwa`) et constitue **l'unique source de référence architecturale** du projet (remplaçant définitivement l'ancien dossier `Markdowns/` pour éliminer tout risque de collision de contexte).  
> **Tout agent intervenant sur le projet DOIT consulter cette carte à l'Étape 0 avant toute action.**

---

## Synthèse Exécutive : Rapport Tripartite (Checkup Zéro, Phase 1 & Phase 2 Validées)

À l'issue de l'audit tripartite coordonné par la Squad IA Autonome (**Tech Lead**, **Code Reviewer**, **Security Auditor**) et de la livraison complète des **Phases 1 et 2** (UI Shell, Authentification, Navigation iOS, Journal Quotidien "Aujourd'hui", Pesée & EMA 7j, Profil & Objectifs) :

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                   BILAN GLOBAL SQUAD IA (PHASES 1 & 2 VALIDÉES)                        │
├────────────────────┬───────────────────────────────────────────────────────────────────┤
│ Tech Lead          │ Architecture 3 couches strictement étanche et validée.            │
│                    │ ZÉRO appel direct à Supabase dans les composants UI.              │
│                    │ Environnement Docker Desktop opérationnel avec volumes isolés.    │
│                    │ Stack Vitest + TSConfig Paths intégrée sans dépendance hôte.      │
│                    │ PostgREST typé via Relationships (0 erreur `tsc --noEmit`).       │
│                    │ UI Shell PWA iOS : Header Liquid Glass, BottomNav 5 onglets,      │
│                    │ gestion stricte des Safe Areas et Safe Area Insets iOS.           │
│                    │ Phase 2 intégrée : Page d'accueil "Aujourd'hui" connectée,        │
│                    │ composant WeightQuickInput (Vaul Drawer + steppers ±0.1/±0.5kg),   │
│                    │ composant ProfileTargetsDrawer (cibles kcal/macros, formule 4/4/9)│
│                    │ et compteurs dynamiques NumberFlow intégrés.                      │
├────────────────────┼───────────────────────────────────────────────────────────────────┤
│ Code Reviewer      │ Règle des 200 lignes max respectée à 100% sur le code source      │
│                    │ (fichiers src/ de 13 à 189 l., tests unitaires de 28 à 192 l.).    │
│                    │ Typage TypeScript strict à 100% : ZÉRO mot-clé `any`.             │
│                    │ 19 suites de tests unitaires modularisées créées (tests/unit/).   │
│                    │ 120 tests unitaires & chaos exécutés avec succès (100% GREEN).    │
│                    │ Robustesse validée par Monkey Testing chaos (doubles clics        │
│                    │ frénétiques, valeurs aberrantes, virgules françaises, bornes).    │
│                    │ ESLint Next.js validé (0 avertissement, 0 erreur).                │
├────────────────────┼───────────────────────────────────────────────────────────────────┤
│ Security Auditor   │ Formule CSV Injection (CWE-1236) neutralisée dans export.service. │
│                    │ Typage strict et propagation des cookies de session (middleware). │
│                    │ 001_initial_schema.sql durci : search_path figé sur 4 SECURITY    │
│                    │ DEFINER, contrôle BOLA/IDOR sur copy_meal_entries et moindre      │
│                    │ privilège appliqué sur keepalive_ping().                          │
│                    │ RLS 100% hermétique sur les 14 tables PostgreSQL (auth.uid()).    │
│                    │ Données sensibles de profil et cibles cloisonnées par compte.     │
├────────────────────┴───────────────────────────────────────────────────────────────────┤
│ FEUILLE DE ROUTE DU PROJET :                                                          │
│ 1. [DB] Exécution de 001_initial_schema.sql sur l'instance Supabase de développement.  │
│ 2. [UI Phase 1] ✅ VALIDÉ : Login couple & Shell de navigation iOS (BottomNav/Header) │
│ 3. [UI Phase 2] ✅ VALIDÉ : Journal Quotidien (Aujourd'hui) : Pesée, EMA & Profil/Cibles│
│ 4. [UI Phase 3] Module Entraînement : Presets, Séance Active (Store), Ghost Values.    │
│ 5. [UI Phase 4] Module Nutrition : 3 modes de saisie, Recettes, Synchro couple.       │
│ 6. [UI Phase 5] Catalogues : Exercices (seed JSON) et Aliments / Recettes.             │
│ 7. [UI Phase 6] Analytics & Profil : TDEE 14j, Radars musculaires, Export CSV/JSON.   │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 1. Stack Technique Complète & Commandes Clés

### 1.1 Matrice des Technologies Verrouillées
| Couche / Domaine | Technologie | Version | Rôle & Contraintes Techniques |
| :--- | :--- | :--- | :--- |
| **Runtime & Bundler** | Node.js | `>= 20.18.0` (LTS) | Prérequis Next.js 15 App Router |
| **Framework Web** | Next.js | `15.1.6` | App Router, SSR asynchrone (`await cookies()`), Turbopack/Webpack |
| **Bibliothèque UI** | React / React DOM | `^19.0.0` | Support Server Components & Hooks React 19 |
| **Typage** | TypeScript | `^5.7.3` | Typage strict (`strict: true`), mot-clé `any` banni |
| **Styles & Tokens** | Tailwind CSS | `^3.4.17` | Thème sombre OLED Apple HIG (`class`), `.ios-card`, `.ios-input` |
| **Animations & Gestes** | Motion | `^12.4.2` | Ressorts iOS (`import { motion } from "motion/react"`) |
| **Bottom Sheets iOS** | Vaul | `^1.1.2` | Tiroirs coulissants du bas avec physique de ressort (`Drawer`) |
| **Chiffres Animés** | `@number-flow/react`| `^0.5.4` | Compteurs dynamiques calories, macros, tonnages, poids |
| **Toasts Compacts** | Sonner | `^2.0.1` | Notifications dark mode sous la Dynamic Island |
| **Icônes SF Symbols** | Phosphor Icons / Lucide| `^2.1.7` / `^0.475` | Icônes Apple-like (`weight="regular"` / `weight="fill"`) |
| **Graphiques** | Recharts | `^2.15.1` | Courbes EMA 7j, 1RM Epley, radars musculaires |
| **State / Offline** | Zustand | `^5.0.3` | Store anti-crash avec middleware `persist` (`localStorage`) |
| **Base de Données & Auth** | Supabase JS / SSR | `^2.48.1` / `^0.5.2` | Client PostgREST typé via `database.types.ts`, Auth cookies SSR |
| **Harnais de Tests** | Vitest + Plugins | `3.2.7` (`^3.0.5`) | `@vitejs/plugin-react` (`^4.3.4`), `vite-tsconfig-paths` (`^5.1.4`) |
| **Gestion des Dates** | `date-fns` + local utils | `^4.1.0` | Manipulation de dates sans biais UTC iPhone (`Europe/Paris`) |
| **Conteneurisation & Isolation** | Docker & Compose | `node:20-alpine` | Exécution 100% conteneurisée, volumes `node_modules` & `.next` isolés |

### 1.2 Commandes Clés du Projet (100% Conteneurisées & Opérationnelles)
> [!IMPORTANT]
> **Docker Desktop doit impérativement être lancé sur macOS.**  
> Aucune commande `npm`, `npx` ou `vitest` ne doit être exécutée directement sur la machine hôte afin de ne pas télécharger de paquets en boucle sur le stockage personnel.

```bash
# 1. Validation globale en une seule commande (Lint + Typecheck + Tests)
docker compose exec app npm run check

# 2. Démarrer le serveur Next.js dans Docker (serveur accessible sur http://localhost:3000)
docker compose up -d

# 3. Démarrer le conteneur Mock Supabase (port 8000 pour tests/démo offline)
docker compose up -d mock-supabase

# 4. Visualiser les logs du conteneur en direct
docker compose logs -f app

# 5. Vérification du typage statique TypeScript (Zéro erreur tolérée)
docker compose exec app npm run typecheck

# 6. Analyse de linting Next.js / ESLint
docker compose exec app npm run lint

# 7. Exécution des Tests Unitaires & Composants (120 tests au vert, 19 suites modularisées)
docker compose exec app npm test

# 8. Mode TDD interactif / surveillance des tests
docker compose exec app npm run test:watch

# 9. Ajout / Installation de dépendances (enregistrées dans le volume Docker dédié)
docker compose exec app npm install <nom-du-paquet>
docker compose exec app npm install -D <nom-du-paquet-dev>

# 10. Arrêt des conteneurs
docker compose down
```

---

## 2. Arborescence Commentée du Dépôt & État d'Avancement

```text
FitnessApp/
├── config/                                      # [IMPLÉMENTÉ] Fichiers de configuration tooling & styles déportés
│   ├── tailwind.config.ts                       # [IMPLÉMENTÉ - 35 l.] Thème OLED Apple, tokens ios-* centralisés
│   └── vitest.config.ts                         # [IMPLÉMENTÉ - 19 l.] Config Vitest avec @vitejs/plugin-react, alias & paths
├── docker/                                      # [IMPLÉMENTÉ] Configuration conteneurs Docker
│   ├── Dockerfile                               # [IMPLÉMENTÉ - 26 l.] Conteneur Node.js 20 Alpine avec libc6-compat
│   ├── Dockerfile.dev                           # [IMPLÉMENTÉ - 26 l.] Image de développement Alpine pour Docker Compose
│   └── mock-server/                             # [IMPLÉMENTÉ] Mock Supabase léger natif Node.js Alpine (port 8000)
│       └── server.mjs                           # [IMPLÉMENTÉ - 134 l.] Mock Auth JWT & endpoints PostgREST
├── docker-compose.yml                           # [IMPLÉMENTÉ - 40 l.] Services `app` (port 3000) et `mock-supabase` (port 8000)
├── .dockerignore                                # [IMPLÉMENTÉ - 8 l.] Exclusion node_modules, .next, .git, .env*.local
├── .eslintrc.json                               # [IMPLÉMENTÉ - 3 l.] Configuration Next.js Core Web Vitals ESLint
├── package.json                                 # [IMPLÉMENTÉ - 51 l.] Scripts (check, typecheck, lint, test) & deps
├── tsconfig.json                                # [IMPLÉMENTÉ - 28 l.] TypeScript strict, alias @/* -> ./src/*
├── postcss.config.mjs                           # [IMPLÉMENTÉ - 10 l.] TailwindCSS (pointant vers ./config/tailwind.config.ts) & Autoprefixer
├── next.config.mjs                              # [IMPLÉMENTÉ - 7 l.] reactStrictMode: true
├── .env.local                                   # [IMPLÉMENTÉ - 5 l.] Variables Supabase (URL, Anon Key, Project ID)
├── AGENTS.md                                    # [IMPLÉMENTÉ - 186 l.] Cerveau Central & Lois d'Orchestration Squad IA
├── ARCHITECTURE_MAP.md                          # [IMPLÉMENTÉ] Cartographie vivante & source de vérité
├── PRE_DEV_AUDIT_REPORT.md                      # [IMPLÉMENTÉ - 109 l.] Rapport d'audit pré-développement maître
├── .agents/                                     # [BRIDGE] Pont vers les skills, agents & plugins de DevPerso
├── docs/                                        # [DOCS] Spécifications métier et cahiers des charges par phase
│   ├── SPECIFICATION.md                         # Spécification générale de l'application
│   ├── audit/                                   # [IMPLÉMENTÉ] Rapports spécialisés issus du Teamwork audit
│   │   ├── technical_inventory_and_dx.md        # [IMPLÉMENTÉ - 107 l.] Inventaire technique & DX
│   │   ├── mock_strategy_and_contracts.md       # [IMPLÉMENTÉ - 96 l.] Stratégie de mocking Couche 2 & fixtures
│   │   └── specs_evaluation_phases_1_6.md       # [IMPLÉMENTÉ - 94 l.] Points d'attention UI Phases 1 à 6
│   └── phases/                                  # Découpage fonctionnel des phases 1 à 6 (avec points d'attention)
├── tests/                                       # [TESTS UNITAIRES, COMPOSANTS & FIXTURES]
│   ├── fixtures/                                # [IMPLÉMENTÉ - 5 modules de fixtures]
│   │   ├── profiles.fixture.ts                  # [IMPLÉMENTÉ - 34 l.] Profils utilisateur & partenaire
│   │   ├── daily-log.fixture.ts                 # [IMPLÉMENTÉ - 232 l.] Historique 14j de pesées & EMA réaliste
│   │   ├── workout.fixture.ts                   # [IMPLÉMENTÉ - 68 l.] Exercices, presets, séances & ghost values
│   │   ├── nutrition.fixture.ts                 # [IMPLÉMENTÉ - 78 l.] Aliments des 3 modes & repas
│   │   └── index.ts                             # [IMPLÉMENTÉ - 6 l.] Point d'entrée ré-exportant les fixtures
│   ├── mocks/                                   # [IMPLÉMENTÉ] Bouchons des services métier Couche 2
│   │   └── services/                            # Mocks TypeScript pour Vitest
│   │       ├── auth.service.mock.ts             # [IMPLÉMENTÉ - 23 l.] Mock de l'authentification
│   │       └── index.ts                         # [IMPLÉMENTÉ - 3 l.] Index des mocks de services
│   └── unit/                                    # [IMPLÉMENTÉ - 19 suites, 120 tests au vert, 100% < 200 l.]
│       ├── weight-ema.test.ts                   # [IMPLÉMENTÉ - 169 l.] Tests EMA 7j, lissage du poids & parsing
│       ├── workout-1rm-tonnage.test.ts          # [IMPLÉMENTÉ - 132 l.] Formule d'Epley, tonnage par séance
│       ├── workout-pr-flags.test.ts             # [IMPLÉMENTÉ - 134 l.] Détection dynamique des PRs
│       ├── workout-muscle-volume.test.ts        # [IMPLÉMENTÉ - 104 l.] Répartition du volume d'entraînement
│       ├── nutrition-macros.test.ts             # [IMPLÉMENTÉ - 192 l.] Règle de trois, conversions macros & 4/4/9
│       ├── nutrition-portions.test.ts           # [IMPLÉMENTÉ - 80 l.] Calculs de portions décimales
│       ├── tdee.test.ts                         # [IMPLÉMENTÉ - 144 l.] Dépense énergétique réelle sur 14j
│       ├── date-utils.test.ts                   # [IMPLÉMENTÉ - 133 l.] Dates ISO locales (Europe/Paris)
│       ├── auth-service.test.ts                 # [IMPLÉMENTÉ - 61 l.] Tests unitaires du service d'authentification
│       ├── supabase-config.test.ts              # [IMPLÉMENTÉ - 39 l.] Tests bascule environnement Dev Mock / Prod Cloud
│       ├── bottom-nav.test.tsx                  # [IMPLÉMENTÉ - 28 l.] Test barre de navigation iOS (5 onglets, safe area)
│       ├── page-header.test.tsx                 # [IMPLÉMENTÉ - 33 l.] Test en-tête mobile Liquid Glass (3 tests)
│       ├── login-form.test.tsx                  # [IMPLÉMENTÉ - 98 l.] Test formulaire login Apple HIG (4 tests)
│       ├── protected-layout.test.tsx            # [IMPLÉMENTÉ - 36 l.] Test shell protégé & BottomNav (2 tests)
│       ├── weight-quick-input.test.tsx          # [IMPLÉMENTÉ - 126 l.] Tests composant saisie pesée rapide, Drawer Vaul & EMA
│       ├── profile-targets-drawer.test.tsx      # [IMPLÉMENTÉ - 142 l.] Tests tiroir objectifs kcal & macros avec Vaul
│       ├── today-page.test.tsx                  # [IMPLÉMENTÉ - 77 l.] Tests intégration page Aujourd'hui (Dashboard connecté)
│       ├── today-chaos-weight.test.tsx          # [IMPLÉMENTÉ - 180 l.] Monkey testing chaos pesée (virgules, doubles clics, extrêmes)
│       └── today-chaos-profile.test.tsx         # [IMPLÉMENTÉ - 191 l.] Monkey testing chaos cibles profil (bornes 0-10000, 4/4/9)
├── public/
│   ├── manifest.json                            # [IMPLÉMENTÉ - 23 l.] PWA iOS Standalone (theme: #000000)
│   └── data/
│       └── exercises_seed.json                  # [IMPLÉMENTÉ - 237 l.] 40 exercices de référence
├── supabase/
│   └── migrations/
│       └── 001_initial_schema.sql               # [IMPLÉMENTÉ - 485 l.] 14 tables, 5 enums, 3 RPCs, triggers & RLS
└── src/
    ├── middleware.ts                            # [IMPLÉMENTÉ - 60 l.] Protection routes, typage strict & propagation cookies
    ├── types/
    │   ├── database.types.ts                    # [IMPLÉMENTÉ - 703 l.] Types PostgreSQL + Relations FK jointes
    │   └── domain.types.ts                      # [IMPLÉMENTÉ - 25 l.] 10 groupes musculaires & 5 catégories repas
    │
    ├── lib/                                     # [COUCHE 1 - CŒUR TECHNIQUE & MATHÉMATIQUES PURES]
    │   ├── date.utils.ts                        # [IMPLÉMENTÉ - 34 l.] Dates locales iPhone Europe/Paris
    │   ├── supabase/
    │   │   ├── config.ts                        # [IMPLÉMENTÉ - 46 l.] Bascule d'environnement (booléen Dev Mock / Prod Cloud)
    │   │   ├── client.ts                        # [IMPLÉMENTÉ - 13 l.] Client navigateur Supabase typé
    │   │   └── server.ts                        # [IMPLÉMENTÉ - 31 l.] Client serveur Next.js 15 cookies asynchrones
    │   └── math/
    │       ├── weight-ema.math.ts               # [IMPLÉMENTÉ - 80 l.] Moyenne Mobile Exponentielle du poids (7j) & parsing décimal
    │       ├── workout-kpis.math.ts             # [IMPLÉMENTÉ - 137 l.] 1RM Epley, Tonnage, PRs dynamiques
    │       ├── nutrition.math.ts                # [IMPLÉMENTÉ - 149 l.] Règle de 3 macros, Meal Prep, calculateKcalFromMacros
    │       └── tdee.math.ts                     # [IMPLÉMENTÉ - 120 l.] Dépense énergétique réelle sur 14j
    │
    ├── components/                              # [COUCHE 3 - DESIGN SYSTEM & LAYOUT GLOBAL iOS]
    │   ├── ui/                                  # [À CODER - UI] Composants shadcn/ui customisés iOS + Vaul
    │   └── layout/
    │       ├── BottomNav.tsx                    # [IMPLÉMENTÉ - 47 l.] Barre de navigation iOS floutée (5 onglets)
    │       └── PageHeader.tsx                   # [IMPLÉMENTÉ - 29 l.] En-tête mobile avec effet Liquid Glass, Safe Area haute dynamique
    │
    ├── features/                                # [COUCHE 2 & 3 - MODULES MÉTIER PAR DOMAINE]
    │   ├── auth/
    │   │   └── services/
    │   │       └── auth.service.ts              # [IMPLÉMENTÉ - 62 l.] Login, logout, getSessionUser (Règle d'Or #3)
    │   ├── daily-log/
    │   │   ├── services/
    │   │   │   ├── log.service.ts               # [IMPLÉMENTÉ - 168 l.] Snapshot quotidien, recalcul EMA, getPreviousWeightEma
    │   │   │   └── profile.service.ts           # [IMPLÉMENTÉ - 63 l.] Profil utilisateur & mise à jour des cibles macros
    │   │   └── components/                      # [IMPLÉMENTÉ - UI PHASE 2]
    │   │       ├── WeightQuickInput.tsx         # [IMPLÉMENTÉ - 112 l.] Bouton pesée rapide, Drawer Vaul, steppers ±0.1kg/±0.5kg & feedback Sonner
    │   │       └── ProfileTargetsDrawer.tsx     # [IMPLÉMENTÉ - 142 l.] Drawer Vaul cibles kcal/macros avec auto-calcul Px4+Gx4+Lx9
    │   ├── catalogs/
    │   │   ├── services/
    │   │   │   ├── exercises.service.ts         # [IMPLÉMENTÉ - 63 l.] CRUD Exercices + auto-seed JSON
    │   │   │   └── nutrition.service.ts         # [IMPLÉMENTÉ - 136 l.] CRUD Aliments & Recettes
    │   │   └── components/                      # [À CODER - UI] MuscleFilterChips, ExerciseList, FoodList
    │   ├── workout/
    │   │   ├── types/
    │   │   │   └── workout-store.types.ts       # [IMPLÉMENTÉ - 69 l.] Interfaces du store de séance active
    │   │   ├── store/
    │   │   │   └── active-workout.store.ts      # [IMPLÉMENTÉ - 170 l.] Store anti-crash en séance + Ghost + PR
    │   │   ├── services/
    │   │   │   ├── presets.service.ts           # [IMPLÉMENTÉ - 189 l.] CRUD complet des Presets (create/update/delete)
    │   │   │   ├── ghost-records.service.ts     # [IMPLÉMENTÉ - 106 l.] Ghost values (optimisé limit 1) & Records
    │   │   │   ├── sessions.service.ts          # [IMPLÉMENTÉ - 182 l.] Sauvegarde batchée en 3 requêtes (optimisé)
    │   │   │   └── calendar.service.ts          # [IMPLÉMENTÉ - 134 l.] Vue semaine Lundi-Dimanche
    │   │   └── components/                      # [À CODER - UI] WeeklyCalendar, ActiveSession, SetRow
    │   ├── nutrition/
    │   │   ├── services/
    │   │   │   ├── entries.service.ts           # [IMPLÉMENTÉ - 174 l.] Entrées repas (jointure foods incluse)
    │   │   │   ├── couple-sync.service.ts       # [IMPLÉMENTÉ - 44 l.] Synchronisation & copie repas couple
    │   │   │   └── recipes.service.ts           # [IMPLÉMENTÉ - 145 l.] Clonage portions décimales
    │   │   └── components/                      # [À CODER - UI] DailyMacroSummary, MealCard, RecipeAccordion
    │   └── analytics/
    │       ├── services/
    │       │   ├── kpis.service.ts              # [IMPLÉMENTÉ - 169 l.] TDEE 14j, progression 1RM, volume hebdo
    │       │   └── export.service.ts            # [IMPLÉMENTÉ - 176 l.] Export JSON + bundle CSV sécurisé
    │       └── components/                      # [À CODER - UI] WeightEmaChart, OneRmChart, MuscleRadar
    │
    └── app/                                     # [COUCHE 3 - ROUTAGE & ASSEMBLAGE NEXT.JS APP ROUTER]
        ├── globals.css                          # [IMPLÉMENTÉ - 39 l.] Styles OLED, tokens .ios-card, .ios-input
        ├── layout.tsx                           # [IMPLÉMENTÉ - 38 l.] Root Layout (viewportFit: cover, Sonner)
        ├── not-found.tsx                        # [IMPLÉMENTÉ - 24 l.] Écran 404 personnalisé Apple HIG avec bouton retour
        ├── (auth)/
        │   └── login/
        │       ├── LoginForm.tsx                # [IMPLÉMENTÉ - 91 l.] Formulaire de connexion Apple HIG, consommation auth.service.ts
        │       └── page.tsx                     # [IMPLÉMENTÉ - 20 l.] Page publique d'authentification couple
        └── (protected)/
            ├── layout.tsx                       # [IMPLÉMENTÉ - 16 l.] Shell protégé intégrant BottomNav et Safe Area basse
            ├── page.tsx                         # [IMPLÉMENTÉ - 141 l.] Onglet 1 : Aujourd'hui (Dashboard d'accueil complet connecté, pesée, EMA, cibles & navigation rapide)
            ├── workout/page.tsx                 # [IMPLÉMENTÉ - 19 l.] Onglet 2 : Entraînement & Séances (Placeholder anti-404)
            ├── nutrition/page.tsx               # [IMPLÉMENTÉ - 19 l.] Onglet 3 : Journal Nutrition & Macros (Placeholder anti-404)
            ├── catalogs/page.tsx                # [IMPLÉMENTÉ - 19 l.] Onglet 4 : Catalogues (Aliments & Exercices) (Placeholder anti-404)
            └── analytics/page.tsx               # [IMPLÉMENTÉ - 19 l.] Onglet 5 : Bilan, TDEE, Graphiques & Export (Placeholder anti-404)
```

---

## 3. Flux de Données & Points d'Entrée Principaux

### 3.1 Pattern d'Exécution en 3 Couches Étanches
```
┌────────────────────────────────────────────────────────┐
│  COUCHE 3 : UI & COMPOSANTS REACT 19 (`src/features/*/components/`) │
│  - Affichage mobile, Drawer Vaul, interactions tactiles │
│  - ZÉRO appel direct à `supabase.from()`               │
└───────────────────────────┬────────────────────────────┘
                            │ Appelle les services
┌───────────────────────────▼────────────────────────────┐
│  COUCHE 2 : SERVICES SUPABASE & STORE (`src/features/*/services/`) │
│  - Requêtes PostgREST, mutations, gestion erreurs SQL  │
│  - Store Zustand offline-first (`active-workout.store`) │
└───────────────────────────┬────────────────────────────┘
                            │ Appelle les fonctions pures
┌───────────────────────────▼────────────────────────────┐
│  COUCHE 1 : MATHÉMATIQUES PURES (`src/lib/math/*.math.ts`)   │
│  - EMA 7j, 1RM Epley, PR, macros, TDEE 14j révolus    │
│  - 100% Déterministe : Zéro dépendance React ou DB    │
└────────────────────────────────────────────────────────┘
```

### 3.2 Données & Base PostgreSQL Supabase
- **14 Tables** : `profiles`, `daily_logs`, `exercises`, `user_exercise_notes`, `workout_presets`, `workout_preset_exercises`, `workout_sessions`, `workout_session_exercises`, `workout_sets`, `foods`, `recipes`, `recipe_ingredients`, `meal_entries`, `meal_entry_items`.
- **Row Level Security (RLS)** : Activé sur les 14 tables, cloisonné sur `auth.uid() = user_id`.
- **RPCs Dédiées** :
  - `sync_parent_meal_entry_totals()` : Recalcul automatique des totaux de repas.
  - `get_partner_info()` & `copy_meal_entries()` : Synchronisation et copie de repas au sein du couple.
  - `keepalive_ping()` : Déclenchée par GitHub Actions tous les 5 jours pour empêcher la mise en veille Supabase.

### 3.3 Auth, UI Shell & Ergonomie iOS (Phase 1)
- **Middleware Next.js (`src/middleware.ts`)** : Vérifie l'authentification sur chaque requête non-statique. Redirige les utilisateurs non connectés vers `/login` et les utilisateurs connectés hors de `/login` vers `/`. Les cookies de session Supabase modifiés sont systématiquement propagés sur l'objet `NextResponse.redirect` pour éviter toute rupture de session.
- **Client Serveur (`src/lib/supabase/server.ts`)** : Exploite l'accès asynchrone aux cookies (`await cookies()`) de Next.js 15 avec typage strict des options de persistance dans `setAll()`.
- **Formulaire de Connexion Apple HIG (`src/app/(auth)/login/LoginForm.tsx`)** : Formulaire respectant la Règle d'Or #3 (consommation exclusive de `auth.service.ts`). Gestion des retours d'état (chargement, messages d'erreur contextualisés), anti-zoom Safari (`text-base`), redirection vers `/` après authentification réussie.
- **Shell Protégé & Navigation (`src/app/(protected)/layout.tsx`)** : Encapsule les 5 vues principales avec un conteneur adaptatif Safe Area basse (`pb-24`) et la barre d'onglets `BottomNav` floutée à 5 entrées positionnée en bas d'écran (`fixed bottom-0`).
- **En-tête Mobile Liquid Glass (`src/components/layout/PageHeader.tsx`)** : En-tête mobile avec effet Liquid Glass (`backdrop-blur-md`), Safe Area haute dynamique (`pt-safe`), gestion de titre, sous-titre et slot d'action contextuelle.

### 3.4 Module Daily-Log & Page d'Accueil "Aujourd'hui" (Phase 2)
- **TodayPage (`src/app/(protected)/page.tsx`)** : Point d'entrée de l'application connectée. Orchestration asynchrone au montage (`Promise.all` des services Couche 2 : `log.service.ts` et `profile.service.ts`). Affichage du badge de statut pesée (poids du jour vs EMA 7j ou indicateur de pesée manquante), résumé des cibles journalières avec compteurs animés `@number-flow/react`, raccourcis tactiles vers l'entraînement et le journal nutrition.
- **Saisie Rapide de Pesée (`src/features/daily-log/components/WeightQuickInput.tsx`)** : Déclencheur tactile avec bottom-sheet `Vaul`, sélecteur de date (par défaut aujourd'hui local), steppers rapides (`-0.5kg`, `-0.1kg`, `+0.1kg`, `+0.5kg`), parsing décimal flexible (point ou virgule française) via `parseDecimalInput` (`src/lib/math/weight-ema.math.ts`), sauvegarde transactionnelle et recalcul d'EMA 7j via `logWeightAndRecalculateEma` (Couche 2), avec feedback immédiat via `sonner`.
- **Gestion des Cibles Nutritionnelles (`src/features/daily-log/components/ProfileTargetsDrawer.tsx`)** : Tiroir iOS `Vaul` permettant d'ajuster les cibles caloriques et les macronutriments (P, G, L) avec fonction d'auto-calcul instantané `calculateKcalFromMacros(p, g, l)` ($4P + 4G + 9L$ dans `src/lib/math/nutrition.math.ts`) et mise à jour dans `profiles` via `updateProfileTargets` (`profile.service.ts`).

---

## 4. Conventions de Code, Ergonomie iOS & Règles d'Or

### 4.1 Les 6 Règles d'Or du Dépôt
1. **Règle des 200 lignes max par fichier** : Aucun fichier applicatif ou suite de tests ne doit dépasser 200 lignes. Vérifié : 100% des fichiers applicatifs dans `src/` (13 à 189 l.) et 100% des 19 suites de tests sous `tests/unit/` (28 à 192 l.) respectent strictement cette règle.
2. **Isolation stricte des mathématiques** : Calculs purs logés exclusivement dans `src/lib/math/`, couverts à 100% par des tests unitaires déterministes.
3. **Zéro appel Supabase dans l'UI** : Les composants React consomment exclusivement les fonctions des fichiers `services/*.service.ts`.
4. **Typage strict indexé sur SQL** : Zéro `any`. Les schémas de données reposent intégralement sur `src/types/database.types.ts`.
5. **Filtrage PostgREST sur jointures aliasées** : Lors d'une jointure avec alias `!inner` (ex: `session:workout_sessions!inner`), TOUJOURS filtrer sur l'alias (`.eq('session.status', 'completed')`) et JAMAIS sur le nom de table PostgreSQL brut.
6. **Zéro téléchargement local & Exécution 100% Docker** : Interdiction formelle de télécharger des paquets sur le Mac hôte. Toutes les commandes (`dev`, `vitest`, `tsc`, `lint`, `npm install`) s'exécutent strictement au sein du conteneur `fitness-app` orchestré par Docker Desktop.

### 4.2 Standard des Dates Locales (Anti-Bug UTC)
- **Règle** : Toujours utiliser `src/lib/date.utils.ts` (`getLocalTodayIso()`, `shiftDateIso()`, `getWeekDatesIso()`, `formatShortFrenchDate()`).
- **Interdiction formelle** : Ne jamais utiliser `new Date().toISOString().slice(0, 10)` pour déterminer la date d'une séance ou d'un repas (risque d'enregistrement à J-1 après 20h en France).

### 4.3 Design System Apple HIG OLED (Dark Mode Natif)
- **Fond principal (OLED pur)** : `#000000` (`bg-black`)
- **Cartes & Groupes (Surface 1)** : `#1C1C1E` (`.ios-card`)
- **Champs de saisie & Sous-menus (Surface 2)** : `#2C2C2E` (`.ios-input`)
- **Bordures & Séparateurs fins** : `#38383A`
- **Labels secondaires & Ghost Values** : `#8E8E93`
- **Anti-Zoom Safari** : `text-base` (16px minimum) obligatoire sur tous les inputs/selects/textareas.
- **Chiffres alignés** : Classe `tabular-nums` sur tous les nombres (poids, reps, calories, chronos).
- **Zones tactiles** : Minimum `44x44px` (`min-h-[44px] min-w-[44px]`).
- **Claviers virtuels iPhone** : `inputMode="decimal"` pour les valeurs à virgule, `inputMode="numeric"` pour les entiers.

### 4.4 Sécurité & Hardening (SecOps)
- **Neutralisation Formula Injection (CWE-1236)** : La fonction `escapeCsvCell()` dans `src/features/analytics/services/export.service.ts` préfixe d'une apostrophe toute chaîne débutant par `=`, `+`, `-`, `@`, `\t` ou `\r`, prévenant l'exécution de formules arbitraires lors de l'ouverture des exports dans Microsoft Excel ou Apple Numbers.
- **Cloisonnement RLS** : Cloisonnement strict sur `auth.uid() = user_id` garantissant qu'aucun utilisateur ne peut lire ou altérer les données de tiers. Seules les fonctions RPC explicitement contrôlées permettent la synchronisation au sein du couple partenaire.

---

## 5. Check-list Infrastructure & Démarrage

- [x] **Docker Desktop** : Lancé et opérationnel sur macOS hôte.
- [x] **Démarrage Conteneurisé** : Validé via `docker compose up -d` (accessible sur `http://localhost:3000`).
- [x] **Harnais de Tests Vitest** : Configuré avec `@vitejs/plugin-react` et `vite-tsconfig-paths` (`config/vitest.config.ts`).
- [x] **Tests Unitaires & Chaos au Vert** : 19 suites modularisées sous `tests/unit/` (120 tests au vert, 100% GREEN, 0 avertissement, exécution via `docker compose exec app npm test`).
- [x] **UI Shell & Navigation iOS (Phase 1)** : Shell protégé, barre `BottomNav` 5 onglets avec Liquid Glass, `PageHeader` dynamique, formulaire `LoginForm` Apple HIG et routes de navigation anti-404 validés.
- [x] **Journal Quotidien (Aujourd'hui), Pesée & Cibles (Phase 2)** : Composants `WeightQuickInput` et `ProfileTargetsDrawer` implémentés avec Drawer Vaul, Page d'accueil connectée avec compteurs animés `@number-flow/react`, recalcul EMA 7j en temps réel, auto-calcul macros ($4P + 4G + 9L$), tests unitaires et de chaos (monkey testing) validés.
- [x] **Typage strict généré** : `src/types/database.types.ts` présent et synchronisé avec le schéma SQL (14 tables, 5 enums, 3 RPCs, Relationships typées, 0 mot-clé `any`).
- [ ] **Variables d'environnement** : Vérifier dans `.env.local` la présence de `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` et `SUPABASE_PROJECT_ID`.
- [ ] **Migration SQL** : Exécuter `supabase/migrations/001_initial_schema.sql` dans le SQL Editor de Supabase.
- [ ] **Test de connexion & RPC** : Vérifier que la fonction RPC `keepalive_ping()` répond `{"status": "ok"}`.
