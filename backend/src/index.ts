import { createApp } from './app.js'
import { EvaluationService } from './services/evaluationService.js'

const PORT = process.env.PORT || 3000
const openaiApiKey = process.env.OPENAI_API_KEY

const evaluationService = new EvaluationService(openaiApiKey)
const app = createApp(evaluationService, { llmEnabled: !!openaiApiKey })

// Startup sweep: re-queue submissions left EVALUATING by an unclean shutdown.
evaluationService.requeueStuckSubmissions().catch(err => {
  console.error('Startup sweep failed:', err)
})

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
  console.log(`LLM evaluation: ${openaiApiKey ? 'enabled' : 'disabled (rule-based only)'}`)
})
