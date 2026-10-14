import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { CompositeEvaluator } from '../src/evaluators/compositeEvaluator.js'
import type { Evaluator } from '../src/evaluators/evaluator.js'
import { goodDesign, llmResult, REQUIREMENTS } from './fixtures.js'

describe('CompositeEvaluator', () => {
  beforeEach(() => { vi.spyOn(console, 'error').mockImplementation(() => {}) })
  afterEach(() => vi.restoreAllMocks())

  it('returns only rule results when no judgement evaluator is configured', async () => {
    const out = await new CompositeEvaluator().evaluate(goodDesign(), REQUIREMENTS)
    expect(out.length).toBe(4)
    expect(out.every(r => r.source === 'rule')).toBe(true)
  })

  it('merges rule and judgement results', async () => {
    const judge: Evaluator = { evaluate: async () => [llmResult('coupling'), llmResult('tradeoffs')] }
    const out = await new CompositeEvaluator(judge).evaluate(goodDesign(), REQUIREMENTS)
    expect(out.map(r => r.criterionId)).toEqual([
      'sections-present', 'minimum-classes', 'requirement-coverage', 'class-completeness', 'coupling', 'tradeoffs',
    ])
  })

  it('lets rule results win when both evaluators grade the same criterion', async () => {
    const judge: Evaluator = { evaluate: async () => [llmResult('minimum-classes', 0)] }
    const out = await new CompositeEvaluator(judge).evaluate(goodDesign(), REQUIREMENTS)
    const r = out.filter(x => x.criterionId === 'minimum-classes')
    expect(r).toHaveLength(1)
    expect(r[0].source).toBe('rule')
  })

  it('degrades to rule results when the judgement evaluator throws', async () => {
    const judge: Evaluator = { evaluate: async () => { throw new Error('boom') } }
    const out = await new CompositeEvaluator(judge).evaluate(goodDesign(), REQUIREMENTS)
    expect(out.length).toBe(4)
    expect(out.every(r => r.source === 'rule')).toBe(true)
  })

  it('accepts a custom rule evaluator (extensibility)', async () => {
    const custom: Evaluator = { evaluate: () => [llmResult('custom')] }
    const out = await new CompositeEvaluator(undefined, custom).evaluate(goodDesign(), REQUIREMENTS)
    expect(out.map(r => r.criterionId)).toEqual(['custom'])
  })
})
