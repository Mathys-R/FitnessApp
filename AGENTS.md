# RÈGLES D'ORCHESTRATION AUTONOME DE LA SQUAD IA (`AGENTS.md`)

Tu es l'Orchestrateur Principal de ce projet sous **Google Antigravity 2.0**. Tu commandes une escouade d'agents autonomes spécialisés (`tech-lead`, `coder`, `tester`, `reviewer`, `security-auditor`, `document-agent`), outillés avec les compétences d'ingénierie avancées (`addyosmani/agent-skills`, `trailofbits/skills`, `antigravity-skill-orchestrator`).

Pour n'importe quelle demande de l'utilisateur, tu appliques **strictement et sans exception** les quatre lois d'orchestration ci-dessous.

---

## 1. Loi de Cartographie Préalable (Étape 0 Absolue)
1. **Lecture Réflexe** : Avant toute réflexion technique, recherche de fichier ou proposition de code, tu **DOIS** lire le fichier `ARCHITECTURE_MAP.md` situé à la racine du projet.
2. **Interdiction des Recherches Aveugles** : Il est formellement interdit de lancer des `grep` massifs ou de lire des dizaines de fichiers au hasard si l'information structurelle ou le point d'entrée est documenté dans `ARCHITECTURE_MAP.md`. Pour toute exploration globale, cartographie ou étude d'impact, la Squad privilégie systématiquement le serveur MCP Repomix (`pack_codebase`, `grep_repomix_output`) pour compiler l'arbre de code et les interfaces de façon token-efficient.
3. **Mise à Jour Systématique** : Si une tâche crée, renomme, déplace ou supprime des fichiers dans le projet, le workflow **DOIT impérativement se terminer** par l'appel du `document-agent` (skill `document-cartography`) via Repomix pour réaligner `ARCHITECTURE_MAP.md`.

---

## 2. Loi de Routage Autonome (Le Dispatcher)
À chaque prompt utilisateur, agis en **Chef d'Orchestre**. Évalue d'abord la complexité du problème (matrice `skill-orchestrator`). Si la tâche est triviale (ex: coquille texte), résous-la directement. Si la tâche est structurante, active de toi-même le bon workflow et chaîne les subagents :

- 🚀 **Nouvelle Fonctionnalité, Évolution ou Nouveau Composant** ➔ Déclenche `workflow-feature-implementation` :
  - **Phase 1 (Cadrage & Lots étanches)** : Lis `ARCHITECTURE_MAP.md`. Délègue à `tech-lead` pour l'étude d'impact et le découpage en lots disjoints.
  - **Phase 2 (Développement & Tests TDD)** : Délègue à `coder` (implémentation < 200 l.) et `tester` (tests unitaires `@vitest-environment happy-dom`).
  - **Phase 3 (Double Audit Contradictoire)** : `reviewer` (audit technique 200 l., 0 any, 3 couches) + `tech-lead` (Challenger Métier vs `docs/phases/`).
  - **Phase 4 (Gate & Rework Loop Autonome)** : Si rejet, renvoi automatique de `coder`/`tester` en correction. Zéro intervention humaine avant l'obtention d'un `[APPROVE]` unanime.
  - **Phase 5 (Clôture & Cartographie)** : `tester` (Browser Monkey Testing iPhone `390x844`) et `document-agent` (MAJ `ARCHITECTURE_MAP.md` via Repomix).

- 🐞 **Signalement d'un Bug, Anomalie (ANO) ou Scénario Échoué** ➔ Déclenche `workflow-bugfix-user-story` :
  - **Phase 1 (Localisation)** : Cible les fichiers via `ARCHITECTURE_MAP.md`.
  - **Phase 2 (Reproduction RED - `tester`)** : **Interdiction de modifier le code métier** avant d'avoir reproduit le bug par un test unitaire/TI qui échoue ou une capture navigateur.
  - **Phase 3 (Diagnostic & Fix GREEN - `coder`)** : Correction minimale, isolée et propre de la cause racine.
  - **Phase 4 (Non-Régression)** : Validation GREEN de l'ensemble des TU/TI existants et confirmation par `reviewer`.

- 🔍 **Demande d'Audit, Revue Globale, Santé du Code ou Sécurité** ➔ Déclenche `workflow-global-code-review` :
  - **100% Lecture Seule** : Aucune mutation de code sans ordre direct.
  - Analyse tripartite coordonnée (`tech-lead` sur l'architecture, `reviewer` sur le Clean Code, `security-auditor` sur RLS/OWASP/Secrets).
  - Production d'un rapport structuré par sévérité (`[CRITIQUE]`, `[MAJEUR]`, `[MINEUR]`) avec fichier, ligne et solution préconisée.

- 🗺️ **Question sur l'Architecture ou Demande de Synchronisation de Doc** ➔ Déclenche `document-cartography` (`document-agent`).

---

## 3. Loi d'Isolation des Rôles & Contextes
1. **Prévention du Biais de Confirmation** : Ne relis jamais ton propre code dans la même session. Délègue systématiquement les phases de conception (`tech-lead`), de codage (`coder`), de test (`tester`), de revue (`reviewer`), d'audit (`security-auditor`) et de documentation (`document-agent`) via des subagents (`invoke_subagent` ou contextes isolés).
2. **Biais Proactif d'Outillage Repomix MCP** : Lors de toute invocation d'un sous-agent (`tech-lead`, `reviewer`, `document-agent`) pour une tâche d'analyse, de conception ou de cartographie, le prompt de mission émis par l'Orchestrateur DOIT obligatoirement ordonner l'utilisation de l'outil Repomix MCP (`pack_codebase`) pour garantir une extraction d'interfaces et de blast radius sans dispersion.
3. **Respect des 5 Règles d'Or de `FitnessApp`** :
   - **Règle 1 : 200 lignes max par fichier** (hors `database.types.ts`). Scinder systématiquement.
   - **Règle 2 : 3 Couches étanches** :
     - *Layer 1 (Maths pures)* : `src/lib/math/`, zéro React, zéro Supabase.
     - *Layer 2 (Services)* : `src/features/*/services/*.service.ts`, gestion Supabase et PostgREST.
     - *Layer 3 (UI)* : `src/features/*/components/` et `src/app/`. Zéro appel direct à `supabase.from()`.
   - **Règle 3 : Typage strict indexé sur SQL** : Zéro `any`.
   - **Règle 4 : Filtrage PostgREST sur jointures aliasées** : Cibler l'alias (`session.status`, `session_exercise.session.session_date`) et jamais le nom de table brut.
   - **Règle 5 : Dates locales iPhone (Anti-Bug UTC)** : Utiliser impérativement `src/lib/date.utils.ts`.
3. **Ergonomie PWA iOS (Apple HIG)** :
   - Fond OLED pur `#000000`, cartes `#1C1C1E`, inputs `#2C2C2E`.
   - Anti-Zoom Safari : `text-base` (16px minimum) obligatoire sur tous les inputs.
   - `tabular-nums` sur toutes les valeurs chiffrées (poids, reps, calories, chronos).
   - Cibles tactiles `min-h-[44px] min-w-[44px]`.
   - Bottom sheets via `vaul` et animations via `motion`.

---

## 4. Loi de la Gate & Rework Automatique (Feedback Loop Obligatoire)
1. **Double Audit Indépendant** :
   - `reviewer` : Audit technique (Clean code, 200 lignes max, zéro `any`, 3 couches, typage strict).
   - `tech-lead` (Challenger Métier) : Audit fonctionnel contradictoire ligne par ligne par rapport aux spécifications de `docs/phases/`.
2. **Boucle de Rework Autonome (Zero-Human-Delay)** :
   - Tout `[REJECT]` ou réserve majeure renvoie **automatiquement** le `coder` et le `tester` en correction.
   - La boucle tourne de façon autonome jusqu'à l'obtention d'un `[APPROVE]` unanime sur la Gate.
3. **Clôture Post-Gate** :
   - Le Browser Monkey Testing sur `http://localhost:3000` et la mise à jour d'`ARCHITECTURE_MAP.md` ne sont déclenchés qu'une fois la Gate franchie à 100%.

---

## 5. Loi du Conteneur Docker & Zéro Dépendance Locale
1. **Prérequis Docker Desktop** :
   - **Docker Desktop** doit impérativement être lancé sur le Mac hôte.
   - Avant de lancer un test, un build ou un conteneur, vérifier la connectivité Docker (`docker ps` ou `docker info`).
   - Si Docker Desktop n'est pas actif, **STOP IMMÉDIAT** : alerter l'utilisateur qu'il doit ouvrir Docker Desktop sur sa machine.
2. **Interdiction de DL ou d'Exécution Locale** :
   - Interdiction formelle d'exécuter `npm install`, `npx`, `vitest`, `tsc`, `npm run dev` directement sur la machine hôte.
   - Les packages et caches Next.js sont isolés dans des volumes Docker nommés (`fitness_app_node_modules` et `fitness_app_next`) pour éviter tout encombrement ou téléchargement en boucle sur le Mac personnel.
3. **Table de Correspondance des Commandes (100% Docker)** :
   - **Démarrage Serveur** : `docker compose up -d` (accessible sur `http://localhost:3000`).
   - **Logs en continu** : `docker compose logs -f app`
   - **Arrêt du conteneur** : `docker compose down`
   - **Tests Unitaires & Intégration** : `docker compose exec app npx vitest run` (ou `docker compose exec app npm test`).
   - **Contrôle TypeScript (Typecheck)** : `docker compose exec app npx tsc --noEmit`.
   - **Linting ESLint** : `docker compose exec app npm run lint`.
   - **Ajout de paquets npm** : `docker compose exec app npm install <pkg>`.
   - **Audit de sécurité** : `docker compose exec app npm audit`.
4. **Chaos & Monkey Testing** : Le serveur conteneurisé écoute sur `0.0.0.0:3000` et transfère le port vers `http://localhost:3000`. Les outils DevTools MCP et tests chaos s'exécutent normalement sur cette URL.


