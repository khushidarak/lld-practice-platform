import type { SubmissionStatus } from '../types'

const STYLES: Record<SubmissionStatus, string> = {
  SUBMITTED: 'border-stone-400 bg-stone-100 text-stone-700',
  EVALUATING: 'border-amber-300 bg-amber-50 text-amber-800',
  COMPLETED: 'border-lime-300 bg-lime-50 text-lime-900',
  FAILED: 'border-red-300 bg-red-50 text-red-800',
}

const LABELS: Record<SubmissionStatus, string> = {
  SUBMITTED: 'Submitted',
  EVALUATING: 'Evaluating',
  COMPLETED: 'Completed',
  FAILED: 'Failed',
}

type Props = {
  status: SubmissionStatus | null
}

export function StatusBadge({ status }: Props) {
  if (!status) {
    return (
      <span className="inline-flex items-center rounded-full border border-dashed border-line px-2.5 py-0.5 text-xs font-medium text-ink-muted">
        No submission
      </span>
    )
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${STYLES[status]}`}
    >
      <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
      {LABELS[status]}
    </span>
  )
}
