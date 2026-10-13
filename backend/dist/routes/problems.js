import { Router } from 'express';
import { ProblemRepository } from '../repositories/problemRepository.js';
const router = Router();
const problemRepo = new ProblemRepository();
router.get('/', (req, res) => {
    const problems = problemRepo.findAll();
    res.json(problems.map(p => ({
        id: p.id,
        title: p.title,
        summary: p.summary,
        difficulty: p.difficulty,
    })));
});
router.get('/:id', (req, res) => {
    const problem = problemRepo.findById(req.params.id);
    if (!problem) {
        return res.status(404).json({ error: 'Problem not found' });
    }
    res.json(problem);
});
export default router;
