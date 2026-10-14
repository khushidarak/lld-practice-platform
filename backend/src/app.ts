import express from 'express'
import cors from 'cors'
import { initDatabase } from './database.js'
import type { EvaluationService } from './services/evaluationService.js'
import problemsRouter from './routes/problems.js'
import attemptsRouter from './routes/attempts.js'
import submissionsRouter, { setEvaluationService } from './routes/submissions.js'
import progressRouter from './routes/progress.js'

export function createApp(evaluationService: EvaluationService, options: { llmEnabled?: boolean } = {}) {
  const app = express()
  app.use(cors())
  app.use(express.json())

  initDatabase()
  setEvaluationService(evaluationService)

  app.use('/api/problems', problemsRouter)
  app.use('/api/attempts', attemptsRouter)
  app.use('/api/submissions', submissionsRouter)
  app.use('/api/progress', progressRouter)

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', llm: !!options.llmEnabled })
  })

  return app
}
