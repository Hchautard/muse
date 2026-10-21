# Muse

Un « Duolingo de la culture » : sessions de 3 à 5 minutes pour apprendre à **reconnaître** la
musique classique et la peinture occidentale. Application web installable (PWA), sans backend :
le contenu est statique, la progression reste sur l'appareil.

Le cahier des charges complet est dans [`PLAN.md`](PLAN.md), les choix de conception dans
[`DECISIONS.md`](DECISIONS.md).

> **État : phase 4** — parcours « Musique classique », unité 1 « Les grands repères » (8 leçons,
> 24 œuvres avec extraits) : sessions et répétition espacée, collection, statistiques, réglages,
> sauvegarde de la progression et téléchargement hors ligne. Le parcours Peinture arrive en
> phase 5.

## Prérequis

- Node.js ≥ 22.12 (voir `.nvmrc`)
- npm 10+
- Pour les scripts de contenu : `ffmpeg` et `ffprobe` dans le `PATH`

## Commandes

| Commande             | Rôle                                                       |
| -------------------- | ---------------------------------------------------------- |
| `npm install`        | Installer les dépendances                                  |
| `npm run dev`        | Serveur de développement (service worker désactivé)        |
| `npm run build`      | Vérification TypeScript + build de production dans `dist/` |
| `npm run preview`    | Servir `dist/` localement (service worker actif)           |
| `npm test`           | Tests Vitest (une passe)                                   |
| `npm run test:watch` | Tests en continu                                           |
| `npm run lint`       | ESLint                                                     |
| `npm run format`     | Formater avec Prettier (`format:check` pour vérifier)      |
| `npm run icons`      | Régénérer les icônes PNG depuis `public/icons/icon.svg`    |
| `npm run content`    | Pipeline de contenu complet (les trois étapes ci-dessous)  |
| `content:ingest`     | Compléter `content/entities/*.yaml` depuis Wikidata        |
| `content:media`      | Télécharger et convertir images et extraits audio          |
| `content:build`      | Valider le contenu et générer `public/content/*.json`      |

Pour reproduire localement le build de GitHub Pages (servi sous `/muse/`) :

```sh
BASE_PATH=/muse/ npm run build && BASE_PATH=/muse/ npm run preview
# puis ouvrir http://localhost:4173/muse/
```

> Sous Git Bash (Windows), préfixer par `MSYS_NO_PATHCONV=1`, sinon `/muse/` est réécrit en
> chemin Windows.

## Structure

```
content/          SOURCE éditable à la main (YAML)
├── courses/      unités et leçons de chaque parcours
├── entities/     œuvres, compositeurs, périodes…
├── manifests/    extraits audio choisis à la main
├── generated/    registre des médias (écrit par content:media)
└── TO_REVIEW.md  affirmations, dates et licences à vérifier
scripts/          pipeline de contenu (Node + TypeScript, lancé avec tsx)
src/
├── app/          routes, layout, bandeau de mise à jour
├── content/      chargement et index du contenu
├── db/           progression dans IndexedDB (Dexie)
├── engine/       logique pure, sans React ni IndexedDB, couverte par Vitest
├── features/     un dossier par écran : home, course, session, exercises, collection, stats,
│                 settings (dont le téléchargement hors ligne)
├── schemas/      schémas zod partagés par l'app et les scripts
└── ui/           composants partagés
public/
├── content/      JSON GÉNÉRÉS (ne pas éditer)
├── media/        images et audio GÉNÉRÉS
└── icons/
```

## Sessions et révisions

- **Leçon** (« Continuer » sur l'accueil, ou une leçon du Parcours) : une douzaine d'exercices.
  Chaque nouvelle œuvre est d'abord présentée (compositeur, date, période, écoute), puis
  interrogée ; 2 à 4 révisions dues sont intercalées.
- **Révision** (« Réviser (N) » sur l'accueil, quand des cartes sont dues) : jusqu'à 15 cartes,
  les plus en retard d'abord.
- Une **carte** est une œuvre × une compétence (reconnaître le compositeur à l'écoute, la
  période, dater l'œuvre). Chaque carte est planifiée par [FSRS](https://github.com/open-spaced-repetition/ts-fsrs),
  au jour près : une erreur la fait revenir le lendemain, une bonne réponse quelques jours plus
  tard, une réponse très rapide encore plus tard. Une carte ratée revient une seconde fois en fin
  de session, sans nouvelle notation.
- Exercices : QCM audio, QCM image, vrai / faux, chronologie (toucher les œuvres dans l'ordre),
  **association** (relier quatre extraits ou tableaux à leur compositeur, peintre, période ou
  mouvement ; quatre notions à leur définition) et **détail** (un gros plan du tableau seulement).
  Une carte nouvelle est toujours posée en QCM ; vrai / faux, association et détail viennent quand
  elle est mieux connue. Au moins la moitié de chaque session fait écouter ou voir. Le QCM image et
  le détail servent au parcours Peinture (phase 5).
- Quitter une session en cours n'enregistre rien. Une session terminée met à jour les cartes, le
  journal des réponses, la leçon, les XP et la série ; l'écran de fin montre les XP, la précision,
  l'objectif du jour et les œuvres ajoutées à la collection.

## Collection, statistiques, réglages

La barre du bas mène à quatre écrans :

- **Accueil** : objectif du jour, série, prochaine leçon et révisions dues.
- **Collection** : les œuvres rencontrées, filtrables par période ; chaque fiche permet de
  réécouter (ou revoir) l'œuvre et montre son crédit et sa maîtrise compétence par compétence.
- **Statistiques** : séries, XP des 30 derniers jours, cartes par niveau (en apprentissage, en
  consolidation, maîtrisées) et points faibles (ce qui est le plus souvent confondu).
- **Réglages** : objectif du jour (1 à 5 sessions), effets sonores, hors ligne, sauvegarde.

## Hors ligne

Dans **Réglages → Hors ligne**, « Télécharger » enregistre tous les médias d'un parcours (taille
affichée, barre de progression, annulable) ; l'app est ensuite entièrement utilisable en mode
avion. « Libérer l'espace » les retire ; ils seront de nouveau chargés à l'usage.

Sans téléchargement, l'app fonctionne aussi hors ligne, mais seulement avec les médias déjà
écoutés ou vus. Sur iPhone, les données d'une app ajoutée à l'écran d'accueil sont conservées ; dans un
simple onglet Safari, elles peuvent être effacées après 7 jours d'utilisation de Safari sans
visite du site (d'où l'intérêt de l'export).

## Sauvegarde de la progression

La progression est stockée **sur l'appareil** (IndexedDB) ; l'app demande au navigateur de la
conserver durablement (`navigator.storage.persist()`).

- **Exporter** (Réglages → Progression) produit un fichier `muse-progression-AAAA-MM-JJ.json`.
  Sur iPhone, la feuille de partage s'ouvre : choisir « Enregistrer dans Fichiers » (ou s'envoyer
  le fichier).
- **Importer** relit ce fichier et remplace, après confirmation, toute la progression de
  l'appareil (cartes, historique, leçons, jours, réglages) : c'est ainsi qu'on la restaure ou
  qu'on la transfère sur un autre appareil.
- **Réinitialiser** efface la progression (pas les réglages), après confirmation.

## Déploiement (GitHub Pages)

Le workflow [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) lance lint, tests et
build à chaque push sur `main`, puis publie `dist/` sur GitHub Pages.

Mise en place, une seule fois :

1. Créer un dépôt sur GitHub (public : GitHub Pages est gratuit pour les dépôts publics) et y
   pousser ce dépôt :
   ```sh
   git remote add origin https://github.com/<utilisateur>/muse.git
   git push -u origin main
   ```
2. Sur GitHub : **Settings → Pages → Build and deployment → Source : GitHub Actions**.
3. Relancer le workflow si le premier passage a échoué faute de Pages activé
   (**Actions → Deploy to GitHub Pages → Run workflow**).

Le site est alors servi sur `https://<utilisateur>.github.io/<nom-du-repo>/`. Le sous-chemin est
déduit automatiquement du nom du dépôt. (Exception : un dépôt nommé `<utilisateur>.github.io` est
servi à la racine ; il faudrait alors fixer `BASE_PATH: /` dans le workflow.)

## Installation sur iPhone

1. Ouvrir l'URL du site dans **Safari** (depuis iOS 16.4, Chrome et Edge savent aussi ajouter
   une PWA à l'écran d'accueil, mais Safari reste la référence).
2. Bouton **Partager** → **Sur l'écran d'accueil** → **Ajouter**.
3. Lancer Muse depuis l'icône : l'app s'ouvre en plein écran, sans barre Safari.
4. Après un premier lancement en ligne, l'app se relance **hors ligne** (mode avion compris).
   Pour disposer de tous les extraits sans réseau, télécharger le parcours dans **Réglages →
   Hors ligne**.

Mises à jour : quand une nouvelle version est publiée, un bandeau « Nouvelle version —
Recharger » apparaît en haut de l'écran.

> **Mode silencieux** : les extraits sont lus par un élément `<audio>` (lecture multimédia, comme
> une app de musique), et sur Safari 17+ l'app déclare `navigator.audioSession.type = 'playback'`.
> Ils devraient donc s'entendre même commutateur silencieux activé, au volume « multimédia ».
> **Non vérifié sur un iPhone réel** (les tests ont été faits dans un navigateur de bureau) : si
> rien ne s'entend en mode silencieux, désactiver le commutateur et le signaler ici.
> La lecture ne démarre jamais seule : il faut toucher le bouton de lecture. Les effets sonores
> (après chaque réponse) suivent le même réglage audio : ils peuvent être coupés dans Réglages.

## Ajouter du contenu

Tout se passe dans `content/` ; `public/content/` et `public/media/` sont générés.

1. **Entités** — ajouter une fiche dans `content/entities/<parcours>-*.yaml` :
   ```yaml
   - id: debussy-la-mer # identifiant stable, minuscules et tirets
     type: work # work, person, period, movement, concept, instrument
     name: La Mer
     wikidataId: Q1057812
     relations:
       inPeriod: musique-debut-xxe
     summary: >-
       Une à trois phrases factuelles, montrées après la réponse.
   ```
   `createdBy`, l'année, les dates d'une personne et son portrait sont complétés par
   `npm run content:ingest`. Une valeur écrite à la main n'est jamais écrasée : les désaccords avec
   Wikidata sont listés dans `reports/ingest.md`.
2. **Extrait audio** — l'ajouter dans `content/manifests/<parcours>-audio.yaml` (fichier Commons,
   début, durée de 15 à 25 s). Hors Commons, renseigner aussi `credit`, `license` et `sourceUrl`.
3. **Leçon** — référencer les nouvelles entités dans `content/courses/<parcours>.yaml` (au moins
   3 par leçon).
4. Lancer `npm run content`, vérifier le rapport, écouter les extraits dans l'écran Parcours
   (toucher une leçon), puis commiter `content/`, `public/content/` et `public/media/`.

Le build refuse le contenu, avec un message par problème, si un identifiant est dupliqué, si une
relation pointe dans le vide, si un média manque, si une leçon introduit moins de 3 entités, ou si
une œuvre ne peut pas être exercée avec les compétences de sa leçon (extrait, compositeur,
période ou année manquants). La compétence `concept-definition` (notions associées à leur
définition, tirée de la première phrase du `summary`) demande au moins 4 concepts dans le
parcours.

**Wikimedia** limite fortement les téléchargements : le pipeline fait une requête par seconde sur
les API, attend 5 s entre deux fichiers et respecte `Retry-After`. Déjà téléchargés, les fichiers
sont gardés dans `.cache/` et ne sont pas retéléchargés. Pour s'identifier comme le demande la
[politique User-Agent](https://meta.wikimedia.org/wiki/User-Agent_policy), définir
`WIKIMEDIA_CONTACT` (adresse ou URL de contact) avant de lancer le pipeline.

## Contenu et licences

Seuls les médias du domaine public ou sous licence libre (CC0, CC BY, CC BY-SA) sont acceptés : le
pipeline refuse tout autre fichier. Auteur, licence et source de chaque média sont conservés dans
`content/generated/media.json` et affichés dans l'app avec le média.

Les points incertains (dates, attributions, licences d’enregistrements
historiques, points de départ des extraits) sont listés dans
[`content/TO_REVIEW.md`](content/TO_REVIEW.md).
