import { NavLink, Outlet } from 'react-router-dom'

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `rounded-md px-3 py-1.5 text-sm font-medium ${
    isActive ? 'bg-paper-2 text-ink' : 'text-ink-muted hover:text-ink'
  }`

export function Layout() {
  return (
    <div className="min-h-screen">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-10 focus:rounded-md focus:bg-card focus:px-3 focus:py-2"
      >
        Skip to content
      </a>
      <header className="border-b border-line bg-card/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
          <NavLink to="/" className="font-serif text-xl font-medium tracking-tight text-ink">
            LLD Practice
          </NavLink>
          <nav aria-label="Primary" className="flex items-center gap-1">
            <NavLink to="/" end className={linkClass}>
              Problems
            </NavLink>
            <NavLink to="/history" className={linkClass}>
              History
            </NavLink>
          </nav>
        </div>
      </header>
      <main id="main" className="mx-auto max-w-5xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  )
}

export function LoadingState({ label }: { label: string }) {
  return (
    <p className="text-sm text-ink-muted" role="status">
      {label}
    </p>
  )
}

export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-xl border border-dashed border-line bg-card px-4 py-8 text-center">
      <p className="font-medium text-ink">{title}</p>
      <p className="mt-1 text-sm text-ink-muted">{body}</p>
    </div>
  )
}

export function ErrorState({ message }: { message: string }) {
  return (
    <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-bad" role="alert">
      {message}
    </p>
  )
}

export function DifficultyBadge({ difficulty }: { difficulty: string }) {
  const tone = difficulty.toLowerCase()
  const color =
    tone === 'easy'
      ? 'bg-lime-50 text-lime-900 border-lime-200'
      : tone === 'hard'
        ? 'bg-red-50 text-red-800 border-red-200'
        : 'bg-amber-50 text-amber-900 border-amber-200'

  return (
    <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${color}`}>
      {difficulty}
    </span>
  )
}
