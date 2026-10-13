import { Router } from 'express';
import { AttemptRepository } from '../repositories/attemptRepository.js';
import { ProblemRepository } from '../repositories/problemRepository.js';
const router = Router();
const attemptRepo = new AttemptRepository();
const problemRepo = new ProblemRepository();
router.post('/', (req, res) => {
    const { problemId } = req.body;
    if (!problemId) {
        return res.status(400).json({ error: 'problemId is required' });
    }
    const problem = problemRepo.findById(problemId);
    if (!problem) {
        return res.status(400).json({ error: 'Invalid problemId' });
    }
    const attempt = attemptRepo.create(problemId);
    res.status(201).json(attempt);
});
router.get('/', (req, res) => {
    const attempts = attemptRepo.findAll();
    res.json(attempts);
});
router.get('/:id', (req, res) => {
    const attempt = attemptRepo.findById(req.params.id);
    if (!attempt) {
        return res.status(404).json({ error: 'Attempt not found' });
    }
    res.json(attempt);
});
export default router;
