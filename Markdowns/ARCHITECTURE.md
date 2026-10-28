# Architecture Logicielle, Design System iOS & Règles IA (`ARCHITECTURE.md`)

## 1. Les 4 Règles d'Or pour le Vibe Coding
1. **Règle des 200 lignes max par fichier :** Aucun fichier de code applicatif (`.ts`, `.tsx`, `.css`) ne doit dépasser 200 lignes (à l'exception du fichier auto-généré `src/types/database.types.ts`). Les services de domaine sont systématiquement scindés en sous-fichiers thématiques dans un sous-dossier `services/` pour que l'IA garde 100 % du contexte sans halluciner.
2. **Isolation stricte des mathématiques (Fonctions Pures) :** Tous les calculs (EMA 7 jours, 1RM Epley & PR dynamiques, TDEE 14 jours révolus, règle de trois des macros et portions décimales) vivent dans `src/lib/math/` sous forme de fonctions TypeScript pures (zéro dépendance à React ou Supabase).
3. **Zéro appel Supabase dans l'UI :** Il est strictement interdit d'appeler `supabase.from(...)` dans un fichier `.tsx`. Les composants React appellent uniquement les fonctions exposées par les fichiers `src/features/*/services/*.service.ts`.
4. **Typage strict indexé sur SQL :** Utiliser systématiquement les types générés depuis le schéma PostgreSQL (`src/types/database.types.ts`). Le mot-clé `any` est strictement banni.

---

## 2. Arborescence Complète du Projet & Fichiers de Code Extraits

Tous les fichiers techniques du socle, du moteur mathématique et des services Supabase sont **déjà extraits et découpés (`< 200 lignes`)** dans l'arborescence réelle du projet :

```text
FitnessApp/
├── Markdowns/                                           # Documentation par phase (allégée sans blocs de code géants)
│   ├── SPECIFICATION.md
│   ├── ARCHITECTURE.md
│   ├── PHASE_1_FOUNDATION.md
│   ├── PHASE_2_DAILY_SNAPSHOT_AND_WEIGHT.md
│   ├── PHASE_3_SHARED_CATALOGS.md
│   ├── PHASE_4_WORKOUT_ENGINE.md
│   ├── PHASE_5_NUTRITION_JOURNAL.md
│   └── PHASE_6_ANALYTICS_AND_TDEE.md
├── .github/
│   └── workflows/
│       └── supabase-keepalive.yml                       # [Créé] Cron anti-veille Supabase (tous les 5j)
├── public/
│   ├── manifest.json                                    # [Créé] Configuration PWA iOS (standalone, #000000)
│   └── data/
│       └── exercises_seed.json                          # [Créé] 40 exercices répartis sur 10 groupes musculaires
├── supabase/
│   └── migrations/
│       └── 001_initial_schema.sql                       # [Créé] Schéma SQL complet, triggers Europe/Paris et RLS
└── src/
    ├── middleware.ts                                    # [Créé] Protection des routes authentifiées
    ├── types/
    │   ├── database.types.ts                            # [À générer en Phase 1 via Supabase CLI]
    │   └── domain.types.ts                              # [Créé] 10 groupes musculaires & 5 catégories de repas
    │
    ├── lib/                                             # CŒUR TECHNIQUE & MATHÉMATIQUE (Pur TS < 200 lignes)
    │   ├── date.utils.ts                                # [Créé] Dates locales iPhone (anti-bug UTC)
    │   ├── supabase/
    │   │   ├── client.ts                                # [Créé] Client navigateur (@supabase/ssr)
    │   │   └── server.ts                                # [Créé] Client serveur Next.js 15
    │   └── math/
    │       ├── weight-ema.math.ts                       # [Créé] Moyenne Mobile Exponentielle (7j)
    │       ├── workout-kpis.math.ts                     # [Créé] 1RM Epley, Tonnage, Volume/muscle, PR dynamiques
    │       ├── nutrition.math.ts                        # [Créé] Calculs au gramme, Meal Prep & portions décimales
    │       └── tdee.math.ts                             # [Créé] Maintenance réelle sur 14 jours révolus (J-14 à J-1)
    │
    ├── components/                                      # DESIGN SYSTEM & LAYOUT GLOBAL iOS
    │   ├── ui/                                          # Composants shadcn/ui + Vaul
    │   └── layout/
    │       ├── BottomNav.tsx                            # [Créé] Barre de navigation iOS translucide (5 onglets)
    │       └── PageHeader.tsx                           # En-tête mobile standardisé avec flou Liquid Glass
    │
    ├── features/                                        # MODULES MÉTIER DÉCOUPÉS PAR DOMAINE
    │   ├── daily-log/
    │   │   ├── components/                              # WeightQuickInput, ProfileTargetsDrawer
    │   │   └── services/
    │   │       └── log.service.ts                       # [Créé] Snapshot journalier, Profil & recalcul EMA
    │   ├── catalogs/
    │   │   ├── components/                              # MuscleFilterChips, ExerciseList, FoodList, RecipeBuilderDrawer
    │   │   └── services/
    │   │       ├── exercises.service.ts                 # [Créé] CRUD Exercices + auto-seed
    │   │       └── nutrition.service.ts                 # [Créé] CRUD Aliments ('100g'|'unit'|'both') & Recettes
    │   ├── workout/
    │   │   ├── components/                              # WeeklyCalendar, ActiveSession, ExerciseCard, SetRow, FinishSessionDrawer
    │   │   ├── store/
    │   │   │   └── active-workout.store.ts              # [Créé] Store anti-crash iOS + 1-Tap Ghost + PR temps réel
    │   │   └── services/
    │   │       ├── presets.service.ts                   # [Créé] Ghost Values (tri session_date) & CRUD Presets
    │   │       ├── sessions.service.ts                  # [Créé] Sauvegarde, suppression séance & notes épinglées
    │   │       └── calendar.service.ts                  # [Créé] Agenda Lundi->Dimanche & chargement pour ré-édition
    │   ├── nutrition/
    │   │   ├── components/                              # DailyMacroSummary, MealCard, RecipeSubmenuAccordion, AddNutritionItemDrawer
    │   │   └── services/
    │   │       ├── entries.service.ts                   # [Créé] Ajout/Édition/Suppression aliment & copie couple
    │   │       └── recipes.service.ts                   # [Créé] Clonage recette (portions décimales) & override
    │   └── analytics/
    │       ├── components/                              # WeightEmaChart, OneRmChart, MuscleRadar, TdeeBanner, ExportDataCard
    │       └── services/
    │           ├── kpis.service.ts                      # [Créé] TDEE 14j révolus, 1RM (session_date) & Volume Lundi->Dimanche
    │           └── export.service.ts                    # [Créé] Export JSON complet + Bundle de 3 fichiers CSV
    │
    └── app/                                             # ROUTAGE NEXT.JS (Pages légères d'assemblage)
        ├── globals.css                                  # [Créé] Styles globaux iOS Native Feel, OLED #000000, SF Pro
        ├── layout.tsx                                   # [Créé] Root layout PWA (viewportFit: cover, Vaul, Sonner)
        ├── (auth)/
        │   └── login/page.tsx
        └── (protected)/
            ├── layout.tsx
            ├── page.tsx                                 # Onglet 1 : Aujourd'hui
            ├── workout/page.tsx                         # Onglet 2 : Musculation
            ├── nutrition/page.tsx                       # Onglet 3 : Nutrition
            ├── catalogs/page.tsx                        # Onglet 4 : Catalogues
            └── analytics/page.tsx                       # Onglet 5 : Stats, TDEE & Export
```

---

## 3. Pattern d'Exécution en 3 Couches

| Couche | Emplacement | Responsabilité | Interdictions |
| :--- | :--- | :--- | :--- |
| **1. Math / Domain** | `src/lib/math/*.math.ts` | Calculs purs (EMA, 1RM/PR, macros, TDEE). | Aucun import React, aucun appel réseau/Supabase. |
| **2. Service / Data** | `src/features/*/services/*.service.ts` | Lecture/Écriture Supabase, gestion des erreurs SQL, transformation des données. | Aucun JSX/HTML, aucune logique d'affichage. |
| **3. UI / Feature** | `src/features/*/components/*.tsx` | Affichage mobile, gestion des clics, animations, états de chargement. | Aucun appel direct à `supabase.from()`. |

---

## 4. Design System & Stack UI "iOS Native Feel"

### 4.1 Bibliothèques UI & Animations obligatoires
```bash
npm install motion @number-flow/react sonner @phosphor-icons/react vaul
```
1. **`vaul` (via `shadcn/ui Drawer`) :** Formulaires en **Bottom Sheet iOS** coulissant du bas avec physique de ressort (`shouldScaleBackground`).
2. **`motion` (`import { motion, AnimatePresence } from "motion/react"`) :** Animations à ressort (`type: "spring", stiffness: 300, damping: 28`), jauges de macros et dépliage des sous-menus de recettes.
3. **`@number-flow/react` (`<NumberFlow value={...} />`) :** Compteurs dynamiques (calories restantes, protéines, tonnage, poids EMA).
4. **`sonner` (`<Toaster position="top-center" theme="dark" />`) :** Notifications compactes sous la Dynamic Island.
5. **`@phosphor-icons/react` :** Icônes style *SF Symbols* (`weight="regular"` inactif, `weight="fill"` actif).

### 4.2 Palette de Couleurs OLED Apple HIG (Dark Mode natif)
Voir [`src/app/globals.css`](../src/app/globals.css) :
- **Fond principal (OLED pur) :** `#000000` (`bg-black`)
- **Cartes / Listes groupées (Surface 1) :** `#1C1C1E` (`.ios-card`)
- **Champs de saisie / Sous-menus (Surface 2) :** `#2C2C2E` (`.ios-input`)
- **Éléments survolés / Badges (Surface 3) :** `#3A3A3C` (`bg-[#3A3A3C]`)
- **Bordures & Séparateurs fins :** `#38383A` (`border-[#38383A]` ou `border-white/[0.08]`)
- **Texte secondaire (Labels, Ghost Values) :** `#8E8E93` (`text-[#8E8E93]`)
- **Couleurs sémantiques Apple Fitness :**
  - Action principale / Focus : Bleu iOS `#0A84FF`
  - Validation série / Objectif atteint : Vert iOS `#30D158`
  - Calories / Anneau d'énergie : Rose-Rouge `#FF375F`
  - Protéines : Bleu Cyan `#32ADE6` | Glucides : Orange `#FF9F0A` | Lipides : Violet `#BF5AF2`

---

## 5. Ingénierie Spécifique iOS & Contraintes Ergonomiques

1. **Persistance Anti-Crash en Séance :** Stockée dans [`src/features/workout/store/active-workout.store.ts`](../src/features/workout/store/active-workout.store.ts) via Zustand + `localStorage`.
2. **Anti-Zoom Safari (Critique) :** Tous les champs `<input>`, `<select>` et `<textarea>` doivent avoir la classe `text-base` (16px minimum) ou `.ios-input`.
3. **Alignement des chiffres :** Toujours ajouter la classe `tabular-nums` sur les poids, répétitions, calories, grammes et chronomètres.
4. **Clavier Numérique Adapté :**
   - Champs à décimales (Poids corporel, Charges haltères, Grammages, Portions de recette) : `type="text" inputMode="decimal"`.
   - Champs entiers (Répétitions, Temps de repos, Calories) : `type="text" inputMode="numeric"`.
5. **Zones Tactiles (Apple HIG) :** Minimum `44x44px` (`min-h-[44px] min-w-[44px]`).
6. **Safe Area iOS :** Gérée dans [`src/app/layout.tsx`](../src/app/layout.tsx) et [`src/components/layout/BottomNav.tsx`](../src/components/layout/BottomNav.tsx).

---

## 6. Matrice des Versions Verrouillées (Stack & Compatibilité)

| Technologie / Package | Version Cible | Raison Technique & Compatibilité |
| :--- | :--- | :--- |
| **Node.js** | `>= 20.18.0` (LTS) | Requis par Next.js 15 et `@supabase/ssr`. |
| **`next`** | `^15.2.0` | App Router stable (`await cookies()` asynchrone). |
| **`react` / `react-dom`** | `^19.0.0` | Support natif de `@number-flow/react` et `motion`. |
| **`typescript`** | `^5.7.0` | Typage strict (`strict: true`, zéro `any`). |
| **`tailwindcss`** | `^3.4.17` | Verrouillé en v3.4.x pour `.ios-glass` et `shadcn/ui`. |
| **`@supabase/supabase-js`** | `^2.49.0` | Support complet du typage généré `Database` et des appels `.rpc()`. |
| **`@supabase/ssr`** | `^0.6.1` | Gestion propre des cookies d'authentification Next.js 15. |
| **`zustand`** | `^5.0.3` | Store anti-crash en séance avec middleware `persist` (`localStorage`). |
| **`motion`** | `^12.4.0` | `import { motion, AnimatePresence } from "motion/react"`. |
| **`@number-flow/react`** | `^0.5.10` | Compteurs animés iOS. |
| **`vaul`** | `^1.1.2` | Bottom Sheets iOS natifs. |
| **`sonner`** | `^2.0.1` | Toasts compacts sous la Dynamic Island. |
| **`@phosphor-icons/react`** | `^2.1.7` | Icônes style SF Symbols. |
| **`recharts`** | `^2.15.1` | Courbes EMA 7j, 1RM Epley et graphiques analytiques. |
| **`date-fns`** | `^4.1.0` | Manipulation fiable des dates au fuseau horaire local de l'iPhone. |

---

## 7. Protocole d'Exécution Agent IA & Utilitaires Transversaux

### 7.1 TODO INFRASTRUCTURE BLOQUANT (À vérifier AVANT de coder la Phase 1)
- [ ] **TODO 1 (Variables d'environnement) :** Vérifier dans `.env.local` la présence de `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` et du `SUPABASE_PROJECT_ID`.
- [ ] **TODO 2 (Migration SQL) :** Exécuter [`supabase/migrations/001_initial_schema.sql`](../supabase/migrations/001_initial_schema.sql) dans le SQL Editor de Supabase.
- [ ] **TODO 3 (Test de connexion & RPC) :** Vérifier que la fonction RPC `keepalive_ping()` répond `{"status": "ok"}`.
- [ ] **TODO 4 (Génération de `src/types/database.types.ts`) :** Exécuter `npx supabase gen types typescript --project-id "<PROJECT_ID>" --schema public > src/types/database.types.ts`.

### 7.2 Dates Locales & Types Métier (Fichiers de référence)
- **Dates locales (Anti-Bug UTC) :** Utiliser exclusivement [`src/lib/date.utils.ts`](../src/lib/date.utils.ts) (`getLocalTodayIso`, `shiftDateIso`, `getWeekDatesIso`, `formatShortFrenchDate`). Interdiction absolue d'utiliser `new Date().toISOString().slice(0, 10)` pour déterminer une date métier.
- **Types métier partagés :** Voir [`src/types/domain.types.ts`](../src/types/domain.types.ts) (`MUSCLE_GROUPS`, `MuscleGroup`, `MEAL_CATEGORIES_ORDER`).
