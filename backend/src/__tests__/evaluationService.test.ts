import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { EvaluationService } from '../services/evaluationService.js'
import { SubmissionRepository } from '../repositories/submissionRepository.js'
import { AttemptRepository } from '../repositories/attemptRepository.js'
import { resetDatabase } from '../database.js'
import type { Evaluator } from '../evaluators/evaluator.js'
import { CompositeEvaluator } from '../evaluators/compositeEvaluator.js'
import { goodDesign, llmResult } from './fixtures.js'

const submissions = new SubmissionRepository()
const attempts = new AttemptRepository()

function newSubmission() {
  const attempt = attempts.create('parking-lot')
  return submissions.create(attempt.id, goodDesign())
}

describe('EvaluationService', () => {
  beforeEach(() => { resetDatabase(); vi.spyOn(console, 'error').mockImplementation(() => {}) })
  afterEach(() => vi.restoreAllMocks())

  it('moves SUBMITTED -> EVALUATING -> COMPLETED and stores the evaluation', async () => {
    const sub = newSubmission()
    let statusDuringEval: string | undefined
    const evaluator: Evaluator = {
      evaluate: async () => { statusDuringEval = submissions.findById(sub.id)?.status; return [llmResult('coupling', 4)] },
    }
    await new EvaluationService(undefined, evaluator).evaluateSubmission(sub.id)

    const done = submissions.findById(sub.id)!
    expect(statusDuringEval).toBe('EVALUATING')
    expect(done.status).toBe('COMPLETED')
    expect(done.evaluation?.overallScore).toBe(4)
    expect(done.completedAt).toBeDefined()
  })

  it('runs rule-only (no API key) and marks the evaluation degraded', async () => {
    const sub = newSubmission()
    await new EvaluationService().evaluateSubmission(sub.id)
    const done = submissions.findById(sub.id)!
    expect(done.status).toBe('COMPLETED')
    expect(done.evaluation?.degraded).toBe(true)
  })

  it('is not degraded when judgement results are present', async () => {
    const sub = newSubmission()
    const evaluator: Evaluator = { evaluate: async () => [llmResult('coupling')] }
    await new EvaluationService(undefined, evaluator).evaluateSubmission(sub.id)
    expect(submissions.findById(sub.id)?.evaluation?.degraded).toBe(false)
  })

  it('marks the submission FAILED with a reason when the evaluator throws', async () => {
    const sub = newSubmission()
    const evaluator: Evaluator = { evaluate: async () => { throw new Error('evaluator exploded') } }
    await new EvaluationService(undefined, evaluator).evaluateSubmission(sub.id)

    const failed = submissions.findById(sub.id)!
    expect(failed.status).toBe('FAILED')
    expect(failed.failureReason).toBe('evaluator exploded')
    expect(failed.evaluation).toBeUndefined()
  })

  it('does not crash for an unknown submission id', async () => {
    await expect(new EvaluationService().evaluateSubmission('nope')).resolves.toBeUndefined()
  })

  describe('state-transition guard', () => {
    it('rejects a submission stuck in EVALUATING without changing it', async () => {
      const sub = newSubmission()
      submissions.updateStatus(sub.id, 'EVALUATING', {})
      const evaluator: Evaluator = { evaluate: async () => [llmResult('coupling')] }

      await expect(new EvaluationService(undefined, evaluator).evaluateSubmission(sub.id))
        .rejects.toThrow('Illegal state transition: EVALUATING -> EVALUATING')

      const still = submissions.findById(sub.id)!
      expect(still.status).toBe('EVALUATING')
      expect(still.failureReason).toBeUndefined()
      expect(still.evaluation).toBeUndefined()
    })

    it('rejects a COMPLETED submission without re-evaluating it', async () => {
      const sub = newSubmission()
      const evaluator: Evaluator = { evaluate: async () => [llmResult('coupling', 4)] }
      const service = new EvaluationService(undefined, evaluator)
      await service.evaluateSubmission(sub.id)
      const firstScore = submissions.findById(sub.id)!.evaluation

      const slow: Evaluator = { evaluate: async () => [llmResult('coupling', 1)] }
      await expect(new EvaluationService(undefined, slow).evaluateSubmission(sub.id))
        .rejects.toThrow('Illegal state transition')
      expect(submissions.findById(sub.id)!.evaluation).toEqual(firstScore)
    })

    it('allows FAILED -> EVALUATING (the retry path)', async () => {
      const sub = newSubmission()
      submissions.updateStatus(sub.id, 'FAILED', { failureReason: 'boom' })
      const evaluator: Evaluator = { evaluate: async () => [llmResult('coupling', 3)] }
      await new EvaluationService(undefined, evaluator).evaluateSubmission(sub.id)

      const done = submissions.findById(sub.id)!
      expect(done.status).toBe('COMPLETED')
      expect(done.failureReason).toBeUndefined()
    })
  })

  it('falls back to rule results (degraded) when the LLM judge fails', async () => {
    const sub = newSubmission()
    const judge: Evaluator = { evaluate: async () => { throw new Error('LLM evaluation failed') } }
    const service = new EvaluationService(undefined, new CompositeEvaluator(judge))
    await service.evaluateSubmission(sub.id)

    const done = submissions.findById(sub.id)!
    expect(done.status).toBe('COMPLETED')
    expect(done.evaluation?.degraded).toBe(true)
    expect(done.evaluation!.results.every(r => r.source === 'rule')).toBe(true)
    expect(done.evaluation!.results.length).toBeGreaterThan(0)
  })

  describe('startup sweep', () => {
    it('re-runs submissions left EVALUATING and clears the stale state', async () => {
      const sub = newSubmission()
      submissions.updateStatus(sub.id, 'EVALUATING', { evaluatingAt: '2020-01-01T00:00:00.000Z' })

      const evaluator: Evaluator = { evaluate: async () => [llmResult('coupling', 3)] }
      await new EvaluationService(undefined, evaluator).requeueStuckSubmissions()

      const done = submissions.findById(sub.id)!
      expect(done.status).toBe('COMPLETED')
      expect(done.evaluation?.overallScore).toBe(3)
      // evaluatingAt is refreshed for the new run, not left stale from the old one.
      expect(done.evaluatingAt).toBeDefined()
      expect(done.evaluatingAt).not.toBe('2020-01-01T00:00:00.000Z')
    })

    it('leaves healthy submissions alone', async () => {
      const sub = newSubmission()
      const evaluator: Evaluator = { evaluate: async () => [llmResult('coupling')] }
      await new EvaluationService(undefined, evaluator).requeueStuckSubmissions()
      expect(submissions.findById(sub.id)!.status).toBe('SUBMITTED')
    })
  })

  it('summarises weak criteria in the evaluation summary', async () => {
    const sub = newSubmission()
    const evaluator: Evaluator = { evaluate: async () => [llmResult('coupling', 1), llmResult('tradeoffs', 4)] }
    await new EvaluationService(undefined, evaluator).evaluateSubmission(sub.id)
    const summary = submissions.findById(sub.id)!.evaluation!.summary
    expect(summary).toContain('coupling')
    expect(summary).not.toContain('tradeoffs')
  })

  it('gives overallScore 0 when there are no results', async () => {
    const sub = newSubmission()
    const evaluator: Evaluator = { evaluate: async () => [] }
    await new EvaluationService(undefined, evaluator).evaluateSubmission(sub.id)
    expect(submissions.findById(sub.id)?.evaluation?.overallScore).toBe(0)
  })
})
