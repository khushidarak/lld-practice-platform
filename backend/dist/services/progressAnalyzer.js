import { evaluations, submissions } from '../database.js';
export class ProgressAnalyzer {
    analyze() {
        const totals = new Map();
        for (const [submissionId, evaluation] of evaluations.entries()) {
            const submission = submissions.get(submissionId);
            if (!submission || submission.status !== 'COMPLETED')
                continue;
            for (const result of evaluation.results) {
                const prev = totals.get(result.criterionId) ?? {
                    criterion: result.criterion,
                    sum: 0,
                    attempts: 0,
                };
                prev.sum += result.score;
                prev.attempts += 1;
                totals.set(result.criterionId, prev);
            }
        }
        const weakCriteria = [...totals.entries()]
            .map(([criterionId, value]) => ({
            criterionId,
            criterion: value.criterion,
            averageScore: Math.round((value.sum / value.attempts) * 10) / 10,
            attempts: value.attempts,
        }))
            .sort((a, b) => a.averageScore - b.averageScore)
            .slice(0, 4);
        return { weakCriteria };
    }
}
