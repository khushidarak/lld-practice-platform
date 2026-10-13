import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api, formatApiError } from '../api/client'
import { CriterionCard } from '../components/CriterionCard'
import { ErrorState, LoadingState } from '../components/Layout'
import { StatusBadge } from '../components/StatusBadge'
import { getSubmissionContext } from '../session'
import type { SubmissionDetail } from '../types'

const POLL_MS = 2000
const ACTIVE = new Set(['SUBMITTED', 'EVALUATING'])

export function SubmissionPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [submission, setSubmission] = useState<SubmissionDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [retrying, setRetrying] = useState(false)
  const [retryError, setRetryError] = useState<string | null>(null)
  const [problemId, setProblemId] = useState<string | null>(null)
  const [pollEpoch, setPollEpoch] = useState(0)

  useEffect(() => {
    if (!id) return
    const stored = getSubmissionContext(id)
    if (stored) setProblemId(stored.problemId)
  }, [id])

  useEffect(() => {
    if (!id) return
    let cancelled = false
    let timer: number | undefined

    async function load() {
      try {
        const data = await api.getSubmission(id!)
        if (cancelled) return
        setSubmission(data)
        setError(null)
        if (ACTIVE.has(data.status)) {
          timer = window.setTimeout(() => {
            void load()
          }, POLL_MS)
        }
      } catch (err: unknown) {
        if (cancelled) return
        setError(formatApiError(err))
      }
    }

    void load()
    return () => {
      cancelled = true
      if (timer !== undefined) window.clearTimeout(timer)
    }
  }, [id, pollEpoch])

  useEffect(() => {
    if (problemId || !id || !submission) return
    let cancelled = false
    async function resolveProblem() {
      try {
        const attempts = await api.listAttempts()
        for (const attempt of attempts) {
          const detail = await api.getAttempt(attempt.id)
          if (detail.submissions.some((item) => item.id === id)) {
            if (!cancelled) setProblemId(detail.problemId)
            return
          }
        }
      } catch {
        /* optional context */
      }
    }
    void resolveProblem()
    return () => {
      cancelled = true
    }
  }, [id, problemId, submission])

  async function retry() {
    if (!id) return
    setRetrying(true)
    setRetryError(null)
    try {
      const result = await api.retrySubmission(id)
      if (result.submissionId !== id) {
        navigate(`/submissions/${result.submissionId}`)
        return
      }
      const data = await api.getSubmission(result.submissionId)
      setSubmission(data)
      setPollEpoch((epoch) => epoch + 1)
    } catch (err: unknown) {
      setRetryError(formatApiError(err))
    } finally {
      setRetrying(false)
    }
  }

  if (error && !submission) return <ErrorState message={error} />
  if (!submission) return <LoadingState label="Loading submission…" />

  const evaluation = submission.evaluation
  const retryHref = problemId ? `/problems/${problemId}?retry=1` : '/'

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-ink-muted">
            <Link to="/history" className="hover:underline">
              History
            </Link>
            <span aria-hidden="true"> / </span>
            Submission
          </p>
          <h1 className="mt-1 font-serif text-3xl font-medium tracking-tight">
            Submission status
          </h1>
        </div>
        <StatusBadge status={submission.status} />
      </div>

      {ACTIVE.has(submission.status) ? (
        <p className="text-sm text-ink-muted" role="status">
          Evaluation is running. This page checks again every 2 seconds.
        </p>
      ) : null}

      {submission.status === 'FAILED' ? (
        <section className="rounded-xl border border-red-200 bg-red-50 p-4">
          <h2 className="font-medium text-bad">Evaluation failed</h2>
          <p className="mt-1 text-sm text-ink">
            {submission.failureReason ?? 'No failure reason was provided.'}
          </p>
          <button
            type="button"
            onClick={() => void retry()}
            disabled={retrying}
            className="mt-4 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 disabled:bg-stone-400"
          >
            {retrying ? 'Retrying…' : 'Retry evaluation'}
          </button>
          {retryError ? <p className="mt-2 text-sm text-bad">{retryError}</p> : null}
        </section>
      ) : null}

      {submission.status === 'COMPLETED' && evaluation ? (
        <div className="space-y-5">
          {evaluation.degraded ? (
            <p
              className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-ink"
              role="status"
            >
              AI feedback unavailable, showing rule-based results only
            </p>
          ) : null}

          <section className="rounded-xl border border-line bg-card p-4 sm:p-5">
            <p className="text-sm text-ink-muted">Overall score</p>
            <p className="font-serif text-3xl font-medium tabular-nums">
              {evaluation.overallScore}
              <span className="text-base font-sans font-normal text-ink-muted"> / 4</span>
            </p>
            <p className="mt-2 text-sm text-ink">{evaluation.summary}</p>
          </section>

          {evaluation.results.length === 0 ? (
            <p className="text-sm text-ink-muted">No criterion results were returned.</p>
          ) : (
            <ul className="space-y-3">
              {evaluation.results.map((result) => (
                <li key={result.criterionId}>
                  <CriterionCard result={result} />
                </li>
              ))}
            </ul>
          )}

          <Link
            to={retryHref}
            className="inline-flex rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-accent/90"
          >
            Try again with change request
          </Link>
        </div>
      ) : null}
    </div>
  )
}
