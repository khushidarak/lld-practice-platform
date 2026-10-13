import { attempts, submissions, evaluations } from '../database.js';
import { ProblemRepository } from './problemRepository.js';
export class AttemptRepository {
    problemRepo;
    constructor() {
        this.problemRepo = new ProblemRepository();
    }
    create(problemId) {
        const id = crypto.randomUUID();
        const number = this.getNextNumber(problemId);
        const createdAt = new Date().toISOString();
        const attempt = { id, problemId, number, createdAt };
        attempts.set(id, attempt);
        return attempt;
    }
    findAll() {
        const result = [];
        for (const attempt of attempts.values()) {
            const problem = this.problemRepo.findById(attempt.problemId);
            if (!problem)
                continue;
            const attemptSubmissions = Array.from(submissions.values()).filter(s => s.attemptId === attempt.id);
            const latest = attemptSubmissions.sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
            let overallScore = null;
            if (latest && latest.status === 'COMPLETED') {
                const eval_ = evaluations.get(latest.id);
                overallScore = eval_?.overallScore || null;
            }
            result.push({
                id: attempt.id,
                problemId: attempt.problemId,
                number: attempt.number,
                createdAt: attempt.createdAt,
                problemTitle: problem.title,
                latestStatus: latest?.status || null,
                overallScore,
            });
        }
        return result.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    }
    findById(id) {
        const attempt = attempts.get(id);
        if (!attempt)
            return null;
        const attemptSubmissions = Array.from(submissions.values())
            .filter(s => s.attemptId === id)
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        return {
            id: attempt.id,
            problemId: attempt.problemId,
            number: attempt.number,
            createdAt: attempt.createdAt,
            submissions: attemptSubmissions.map(s => ({
                id: s.id,
                status: s.status,
                createdAt: s.createdAt,
            })),
        };
    }
    getNextNumber(problemId) {
        const count = Array.from(attempts.values()).filter(a => a.problemId === problemId).length;
        return count + 1;
    }
}
