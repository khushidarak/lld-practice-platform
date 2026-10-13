import type { CriterionResult } from '../types'

type Props = {
  result: CriterionResult
}

function ScoreBar({ score }: { score: number }) {
  const clamped = Math.max(0, Math.min(4, Math.round(score)))
  return (
    <div className="flex items-center gap-2" aria-label={`Score ${clamped} out of 4`}>
      <div className="flex gap-0.5" aria-hidden="true">
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className={`h-2.5 w-5 rounded-sm ${i < clamped ? 'bg-accent' : 'bg-paper-2'}`}
          />
        ))}
      </div>
      <span className="text-sm font-medium tabular-nums text-ink">{clamped}/4</span>
    </div>
  )
}

const SOURCE_LABEL: Record<CriterionResult['source'], string> = {
  rule: 'Rule check',
  llm: 'AI',
}

export function CriterionCard({ result }: Props) {
  return (
    <article className="rounded-xl border border-line bg-card p-4 shadow-sm">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <h3 className="font-serif text-lg font-medium text-ink">{result.criterion}</h3>
        <div className="flex flex-wrap items-center gap-2">
          <ScoreBar score={result.score} />
          <span className="rounded-full border border-line bg-paper px-2 py-0.5 text-xs text-ink-muted">
            {SOURCE_LABEL[result.source]}
          </span>
          <span className="text-xs capitalize text-ink-muted">
            {result.confidence} confidence
          </span>
        </div>
      </header>

      <dl className="mt-3 space-y-2 text-sm">
        {result.evidence ? (
          <div>
            <dt className="font-medium text-ink-muted">Evidence</dt>
            <dd className="mt-0.5 border-l-2 border-accent/40 pl-3 text-ink italic">
              “{result.evidence}”
            </dd>
          </div>
        ) : null}
        {result.concern ? (
          <div>
            <dt className="font-medium text-ink-muted">Concern</dt>
            <dd className="mt-0.5 text-ink">{result.concern}</dd>
          </div>
        ) : null}
        {result.suggestion ? (
          <div>
            <dt className="font-medium text-ink-muted">Suggestion</dt>
            <dd className="mt-0.5 text-ink">{result.suggestion}</dd>
          </div>
        ) : null}
      </dl>
    </article>
  )
}
