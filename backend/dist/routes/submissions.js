import { Router } from 'express';
import { SubmissionRepository } from '../repositories/submissionRepository.js';
import { AttemptRepository } from '../repositories/attemptRepository.js';
const router = Router();
const submissionRepo = new SubmissionRepository();
const attemptRepo = new AttemptRepository();
// Store evaluation service instance for background processing
let evaluationService = null;
export function setEvaluationService(service) {
    evaluationService = service;
}
router.post('/', (req, res) => {
    const { attemptId, content } = req.body;
    if (!attemptId || !content) {
        return res.status(400).json({ error: 'attemptId and content are required' });
    }
    // Validate content
    const errors = validateContent(content);
    if (errors.length > 0) {
        return res.status(400).json({ error: errors.join(', ') });
    }
    try {
        const submission = submissionRepo.create(attemptId, content);
        // Trigger background evaluation
        if (evaluationService) {
            // Run in background without awaiting
            evaluationService.evaluateSubmission(submission.id).catch(err => {
                console.error('Background evaluation failed:', err);
            });
        }
        res.status(201).json({ submissionId: submission.id, status: submission.status });
    }
    catch (error) {
        if (error instanceof Error && error.message === 'DUPLICATE_SUBMISSION') {
            return res.status(409).json({ error: 'This design was already submitted' });
        }
        res.status(500).json({ error: 'Failed to create submission' });
    }
});
router.get('/:id', (req, res) => {
    const submission = submissionRepo.findById(req.params.id);
    if (!submission) {
        return res.status(404).json({ error: 'Submission not found' });
    }
    res.json(submission);
});
router.post('/:id/retry', (req, res) => {
    const submission = submissionRepo.findById(req.params.id);
    if (!submission) {
        return res.status(404).json({ error: 'Submission not found' });
    }
    if (submission.status !== 'FAILED') {
        return res.status(400).json({ error: 'Only a failed submission can be retried' });
    }
    // Reset to SUBMITTED
    submissionRepo.updateStatus(submission.id, 'SUBMITTED', {
        evaluatingAt: undefined,
        completedAt: undefined,
        failureReason: undefined,
    });
    // Trigger background evaluation
    if (evaluationService) {
        evaluationService.evaluateSubmission(submission.id).catch(err => {
            console.error('Background evaluation failed:', err);
        });
    }
    res.json({ submissionId: submission.id, status: 'SUBMITTED' });
});
function validateContent(content) {
    const errors = [];
    if (!content.assumptions?.trim())
        errors.push('Assumptions are required');
    if (!content.relationships?.trim())
        errors.push('Relationships are required');
    if (!content.keyFlow?.trim())
        errors.push('Key flow is required');
    if (!content.tradeoffs?.trim())
        errors.push('Trade-offs are required');
    if (!content.classes?.length)
        errors.push('At least one class is required');
    content.classes?.forEach((cls, index) => {
        if (!cls.name?.trim() || !cls.responsibility?.trim() || !cls.keyMethods?.length) {
            errors.push(`Class row ${index + 1} is incomplete`);
        }
    });
    return errors;
}
export default router;
