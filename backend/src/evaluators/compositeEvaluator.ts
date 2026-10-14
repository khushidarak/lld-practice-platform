import type { CriterionResult, SubmissionContent } from '../types.js'
import type { Evaluator } from './evaluator.js'
import { RuleBasedEvaluator } from './ruleBasedEvaluator.js'

/**
 * Runs the deterministic rule evaluator first, then (optionally) a judgement
 * evaluator such as the LLM one. If the judgement evaluator fails, the
 * learner still gets rule-based feedback (degraded mode) instead of an error.
 */
export class CompositeEvaluator implements Evaluator {
  constructor(
    private readonly judgementEvaluator?: Evaluator,
    private readonly ruleEvaluator: Evaluator = new RuleBasedEvaluator(),
  ) {}

  async evaluate(content: SubmissionContent, problemRequirements: string[]): Promise<CriterionResult[]> {
    const ruleResults = await this.ruleEvaluator.evaluate(content, problemRequirements)

    if (!this.judgementEvaluator) return ruleResults

    try {
      const judgementResults = await this.judgementEvaluator.evaluate(content, problemRequirements)
      return this.mergeResults(ruleResults, judgementResults)
    } catch (error) {
      console.error('Judgement evaluation failed, using rule results only:', error)
      return ruleResults
    }
  }

  private mergeResults(ruleResults: CriterionResult[], judgementResults: CriterionResult[]): CriterionResult[] {
    const merged = new Map<string, CriterionResult>()

    // Rule results take precedence for criteria they own
    for (const result of ruleResults) merged.set(result.criterionId, result)

    // Add judgement results only for criteria the rules don't cover
    for (const result of judgementResults) {
      if (!merged.has(result.criterionId)) merged.set(result.criterionId, result)
    }

    return Array.from(merged.values())
  }
}
