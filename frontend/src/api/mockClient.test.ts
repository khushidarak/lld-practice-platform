import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mockApi } from './mockClient'
import type { SubmissionContent } from '../types'

const STORAGE_KEY = 'lld-mock-db'

function clearStorage() {
  localStorage.removeItem(STORAGE_KEY)
}

function createValidContent(): SubmissionContent {
  return {
    assumptions: 'One vehicle per spot',
    relationships: 'ParkingLot has multiple Floors',
    keyFlow: 'Vehicle arrives -> find spot -> issue ticket',
    tradeoffs: 'Simple vs flexible design',
    classes: [
      {
        name: 'ParkingLot',
        kind: 'class',
        responsibility: 'Manages the entire garage',
        keyMethods: ['findSpot', 'issueTicket'],
      },
      {
        name: 'Ticket',
        kind: 'class',
        responsibility: 'Represents a parking session',
        keyMethods: ['calculateFee'],
      },
    ],
  }
}

describe('mockClient', () => {
  beforeEach(() => {
    clearStorage()
  })

  afterEach(() => {
    clearStorage()
  })

  describe('listProblems', () => {
    it('returns all 4 problems with correct structure', async () => {
      const problems = await mockApi.listProblems()
      expect(problems).toHaveLength(4)
      expect(problems[0]).toHaveProperty('id')
      expect(problems[0]).toHaveProperty('title')
      expect(problems[0]).toHaveProperty('summary')
      expect(problems[0]).toHaveProperty('difficulty')
    })

    it('includes parking-lot, elevator, vending-machine, lru-cache', async () => {
      const problems = await mockApi.listProblems()
      const ids = problems.map((p) => p.id)
      expect(ids).toContain('parking-lot')
      expect(ids).toContain('elevator')
      expect(ids).toContain('vending-machine')
      expect(ids).toContain('lru-cache')
    })
  })

  describe('getProblem', () => {
    it('returns problem details for valid id', async () => {
      const problem = await mockApi.getProblem('parking-lot')
      expect(problem.id).toBe('parking-lot')
      expect(problem.title).toBe('Parking Lot')
      expect(problem.requirements).toBeInstanceOf(Array)
      expect(problem.assumptions).toBeInstanceOf(Array)
      expect(problem.changeRequest).toBeTruthy()
    })

    it('throws 404 for invalid problem id', async () => {
      await expect(mockApi.getProblem('invalid')).rejects.toThrow('Problem not found')
    })
  })

  describe('createAttempt', () => {
    it('creates an attempt with incrementing numbers', async () => {
      const attempt1 = await mockApi.createAttempt('parking-lot')
      expect(attempt1.id).toBeTruthy()
      expect(attempt1.problemId).toBe('parking-lot')
      expect(attempt1.number).toBe(1)

      const attempt2 = await mockApi.createAttempt('parking-lot')
      expect(attempt2.number).toBe(2)

      const attempt3 = await mockApi.createAttempt('elevator')
      expect(attempt3.number).toBe(1) // Different problem, resets to 1
    })

    it('throws 400 for invalid problemId', async () => {
      await expect(mockApi.createAttempt('invalid')).rejects.toThrow('Unknown problemId')
    })
  })

  describe('listAttempts', () => {
    it('returns empty list initially', async () => {
      const attempts = await mockApi.listAttempts()
      expect(attempts).toHaveLength(0)
    })

    it('returns attempts sorted by creation time (newest first)', async () => {
      const attempt1 = await mockApi.createAttempt('parking-lot')
      await new Promise((resolve) => setTimeout(resolve, 10))
      const attempt2 = await mockApi.createAttempt('elevator')

      const attempts = await mockApi.listAttempts()
      expect(attempts).toHaveLength(2)
      expect(attempts[0].id).toBe(attempt2.id)
      expect(attempts[1].id).toBe(attempt1.id)
    })

    it('includes problem title and latest status', async () => {
      await mockApi.createAttempt('parking-lot')
      const attempts = await mockApi.listAttempts()

      expect(attempts[0].problemTitle).toBe('Parking Lot')
      expect(attempts[0].latestStatus).toBeNull()
    })
  })

  describe('getAttempt', () => {
    it('returns attempt details', async () => {
      const attempt = await mockApi.createAttempt('parking-lot')
      const detail = await mockApi.getAttempt(attempt.id)

      expect(detail.id).toBe(attempt.id)
      expect(detail.problemId).toBe('parking-lot')
      expect(detail.number).toBe(attempt.number)
      expect(detail.submissions).toHaveLength(0)
    })

    it('throws 404 for invalid attempt id', async () => {
      await expect(mockApi.getAttempt('invalid')).rejects.toThrow('Attempt not found')
    })
  })

  describe('createSubmission', () => {
    it('creates a submission with valid content', async () => {
      const attempt = await mockApi.createAttempt('parking-lot')
      const content = createValidContent()

      const response = await mockApi.createSubmission(attempt.id, content)
      expect(response.submissionId).toBeTruthy()
      expect(response.status).toBe('SUBMITTED')
    })

    it('throws 400 for invalid attempt id', async () => {
      const content = createValidContent()
      await expect(mockApi.createSubmission('invalid', content)).rejects.toThrow(
        'Attempt not found',
      )
    })

    it('rejects empty assumptions', async () => {
      const attempt = await mockApi.createAttempt('parking-lot')
      const content = createValidContent()
      content.assumptions = ''

      await expect(mockApi.createSubmission(attempt.id, content)).rejects.toThrow(
        'Assumptions are required',
      )
    })

    it('rejects empty relationships', async () => {
      const attempt = await mockApi.createAttempt('parking-lot')
      const content = createValidContent()
      content.relationships = ''

      await expect(mockApi.createSubmission(attempt.id, content)).rejects.toThrow(
        'Relationships are required',
      )
    })

    it('rejects empty key flow', async () => {
      const attempt = await mockApi.createAttempt('parking-lot')
      const content = createValidContent()
      content.keyFlow = ''

      await expect(mockApi.createSubmission(attempt.id, content)).rejects.toThrow(
        'Key flow is required',
      )
    })

    it('rejects empty tradeoffs', async () => {
      const attempt = await mockApi.createAttempt('parking-lot')
      const content = createValidContent()
      content.tradeoffs = ''

      await expect(mockApi.createSubmission(attempt.id, content)).rejects.toThrow(
        'Trade-offs are required',
      )
    })

    it('rejects empty classes array', async () => {
      const attempt = await mockApi.createAttempt('parking-lot')
      const content = createValidContent()
      content.classes = []

      await expect(mockApi.createSubmission(attempt.id, content)).rejects.toThrow(
        'At least one class or interface is required',
      )
    })

    it('rejects incomplete class row', async () => {
      const attempt = await mockApi.createAttempt('parking-lot')
      const content = createValidContent()
      content.classes = [
        {
          name: '',
          kind: 'class',
          responsibility: 'Some responsibility',
          keyMethods: ['method1'],
        },
      ]

      await expect(mockApi.createSubmission(attempt.id, content)).rejects.toThrow(
        'Class row 1 is incomplete',
      )
    })

    it('rejects duplicate submissions (idempotency)', async () => {
      const attempt = await mockApi.createAttempt('parking-lot')
      const content = createValidContent()

      const response1 = await mockApi.createSubmission(attempt.id, content)
      await expect(mockApi.createSubmission(attempt.id, content)).rejects.toThrow(
        'This design was already submitted',
      )

      const error = await mockApi
        .createSubmission(attempt.id, content)
        .catch((e) => e)
      expect(error.submissionId).toBe(response1.submissionId)
    })

    it('detects FORCE_FAIL flag in assumptions', async () => {
      const attempt = await mockApi.createAttempt('parking-lot')
      const content = createValidContent()
      content.assumptions = 'FORCE_FAIL - test failure scenario'

      const response = await mockApi.createSubmission(attempt.id, content)
      expect(response.submissionId).toBeTruthy()
    })

    it('detects FORCE_DEGRADED flag in assumptions', async () => {
      const attempt = await mockApi.createAttempt('parking-lot')
      const content = createValidContent()
      content.assumptions = 'FORCE_DEGRADED - test degraded mode'

      const response = await mockApi.createSubmission(attempt.id, content)
      expect(response.submissionId).toBeTruthy()
    })
  })

  describe('getSubmission', () => {
    it('returns submission with SUBMITTED status initially', async () => {
      const attempt = await mockApi.createAttempt('parking-lot')
      const content = createValidContent()
      const { submissionId } = await mockApi.createSubmission(attempt.id, content)

      const submission = await mockApi.getSubmission(submissionId)
      expect(submission.id).toBe(submissionId)
      expect(submission.status).toBe('SUBMITTED')
      expect(submission.evaluation).toBeUndefined()
    })

    it('transitions to EVALUATING after delay', async () => {
      const attempt = await mockApi.createAttempt('parking-lot')
      const content = createValidContent()
      const { submissionId } = await mockApi.createSubmission(attempt.id, content)

      await new Promise((resolve) => setTimeout(resolve, 2100))
      const submission = await mockApi.getSubmission(submissionId)
      expect(submission.status).toBe('EVALUATING')
    })

    it('transitions to COMPLETED with evaluation after longer delay', async () => {
      const attempt = await mockApi.createAttempt('parking-lot')
      const content = createValidContent()
      const { submissionId } = await mockApi.createSubmission(attempt.id, content)

      await new Promise((resolve) => setTimeout(resolve, 4600))
      const submission = await mockApi.getSubmission(submissionId)
      expect(submission.status).toBe('COMPLETED')
      expect(submission.evaluation).toBeDefined()
      expect(submission.evaluation?.results).toBeInstanceOf(Array)
      expect(submission.evaluation?.overallScore).toBeGreaterThan(0)
    }, 10000)

    it('transitions to FAILED with FORCE_FAIL flag', async () => {
      const attempt = await mockApi.createAttempt('parking-lot')
      const content = createValidContent()
      content.assumptions = 'FORCE_FAIL'
      const { submissionId } = await mockApi.createSubmission(attempt.id, content)

      await new Promise((resolve) => setTimeout(resolve, 2600))
      const submission = await mockApi.getSubmission(submissionId)
      expect(submission.status).toBe('FAILED')
      expect(submission.failureReason).toContain('timed out')
    })

    it('returns degraded evaluation with FORCE_DEGRADED flag', async () => {
      const attempt = await mockApi.createAttempt('parking-lot')
      const content = createValidContent()
      content.assumptions = 'FORCE_DEGRADED'
      const { submissionId } = await mockApi.createSubmission(attempt.id, content)

      await new Promise((resolve) => setTimeout(resolve, 4600))
      const submission = await mockApi.getSubmission(submissionId)
      expect(submission.status).toBe('COMPLETED')
      expect(submission.evaluation?.degraded).toBe(true)
      expect(submission.evaluation?.results).toBeInstanceOf(Array)
    }, 10000)

    it('throws 404 for invalid submission id', async () => {
      await expect(mockApi.getSubmission('invalid')).rejects.toThrow('Submission not found')
    })
  })

  describe('retrySubmission', () => {
    it('retries a failed submission', async () => {
      const attempt = await mockApi.createAttempt('parking-lot')
      const content = createValidContent()
      content.assumptions = 'FORCE_FAIL'
      const { submissionId } = await mockApi.createSubmission(attempt.id, content)

      await new Promise((resolve) => setTimeout(resolve, 2600))
      const beforeRetry = await mockApi.getSubmission(submissionId)
      expect(beforeRetry.status).toBe('FAILED')

      const response = await mockApi.retrySubmission(submissionId)
      expect(response.submissionId).toBe(submissionId)
      expect(response.status).toBe('SUBMITTED')

      const afterRetry = await mockApi.getSubmission(submissionId)
      expect(afterRetry.status).toBe('SUBMITTED')
      expect(afterRetry.failureReason).toBeUndefined()
    })

    it('throws 400 for non-failed submission', async () => {
      const attempt = await mockApi.createAttempt('parking-lot')
      const content = createValidContent()
      const { submissionId } = await mockApi.createSubmission(attempt.id, content)

      await expect(mockApi.retrySubmission(submissionId)).rejects.toThrow(
        'Only a failed submission can be retried',
      )
    })

    it('throws 404 for invalid submission id', async () => {
      await expect(mockApi.retrySubmission('invalid')).rejects.toThrow('Submission not found')
    })
  })

  describe('getProgress', () => {
    it('returns empty weak criteria with no completed submissions', async () => {
      const progress = await mockApi.getProgress()
      expect(progress.weakCriteria).toHaveLength(0)
    })

    it('calculates per-criterion averages from completed submissions', async () => {
      const attempt = await mockApi.createAttempt('parking-lot')
      const content = createValidContent()
      const { submissionId } = await mockApi.createSubmission(attempt.id, content)

      await new Promise((resolve) => setTimeout(resolve, 4600))
      await mockApi.getSubmission(submissionId)

      const progress = await mockApi.getProgress()
      expect(progress.weakCriteria).toBeInstanceOf(Array)
      expect(progress.weakCriteria.length).toBeGreaterThan(0)
      expect(progress.weakCriteria[0]).toHaveProperty('criterionId')
      expect(progress.weakCriteria[0]).toHaveProperty('criterion')
      expect(progress.weakCriteria[0]).toHaveProperty('averageScore')
      expect(progress.weakCriteria[0]).toHaveProperty('attempts')
    }, 10000)

    it('sorts weak criteria by average score (lowest first)', async () => {
      const attempt = await mockApi.createAttempt('parking-lot')
      const content = createValidContent()
      const { submissionId } = await mockApi.createSubmission(attempt.id, content)

      await new Promise((resolve) => setTimeout(resolve, 4600))
      await mockApi.getSubmission(submissionId)

      const progress = await mockApi.getProgress()
      if (progress.weakCriteria.length > 1) {
        for (let i = 0; i < progress.weakCriteria.length - 1; i++) {
          expect(progress.weakCriteria[i].averageScore).toBeLessThanOrEqual(
            progress.weakCriteria[i + 1].averageScore,
          )
        }
      }
    }, 10000)

    it('limits weak criteria to top 4', async () => {
      const attempt = await mockApi.createAttempt('parking-lot')
      const content = createValidContent()
      const { submissionId } = await mockApi.createSubmission(attempt.id, content)

      await new Promise((resolve) => setTimeout(resolve, 4600))
      await mockApi.getSubmission(submissionId)

      const progress = await mockApi.getProgress()
      expect(progress.weakCriteria.length).toBeLessThanOrEqual(4)
    }, 10000)
  })
})
