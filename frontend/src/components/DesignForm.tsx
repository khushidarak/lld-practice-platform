import { useMemo, useState, type FormEvent } from 'react'
import type { SubmissionContent } from '../types'
import { ClassRowsEditor, emptyClassRow, type ClassRowDraft } from './ClassRowsEditor'

type FieldErrors = {
  assumptions?: string
  relationships?: string
  keyFlow?: string
  tradeoffs?: string
  classes?: string
  rows: Record<string, string>
}

type Props = {
  onSubmit: (content: SubmissionContent) => Promise<void>
  submitting: boolean
  formError: string | null
}

function isBlank(value: string): boolean {
  return value.trim().length === 0
}

function validate(draft: {
  assumptions: string
  relationships: string
  keyFlow: string
  tradeoffs: string
  rows: ClassRowDraft[]
}): FieldErrors {
  const errors: FieldErrors = { rows: {} }
  if (isBlank(draft.assumptions)) errors.assumptions = 'Add the assumptions you are designing under.'
  if (isBlank(draft.relationships)) errors.relationships = 'Describe how the types relate.'
  if (isBlank(draft.keyFlow)) errors.keyFlow = 'Walk through one important scenario.'
  if (isBlank(draft.tradeoffs)) errors.tradeoffs = 'Name at least one trade-off or extension point.'

  const completeRows = draft.rows.filter(
    (row) =>
      !isBlank(row.name) &&
      !isBlank(row.responsibility) &&
      !isBlank(row.keyMethods),
  )
  if (completeRows.length === 0) {
    errors.classes = 'Add at least one class or interface with name, responsibility, and methods.'
  }

  for (const row of draft.rows) {
    const missing: string[] = []
    if (isBlank(row.name)) missing.push('name')
    if (isBlank(row.responsibility)) missing.push('responsibility')
    if (isBlank(row.keyMethods)) missing.push('key methods')
    const anyFilled =
      !isBlank(row.name) || !isBlank(row.responsibility) || !isBlank(row.keyMethods)
    if (anyFilled && missing.length) {
      errors.rows[row.id] = `This row still needs: ${missing.join(', ')}.`
    }
  }

  return errors
}

function hasErrors(errors: FieldErrors): boolean {
  return Boolean(
    errors.assumptions ||
      errors.relationships ||
      errors.keyFlow ||
      errors.tradeoffs ||
      errors.classes ||
      Object.keys(errors.rows).length,
  )
}

export function DesignForm({ onSubmit, submitting, formError }: Props) {
  const [assumptions, setAssumptions] = useState('')
  const [relationships, setRelationships] = useState('')
  const [keyFlow, setKeyFlow] = useState('')
  const [tradeoffs, setTradeoffs] = useState('')
  const [rows, setRows] = useState<ClassRowDraft[]>([emptyClassRow()])
  const [showErrors, setShowErrors] = useState(false)

  const errors = useMemo(
    () => validate({ assumptions, relationships, keyFlow, tradeoffs, rows }),
    [assumptions, relationships, keyFlow, tradeoffs, rows],
  )
  const requiredEmpty = hasErrors(errors)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setShowErrors(true)
    if (hasErrors(errors)) return

    const content: SubmissionContent = {
      assumptions: assumptions.trim(),
      relationships: relationships.trim(),
      keyFlow: keyFlow.trim(),
      tradeoffs: tradeoffs.trim(),
      classes: rows
        .filter(
          (row) =>
            !isBlank(row.name) &&
            !isBlank(row.responsibility) &&
            !isBlank(row.keyMethods),
        )
        .map((row) => ({
          name: row.name.trim(),
          kind: row.kind,
          responsibility: row.responsibility.trim(),
          keyMethods: row.keyMethods
            .split(',')
            .map((method) => method.trim())
            .filter(Boolean),
        })),
    }
    await onSubmit(content)
  }

  const fieldClass =
    'mt-1 w-full rounded-lg border border-line bg-card px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/20'

  return (
    <form onSubmit={handleSubmit} className="space-y-6" noValidate>
      <div>
        <label className="block text-sm font-medium" htmlFor="assumptions">
          Assumptions / clarified requirements
        </label>
        <textarea
          id="assumptions"
          required
          rows={4}
          value={assumptions}
          onChange={(e) => setAssumptions(e.target.value)}
          aria-invalid={showErrors && Boolean(errors.assumptions)}
          aria-describedby={errors.assumptions ? 'assumptions-error' : undefined}
          className={fieldClass}
        />
        {showErrors && errors.assumptions ? (
          <p id="assumptions-error" className="mt-1 text-sm text-bad" role="alert">
            {errors.assumptions}
          </p>
        ) : null}
      </div>

      <ClassRowsEditor
        rows={rows}
        errors={showErrors ? errors.rows : {}}
        onChange={setRows}
      />
      {showErrors && errors.classes ? (
        <p className="text-sm text-bad" role="alert">
          {errors.classes}
        </p>
      ) : null}

      <div>
        <label className="block text-sm font-medium" htmlFor="relationships">
          Relationships
        </label>
        <p className="text-sm text-ink-muted">has-a, is-a, depends-on</p>
        <textarea
          id="relationships"
          required
          rows={4}
          value={relationships}
          onChange={(e) => setRelationships(e.target.value)}
          aria-invalid={showErrors && Boolean(errors.relationships)}
          aria-describedby={errors.relationships ? 'relationships-error' : undefined}
          className={fieldClass}
        />
        {showErrors && errors.relationships ? (
          <p id="relationships-error" className="mt-1 text-sm text-bad" role="alert">
            {errors.relationships}
          </p>
        ) : null}
      </div>

      <div>
        <label className="block text-sm font-medium" htmlFor="keyFlow">
          Key flow
        </label>
        <p className="text-sm text-ink-muted">
          What happens in one scenario, e.g. when a car is parked.
        </p>
        <textarea
          id="keyFlow"
          required
          rows={5}
          value={keyFlow}
          onChange={(e) => setKeyFlow(e.target.value)}
          aria-invalid={showErrors && Boolean(errors.keyFlow)}
          aria-describedby={errors.keyFlow ? 'keyFlow-error' : undefined}
          className={fieldClass}
        />
        {showErrors && errors.keyFlow ? (
          <p id="keyFlow-error" className="mt-1 text-sm text-bad" role="alert">
            {errors.keyFlow}
          </p>
        ) : null}
      </div>

      <div>
        <label className="block text-sm font-medium" htmlFor="tradeoffs">
          Trade-offs & extension points
        </label>
        <textarea
          id="tradeoffs"
          required
          rows={4}
          value={tradeoffs}
          onChange={(e) => setTradeoffs(e.target.value)}
          aria-invalid={showErrors && Boolean(errors.tradeoffs)}
          aria-describedby={errors.tradeoffs ? 'tradeoffs-error' : undefined}
          className={fieldClass}
        />
        {showErrors && errors.tradeoffs ? (
          <p id="tradeoffs-error" className="mt-1 text-sm text-bad" role="alert">
            {errors.tradeoffs}
          </p>
        ) : null}
      </div>

      {formError ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-bad" role="alert">
          {formError}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={submitting || requiredEmpty}
        className="rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-accent/90 disabled:cursor-not-allowed disabled:bg-stone-400"
      >
        {submitting ? 'Submitting…' : 'Submit design'}
      </button>
    </form>
  )
}
