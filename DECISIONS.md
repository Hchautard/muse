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

## Phase 4

- **Association** : l'œuvre y est représentée par son extrait ou son tableau (pas par son titre),
  pour rester sur la reconnaissance. Quatre paires ; les trois autres œuvres sont choisies à
  travers leurs réponses (compositeurs, périodes… plus proches à mesure que la carte est connue),
  parmi les œuvres déjà rencontrées de préférence. Elle apparaît à partir d'une maîtrise de 0,5
  (20 % des questions audio, 15 % des questions image) et ne note que la carte visée.
- **Association réussie = sans aucune erreur** (comme la chronologie) : on recommence jusqu'à
  trouver toutes les paires, mais une seule erreur vaut « Again ». Chaque mauvaise paire est
  journalisée (`mismatches`) pour les points faibles.
- **`concept-definition`** : son seul exercice est l'association notion ↔ définition. La définition
  est la première phrase du `summary`, où le nom de la notion est masqué. Il faut au moins
  4 concepts dans le parcours ; le contenu actuel n'en a pas encore.
- **Détail** : gros plan ×2,5 dont le centre est tiré au hasard dans la partie centrale du
  tableau (25 à 75 % de la largeur et de la hauteur), puis dézoom sur le tableau entier après la
  réponse. Réservé aux cartes à maîtrise ≥ 0,5 ; « Easy » sous 6 s. Des points d'intérêt choisis à
  la main pourront être ajoutés au contenu en phase 5 si le hasard tombe trop souvent à côté.
- **Navigation** : barre d'onglets en bas (Accueil, Collection, Statistiques, Réglages), masquée
  pendant les sessions.
- **Collection** : les œuvres qui ont au moins une carte. Maîtrise d'une œuvre = moyenne de ses
  cartes, sur quatre crans (découverte < 0,25, en cours < 0,6, solide < 1, maîtrisée). Filtre par
  période (ou par mouvement pour une œuvre sans période).
- **Cartes par état** : par stabilité FSRS (en apprentissage < 7 jours, en consolidation
  < 21 jours, maîtrisées au-delà), les états FSRS étant tous « Review » sans pas d'apprentissage.
- **Points faibles** : paires d'entités confondues dans un sens ou dans l'autre (mauvais choix d'un
  QCM, d'un détail ou d'un vrai / faux, mauvaises paires d'association), sur les 60 derniers jours,
  les 5 plus fréquentes.
- **Objectif du jour** : 1, 2, 3 ou 5 sessions. Un changement vaut pour la journée en cours ; les
  jours passés gardent leur objectif.
- **Effets sonores** : synthétisés avec Web Audio (aucun fichier), activés par défaut. Avec la
  session audio « playback », ils s'entendent aussi en mode silencieux ; ils se coupent dans les
  Réglages.
- **Téléchargement hors ligne** : écrit directement dans les caches du service worker
  (`muse-media`, `muse-content`), trois fichiers à la fois, toutes les tailles d'image (c'est le
  navigateur qui choisit la variante affichée). Les routes ignorent l'en-tête `Vary`, sinon les
  requêtes de l'élément `<audio>` ne retrouvent pas les fichiers téléchargés. « Libérer l'espace »
  retire tous les médias du parcours, y compris ceux de versions précédentes du contenu.
- **Sauvegarde** : un fichier JSON (`format: "muse-progress"`, `version: 1`, dates en ISO) qui
  contient toutes les tables. L'import le valide avec zod sans écarter de champ, puis remplace tout
  (réglages compris) en une transaction ; la réinitialisation garde les réglages. Sur iPhone,
  l'export passe par la feuille de partage (le fichier est préparé à l'avance, car le partage doit
  partir du toucher) ; sur ordinateur, c'est un téléchargement.
- **Écran de fin** : œuvres ajoutées à la collection et état de l'objectif du jour.
- **Typographie** : le build du contenu met des espaces insécables dans les noms et résumés
  (« n° 3 », guillemets, `;` `:` `!` `?`).

## Phase 5

- **Unité Peinture** : cinq mouvements, neuf peintres (deux par mouvement, sauf le cubisme) et
  trois tableaux chacun, en neuf leçons construites comme celles de la musique (un mouvement est
  présenté avec son premier peintre). Les tableaux retenus sont parmi les plus connus de chaque
  peintre (nombre de liens Wikipédia sur Wikidata), avec des genres variés.
- **Cubisme** : Juan Gris seul, car Picasso (mort en 1973) et Braque (mort en 1963) ne sont pas
  dans le domaine public.
- **Images de musées** : `museumImage: aic:<id>` ou `met:<id>` dans une fiche. Seuls les objets
  que le musée place dans le domaine public sont acceptés (sous CC0, crédit : le musée). L'Art
  Institute of Chicago exige l'en-tête `AIC-User-Agent` ; la recherche historique du Met
  (`/v1/search`) a été retirée le 1er octobre 2026, seule la fiche d'objet est utilisée. Six
  tableaux et deux portraits en viennent, le reste vient de Commons (P18).
- **Liens Wikidata par parcours** : une affirmation de Wikidata ne relie plus que des entités du
  même parcours (sinon les œuvres de Ravel et Debussy rejoignaient l'« impressionnisme » de la
  peinture).
- **Crédits des tableaux** : le peintre, écrit en français ; pour une photographie sous licence
  libre, le photographe. Deux photos sous CC BY-SA dont le photographe n'était pas identifiable ont
  été remplacées par des reproductions du domaine public, et la photo de Cézanne (minuscule, de
  source douteuse) par son autoportrait dessiné du Met.
- **Ordre des parcours** : celui de `COURSE_IDS` (musique, puis peinture), quel que soit le nom des
  fichiers.
- **Parcours mémorisé** : le dernier parcours choisi sur l'accueil ou la collection est gardé dans
  les réglages (donc dans les sauvegardes).
- **Préchargement des images** : la taille que l'écran affichera (d'après `srcset`/`sizes`), plutôt
  que toujours la variante 960 px.
- **Test du contenu publié** : un test Vitest (`scripts/lib/published-content.test.ts`) joue chaque
  leçon des parcours publiés avec le moteur, puis des révisions, et vérifie que tous les types
  d'exercice y apparaissent.

## Phase 6

- **Défi du jour** : une œuvre qui a au moins une carte, tirée chaque jour avec la date pour graine,
  sans reprendre une œuvre des 30 derniers défis tant qu'il en reste. Il est tiré et enregistré à
  la première ouverture du jour : terminer une leçon ensuite ne le change plus.
- **Six titres, quatre essais** : les titres proposés suivent les règles des distracteurs (même
  parcours, années différentes, assez proches : maîtrise fictive de 0,6). Chaque erreur révèle un
  indice : période ou mouvement, décennie, puis créateur ; pour un tableau, le gros plan passe de
  ×4 à ×2, puis à l'œuvre entière.
- **XP du défi** : 20, 15, 10 ou 5 selon l'essai, ajoutés à la journée sans compter de session
  (l'objectif du jour reste fait de sessions). Le défi ne touche pas aux cartes FSRS. Sa série est
  distincte de celle de l'objectif.
- **Partage** : un texte sans le nom de l'œuvre (un carré par essai), par la feuille de partage sur
  téléphone, sinon copié dans le presse-papiers.
- **Données** : table `challenges` (version 2 de la base), incluse dans les sauvegardes (format 2 ;
  les fichiers au format 1 restent lisibles) et effacée par la réinitialisation.
- **Unités 2** : une par parcours, sur le modèle des unités 1 (huit créateurs, trois œuvres
  chacun). Musique : deux compositeurs par période (Rameau et Haendel, Gluck et Haydn, Schubert et
  Dvořák, Satie et Holst), pour que « de quelle période ? » ne soit jamais devinable d'avance.
  Peinture : du romantisme à l'art abstrait (Delacroix, Turner, Courbet, Millet, Seurat, Klimt,
  Munch, Kandinsky). Les leçons des unités 2 s'ouvrent une fois celles de l'unité 1 terminées.
- **Choix des compositeurs selon les enregistrements libres** : Purcell, envisagé pour le baroque,
  n'a presque aucun enregistrement libre exploitable sur Commons ; Rameau le remplace (pièces de
  clavecin jouées au piano par Marcelle Meyer). Pour Holst, les versions libres sont celles des
  orchestres militaires américains (domaine public).
- **Pas de nus explicites** dans le choix des tableaux (L'Origine du monde, La Femme au perroquet
  écartés).
