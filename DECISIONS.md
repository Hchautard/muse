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
- **Image de démonstration** dans `public/demo/` (Vermeer, domaine public, via Commons) : à
  supprimer en phase 2 quand le pipeline produira `public/media/`.
- **TypeScript 6** (celui fourni par create-vite) plutôt que TypeScript 7 : typescript-eslint
  n'accepte pour l'instant que `typescript >=4.8.4 <6.1.0`.
- **Prettier** : sans point-virgule, guillemets simples, 100 colonnes (style du gabarit Vite).
- **Lint** : la règle `react-hooks/purity` interdit `performance.now()` dans un gestionnaire
  déclaré dans le composant ; la durée de réponse utilise donc `event.timeStamp` (même horloge).
