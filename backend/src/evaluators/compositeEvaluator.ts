import type { CriterionResult } from '../types.js'
import { RuleBasedEvaluator } from './ruleBasedEvaluator.js'
import { LLMEvaluator } from './llmEvaluator.js'

export class CompositeEvaluator {
  private ruleEvaluator: RuleBasedEvaluator
  private llmEvaluator?: LLMEvaluator

  constructor(llmEvaluator?: LLMEvaluator) {
    this.ruleEvaluator = new RuleBasedEvaluator()
    this.llmEvaluator = llmEvaluator
  }

  async evaluate(content: any, problemRequirements: string[]): Promise<CriterionResult[]> {
    const ruleResults = this.ruleEvaluator.evaluate(content, problemRequirements)

    if (!this.llmEvaluator) {
      // If no LLM, return only rule results and mark as degraded
      return ruleResults
    }

    try {
      const llmResults = await this.llmEvaluator.evaluate(content, problemRequirements)
      return this.mergeResults(ruleResults, llmResults)
    } catch (error) {
      console.error('LLM evaluation failed, using rule results only:', error)
      return ruleResults
    }
  }

  private mergeResults(ruleResults: CriterionResult[], llmResults: CriterionResult[]): CriterionResult[] {
    const merged = new Map<string, CriterionResult>()

    // Rule results take precedence for criteria they own
    for (const result of ruleResults) {
      merged.set(result.criterionId, result)
    }

    // Add LLM results for criteria not covered by rules
    for (const result of llmResults) {
      if (!merged.has(result.criterionId)) {
        merged.set(result.criterionId, result)
      }
    }

    return Array.from(merged.values())
  }
}
