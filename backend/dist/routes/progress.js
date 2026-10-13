import { Router } from 'express';
import { ProgressAnalyzer } from '../services/progressAnalyzer.js';
const router = Router();
const progressAnalyzer = new ProgressAnalyzer();
router.get('/', (req, res) => {
    const progress = progressAnalyzer.analyze();
    res.json(progress);
});
export default router;
