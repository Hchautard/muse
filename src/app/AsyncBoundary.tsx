import { Component, Suspense, type ReactNode } from 'react'
import { resetContentCache } from '../content/loader'

interface AsyncBoundaryProps {
  children: ReactNode
  fallback: ReactNode
  /** Called on "Réessayer", e.g. to restart a failed load that the children suspend on. */
  onRetry?: () => void
}

/** Suspense plus an error state with a retry button, for screens that load content. */
export function AsyncBoundary({ children, fallback, onRetry }: AsyncBoundaryProps) {
  return (
    <ErrorBoundary onRetry={onRetry}>
      <Suspense fallback={fallback}>{children}</Suspense>
    </ErrorBoundary>
  )
}

interface ErrorBoundaryProps {
  children: ReactNode
  onRetry?: () => void
}

class ErrorBoundary extends Component<ErrorBoundaryProps, { error: Error | null }> {
  state = { error: null as Error | null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  retry = () => {
    resetContentCache()
    this.props.onRetry?.()
    this.setState({ error: null })
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div
        role="alert"
        className="flex flex-col items-start gap-3 rounded-2xl border border-line bg-surface p-5"
      >
        <p className="font-serif text-lg">Le contenu n’a pas pu être chargé</p>
        <p className="text-sm text-muted">{this.state.error.message}</p>
        <button
          type="button"
          onClick={this.retry}
          className="min-h-11 rounded-full border border-line px-5 font-medium"
        >
          Réessayer
        </button>
      </div>
    )
  }
}
