import { CompositeEvaluator } from '../evaluators/compositeEvaluator.js'
import type { Evaluator } from '../evaluators/evaluator.js'
import { LLMEvaluator } from '../evaluators/llmEvaluator.js'
import { SubmissionRepository } from '../repositories/submissionRepository.js'
import { ProblemRepository } from '../repositories/problemRepository.js'
import { AttemptRepository } from '../repositories/attemptRepository.js'
import type { Evaluation, SubmissionStatus } from '../types.js'

export class EvaluationService {
  private submissionRepo: SubmissionRepository
  private problemRepo: ProblemRepository
  private attemptRepo: AttemptRepository
  private evaluator: Evaluator

  constructor(openaiApiKey?: string, evaluator?: Evaluator) {
    this.submissionRepo = new SubmissionRepository()
    this.problemRepo = new ProblemRepository()
    this.attemptRepo = new AttemptRepository()

    const llmEvaluator = openaiApiKey ? new LLMEvaluator(openaiApiKey) : undefined
    this.evaluator = evaluator ?? new CompositeEvaluator(llmEvaluator)
  }

  async evaluateSubmission(submissionId: string): Promise<void> {
    const submission = this.submissionRepo.findById(submissionId)
    if (!submission) return

    // State-transition guard: only SUBMITTED or FAILED may move to EVALUATING.
    // Throws outside the try block so an illegal transition never marks FAILED.
    if (submission.status !== 'SUBMITTED' && submission.status !== 'FAILED') {
      throw new Error(`Illegal state transition: ${submission.status} -> EVALUATING`)
    }

    // Mark as evaluating
    this.submissionRepo.updateStatus(submissionId, 'EVALUATING', {
      evaluatingAt: new Date().toISOString(),
    })

    try {
      const attempt = this.attemptRepo.findById(submission.attemptId)
      if (!attempt) {
        throw new Error('Attempt not found')
      }

      const problem = this.problemRepo.findById(attempt.problemId)
      if (!problem) {
        throw new Error('Problem not found')
      }

      // Run evaluation
      const results = await this.evaluator.evaluate(submission.content, problem.requirements)

      // Calculate overall score
      const overallScore = this.calculateOverallScore(results)

      // Generate summary
      const summary = this.generateSummary(results, overallScore)

      // Check if degraded (only rule results)
      const degraded = results.every(r => r.source === 'rule')

      const evaluation: Evaluation = {
        overallScore,
        summary,
        degraded,
        results,
      }

      // Save evaluation
      this.submissionRepo.saveEvaluation(submissionId, evaluation)

      // Mark as completed
      this.submissionRepo.updateStatus(submissionId, 'COMPLETED', {
        completedAt: new Date().toISOString(),
      })
    } catch (error) {
      console.error('Evaluation failed:', error)
      this.submissionRepo.updateStatus(submissionId, 'FAILED', {
        completedAt: new Date().toISOString(),
        failureReason: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  }

  /**
   * Startup sweep: re-queue submissions left in EVALUATING by an unclean
   * shutdown. Resets them to SUBMITTED (so the transition guard allows the
   * move) and runs evaluation again.
   */
  async requeueStuckSubmissions(): Promise<void> {
    const stuck = this.submissionRepo.findEvaluating()
    for (const submission of stuck) {
      this.submissionRepo.updateStatus(submission.id, 'SUBMITTED', {
        evaluatingAt: undefined,
      })
      await this.evaluateSubmission(submission.id)
    }
  }

  private calculateOverallScore(results: any[]): number {
    if (results.length === 0) return 0
    const sum = results.reduce((acc, r) => acc + r.score, 0)
    return Math.round((sum / results.length) * 10) / 10
  }

  private generateSummary(results: any[], overallScore: number): string {
    const weak = results.filter(r => r.score < 3)
    if (weak.length === 0) {
      return 'Strong design with clear responsibilities and good structure.'
    }
    const weakNames = weak.map(r => r.criterion).slice(0, 2).join(', ')
    return `Overall score ${overallScore}/4. Focus on improving: ${weakNames}.`
  }
}
