import { CompositeEvaluator } from '../evaluators/compositeEvaluator.js';
import { LLMEvaluator } from '../evaluators/llmEvaluator.js';
import { SubmissionRepository } from '../repositories/submissionRepository.js';
import { ProblemRepository } from '../repositories/problemRepository.js';
import { AttemptRepository } from '../repositories/attemptRepository.js';
export class EvaluationService {
    submissionRepo;
    problemRepo;
    attemptRepo;
    evaluator;
    constructor(openaiApiKey) {
        this.submissionRepo = new SubmissionRepository();
        this.problemRepo = new ProblemRepository();
        this.attemptRepo = new AttemptRepository();
        const llmEvaluator = openaiApiKey ? new LLMEvaluator(openaiApiKey) : undefined;
        this.evaluator = new CompositeEvaluator(llmEvaluator);
    }
    async evaluateSubmission(submissionId) {
        // Mark as evaluating
        this.submissionRepo.updateStatus(submissionId, 'EVALUATING', {
            evaluatingAt: new Date().toISOString(),
        });
        try {
            const submission = this.submissionRepo.findById(submissionId);
            if (!submission) {
                throw new Error('Submission not found');
            }
            const attempt = this.attemptRepo.findById(submission.attemptId);
            if (!attempt) {
                throw new Error('Attempt not found');
            }
            const problem = this.problemRepo.findById(attempt.problemId);
            if (!problem) {
                throw new Error('Problem not found');
            }
            // Run evaluation
            const results = await this.evaluator.evaluate(submission.content, problem.requirements);
            // Calculate overall score
            const overallScore = this.calculateOverallScore(results);
            // Generate summary
            const summary = this.generateSummary(results, overallScore);
            // Check if degraded (only rule results)
            const degraded = results.every(r => r.source === 'rule');
            const evaluation = {
                overallScore,
                summary,
                degraded,
                results,
            };
            // Save evaluation
            this.submissionRepo.saveEvaluation(submissionId, evaluation);
            // Mark as completed
            this.submissionRepo.updateStatus(submissionId, 'COMPLETED', {
                completedAt: new Date().toISOString(),
            });
        }
        catch (error) {
            console.error('Evaluation failed:', error);
            this.submissionRepo.updateStatus(submissionId, 'FAILED', {
                completedAt: new Date().toISOString(),
                failureReason: error instanceof Error ? error.message : 'Unknown error',
            });
        }
    }
    calculateOverallScore(results) {
        if (results.length === 0)
            return 0;
        const sum = results.reduce((acc, r) => acc + r.score, 0);
        return Math.round((sum / results.length) * 10) / 10;
    }
    generateSummary(results, overallScore) {
        const weak = results.filter(r => r.score < 3);
        if (weak.length === 0) {
            return 'Strong design with clear responsibilities and good structure.';
        }
        const weakNames = weak.map(r => r.criterion).slice(0, 2).join(', ');
        return `Overall score ${overallScore}/4. Focus on improving: ${weakNames}.`;
    }
}
