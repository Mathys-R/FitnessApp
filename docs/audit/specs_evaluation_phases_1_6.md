# Évaluation Critique des Spécifications (Phases 1 à 6)

Audit d'exhaustivité, de précision et de clarté des spécifications fonctionnelles sous `docs/phases/`.
Référence : `docs/SPECIFICATION.md`, `PHASE_1_FOUNDATION.md` à `PHASE_6_ANALYTICS_AND_TDEE.md`.

---

## 1. Vue d'Ensemble & Maturité Globale des Spécifications

La documentation fonctionnelle sous `docs/phases/` présente un niveau de structuration élevé :
- **6 phases séquentielles cohérentes** : Découpage logique allant du socle PWA à l'analyse avancée TDEE.
- **Règles métier documentées avec exactitude** : Formules mathématiques (Epley, EMA $\alpha=0.25$, TDEE 14j révolus), fuseau horaire `Europe/Paris`, modèle de données des catalogues partagés.
- **Degré de préparation global** : ~85% des besoins sont exhaustivement spécifiés. Toutefois, plusieurs zones d'ombre, composants omis et détails ergonomiques mobiles doivent être clarifiés avant de confier le développement UI autonome aux agents.

---

## 2. Évaluation Détaillée Phase par Phase

### Phase 1 : Socle PWA, Authentification & Navigation (`PHASE_1_FOUNDATION.md`, 135 l.)
- **Points Forts** :
  - Métadonnées PWA iOS exhaustives (mode standalone, barre translucide, anti-zoom `userScalable: false`).
  - Palette OLED iOS et utilitaires CSS (`.ios-glass`, `.ios-card`, `.ios-input`) spécifiés.
  - Composant `BottomNav.tsx` déjà implémenté avec les 5 onglets et la Safe Area basse.
- **Zones d'Ombre & Gaps Identifiés** :
  - *Absence de spécification pour `auth.service.ts`* : La spec mentionne `LoginForm.tsx` sans spécifier le service d'authentification sous-jacent, risquant d'inciter à des appels directs à `supabase.auth` dans l'UI (violation Règle d'Or #3).
  - *Safe Area haute sur `PageHeader.tsx`* (l.118) : Spécifié avec `sticky top-0 z-30`, mais omet `pt-[env(safe-area-inset-top)]`, ce qui provoquera un chevauchement avec l'encoche / Dynamic Island sur iPhone.
  - *Feedback visuel d'erreur* : Le comportement d'erreur en cas de mot de passe erroné ou d'absence de réseau n'est pas formalisé.

### Phase 2 : Snapshot Journalier, Pesée & Lissage EMA (`PHASE_2_DAILY_SNAPSHOT_AND_WEIGHT.md`, 128 l.)
- **Points Forts** :
  - Recalcul en cascade de l'EMA 7 jours et exclusion manuelle du TDEE rigoureusement documentés.
  - Snapshot figé à minuit au fuseau de Paris pour immuniser l'historique contre les changements de profil.
- **Zones d'Ombre & Gaps Identifiés** :
  - *Gap de contrat `previousEmaKg`* (l.48) : Le composant `WeightQuickInput.tsx` requiert `previousEmaKg: number | null`, mais aucun helper dédié n'est spécifié côté `log.service.ts`.
  - *Affichage de l'état vide* (l.50) : `<NumberFlow value={dailyLog.weight_kg ?? 0} />` affichera `0 kg` au premier chargement. L'UI doit explicitement prévoir un état non pesé (`-- kg`).

### Phase 3 : Catalogues Partagés Couple (`PHASE_3_SHARED_CATALOGS.md`, 142 l.)
- **Points Forts** :
  - 40 exercices avec muscles primaires/secondaires et 10 groupes anatomiques fixes.
  - Aliments gérant les 3 modes de dosage (`100g`, `unit`, `both`).
  - Recettes Meal Prep stockant 1 portion de référence et divisant par le nombre de parts.
- **Zones d'Ombre & Gaps Identifiés** :
  - *États vides de recherche* : Aucun design d'état vide n'est prévu si la recherche dans le catalogue ne renvoie aucun aliment ou exercice.
  - *Gestion de la synchronisation temps réel* : La spec ne précise pas si les ajouts du partenaire doivent se mettre à jour en direct ou au rafraîchissement.

### Phase 4 : Moteur de Séance & Suivi Musculation (`PHASE_4_WORKOUT_ENGINE.md`, 168 l.)
- **Points Forts** :
  - Store Zustand persisté en `localStorage` anti-crash Safari iOS.
  - Ghost values 1-tap pré-remplissant automatiquement la charge et les répétitions de la séance précédente.
  - Détection dynamique de PR excluant les séries de régression. Double note (épinglée et séance).
- **Zones d'Ombre & Gaps Identifiés** :
  - *Composant `ExercisePickerDrawer` manquant* : La séance active doit permettre d'ajouter un exercice à la volée, mais ce tiroir de sélection n'est ni listé ni décrit dans la spec.
  - *Abandon / Annulation de séance* : `active-workout.store.ts` expose `clearActiveSession()`, mais aucun dialogue de confirmation n'est spécifié pour éviter une perte accidentelle de données.
  - *Création de Presets hors séance* : Le flux ne décrit que la création de presets en fin de séance (`finishAndSaveWorkoutSession`). La gestion des presets dans l'onglet Catalogues manque de spécification.

### Phase 5 : Journal Nutritionnel & Partage Couple (`PHASE_5_NUTRITION_JOURNAL.md`, 147 l.)
- **Points Forts** :
  - Jauge calorique et barres de macros instantanées avec NumberFlow.
  - Ajout express et plats décimaux (ex: portion 1.5x) avec sous-ingrédients clonés.
  - Copie instantanée de repas du partenaire via RPC sécurisée contre IDOR.
- **Zones d'Ombre & Gaps Identifiés** :
  - *Gap de contrat Couche 2* : `getDailyNutrition` ne joignant pas `foods (*)`, l'édition de portion dans `MealCard.tsx` est bloquée.
  - *Clavier iOS sur les tiroirs de saisie Vaul* : Nécessité de contraindre la hauteur du tiroir (`max-h-[85vh]`) pour éviter que le bouton de validation ne disparaisse sous le pavé numérique iOS.

### Phase 6 : Analytics, TDEE & Export de Données (`PHASE_6_ANALYTICS_AND_TDEE.md`, 154 l.)
- **Points Forts** :
  - TDEE 14 jours révolus insensible aux variations de la journée en cours.
  - Radar musculaire Recharts sur 10 groupes (+1 série effective / +0.5 si secondaire).
  - Export CSV sanitizé avec préfixe apostrophe anti-injection de formules (CWE-1236).
- **Zones d'Ombre & Gaps Identifiés** :
  - *Blocage de téléchargement multi-fichiers sur iOS Safari* : L'export simultané de 3 CSV déclenche le bloqueur de popups de Safari mobile. La spec doit imposer 3 boutons distincts ou un fichier ZIP.
  - *Squelettes de chargement* : Les graphiques Recharts nécessitent des Skeletons animés durant la récupération des données historiques.

---

## 3. Matrice de Préparation Spécification (Phases 1 à 6)

| Phase | Domaine Fonctionnel | Complétude Métier | Précision UI / Composants | Statut de Démarrage |
|---|---|:---:|:---:|---|
| **Phase 1** | Auth, Shell & Navigation | 95% | 85% | Prêt (avec ajout `auth.service.ts` & Safe Area) |
| **Phase 2** | Snapshot & Pesée EMA | 95% | 90% | Prêt (avec ajout helper `getPreviousWeightEma`) |
| **Phase 3** | 3 Catalogues Partagés | 90% | 85% | Prêt (avec design des états vides) |
| **Phase 4** | Moteur de Séance Muscu | 90% | 75% | Action requise (`ExercisePickerDrawer` & abandon) |
| **Phase 5** | Journal Nutrition & Copie | 90% | 80% | Action requise (jointure `foods` dans Couche 2) |
| **Phase 6** | Analytics, TDEE & Export | 95% | 85% | Prêt (adaptation export iOS multi-CSV) |

---

## 4. Recommandations pour l'Orchestrateur & les Agents Développeurs

1. **Fournir les briques manquantes en amont** : Résoudre les gaps de contrat Couche 2 (Auth service, helper EMA, jointure nutrition) avant de démarrer les composants correspondants.
2. **Encadrer les états vides et de chargement** : Utiliser systématiquement des squelettes de chargement (`Skeleton.tsx`) et des libellés explicites (`-- kg`, `Aucun aliment trouvé`).
3. **Valider les contraintes iOS Safari** : Safe Area haute (`env(safe-area-inset-top)`), hauteur des tiroirs Vaul, et téléchargements séparés.

