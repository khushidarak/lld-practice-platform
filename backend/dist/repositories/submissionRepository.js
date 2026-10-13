import { submissions, evaluations } from '../database.js';
export class SubmissionRepository {
    create(attemptId, content) {
        const id = crypto.randomUUID();
        const contentHash = this.hashContent(content);
        const status = 'SUBMITTED';
        const createdAt = new Date().toISOString();
        // Check for duplicate
        const existing = Array.from(submissions.values()).find(s => s.attemptId === attemptId && s.contentHash === contentHash);
        if (existing) {
            throw new Error('DUPLICATE_SUBMISSION');
        }
        const submission = { id, attemptId, content, contentHash, status, createdAt };
        submissions.set(id, submission);
        return submission;
    }
    findById(id) {
        const submission = submissions.get(id);
        if (!submission)
            return null;
        const evaluation = evaluations.get(id);
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
        };
    }
    updateStatus(id, status, metadata) {
        const submission = submissions.get(id);
        if (!submission)
            return;
        submission.status = status;
        if (metadata?.evaluatingAt)
            submission.evaluatingAt = metadata.evaluatingAt;
        if (metadata?.completedAt)
            submission.completedAt = metadata.completedAt;
        if (metadata?.failureReason)
            submission.failureReason = metadata.failureReason;
    }
    saveEvaluation(submissionId, evaluation) {
        evaluations.set(submissionId, evaluation);
    }
    hashContent(content) {
        return JSON.stringify(content);
    }
}
