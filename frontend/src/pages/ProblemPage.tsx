import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ApiError, api, formatApiError } from '../api/client'
import { DesignForm } from '../components/DesignForm'
import { DifficultyBadge, ErrorState, LoadingState } from '../components/Layout'
import { rememberSubmissionContext } from '../session'
import type { Attempt, ProblemDetail, SubmissionContent } from '../types'

export function ProblemPage() {
  const { id } = useParams<{ id: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()

  const [problem, setProblem] = useState<ProblemDetail | null>(null)
  const [hasCompletedAttempt, setHasCompletedAttempt] = useState(false)
  const [attempt, setAttempt] = useState<Attempt | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [startError, setStartError] = useState<string | null>(null)
  const [starting, setStarting] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [duplicateId, setDuplicateId] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    let cancelled = false
    setLoading(true)
    setError(null)

    Promise.all([api.getProblem(id), api.listAttempts()])
      .then(([detail, attempts]) => {
        if (cancelled) return
        setProblem(detail)
        setHasCompletedAttempt(
          attempts.some((item) => item.problemId === id && item.latestStatus === 'COMPLETED'),
        )
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(formatApiError(err))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [id])

  async function startAttempt() {
    if (!id || starting) return
    setStarting(true)
    setStartError(null)
    try {
      const created = await api.createAttempt(id)
      setAttempt(created)
    } catch (err: unknown) {
      setStartError(formatApiError(err))
    } finally {
      setStarting(false)
    }
  }

  useEffect(() => {
    if (loading || !problem || attempt || !id) return
    if (searchParams.get('retry') !== '1') return

    let cancelled = false
    setSearchParams({}, { replace: true })
    setStarting(true)
    setStartError(null)
    api
      .createAttempt(id)
      .then((created) => {
        if (!cancelled) setAttempt(created)
      })
      .catch((err: unknown) => {
        if (!cancelled) setStartError(formatApiError(err))
      })
      .finally(() => {
        if (!cancelled) setStarting(false)
      })

    return () => {
      cancelled = true
    }
  }, [loading, problem, attempt, id, searchParams, setSearchParams])

  async function handleSubmit(content: SubmissionContent) {
    if (!attempt || !problem) return
    setSubmitting(true)
    setFormError(null)
    setDuplicateId(null)
    try {
      const result = await api.createSubmission(attempt.id, content)
      rememberSubmissionContext(result.submissionId, {
        problemId: problem.id,
        attemptId: attempt.id,
      })
      navigate(`/submissions/${result.submissionId}`)
    } catch (err: unknown) {
      if (err instanceof ApiError && err.status === 409 && err.submissionId) {
        rememberSubmissionContext(err.submissionId, {
          problemId: problem.id,
          attemptId: attempt.id,
        })
        setDuplicateId(err.submissionId)
        setFormError(formatApiError(err))
      } else {
        setFormError(formatApiError(err))
      }
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <LoadingState label="Loading problem…" />
  if (error) return <ErrorState message={error} />
  if (!problem) return <ErrorState message="Problem not found." />

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm text-ink-muted">
          <Link to="/" className="hover:underline">
            Problems
          </Link>
          <span aria-hidden="true"> / </span>
          {problem.title}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="font-serif text-3xl font-medium tracking-tight">{problem.title}</h1>
          <DifficultyBadge difficulty={problem.difficulty} />
        </div>
        <p className="mt-2 text-ink-muted">{problem.summary}</p>
      </div>

      <section>
        <h2 className="font-serif text-xl font-medium">Requirements</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-ink">
          {problem.requirements.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      <section>
        <h2 className="font-serif text-xl font-medium">Assumptions to start from</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-ink">
          {problem.assumptions.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      {hasCompletedAttempt && problem.changeRequest ? (
        <section className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <h2 className="font-serif text-xl font-medium text-ink">Change request</h2>
          <p className="mt-2 text-sm text-ink">{problem.changeRequest}</p>
          <p className="mt-2 text-xs text-ink-muted">
            Shown because you already have a completed attempt on this problem.
          </p>
        </section>
      ) : null}

      {!attempt ? (
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => void startAttempt()}
            disabled={starting}
            className="rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-accent/90 disabled:cursor-not-allowed disabled:bg-stone-400"
          >
            {starting ? 'Starting…' : 'Start attempt'}
          </button>
          {startError ? <ErrorState message={startError} /> : null}
        </div>
      ) : (
        <section className="rounded-xl border border-line bg-card p-4 sm:p-6">
          <h2 className="font-serif text-xl font-medium">Design — attempt {attempt.number}</h2>
          <p className="mt-1 mb-6 text-sm text-ink-muted">
            Fill every section. Submit sends this snapshot to the API for evaluation.
          </p>
          <DesignForm
            onSubmit={handleSubmit}
            submitting={submitting}
            formError={formError}
          />
          {duplicateId ? (
            <p className="mt-3 text-sm">
              <Link className="font-medium text-accent underline-offset-2 hover:underline" to={`/submissions/${duplicateId}`}>
                Open the existing submission
              </Link>
            </p>
          ) : null}
        </section>
      )}
    </div>
  )
}
