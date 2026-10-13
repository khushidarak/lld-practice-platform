import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, formatApiError } from '../api/client'
import { DifficultyBadge, EmptyState, ErrorState, LoadingState } from '../components/Layout'
import type { ProblemSummary } from '../types'

export function ProblemsPage() {
  const [problems, setProblems] = useState<ProblemSummary[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    api
      .listProblems()
      .then((data) => {
        if (!cancelled) setProblems(data)
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(formatApiError(err))
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (error) return <ErrorState message={error} />
  if (!problems) return <LoadingState label="Loading problems…" />
  if (problems.length === 0) {
    return (
      <EmptyState
        title="No problems yet"
        body="The practice set is empty. Check the API, then refresh."
      />
    )
  }

  return (
    <div>
      <h1 className="font-serif text-3xl font-medium tracking-tight">Problems</h1>
      <p className="mt-2 max-w-2xl text-ink-muted">
        Pick a design prompt, write a structured attempt, and review criterion-by-criterion
        feedback. Scoring happens on the server; this page only lists what is available.
      </p>
      <ul className="mt-8 grid gap-4 sm:grid-cols-2">
        {problems.map((problem) => (
          <li key={problem.id}>
            <Link
              to={`/problems/${problem.id}`}
              className="block h-full rounded-xl border border-line bg-card p-5 shadow-sm transition hover:border-accent/40 hover:shadow"
            >
              <div className="flex items-start justify-between gap-3">
                <h2 className="font-serif text-xl font-medium text-ink">{problem.title}</h2>
                <DifficultyBadge difficulty={problem.difficulty} />
              </div>
              <p className="mt-2 text-sm text-ink-muted">{problem.summary}</p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
