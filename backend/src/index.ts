import express from 'express'
import cors from 'cors'
import { initDatabase } from './database.js'
import { EvaluationService } from './services/evaluationService.js'
import problemsRouter from './routes/problems.js'
import attemptsRouter from './routes/attempts.js'
import submissionsRouter, { setEvaluationService } from './routes/submissions.js'
import progressRouter from './routes/progress.js'

const app = express()
const PORT = process.env.PORT || 3000

// Middleware
app.use(cors())
app.use(express.json())

// Initialize database
initDatabase()

// Initialize evaluation service
const openaiApiKey = process.env.OPENAI_API_KEY
const evaluationService = new EvaluationService(openaiApiKey)
setEvaluationService(evaluationService)

// Routes
app.use('/api/problems', problemsRouter)
app.use('/api/attempts', attemptsRouter)
app.use('/api/submissions', submissionsRouter)
app.use('/api/progress', progressRouter)

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', llm: !!openaiApiKey })
})

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
  console.log(`LLM evaluation: ${openaiApiKey ? 'enabled' : 'disabled (rule-based only)'}`)
})
