# PLAN.md — « Muse » : un Duolingo de la culture (musique classique & art)

> Ce document est le cahier des charges du projet. Lis-le en entier avant d'écrire du code.
> Travaille **phase par phase**, dans l'ordre. À la fin de chaque phase : vérifie les critères
> d'acceptation, lance les tests, fais un commit, puis **arrête-toi et attends ma validation**
> avant de passer à la phase suivante.

---

## 1. Contexte et objectifs

Application personnelle (un seul utilisateur : moi) pour apprendre la culture à la manière de
Duolingo : sessions courtes (3 à 5 min), progression par unités, répétition espacée, gamification
légère. On y apprend surtout à **reconnaître** : un compositeur à l'écoute d'un extrait, un peintre
ou un mouvement en voyant un tableau, situer des œuvres dans le temps.

Deux parcours au départ : **Musique classique** puis **Peinture occidentale**.

### Contraintes non négociables

- **Pas d'App Store, pas de compte Apple Developer.** L'app est une **PWA** installée sur iPhone
  via Safari → « Sur l'écran d'accueil ».
- **Aucun backend.** Tout tourne côté client. Le contenu est statique (fichiers JSON + médias),
  la progression est stockée localement (IndexedDB).
- **Hébergement gratuit** : GitHub Pages, déploiement automatique via GitHub Actions.
- **Fonctionne hors ligne** une fois les contenus d'une unité téléchargés.
- **Interface en français.** Code, noms de variables et commentaires en anglais.
- **Médias libres de droits uniquement** (domaine public, CC0, CC BY, CC BY-SA), avec le crédit et
  la licence conservés pour chaque fichier.

---

## 2. Stack technique

| Rôle | Choix |
|---|---|
| Build / dev | Vite (dernière version stable) + TypeScript strict |
| UI | React + Tailwind CSS |
| Routing | React Router, avec `basename` compatible GitHub Pages |
| PWA | `vite-plugin-pwa` (Workbox) |
| Stockage local | IndexedDB via **Dexie** |
| Répétition espacée | **`ts-fsrs`** |
| Validation du contenu | **zod** (schémas partagés entre l'app et les scripts) |
| Tests | **Vitest** (logique) ; Playwright facultatif pour un test de fumée |
| Scripts de contenu | Node + TypeScript (`tsx`), **sharp** pour les images, **ffmpeg** pour l'audio |

Pas d'autres dépendances lourdes sans me demander.

---

## 3. Structure du dépôt

```
/
├── PLAN.md
├── README.md                  # comment lancer, ajouter du contenu, déployer
├── content/                   # SOURCE de vérité éditable à la main
│   ├── courses/
│   │   ├── music.yaml         # unités, leçons, ordre
│   │   └── art.yaml
│   ├── entities/              # œuvres, artistes, mouvements, périodes, concepts
│   └── manifests/
│       └── music-audio.yaml   # extraits audio choisis manuellement (URL, début, durée)
├── scripts/
│   ├── ingest-wikidata.ts     # requêtes SPARQL → entités
│   ├── fetch-media.ts         # téléchargement + conversion des médias
│   ├── build-content.ts       # validation zod + génération de public/content/*.json
│   └── lib/
├── public/
│   ├── content/               # JSON GÉNÉRÉS (ne pas éditer à la main)
│   ├── media/                 # images et audio GÉNÉRÉS
│   └── icons/
├── src/
│   ├── app/                   # routes, layout
│   ├── features/
│   │   ├── home/              # parcours, série, objectif du jour
│   │   ├── session/           # déroulé d'une session d'exercices
│   │   ├── exercises/         # un composant par type d'exercice
│   │   ├── collection/        # « musée personnel »
│   │   ├── stats/
│   │   └── settings/          # export/import, téléchargement hors ligne
│   ├── engine/                # logique pure, testée : sessions, distracteurs, FSRS, XP
│   ├── content/               # chargement et index du contenu
│   ├── db/                    # schéma Dexie et accès
│   └── schemas/               # schémas zod partagés
└── .github/workflows/deploy.yml
```

Règle : **tout ce qui est dans `src/engine/` est du TypeScript pur, sans React ni IndexedDB**, et
est couvert par des tests Vitest.

---

## 4. Modèle de données

### 4.1 Contenu (statique)

```ts
type EntityType = "work" | "person" | "movement" | "period" | "concept" | "instrument";

interface Entity {
  id: string;               // slug stable, ex. "debussy-clair-de-lune"
  type: EntityType;
  name: string;             // nom affiché en français
  wikidataId?: string;      // ex. "Q193935"
  year?: number;            // œuvres : année de création (approx. acceptée)
  yearEnd?: number;         // personnes : mort ; périodes : fin
  yearStart?: number;       // personnes : naissance ; périodes : début
  summary: string;          // 1 à 3 phrases en français, montrées après la réponse
  mediaIds: string[];
  tags?: string[];          // ex. "piano", "nocturne", "portrait"
}

interface Relation {
  from: string;             // entity id
  type: "createdBy" | "belongsTo" | "inPeriod" | "influencedBy" | "features";
  to: string;               // entity id
}

interface MediaAsset {
  id: string;
  kind: "image" | "audio";
  src: string;              // chemin relatif dans public/media
  variants?: { width: number; src: string }[];   // images : 480, 960, 1600 px
  durationSec?: number;     // audio
  credit: string;           // auteur / interprète / institution
  license: string;          // "Public domain", "CC0", "CC BY-SA 4.0"…
  sourceUrl: string;
}

interface Lesson {
  id: string;
  title: string;
  introduces: string[];     // ids des entités nouvelles dans cette leçon
  skills: Skill[];          // compétences travaillées
}

interface Unit { id: string; title: string; description: string; lessons: Lesson[] }
interface Course { id: "music" | "art"; title: string; units: Unit[] }
```

Le build produit dans `public/content/` : `index.json` (liste des parcours et versions), puis un
fichier par parcours contenant ses unités, entités, relations et médias.

### 4.2 Compétences et cartes de révision

Une **carte** = une entité × une compétence. On ne révise pas « Clair de lune » en général, mais
« reconnaître Clair de lune à l'écoute » ou « dater Clair de lune ».

```ts
type Skill =
  | "audio-to-composer"    // entendre l'extrait → choisir le compositeur
  | "audio-to-period"      // entendre l'extrait → choisir la période
  | "image-to-artist"      // voir le tableau → choisir l'artiste
  | "image-to-movement"    // voir le tableau → choisir le mouvement
  | "work-to-date"         // situer une œuvre dans le temps
  | "concept-definition";  // associer un concept à sa définition
```

### 4.3 Données utilisateur (IndexedDB / Dexie)

```ts
// tables Dexie
cards:     { id: `${entityId}:${skill}`, entityId, skill, fsrs: Card /* ts-fsrs */, introducedAt }
reviewLog: { ++id, cardId, rating, answeredAt, durationMs, correct }
lessons:   { lessonId, completedAt, bestScore }
daily:     { date /* YYYY-MM-DD local */, xp, minutes, sessions }
settings:  { key, value }   // objectif du jour, son, thème…
```

Appeler `navigator.storage.persist()` au premier lancement.

---

## 5. Moteur d'apprentissage (`src/engine/`)

### 5.1 Construction d'une session

`buildSession({ courseId, mode, now, cards, content }) → Exercise[]`

- **Mode leçon** : environ 12 exercices. Introduire les entités de la leçon (première rencontre =
  exercice facile avec la réponse « présentée » juste avant), puis les faire retravailler, en
  intercalant 2 à 4 cartes de révision dues.
- **Mode révision** : jusqu'à 15 cartes dues, triées par date d'échéance, en mélangeant les
  compétences. S'il n'y a rien de dû, proposer les cartes les plus fragiles (stabilité faible).
- Ne jamais enchaîner deux fois la même entité. Alterner audio, image et texte autant que possible.

### 5.2 Notation FSRS

Adaptateur autour de `ts-fsrs` :

- Mauvaise réponse → `Again`
- Bonne réponse → `Good`
- Bonne réponse très rapide (seuil configurable, ex. < 4 s sur un QCM) → `Easy`
- Une carte ratée dans la session est reproposée en fin de session (sans nouvelle notation FSRS).

### 5.3 Distracteurs

`pickDistractors(answer, skill, content, mastery) → Entity[]` (3 distracteurs pour un QCM à 4) :

- Toujours du **même type** que la bonne réponse (un compositeur contre des compositeurs).
- Les choisir dans le même parcours, en favorisant **les entités déjà rencontrées**.
- Plus la carte est maîtrisée, plus les distracteurs sont **proches** : même période, même
  mouvement, dates voisines. Une carte nouvelle → distracteurs faciles (époques différentes).
- Résultat déterministe pour une graine donnée (pour les tests).

### 5.4 XP et série

- XP : +10 par bonne réponse, +5 bonus de leçon terminée, +5 bonus de session sans faute.
- La série compte les jours (heure locale) où l'objectif du jour est atteint.
- Objectif du jour par défaut : 1 session. Réglable.

### 5.5 Tests requis

Tests Vitest sur : construction de session (taille, pas de doublon consécutif, présence des
révisions dues), distracteurs (bon type, pas de doublon, pas la bonne réponse, difficulté
croissante), adaptateur FSRS, calcul de série (y compris changement de jour et jour manqué), XP.

---

## 6. Types d'exercices (`src/features/exercises/`)

Chaque type est un composant qui reçoit un `Exercise` et renvoie `{ correct, durationMs }`.

1. **QCM audio** : bouton lecture (grand, centré), 4 réponses. Rejouer autorisé.
2. **QCM image** : image en grand, zoom au pincement ou au tap, 4 réponses.
3. **Détail** : on ne montre qu'un recadrage d'un tableau (via `object-position` + zoom CSS) →
   retrouver l'œuvre ou l'artiste.
4. **Chronologie** : remettre 3 ou 4 œuvres dans l'ordre. Interaction **par taps successifs**
   (pas de glisser-déposer, peu fiable sur iOS Safari).
5. **Association** : relier 4 paires (œuvre ↔ auteur, concept ↔ définition) par taps.
6. **Vrai / faux** : affirmation générée depuis une relation (vraie ou falsifiée).

Après chaque réponse : retour visuel (vert / rouge), bonne réponse, `summary` de l'entité, et
crédit du média en petit. Bouton « Continuer » en bas d'écran, accessible au pouce.

Au moins la moitié des exercices d'une session doivent être sensoriels (audio ou image).

---

## 7. Pipeline de contenu (`scripts/`)

### 7.1 Ingestion Wikidata (`ingest-wikidata.ts`)

Requêtes SPARQL sur `https://query.wikidata.org/sparql` (avec un User-Agent explicite) pour
récupérer, à partir d'une **liste d'identifiants Wikidata que je fournis** dans
`content/entities/*.yaml` :

- œuvres : créateur (P86 compositeur / P170 créateur), date (P571), mouvement (P135),
  image (P18), audio (P51), collection (P195) ;
- personnes : dates de naissance / mort (P569 / P570), mouvement (P135) ;
- libellés en français (repli sur l'anglais si absent, à signaler dans le rapport).

Le script **complète** les fichiers YAML sans écraser ce que j'ai écrit à la main. Il produit un
rapport des champs manquants.

### 7.2 Médias (`fetch-media.ts`)

- **Images** : depuis Wikimedia Commons (via P18) ou les API open access des musées.
  Récupérer la licence et l'auteur via l'API Commons (`imageinfo` + `extmetadata`).
  Conversion avec sharp en WebP aux largeurs 480, 960 et 1600 px.
- **Audio** : depuis P51 (Commons) ou depuis `content/manifests/music-audio.yaml`, où je
  renseigne à la main l'URL d'un enregistrement libre, le début et la durée de l'extrait.
  Découpage avec ffmpeg : 15 à 25 s, fondu d'entrée et de sortie de 0,5 s, normalisation
  du volume (`loudnorm`), encodage **AAC en `.m4a`** (le format le plus sûr sur iOS).
- Refuser tout fichier dont la licence n'est pas dans la liste autorisée, et le signaler.
- Ne pas retélécharger ce qui existe déjà (cache).

### 7.3 Build (`build-content.ts`)

Valide tout le contenu avec zod (ids uniques, relations pointant vers des entités existantes,
médias présents, chaque leçon introduit au moins 3 entités…), puis écrit `public/content/`.
Le build échoue avec des messages clairs en cas d'erreur.

Scripts npm : `content:ingest`, `content:media`, `content:build`, et `content` qui enchaîne les trois.

### 7.4 Contenu de départ

Prépare toi-même un premier jeu de données pour la phase 2 :

- **Musique, unité 1 « Les grands repères »** : environ 8 compositeurs couvrant baroque,
  classique, romantique et début XXe (ex. Bach, Vivaldi, Mozart, Beethoven, Chopin, Tchaïkovski,
  Debussy, Ravel), 3 ou 4 œuvres célèbres chacun, les 4 périodes.
- Le `summary` de chaque entité doit s'appuyer sur les données Wikidata et rester factuel et
  sobre. Signale dans un fichier `content/TO_REVIEW.md` toute affirmation dont tu n'es pas sûr.

---

## 8. Spécificités PWA et iPhone

- Manifeste : `name`, `short_name`, `display: "standalone"`, `theme_color`, `background_color`,
  icônes 192 et 512 px, `start_url` et `scope` compatibles avec le sous-chemin GitHub Pages.
- Dans `index.html` : `apple-touch-icon` (180 px), `apple-mobile-web-app-capable`,
  `apple-mobile-web-app-status-bar-style`, `viewport-fit=cover`.
- Respecter les zones sûres : `env(safe-area-inset-*)`. Utiliser `100dvh`, jamais `100vh`.
- Cibles tactiles d'au moins 44 px. Désactiver le zoom accidentel au double tap sur les boutons.
- Audio : ne lancer la lecture qu'après un tap. Précharger l'extrait suivant pendant l'exercice
  courant. Tester le comportement quand le téléphone est en mode silencieux et l'indiquer dans
  le README.
- Service worker :
  - précache de l'app (shell) ;
  - `CacheFirst` pour `/media/*`, `StaleWhileRevalidate` pour `/content/*.json` ;
  - un écran Réglages avec « Télécharger le parcours pour le hors ligne » (barre de progression,
    taille estimée) et « Libérer l'espace ».
- Mise à jour : quand une nouvelle version est disponible, afficher un bandeau discret
  « Nouvelle version — Recharger ».
- Mode sombre automatique (`prefers-color-scheme`).

---

## 9. Écrans

1. **Accueil** : choix du parcours, série en cours, XP du jour et objectif, bouton principal
   « Continuer » (prochaine leçon), bouton « Réviser (N) » si des cartes sont dues.
2. **Parcours** : arbre vertical des unités et leçons (verrouillées, en cours, terminées).
3. **Session** : barre de progression, exercice, retour, écran de fin (XP gagnés, précision,
   nouvelles œuvres ajoutées à la collection).
4. **Collection** : grille des œuvres rencontrées, filtrable par parcours / période ; fiche
   détaillée avec image ou lecteur audio, résumé, crédits, niveau de maîtrise.
5. **Statistiques** : historique XP sur 30 jours, nombre de cartes par état, points faibles
   (paires d'entités les plus souvent confondues, calculées depuis `reviewLog`).
6. **Réglages** : objectif du jour, son on/off, hors ligne, **export / import de la progression
   en JSON**, réinitialisation (avec confirmation).

Style : sobre et élégant (inspiration musée), une typographie à empattements pour les titres,
animations légères. Pas de surcharge façon jeu vidéo.

---

## 10. Phases

### Phase 1 — Squelette installable

- Initialiser le projet (Vite, TS strict, Tailwind, Router, Vitest, ESLint, Prettier).
- PWA configurée, icônes provisoires, workflow GitHub Actions de déploiement sur GitHub Pages.
- Écran d'accueil factice et un exercice QCM image codé en dur.

**Critères :** `npm run build` et `npm test` passent ; le site déployé s'installe sur iPhone,
s'ouvre en plein écran, et se relance hors ligne.

### Phase 2 — Contenu et pipeline

- Schémas zod, scripts `ingest`, `media`, `build`.
- Contenu de départ de l'unité musique 1 (section 7.4).
- Chargement du contenu dans l'app, écran Parcours.

**Critères :** `npm run content` régénère tout sans erreur ; chaque média a un crédit et une
licence autorisée ; l'écran Parcours affiche l'unité réelle.

### Phase 3 — Moteur et sessions

- `src/engine/` complet avec ses tests (section 5).
- Dexie, adaptateur FSRS, déroulé complet d'une session.
- Exercices : QCM audio, QCM image, chronologie, vrai / faux.

**Critères :** je peux faire une leçon de bout en bout ; les cartes apparaissent ensuite dans
« Réviser » au bon moment ; tous les tests de la section 5.5 passent.

### Phase 4 — Motivation et confort

- XP, série, objectif du jour, écran de fin de session.
- Collection, statistiques, réglages (export / import inclus).
- Exercices association et détail.
- Hors ligne complet (téléchargement du parcours), bandeau de mise à jour.

**Critères :** l'app est entièrement utilisable en mode avion après téléchargement ;
un export suivi d'une réinitialisation puis d'un import restaure exactement la progression.

### Phase 5 — Parcours Art

- Ingestion des tableaux (Commons + API musées), unité art 1 « Grands mouvements de la
  peinture » (Renaissance, baroque, impressionnisme, postimpressionnisme, cubisme… avec des
  œuvres du domaine public).
- Compétences `image-to-artist`, `image-to-movement`, `work-to-date` actives sur ce parcours.

**Critères :** même niveau de finition que le parcours musique.

### Phase 6 — Ensuite (à discuter)

Unités supplémentaires, nouveaux thèmes (opéra, architecture, jazz), défi quotidien
(une œuvre mystère par jour), synchronisation entre appareils (Supabase, offre gratuite).

---

## 11. Façon de travailler

- Une phase à la fois ; arrête-toi à la fin de chacune pour validation.
- Commits petits et explicites (style Conventional Commits).
- Avant de déclarer une phase terminée : `npm run lint`, `npm test`, `npm run build`.
- Tiens le `README.md` à jour (installation, commandes, ajout de contenu, déploiement,
  installation sur iPhone).
- Si une décision de conception n'est pas couverte par ce plan, choisis l'option la plus simple
  et note-la dans `DECISIONS.md` en une ou deux lignes.
- En cas de doute sur une licence ou un fait historique, ne devine pas : signale-le dans
  `content/TO_REVIEW.md`.
