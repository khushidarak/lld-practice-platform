import { problems } from '../database.js'
import type { Problem } from '../types.js'

export class ProblemRepository {
  findAll(): Problem[] {
    return Array.from(problems.values())
  }

  findById(id: string): Problem | null {
    return problems.get(id) || null
  }
}
