import { describe, it, expect, beforeEach } from 'vitest'
import { ProgressAnalyzer } from '../services/progressAnalyzer.js'
import { evaluations, submissions, resetDatabase } from '../database.js'
import { llmResult } from './fixtures.js'
import type { SubmissionStatus } from '../types.js'

function addEvaluated(id: string, status: SubmissionStatus, scores: Record<string, number>) {
  submissions.set(id, { id, attemptId: 'a', content: {} as any, contentHash: id, status, createdAt: id })
  evaluations.set(id, {
    overallScore: 0, summary: '', degraded: false,
    results: Object.entries(scores).map(([k, v]) => llmResult(k, v)),
  })
}

describe('ProgressAnalyzer', () => {
  beforeEach(() => resetDatabase())

  it('returns no weak criteria when there is no history', () => {
    expect(new ProgressAnalyzer().analyze().weakCriteria).toEqual([])
  })

  it('averages scores per criterion and sorts weakest first', () => {
    addEvaluated('s1', 'COMPLETED', { coupling: 1, tradeoffs: 4 })
    addEvaluated('s2', 'COMPLETED', { coupling: 2, tradeoffs: 4 })
    const [first, second] = new ProgressAnalyzer().analyze().weakCriteria
    expect(first).toMatchObject({ criterionId: 'coupling', averageScore: 1.5, attempts: 2 })
    expect(second.criterionId).toBe('tradeoffs')
  })

  it('ignores evaluations whose submission is not COMPLETED', () => {
    addEvaluated('s1', 'FAILED', { coupling: 0 })
    expect(new ProgressAnalyzer().analyze().weakCriteria).toEqual([])
  })

  it('returns at most four criteria', () => {
    addEvaluated('s1', 'COMPLETED', { a: 1, b: 2, c: 3, d: 4, e: 0 })
    expect(new ProgressAnalyzer().analyze().weakCriteria).toHaveLength(4)
  })
})
