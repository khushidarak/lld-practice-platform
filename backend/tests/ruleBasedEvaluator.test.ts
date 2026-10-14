import { describe, it, expect } from 'vitest'
import { RuleBasedEvaluator } from '../src/evaluators/ruleBasedEvaluator.js'
import { goodDesign, REQUIREMENTS } from './fixtures.js'

const evaluator = new RuleBasedEvaluator()
const byId = (results: ReturnType<RuleBasedEvaluator['evaluate']>, id: string) =>
  results.find(r => r.criterionId === id)!

describe('RuleBasedEvaluator', () => {
  it('returns the four deterministic criteria, all sourced from rules', () => {
    const results = evaluator.evaluate(goodDesign(), REQUIREMENTS)
    expect(results.map(r => r.criterionId)).toEqual([
      'sections-present', 'minimum-classes', 'requirement-coverage', 'class-completeness',
    ])
    expect(results.every(r => r.source === 'rule')).toBe(true)
  })

  it('scores a complete design full marks on structure checks', () => {
    const results = evaluator.evaluate(goodDesign(), REQUIREMENTS)
    expect(byId(results, 'sections-present').score).toBe(4)
    expect(byId(results, 'minimum-classes').score).toBe(4)
    expect(byId(results, 'class-completeness').score).toBe(4)
  })

  it('lowers the sections score proportionally when a section is blank', () => {
    const results = evaluator.evaluate(goodDesign({ tradeoffs: '   ' }), REQUIREMENTS)
    expect(byId(results, 'sections-present').score).toBeCloseTo(3.2)
    expect(byId(results, 'sections-present').evidence).not.toContain('trade-offs')
  })

  it('handles a design with no classes without crashing', () => {
    const results = evaluator.evaluate(goodDesign({ classes: [] }), REQUIREMENTS)
    expect(byId(results, 'minimum-classes').score).toBe(0)
    expect(byId(results, 'class-completeness').score).toBe(0)
  })

  it('flags a single-class design with a concern and suggestion', () => {
    const design = goodDesign({ classes: [goodDesign().classes[0]] })
    const r = byId(evaluator.evaluate(design, REQUIREMENTS), 'minimum-classes')
    expect(r.score).toBe(2)
    expect(r.concern).not.toBe('')
    expect(r.suggestion).not.toBe('')
  })

  it('slightly penalises a very large number of classes (over-engineering)', () => {
    const many = Array.from({ length: 6 }, (_, i) => ({
      name: `C${i}`, kind: 'class' as const, responsibility: 'does a thing', keyMethods: ['run'],
    }))
    expect(byId(evaluator.evaluate(goodDesign({ classes: many }), REQUIREMENTS), 'minimum-classes').score).toBe(3)
  })

  it('marks classes with no methods as incomplete', () => {
    const classes = [
      { name: 'A', kind: 'class' as const, responsibility: 'x', keyMethods: ['go'] },
      { name: 'B', kind: 'class' as const, responsibility: 'y', keyMethods: [] },
    ]
    const r = byId(evaluator.evaluate(goodDesign({ classes }), REQUIREMENTS), 'class-completeness')
    expect(r.score).toBe(2)
    expect(r.evidence).toContain('1 of 2')
  })

  it('reports coverage by keyword and lists likely-missing requirements', () => {
    const design = goodDesign({
      assumptions: 'Nothing relevant.',
      keyFlow: 'Nothing relevant.',
      classes: [{ name: 'X', kind: 'class', responsibility: 'does stuff', keyMethods: ['m'] }],
    })
    const r = byId(evaluator.evaluate(design, REQUIREMENTS), 'requirement-coverage')
    expect(r.score).toBeLessThan(4)
    expect(r.concern).toContain('missing')
    expect(r.confidence).toBe('low') // heuristic, so labelled low confidence
  })

  it('does not return NaN when the problem has no requirements', () => {
    const r = byId(evaluator.evaluate(goodDesign(), []), 'requirement-coverage')
    expect(Number.isNaN(r.score)).toBe(false)
  })

  it('is deterministic: same input gives identical output', () => {
    expect(evaluator.evaluate(goodDesign(), REQUIREMENTS)).toEqual(evaluator.evaluate(goodDesign(), REQUIREMENTS))
  })
})
