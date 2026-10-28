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
  - **Règle métier critique** : Modifier ses objectifs en Semaine 2 n'altère jamais les cibles et pourcentages de réussite des journées de la Semaine 1.

### Module B : Suivi du Poids & Lissage Mathématique
- **Saisie quotidienne** : Enregistrement d'une pesée par jour (modifiable) associée à une date.
- **Algorithme de lissage (EMA 7 jours)** :
  Calcul automatique de la Moyenne Mobile Exponentielle (EMA) sur 7 jours à chaque pesée pour gommer les variations hydriques dès le jour J :
  $$EMA_J = (Poids_J \times \alpha) + (EMA_{J-1} \times (1 - \alpha)) \quad \text{avec } \alpha = \frac{2}{7 + 1} = 0{,}25$$
- **Visualisation** : Graphique combinant les pesées brutes (points discrets) et la courbe de tendance EMA (ligne continue).

### Module C : Catalogue & Suivi de Musculation
- **Catalogue d'exercices** :
  - Initialisé via un fichier `exercises_seed.json` injecté en base relationnelle SQL, enrichissable par les utilisateurs.
  - **Attributs d'un exercice** : Nom, illustration/icône, muscle principal, muscles secondaires (stockés en `JSONB`), et Guide d'exécution général.
  - Recherche instantanée par texte + Bulles de filtres rapides (*Chips*) par groupe musculaire (Tous, Pecs, Dos, Épaules, Biceps, Triceps, Jambes, Abdos).
- **Système de double note sur un exercice** :
  - **Note épinglée** (Permanente - par utilisateur et par exercice) : Réglages de machine ou consignes perso (ex: *"Siège cran 4, prise neutre"*), toujours visible à chaque fois que l'exercice est chargé.
  - **Note de séance** (Temporaire - liée à la séance du jour) : Ressenti spécifique du jour (ex: *"Fatigue nerveuse, dernière rep lente"*).
- **Planification & Lancement de séance** :
  - **Calendrier hebdomadaire** : Vue sur la semaine permettant d'assigner à un jour une séance réalisée, une séance planifiée ou un jour de repos.
  - **Séance Vierge** : Création à la volée avec nom personnalisé et ajout d'exercices au fil de l'eau.
  - **Presets (Modèles de séances)** : Sauvegarde d'une structure de séance complète (exercices, nombre de séries, temps de repos cibles) réutilisable en 1 clic.
- **Exécution & Saisie des séries** :
  - Pour chaque série : Poids (kg), Répétitions, Temps de repos cible (s), statut Validé.
  - **Ghost Values (Valeurs fantômes)** : Lors de l'ajout d'un exercice (via Preset ou séance vierge), le système interroge la dernière séance validée contenant cet exercice et pré-remplit les champs en filigrane avec les charges et répétitions précédentes.

### Module D : Catalogue & Suivi Nutritionnel
- **Structure du journal quotidien** :
  - Jauge globale de la journée (Calories restantes / consommées + barres de progression Protéines, Glucides, Lipides par rapport au Snapshot du jour).
  - Découpage par catégories de repas : Petit-déjeuner, Déjeuner, Dîner, Collation, Pré/Post-workout.
- **3 Modes de saisie d'un élément dans un repas** :
  - **Ajout rapide (Quick Add)** : Saisie directe de calories et/ou macros libres avec un intitulé optionnel.
  - **Aliment simple du catalogue** : Sélection d'un aliment (défini pour 100g ou par unité), saisie de la quantité consommée, calcul proportionnel automatique.
  - **Plat composé (Recette) avec sous-menu dépliable** :
    - Création d'un plat en assemblant plusieurs aliments simples et leurs quantités de référence.
    - Lors de l'ajout du plat dans le journal du jour, le plat crée une entrée parente (affichant le total des macros) contenant ses ingrédients en sous-lignes dépliables.
    - **Surcharge locale (Override)** : L'utilisateur peut modifier la quantité d'un ingrédient dans le sous-menu de sa journée (ex: passer le riz de 100g à 130g ce midi) sans modifier la recette de base dans le catalogue partagé.

### Module E : Analytics, Croisement de Données & Export
- **Indicateurs de performance Musculation (4 KPIs)** :
  - **1RM Théorique (Formule d'Epley)** :
    $$1RM = Poids \times \left(1 + \frac{Reps}{30}\right)$$
    tracé en courbe d'évolution par exercice.
  - **Tonnage / Volume par exercice** : Somme de $(Poids \times Reps)$ sur les séries effectives d'une séance.
  - **Volume hebdomadaire par groupe musculaire** : Compteur du nombre total de séries effectives réalisées sur la semaine par muscle.
  - **Détection automatique des PR (Personal Records)** : Attribution d'un badge lorsqu'une série bat le record historique de poids ou de 1RM théorique sur l'exercice.
- **Calculateur de Maintenance Réelle (TDEE Dynamique sur 14 jours)** :
  Croise la moyenne des calories ingérées ($\overline{Kcal}_{14j}$) avec la variation du poids lissé ($\Delta EMA_{14j}$) sur une fenêtre glissante de 14 jours :
  $$TDEE_{réel} = \overline{Kcal}_{14j} - \left( \frac{\Delta EMA_{14j} \times 7700}{14} \right)$$
- **Export des données** : Téléchargement de l'historique (Poids, Nutrition, Séances) aux formats CSV et JSON.

---

## 3. Ordre de Développement Optimisé (Zéro Refactoring)

Pour éviter de devoir réécrire du code ou modifier des écrans déjà construits, l'ordre de construction suit strictement l'arbre des dépendances de données (du socle le plus bas vers les écrans d'agrégation).

```text
[Phase 1 : Socle, Auth & BDD complète]
       │
       ├──► [Phase 2 : Profil, Snapshot Journalier & Poids (EMA)]
       │           │
       ├──► [Phase 3 : Catalogues Partagés (Exos, Aliments, Recettes)]
       │           │
       │           ├──► [Phase 4 : Moteur de Séance Muscu + Ghost Values]
       │           │
       │           └──► [Phase 5 : Journal Nutritionnel + Sous-menus Recettes]
       │                       │
       └───────────────────────┴──► [Phase 6 : Analytics, TDEE Croisé & Export]
```

### Pourquoi cet ordre est critique :

- **Phase 1 — Schéma SQL complet, RLS & Coquille PWA (Navigation + Auth)** :
  - *Pourquoi en 1er* : On crée toutes les tables SQL dès le départ. Ainsi, les types TypeScript générés automatiquement par Supabase (`database.types.ts`) sont complets dès le jour 1. Aucun composant n'aura besoin d'être refactorisé pour un changement de colonne plus tard.
- **Phase 2 — Profil Utilisateur, Moteur de Snapshot Quotidien & Suivi du Poids (EMA)** :
  - *Pourquoi en 2e* : Le journal nutritionnel (Phase 5) et le calculateur de maintenance (Phase 6) dépendent de l'existence d'une entité "Journée" (`daily_logs`) qui fige les objectifs caloriques du jour et stocke le poids. C'est aussi le module le plus simple pour valider toute la chaîne (Saisie UI → Supabase → Graphique EMA).
- **Phase 3 — Les Catalogues Partagés (Exercices + Aliments + Plats composés)** :
  - *Pourquoi avant le tracking* : Impossible de tester proprement une séance ou un repas sans avoir d'abord les entités de base. Construire le CRUD des aliments et des recettes composées ici permet de figer la structure des macros avant de coder le journal journalier.
- **Phase 4 — Le Moteur de Musculation (Presets, Séance active, Ghost Values, PR)** :
  - *Pourquoi indépendant* : Il s'appuie uniquement sur l'Auth (Phase 1) et le Catalogue d'exercices (Phase 3). On implémente la logique de récupération de la dernière performance (Ghost Values) directement sous forme de fonction/requête réutilisable.
- **Phase 5 — Le Journal Nutritionnel Quotidien (Quick Add, Aliments, Dépliage de Recettes)** :
  - *Pourquoi après les Phases 2 et 3* : Lorsqu'on ajoute un "Plat composé" dans un repas du jour, l'application doit "cloner" les ingrédients de la recette dans le journal du jour pour permettre de modifier le grammage d'un ingrédient à la volée sans casser la recette du catalogue. Avoir le catalogue (Phase 3) et le Snapshot du jour (Phase 2) déjà prêts rend cette étape fluide.
- **Phase 6 — Tableaux de Bord, Analytics Muscu & Calculateur de Maintenance (TDEE)** :
  - *Pourquoi en dernier* : Ce module est en lecture seule (*Read-Only*). Il consomme les données des Phases 2, 4 et 5 pour afficher les courbes de 1RM, les volumes par muscle, le TDEE réel et l'export CSV/JSON.

---

## 4. Feuille de Route Future — Backlog V2 (TODOs)

Ces fonctionnalités sont prises en compte dans la conception pour ne jamais être bloquées par l'architecture V1, mais seront développées une fois la V1 en production :

### TODO V2.1 — API OpenFoodFacts & Scanner Code-Barres :
- Intégration de l'API REST gratuite OpenFoodFacts dans le formulaire d'ajout d'aliment (Phase 3).
- Utilisation de l'API caméra HTML5 (`html5-qrcode` ou `BarcodeDetector`) pour scanner les codes-barres directement depuis l'iPhone et pré-remplir les macros pour 100g.

### TODO V2.2 — Chronomètre de repos avancé (Web Audio & Dynamic Island) :
- Bandeau de minuteur flottant en bas de l'écran de séance, déclenché automatiquement à la validation d'une série.
- Signal sonore de fin de repos généré via Web Audio API (pour ne pas couper Spotify / Apple Music sur iOS).
- Bouton d'appel vers un Raccourci iOS (Shortcut) lançant le minuteur système natif sur la Dynamic Island et l'écran verrouillé.

### TODO V2.3 — Passerelle Apple Santé (Pas & Poids) & Widgets iOS :
- Création d'un endpoint API sécurisé (`/api/webhooks/ios-shortcuts`) dans Next.js.
- Configuration de 2 Raccourcis iOS sur l'iPhone :
  - Automatisation nocturne envoyant automatiquement le nombre de pas quotidien d'Apple Santé vers la table `daily_logs`.
  - Widget sur l'écran d'accueil iOS permettant de saisir son poids du matin en 2 secondes (enregistrement simultané dans Apple Santé et dans Supabase).
