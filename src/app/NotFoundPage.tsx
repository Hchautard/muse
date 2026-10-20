import { Link } from 'react-router'

export function NotFoundPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-safe pt-safe pb-safe text-center">
      <h1 className="text-3xl">Salle introuvable</h1>
      <p className="text-muted">Cette page n’existe pas ou a été déplacée.</p>
      <Link
        to="/"
        className="flex min-h-11 items-center rounded-full border border-line bg-surface px-5 font-medium"
      >
        Retour à l’accueil
      </Link>
    </main>
  )
}
