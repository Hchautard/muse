# Muse

Un « Duolingo de la culture » : sessions de 3 à 5 minutes pour apprendre à **reconnaître** la
musique classique et la peinture occidentale. Application web installable (PWA), sans backend :
le contenu est statique, la progression reste sur l'appareil.

Le cahier des charges complet est dans [`PLAN.md`](PLAN.md), les choix de conception dans
[`DECISIONS.md`](DECISIONS.md).

> **État : phase 1** — squelette installable, accueil factice et un exercice QCM image codé en
> dur. Le pipeline de contenu arrive en phase 2.

## Prérequis

- Node.js ≥ 22.12 (voir `.nvmrc`)
- npm 10+
- Pour les scripts de contenu (phase 2) : `ffmpeg` dans le `PATH`

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

Pour reproduire localement le build de GitHub Pages (servi sous `/muse/`) :

```sh
BASE_PATH=/muse/ npm run build && BASE_PATH=/muse/ npm run preview
# puis ouvrir http://localhost:4173/muse/
```

> Sous Git Bash (Windows), préfixer par `MSYS_NO_PATHCONV=1`, sinon `/muse/` est réécrit en
> chemin Windows.

## Structure

```
src/
├── app/          routes, layout, bandeau de mise à jour
├── features/     un dossier par écran (home, session, exercises…)
├── engine/       logique pure, sans React ni IndexedDB, couverte par Vitest
└── ui/           composants partagés (icônes)
scripts/          scripts Node (icônes ; pipeline de contenu en phase 2)
public/           fichiers statiques (icônes, image de démo)
```

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

Mises à jour : quand une nouvelle version est publiée, un bandeau « Nouvelle version —
Recharger » apparaît en haut de l'écran.

> **Mode silencieux** : le comportement de l'audio quand le commutateur silencieux de l'iPhone
> est activé sera testé et documenté ici en phase 3 (premier exercice audio).

## Contenu et licences

Seuls les médias du domaine public ou sous licence libre (CC0, CC BY, CC BY-SA) sont acceptés,
avec auteur, licence et source conservés pour chaque fichier et affichés après chaque réponse.

Image de démonstration de la phase 1 : Johannes Vermeer, _La Jeune Fille à la perle_ (vers
1665), Mauritshuis, La Haye — domaine public, via
[Wikimedia Commons](https://commons.wikimedia.org/wiki/File:1665_Girl_with_a_Pearl_Earring.jpg).

L'ajout de contenu (YAML dans `content/`, scripts `npm run content`) sera documenté en phase 2.
