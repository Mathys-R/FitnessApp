# Cahier des Charges & Roadmap — Application Fitness & Nutrition (PWA iOS)

## 1. Vision & Cadrage Technique

### 1.1 Objectif du projet
Développer une application mobile personnelle (utilisée en couple : 2 utilisateurs) permettant un suivi unifié et précis de la musculation, de la nutrition (calories/macros) et du poids corporel, avec croisement mathématique des données (calcul de la maintenance calorique réelle et indicateurs de progression).

### 1.2 Stack Technique (Coût : 0 €)
- **Format** : Progressive Web App (PWA) installée sur l'écran d'accueil iOS via Safari (mode plein écran *standalone*, icône dédiée, zéro expiration de certificat).
- **Frontend** : Next.js (App Router, TypeScript) + Tailwind CSS + composants UI tactiles optimisés mobile.
- **Backend & Base de données** : Supabase (PostgreSQL + Authentification + Row Level Security).
- **Hébergement** : Vercel ou Cloudflare Pages (déploiement continu via GitHub).
- **Maintien en ligne (Anti-veille)** : GitHub Action (cron tous les 5 jours) effectuant un ping léger sur l'API Supabase pour éviter la mise en pause automatique après 7 jours d'inactivité.

### 1.3 Modèle de confidentialité (Multi-utilisateurs en couple)
L'application gère deux niveaux d'accès aux données via les règles de sécurité PostgreSQL (`RLS`) :

- **Données Privées** (propres à chaque compte `user_id`) :
  - Objectifs caloriques et macronutriments.
  - Historique du poids et mensurations.
  - Journal nutritionnel quotidien.
  - Séances de musculation, performances, records (PR), modèles de séances (Presets) et notes personnelles.
- **Données Partagées** (communes aux deux comptes) :
  - Catalogue d'exercices (base initiale + ajouts manuels).
  - Catalogue d'aliments simples.
  - Catalogue de plats composés (Recettes).

---

## 2. Spécifications Fonctionnelles — Périmètre V1

### Module A : Socle Utilisateur & Journalisation Quotidienne (Snapshot Engine)
- **Profil & Objectifs courants** : Définition des cibles actuelles (kcal, protéines, glucides, lipides).
- **Mécanisme de Snapshot Journalier** :
  - Chaque journée enregistrée fige les objectifs en vigueur ce jour-là (`target_kcal`, `target_p`, `target_g`, `target_l`).
  - **Règle métier critique** : Modifier ses objectifs en Semaine 2 met à jour les cibles futures ainsi que le Snapshot de la journée en cours (`(NOW() AT TIME ZONE 'Europe/Paris')::date`) si elle est déjà initialisée, mais n'altère **jamais** les cibles et pourcentages de réussite des journées passées.
  - **Indicateur d'exclusion TDEE (`exclude_from_tdee`)** : Chaque journée possède un interrupteur permettant à l'utilisateur d'exclure manuellement une journée atypique ou incomplète (ex: restaurant non pesé, oubli de saisie le soir) du calcul de la maintenance calorique.

### Module B : Suivi du Poids & Lissage Mathématique
- **Saisie quotidienne** : Enregistrement d'une pesée par jour (modifiable) associée à une date.
- **Algorithme de lissage (EMA 7 jours)** :
  Calcul automatique de la Moyenne Mobile Exponentielle (EMA) sur 7 jours à chaque pesée pour gommer les variations hydriques dès le jour J :
  $$EMA_J = (Poids_J \times \alpha) + (EMA_{J-1} \times (1 - \alpha)) \quad \text{avec } \alpha = \frac{2}{7 + 1} = 0{,}25$$
  - **Règles de continuité mathématique (`src/lib/math/weight-ema.math.ts`)** :
    1. *Initialisation ($J_0$)* : Lors de la toute première pesée historique, $EMA_0 = Poids_0$.
    2. *Jours sans pesée* : Si l'utilisateur ne se pèse pas pendant un ou plusieurs jours, $EMA_{J-1}$ reprend la **dernière valeur EMA connue** (aucune ligne fictive n'est créée).
    3. *Modification ou saisie rétroactive* : Toute modification ou insertion d'une pesée à une date passée $D$ déclenche le recalcul en cascade des valeurs `weight_ema_kg` pour toutes les pesées où `log_date >= D`.
- **Visualisation** : Graphique combinant les pesées brutes (points discrets) et la courbe de tendance EMA (ligne continue).

### Module C : Catalogue & Suivi de Musculation
- **Catalogue d'exercices** :
  - Initialisé via `public/data/exercises_seed.json` injecté en base relationnelle SQL, enrichissable par les utilisateurs (avec archivage doux `is_archived` pour ne jamais casser l'historique croisé du couple).
  - **Attributs d'un exercice** : Nom, illustration/icône, muscle principal, muscles secondaires (stockés en `JSONB`), et Guide d'exécution général précisant la portion musculaire ciblée (ex: chef long, faisceau claviculaire, etc.).
  - **10 Groupes musculaires distincts (Jambes détaillées)** : Recherche instantanée par texte + Bulles de filtres rapides (*Chips*) sur **Tous, Pecs, Dos, Épaules, Biceps, Triceps, Quadriceps, Ischios, Fessiers, Mollets, Abdos**.
- **Système de double note sur un exercice** :
  - **Note épinglée** (Permanente - par utilisateur et par exercice) : Réglages de machine ou consignes perso (ex: *"Siège cran 4, prise neutre"*), toujours visible à chaque fois que l'exercice est chargé. Si l'utilisateur vide la note épinglée en séance, elle est supprimée de la base pour ne plus réapparaître.
  - **Note de séance** (Temporaire - liée à la séance du jour) : Ressenti spécifique du jour (ex: *"Fatigue nerveuse, dernière rep lente"*).
- **Planification, Édition & Lancement de séance** :
  - **Calendrier hebdomadaire (Agenda daté Lundi → Dimanche)** : Vue sur la semaine permettant d'assigner ou de décaler sur une date précise une séance planifiée (`planned`), une séance réalisée (`completed`) ou un jour de repos (`rest_day`). La date de l'agenda (`session_date`) fait systématiquement foi pour l'historique, les *Ghost Values* et les graphiques.
  - **Séance Vierge & Ré-édition / Suppression de séance passée** : Création à la volée, ou réouverture/suppression d'une séance terminée en cas d'erreur de saisie (ex: faute de frappe sur une charge).
  - **Presets (Modèles de séances CRUD complet) & Workflow de fin de séance à 3 choix** :
    - Sauvegarde, modification et suppression de modèles de séances complets (exercices, nombre de séries, temps de repos cibles) réutilisables en 1 clic.
    - En fin de séance, l'utilisateur peut choisir entre : **(1) Écraser le preset de base** avec les modifications effectuées, **(2) Créer un nouveau preset** à partir de la séance réalisée, ou **(3) Enregistrer uniquement la séance du jour** sans toucher aux presets.
- **Exécution, Ghost Values & PR Dynamiques** :
  - Pour chaque série : Poids (kg), Répétitions, Temps de repos cible (s), statut Échauffement (`is_warmup`) et statut Validé (`is_completed`).
  - **Ghost Values (Valeurs fantômes) & Validation 1-Tap** : Le système interroge la dernière séance validée (`completed`, triée par `session_date DESC`) contenant cet exercice et pré-remplit les champs en filigrane (`placeholder`). Cliquer directement sur **✓ (Valider)** alors que les champs sont vides copie automatiquement les *Ghost Values* comme valeurs réelles validées.
  - **Redéfinition dynamique des PR** : Le statut PR (`is_pr`) se recalcule à la validation/modification de chaque série en séance (une série est PR si elle bat à la fois le record historique d'avant-séance **et** les séries précédentes déjà validées dans la séance en cours) ainsi qu'à l'enregistrement de la séance.

### Module D : Catalogue & Suivi Nutritionnel
- **Structure du journal quotidien** :
  - Jauge globale de la journée (Calories restantes / consommées + barres de progression Protéines, Glucides, Lipides par rapport au Snapshot du jour).
  - Découpage par catégories de repas : Petit-déjeuner, Déjeuner, Dîner, Collation, Pré/Post-workout.
  - **Copie rapide de repas (Hier & Partenaire)** : Depuis l'en-tête d'un repas, possibilité en 1 clic de copier son propre repas de la veille ou d'importer le repas déjà saisi en base par le partenaire pour la journée en cours.
  - **Édition & Suppression complètes** : Toute ligne de repas (`quick_add`, `food`, `recipe`) ou sous-ingrédient cloné peut être modifiée en quantité ou supprimée à tout moment.
- **3 Modes de saisie d'un élément dans un repas** :
  - **Ajout rapide (Quick Add)** : Saisie directe (et modifiable) de calories et/ou macros libres avec un intitulé optionnel.
  - **Aliment simple du catalogue (`100g`, `unit` ou `both`)** :
    - Mode défini dans le catalogue : **`100g` uniquement** (ex: riz, pain), **`unit` uniquement** (ex: œuf), ou **`both` (Grammes + Unité)** (ex: banane, avec macros pour 100g et `unit_weight_g`).
    - Lors de l'ajout ou de la modification dans le repas, le calcul proportionnel s'adapte au mode de l'aliment (avec sélecteur `[ g | unité ]` si l'aliment est en mode `both`).
  - **Plat composé (Recette) avec portions décimales et sous-menu dépliable** :
    - Chaque plat dans le catalogue représente **1 portion individuelle de référence** (avec diviseur automatique par $N$ parts à la création en *meal prep* ; lors d'une ré-édition ultérieure du catalogue, on édite directement les quantités ramenées à 1 portion).
    - Lors de l'ajout du plat dans le journal du jour, l'utilisateur peut choisir un **multiplicateur de portion décimal** (ex: `1`, `1.5`, `0.5` part). Le plat crée une entrée parente et **clone** ses ingrédients multipliés dans le rapport personnel du jour (`meal_entry_items`).
    - **Surcharge locale (Override)** : L'utilisateur peut modifier la quantité ou supprimer un ingrédient dans le sous-menu de sa journée : cela recalcule automatiquement son journal personnel du jour **sans jamais modifier la recette de référence dans le catalogue partagé**.

### Module E : Analytics, Croisement de Données & Export (JSON + 3 CSV)
- **Indicateurs de performance Musculation (4 KPIs calculés sur les séries effectives : `is_completed = true` et `is_warmup = false`, datés par `session_date`)** :
  - **1RM Théorique (Formule d'Epley)** :
    $$1RM = Poids \times \left(1 + \frac{Reps}{30}\right)$$
    tracé en courbe d'évolution par exercice selon `session_date`.
  - **Tonnage / Volume par exercice** : Somme de $(Poids \times Reps)$ sur les séries effectives d'une séance.
  - **Volume hebdomadaire par groupe musculaire (Semaine Lundi → Dimanche)** : Compteur du nombre total de séries effectives réalisées sur la semaine calendaire par muscle, avec pondération **1 série = +1 pour le muscle principal (`primary_muscle`) et +0,5 pour chaque muscle secondaire (`secondary_muscles`)**.
  - **Détection automatique des PR (Personal Records)** : Attribution d'un badge en direct lorsqu'une série effective bat le record historique et les séries précédentes de la séance.
- **Calculateur de Maintenance Réelle (TDEE Dynamique sur 14 jours révolus)** :
  Croise la moyenne des calories ingérées sur les **14 derniers jours terminés ($J-14$ à $J-1$)** ($\overline{Kcal}_{14j}$) avec la variation du poids lissé ($\Delta EMA_{14j}$ de $J-14$ à $J$) :
  $$TDEE_{réel} = \overline{Kcal}_{14j} - \left( \frac{\Delta EMA_{14j} \times 7700}{14} \right)$$
  - **Stabilité quotidienne & Filtrage anti-bruit** :
    1. *Journée en cours exclue des calories* : La journée d'aujourd'hui ($J$) n'entre dans la moyenne calorique que le lendemain matin ($J+1$), garantissant un TDEE fixe toute la journée sans fluctuations aberrantes entre les repas.
    2. *Exclusion manuelle* : L'utilisateur peut cocher *"Exclure du calcul TDEE"* (`exclude_from_tdee = true`) sur n'importe quelle journée.
    3. *Exclusion automatique* : Toute journée révolue dont le total calorique est inférieur à **50 % de l'objectif du jour (`target_kcal`)** est automatiquement écartée de la moyenne $\overline{Kcal}_{14j}$.
    4. *Seuil de calibration* : Le TDEE chiffré s'affiche dès que la fenêtre comporte **au moins 10 journées nutritionnelles révolues valides** et **au moins 2 pesées espacées d'au moins 7 jours**.
- **Export des données (JSON + 3 fichiers CSV dédiés)** :
  - Export JSON complet (`exportUserDataJson`).
  - Export de 3 fichiers CSV (`exportUserDataCsvBundle`) :
    1. `daily_logs.csv` (Poids brut, Poids EMA 7j, Objectifs du jour, Exclusion TDEE).
    2. `nutrition_history.csv` (Historique détaillé des repas, quantités, calories et macros).
    3. `workout_history.csv` (Historique détaillé des séances, exercices, séries, charges, reps, 1RM Epley et PR).

---

## 3. Ordre de Développement Optimisé (Zéro Refactoring)

```text
[Phase 1 : Socle, Auth & BDD complète]
       │
       ├──► [Phase 2 : Profil, Snapshot Journalier & Poids (EMA)]
       │           │
       ├──► [Phase 3 : Catalogues Partagés (Exos, Aliments, Recettes)]
       │           │
       │           ├──► [Phase 4 : Moteur de Séance Muscu + Ghost Values + Presets]
       │           │
       │           └──► [Phase 5 : Journal Nutritionnel + Sous-menus Recettes]
       │                       │
       └───────────────────────┴──► [Phase 6 : Analytics, TDEE Croisé & Export 3 CSV]
```

---

## 4. Feuille de Route Future — Backlog V2 (TODOs)

### TODO V2.1 — API OpenFoodFacts & Scanner Code-Barres :
- Intégration de l'API REST gratuite OpenFoodFacts dans le formulaire d'ajout d'aliment (Phase 3).
- Utilisation de l'API caméra HTML5 (`html5-qrcode` ou `BarcodeDetector`) pour scanner les codes-barres directement depuis l'iPhone et pré-remplir les macros pour 100g.

### TODO V2.2 — Chronomètre de repos avancé (Web Audio & Dynamic Island) :
- Bandeau de minuteur flottant en bas de l'écran de séance, déclenché automatiquement à la validation d'une série.
- Signal sonore de fin de repos généré via Web Audio API (pour ne pas couper Spotify / Apple Music sur iOS).
- Bouton d'appel vers un Raccourci iOS (Shortcut) lançant le minuteur système natif sur la Dynamic Island et l'écran verrouillé.

### TODO V2.3 — Passerelle Apple Santé (Pas & Poids) & Widgets iOS :
- Création d'un endpoint API sécurisé (`/api/webhooks/ios-shortcuts`) dans Next.js.
- Configuration de 2 Raccourcis iOS sur l'iPhone (synchronisation nocturne des pas et widget de pesée rapide).
