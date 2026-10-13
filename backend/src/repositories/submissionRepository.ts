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
    if (metadata?.evaluatingAt) submission.evaluatingAt = metadata.evaluatingAt
    if (metadata?.completedAt) submission.completedAt = metadata.completedAt
    if (metadata?.failureReason) submission.failureReason = metadata.failureReason
  }

  saveEvaluation(submissionId: string, evaluation: Evaluation): void {
    evaluations.set(submissionId, evaluation)
  }

  private hashContent(content: SubmissionContent): string {
    return JSON.stringify(content)
  }
}
