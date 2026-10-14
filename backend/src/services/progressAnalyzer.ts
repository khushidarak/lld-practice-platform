import { SubmissionRepository } from '../repositories/submissionRepository.js'
import type { Progress, WeakCriterion } from '../types.js'

export class ProgressAnalyzer {
  private submissionRepo: SubmissionRepository

  constructor(submissionRepo: SubmissionRepository = new SubmissionRepository()) {
    this.submissionRepo = submissionRepo
  }

  analyze(): Progress {
    const totals = new Map<string, { criterion: string; sum: number; attempts: number }>()

    for (const { evaluation } of this.submissionRepo.findCompletedWithEvaluations()) {
      for (const result of evaluation.results) {
        const prev = totals.get(result.criterionId) ?? {
          criterion: result.criterion,
          sum: 0,
          attempts: 0,
        }
        prev.sum += result.score
        prev.attempts += 1
        totals.set(result.criterionId, prev)
      }
    }

    const weakCriteria: WeakCriterion[] = [...totals.entries()]
      .map(([criterionId, value]) => ({
        criterionId,
        criterion: value.criterion,
        averageScore: Math.round((value.sum / value.attempts) * 10) / 10,
        attempts: value.attempts,
      }))
      .sort((a, b) => a.averageScore - b.averageScore)
      .slice(0, 4)

    return { weakCriteria }
  }
}
