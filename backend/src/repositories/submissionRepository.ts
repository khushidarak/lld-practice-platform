import { submissions, evaluations } from '../database.js'
import type { Submission, SubmissionDetail, SubmissionContent, Evaluation, SubmissionStatus } from '../types.js'

export class SubmissionRepository {
  create(attemptId: string, content: SubmissionContent): Submission {
    const id = crypto.randomUUID()
    const contentHash = this.hashContent(content)
    const status: SubmissionStatus = 'SUBMITTED'
    const createdAt = new Date().toISOString()

    // Check for duplicate
    const existing = Array.from(submissions.values()).find(
      s => s.attemptId === attemptId && s.contentHash === contentHash
    )
    if (existing) {
      throw new Error('DUPLICATE_SUBMISSION')
    }

    const submission: Submission = { id, attemptId, content, contentHash, status, createdAt }
    submissions.set(id, submission)

    return submission
  }

  findById(id: string): SubmissionDetail | null {
    const submission = submissions.get(id)
    if (!submission) return null

    const evaluation = evaluations.get(id)

    return {
      id: submission.id,
      attemptId: submission.attemptId,
      content: submission.content,
      contentHash: submission.contentHash,
      status: submission.status,
      createdAt: submission.createdAt,
      evaluatingAt: submission.evaluatingAt,
      completedAt: submission.completedAt,
      failureReason: submission.failureReason,
      evaluation,
    }
  }

  updateStatus(id: string, status: SubmissionStatus, metadata?: { evaluatingAt?: string; completedAt?: string; failureReason?: string }): void {
    const submission = submissions.get(id)
    if (!submission) return

    submission.status = status
    // 'in' check so callers can clear a field by passing undefined (used on retry)
    if (metadata && 'evaluatingAt' in metadata) submission.evaluatingAt = metadata.evaluatingAt
    if (metadata && 'completedAt' in metadata) submission.completedAt = metadata.completedAt
    if (metadata && 'failureReason' in metadata) submission.failureReason = metadata.failureReason
  }

  saveEvaluation(submissionId: string, evaluation: Evaluation): void {
    evaluations.set(submissionId, evaluation)
  }

  /** Submissions stuck in EVALUATING (e.g. after an unclean shutdown). */
  findEvaluating(): Submission[] {
    return Array.from(submissions.values()).filter(s => s.status === 'EVALUATING')
  }

  /** Completed submissions together with their evaluations, for progress analysis. */
  findCompletedWithEvaluations(): Array<{ submissionId: string; evaluation: Evaluation }> {
    const out: Array<{ submissionId: string; evaluation: Evaluation }> = []
    for (const [submissionId, evaluation] of evaluations.entries()) {
      const submission = submissions.get(submissionId)
      if (submission?.status === 'COMPLETED') out.push({ submissionId, evaluation })
    }
    return out
  }

  private hashContent(content: SubmissionContent): string {
    return JSON.stringify(content)
  }
}
