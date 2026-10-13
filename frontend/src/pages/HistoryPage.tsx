import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, formatApiError } from '../api/client'
import { EmptyState, ErrorState, LoadingState } from '../components/Layout'
import { StatusBadge } from '../components/StatusBadge'
import { rememberSubmissionContext } from '../session'
import type { AttemptSummary, Progress } from '../types'

function formatDate(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return date.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

export function HistoryPage() {
  const navigate = useNavigate()
  const [attempts, setAttempts] = useState<AttemptSummary[] | null>(null)
  const [progress, setProgress] = useState<Progress | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [openingId, setOpeningId] = useState<string | null>(null)
  const [openError, setOpenError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    Promise.all([api.listAttempts(), api.getProgress()])
      .then(([attemptList, progressData]) => {
        if (cancelled) return
        setAttempts(attemptList)
        setProgress(progressData)
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(formatApiError(err))
      })
    return () => {
      cancelled = true
    }
  }, [])

  async function openAttempt(attempt: AttemptSummary) {
    setOpeningId(attempt.id)
    setOpenError(null)
    try {
      const detail = await api.getAttempt(attempt.id)
      const latest = [...detail.submissions].sort((a, b) =>
        b.createdAt.localeCompare(a.createdAt),
      )[0]
      if (!latest) {
        setOpenError('This attempt has no submissions yet.')
        return
      }
      rememberSubmissionContext(latest.id, {
        problemId: detail.problemId,
        attemptId: detail.id,
      })
      navigate(`/submissions/${latest.id}`)
    } catch (err: unknown) {
      setOpenError(formatApiError(err))
    } finally {
      setOpeningId(null)
    }
  }

  if (error) return <ErrorState message={error} />
  if (!attempts || !progress) return <LoadingState label="Loading history…" />

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-serif text-3xl font-medium tracking-tight">History</h1>
        <p className="mt-2 text-ink-muted">Past attempts and the criteria that stay weakest.</p>
      </div>

      <section>
        <h2 className="font-serif text-xl font-medium">Recurring weak areas</h2>
        {progress.weakCriteria.length === 0 ? (
          <div className="mt-3">
            <EmptyState
              title="No trend yet"
              body="Complete an evaluation to see which criteria you miss most often."
            />
          </div>
        ) : (
          <ul className="mt-3 grid gap-3 sm:grid-cols-2">
            {progress.weakCriteria.map((item) => (
              <li
                key={item.criterionId}
                className="rounded-xl border border-line bg-card p-4"
              >
                <p className="font-medium text-ink">{item.criterion}</p>
                <p className="mt-1 text-sm text-ink-muted">
                  Average {item.averageScore}/4 across {item.attempts}{' '}
                  {item.attempts === 1 ? 'attempt' : 'attempts'}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="font-serif text-xl font-medium">Attempts</h2>
        {openError ? (
          <div className="mt-3">
            <ErrorState message={openError} />
          </div>
        ) : null}
        {attempts.length === 0 ? (
          <div className="mt-3">
            <EmptyState
              title="No attempts yet"
              body="Start a problem, submit a design, and it will show up here."
            />
          </div>
        ) : (
          <ul className="mt-3 divide-y divide-line overflow-hidden rounded-xl border border-line bg-card">
            {attempts.map((attempt) => (
              <li key={attempt.id}>
                <button
                  type="button"
                  onClick={() => void openAttempt(attempt)}
                  disabled={openingId === attempt.id}
                  className="flex w-full flex-col gap-2 px-4 py-3 text-left hover:bg-paper-2 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-medium text-ink">{attempt.problemTitle}</p>
                    <p className="text-sm text-ink-muted">
                      Attempt {attempt.number} · {formatDate(attempt.createdAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <StatusBadge status={attempt.latestStatus} />
                    <span className="text-sm tabular-nums text-ink-muted">
                      {attempt.overallScore === null ? '—' : `${attempt.overallScore}/4`}
                    </span>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
