import { Router } from 'express'
import { SubmissionRepository } from '../repositories/submissionRepository.js'
import { AttemptRepository } from '../repositories/attemptRepository.js'
import { EvaluationService } from '../services/evaluationService.js'
import type { SubmissionStatus } from '../types.js'

const router = Router()
const submissionRepo = new SubmissionRepository()
const attemptRepo = new AttemptRepository()

const MAX_TEXT_LENGTH = 5000
const MAX_CLASSES = 30
const MAX_NAME_LENGTH = 120
const MAX_RESPONSIBILITY_LENGTH = 1000
const MAX_METHOD_LENGTH = 120

// Store evaluation service instance for background processing
let evaluationService: EvaluationService | null = null

export function setEvaluationService(service: EvaluationService) {
  evaluationService = service
}

router.post('/', (req, res) => {
  const { attemptId, content } = req.body

  if (!attemptId || !content) {
    return res.status(400).json({ error: 'attemptId and content are required' })
  }

  if (!attemptRepo.findById(attemptId)) {
    return res.status(404).json({ error: 'Attempt not found' })
  }

  // Validate content
  const errors = validateContent(content)
  if (errors.length > 0) {
    return res.status(400).json({ error: errors.join(', ') })
  }

  try {
    const submission = submissionRepo.create(attemptId, content)
    // Capture before evaluation starts: `submission` is a live reference that evaluation mutates.
    const initialStatus = submission.status

    // Trigger background evaluation
    if (evaluationService) {
      // Run in background without awaiting
      evaluationService.evaluateSubmission(submission.id).catch(err => {
        console.error('Background evaluation failed:', err)
      })
    }

    res.status(201).json({ submissionId: submission.id, status: initialStatus })
  } catch (error) {
    if (error instanceof Error && error.message === 'DUPLICATE_SUBMISSION') {
      return res.status(409).json({ error: 'This design was already submitted' })
    }
    res.status(500).json({ error: 'Failed to create submission' })
  }
})

router.get('/:id', (req, res) => {
  const submission = submissionRepo.findById(req.params.id)
  if (!submission) {
    return res.status(404).json({ error: 'Submission not found' })
  }
  res.json(submission)
})

router.post('/:id/retry', (req, res) => {
  const submission = submissionRepo.findById(req.params.id)
  if (!submission) {
    return res.status(404).json({ error: 'Submission not found' })
  }

  if (submission.status !== 'FAILED') {
    return res.status(400).json({ error: 'Only a failed submission can be retried' })
  }

  // Reset to SUBMITTED
  submissionRepo.updateStatus(submission.id, 'SUBMITTED', {
    evaluatingAt: undefined,
    completedAt: undefined,
    failureReason: undefined,
  })

  // Trigger background evaluation
  if (evaluationService) {
    evaluationService.evaluateSubmission(submission.id).catch(err => {
      console.error('Background evaluation failed:', err)
    })
  }

  res.json({ submissionId: submission.id, status: 'SUBMITTED' })
})

function validateContent(content: any): string[] {
  const errors: string[] = []

  if (!content.assumptions?.trim()) errors.push('Assumptions are required')
  if (!content.relationships?.trim()) errors.push('Relationships are required')
  if (!content.keyFlow?.trim()) errors.push('Key flow is required')
  if (!content.tradeoffs?.trim()) errors.push('Trade-offs are required')
  if (!content.classes?.length) errors.push('At least one class is required')

  // Bounds keep a submission (and the LLM prompt built from it) a sane size.
  const TEXT_FIELDS: Array<[string, any]> = [
    ['Assumptions', content.assumptions],
    ['Relationships', content.relationships],
    ['Key flow', content.keyFlow],
    ['Trade-offs', content.tradeoffs],
  ]
  for (const [label, value] of TEXT_FIELDS) {
    if (typeof value === 'string' && value.length > MAX_TEXT_LENGTH) {
      errors.push(`${label} must be at most ${MAX_TEXT_LENGTH} characters`)
    }
  }

  if (Array.isArray(content.classes) && content.classes.length > MAX_CLASSES) {
    errors.push(`At most ${MAX_CLASSES} classes are allowed`)
  }

  content.classes?.forEach((cls: any, index: number) => {
    if (!cls.name?.trim() || !cls.responsibility?.trim() || !cls.keyMethods?.length) {
      errors.push(`Class row ${index + 1} is incomplete`)
    }
    if (typeof cls.name === 'string' && cls.name.length > MAX_NAME_LENGTH) {
      errors.push(`Class row ${index + 1} name must be at most ${MAX_NAME_LENGTH} characters`)
    }
    if (typeof cls.responsibility === 'string' && cls.responsibility.length > MAX_RESPONSIBILITY_LENGTH) {
      errors.push(`Class row ${index + 1} responsibility must be at most ${MAX_RESPONSIBILITY_LENGTH} characters`)
    }
    cls.keyMethods?.forEach((m: any, mIndex: number) => {
      if (typeof m === 'string' && m.length > MAX_METHOD_LENGTH) {
        errors.push(`Class row ${index + 1} method ${mIndex + 1} must be at most ${MAX_METHOD_LENGTH} characters`)
      }
    })
  })

  return errors
}

export default router
