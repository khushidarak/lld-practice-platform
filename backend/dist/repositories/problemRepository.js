import { problems } from '../database.js';
export class ProblemRepository {
    findAll() {
        return Array.from(problems.values());
    }
    findById(id) {
        return problems.get(id) || null;
    }
}
