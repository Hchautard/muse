# Décisions

Choix de conception non couverts par `PLAN.md`, du plus ancien au plus récent.

## Phase 1

- **Sous-chemin GitHub Pages** : `vite.config.ts` lit `BASE_PATH` (défaut `/`). Le workflow le
  fixe à `/<nom-du-repo>/` ; le `basename` du routeur dérive de `import.meta.env.BASE_URL`.
- **Liens profonds sur GitHub Pages** : `BrowserRouter` + copie de `index.html` en `404.html`
  au déploiement. Une fois le service worker installé, c'est lui qui sert la navigation.
- **Mise à jour** : `registerType: 'prompt'` (pas de rechargement automatique en pleine session) ;
  vérification d'une nouvelle version toutes les heures. Le bandeau est livré dès la phase 1 car
  c'est lui qui enregistre le service worker.
- **Routes du service worker** : exprimées en `RegExp` construites à partir de `BASE_PATH`, car
  vite-plugin-pwa sérialise les `urlPattern` dans `sw.js` (une fonction ne peut pas capturer
  de variable).
- **`media/` et `content/` exclus du précache** : ils sont mis en cache à l'usage (et, en phase 4,
  téléchargés à la demande par parcours) pour ne pas gonfler l'installation.
- **Polices** : piles système (`ui-serif` → New York sur iPhone, `-apple-system` pour le texte).
  Aucune police à télécharger, rien à mettre en cache, rendu natif.
- **Composants d'interface partagés** dans `src/ui/` (icônes SVG en ligne, pas de bibliothèque).
- **Icônes** : source unique `public/icons/icon.svg`, PNG générés par `npm run icons` (sharp) et
  versionnés. Le dessin est plein cadre, donc la même image sert d'icône `maskable`.
- **Image de démonstration** dans `public/demo/` (Vermeer, domaine public, via Commons) :
  supprimée en phase 2 avec l'exercice codé en dur, remplacés par le contenu réel.
- **TypeScript 6** (celui fourni par create-vite) plutôt que TypeScript 7 : typescript-eslint
  n'accepte pour l'instant que `typescript >=4.8.4 <6.1.0`.
- **Prettier** : sans point-virgule, guillemets simples, 100 colonnes (style du gabarit Vite).
- **Lint** : la règle `react-hooks/purity` interdit `performance.now()` dans un gestionnaire
  déclaré dans le composant ; la durée de réponse utilise donc `event.timeStamp` (même horloge).

## Phase 2

- **Lecture/écriture YAML** : bibliothèque `yaml` (dev, sans dépendance), seule capable de
  compléter un fichier en conservant commentaires et mise en forme. Les fichiers réécrits par
  l'ingestion sont repliés à 100 colonnes ; `content/` est exclu de Prettier pour éviter deux
  formatages concurrents.
- **Relations dans les fiches** : chaque entité déclare ses relations (`relations.createdBy`,
  `inPeriod`…) ; le build les convertit en `Relation[]`.
- **Ingestion** : P18 n'est repris que pour les personnes et les œuvres du parcours art (pour la
  musique, P18 désigne souvent une partition ou une affiche). Les mouvements Wikidata (P135) qui
  correspondent à nos périodes deviennent `inPeriod`.
- **Année d'une œuvre** : année de composition ; quand Wikidata est imprécis ou s'en écarte, la
  valeur retenue est écrite à la main avec un commentaire (ex. Vivaldi : publication en 1725).
- **Période « Début du XXe siècle »** : 1890–1945, sans équivalent Wikidata ; elle regroupe Debussy
  et Ravel, y compris leurs œuvres des années 1890.
- **Médias générés versionnés** : `public/media/`, `public/content/` et le registre
  `content/generated/media.json` sont commités (le pipeline demande réseau et ffmpeg). La CI
  relance seulement `content:build` et échoue si les bundles ne sont plus à jour.
- **Identifiants de médias** : `<entité>-audio` et `<entité>-image`.
- **Extraits audio** : silence initial retiré, `loudnorm` en deux passes (−16 LUFS, −1,5 dBTP),
  AAC 128 kb/s stéréo 44,1 kHz, `+faststart`. Au-delà de 15 Mo, on télécharge le MP3 transcodé par
  Commons plutôt que l'original.
- **Normalisation de secours** : si le gain linéaire ne permet pas d'atteindre −16 LUFS à 2 LU
  près (crêtes d'un 78 tours), l'extrait est réencodé avec `loudnorm` en mode dynamique.
- **Crédits** : le champ « auteur » de Commons nomme souvent le compositeur ; les crédits sont
  alors réécrits à la main d'après la description du fichier (`credit` dans le manifeste audio,
  `imageCredit` dans les fiches). Ces surcharges s'appliquent sans retélécharger. Les licences
  sont stockées sous leur nom normalisé (« Public domain ») et affichées en français.
- **Politesse envers Wikimedia** : 1 requête/s sur les API, 5 s entre deux téléchargements sur
  upload.wikimedia.org, `Retry-After` toujours respecté (un premier essai trop rapide a valu un
  blocage de 10 minutes). Contact facultatif dans le User-Agent via `WIKIMEDIA_CONTACT`.
- **Version d'un parcours** : 12 premiers caractères du SHA-256 de son bundle (déterministe).
- **Champs ajoutés au modèle** : `bytes` (estimation du téléchargement hors ligne),
  `width`/`height` (mise en page des images) et `collection` (P195) pour les œuvres.
- **Progression** : `src/engine/progression.ts` calcule l'état des leçons ; sans données de
  progression (phase 3), la première leçon est « en cours » et les autres verrouillées.
- **Aperçu de leçon** : un toucher sur une leçon du Parcours ouvre la liste de ce qu'elle
  introduit, avec écoute des extraits — utile pour relire le contenu avant la phase 3.
- **Lecteur d'aperçu** : un seul élément `<audio>` partagé, hors état React.
- **Lint** : `no-unused-vars` avec `ignoreRestSiblings` (pour retirer des champs par
  déstructuration).

## Phase 3

- **Planification au jour près** : `ts-fsrs` avec `enable_short_term: false` (pas de pas
  d'apprentissage en minutes ; l'apprentissage à court terme se fait dans la session) et
  `enable_fuzz` (les cartes apprises ensemble ne reviennent pas toutes le même jour). Une carte est
  « due » pendant toute la journée locale de son échéance.
- **Une note FSRS par carte et par session**, à sa première question notée. La présentation
  d'une œuvre est suivie d'une question notée (QCM, distracteurs faciles) ; les exercices de
  complément d'une leçon courte et les seconds essais ne sont pas notés.
- **Seuils « Easy »** : 6 s pour un QCM audio (le toucher sur « Écouter » compris), 4 s pour un
  QCM image ou un vrai / faux, jamais pour une chronologie.
- **Leçon de 12 exercices** : les cartes de la leçon (9 pour 3 œuvres × 3 compétences), 2 à 4
  révisions dues (une par œuvre d'abord), puis des exercices de complément non notés si la leçon
  est trop courte. Ordonnancement glouton : jamais deux fois la même œuvre de suite, présentation
  avant les autres questions sur l'œuvre, exercices textuels répartis à intervalles réguliers.
- **Vrai / faux** : « Cette œuvre est de X » sur l'extrait ou l'image (relation `createdBy`,
  `inPeriod` ou `belongsTo`, vraie ou falsifiée par un distracteur). Réservé aux cartes un peu
  connues (maîtrise ≥ 0,3) et aux compléments, pour que le QCM reste la norme.
- **Chronologie** : 3 œuvres pour une carte nouvelle, 4 à partir d'une maîtrise de 0,5 ; toutes
  d'années différentes ; le compositeur est affiché ; validation par un bouton (correction possible
  avant). Elle note la carte « dater » de l'œuvre visée.
- **Maîtrise** (difficulté des distracteurs) : stabilité FSRS / 21 jours, plafonnée à 1.
  Proximité de deux entités : dates (sur 150 ans), même période, même mouvement, même créateur.
- **`concept-definition`** ne crée pas encore de carte : il attend l'exercice d'association
  (phase 4).
- **Données ajoutées au modèle** : `courseId` sur les cartes, le journal et les leçons ;
  `kind`, `expectedId` et `chosenId` dans le journal (pour les confusions de la phase 4) ; `goal`
  dans chaque journée, pour qu'un changement d'objectif ne réécrive pas les séries passées.
- **Session abandonnée** : rien n'est enregistré ; une session terminée est écrite en une seule
  transaction.
- **Requêtes vivantes** : petit hook maison sur `liveQuery` de Dexie plutôt que
  `dexie-react-hooks` (une dépendance de moins).
- **Accueil** : l'objectif du jour, la semaine et la série affichent les vraies données dès cette
  phase (l'objectif reste fixé à 1 session jusqu'aux réglages de la phase 4). Le bouton « Réviser »
  sans carte due propose les cartes les plus fragiles une fois toutes les leçons terminées.
- **Audio** : un seul élément `<audio>` pour toute l'app ; chaque lecteur reprend l'extrait au
  début ; les médias des trois exercices suivants sont préchargés par `fetch` (ce qui remplit le
  cache du service worker). Safari 17+ : `navigator.audioSession.type = 'playback'`.
- **Taille du bundle** : un seul fichier JS (~180 Ko compressés) précaché à l'installation ; le
  seuil d'avertissement de Vite est relevé à 700 Ko plutôt que de découper le code.
- **Règles de compétences partagées** : `src/engine/skills.ts` sert au moteur et à la validation
  du contenu.
