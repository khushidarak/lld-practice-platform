import type { CriterionResult, SubmissionContent } from '../types.js'

/**
 * Strategy interface for anything that can grade a design.
 * Rule-based, LLM-based and composite evaluators all implement it, so a new
 * evaluation approach is a new class, not a change to EvaluationService.
 */
export interface Evaluator {
  evaluate(
    content: SubmissionContent,
    problemRequirements: string[],
  ): CriterionResult[] | Promise<CriterionResult[]>
}
