import { describe, it, expect, vi, beforeAll, afterAll, beforeEach, afterEach } from 'vitest'
import type { AddressInfo } from 'node:net'
import type { Server } from 'node:http'
import { createApp } from '../app.js'
import { resetDatabase } from '../database.js'
import { EvaluationService } from '../services/evaluationService.js'
import type { Evaluator } from '../evaluators/evaluator.js'
import { goodDesign, llmResult } from './fixtures.js'

let server: Server
let base: string
let evaluatorImpl: Evaluator['evaluate']

beforeAll(async () => {
  // Delegating evaluator lets each test choose success / failure behaviour.
  const evaluator: Evaluator = { evaluate: (c, r) => evaluatorImpl(c, r) }
  const app = createApp(new EvaluationService(undefined, evaluator))
  await new Promise<void>(resolve => { server = app.listen(0, resolve) })
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`
})
afterAll(() => new Promise<void>(resolve => server.close(() => resolve())))
beforeEach(() => {
  resetDatabase()
  evaluatorImpl = async () => [llmResult('coupling', 3)]
  vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => vi.restoreAllMocks())

async function call(method: string, path: string, body?: unknown) {
  const res = await fetch(base + path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  return { status: res.status, body: await res.json() as any }
}

async function waitForTerminal(id: string) {
  for (let i = 0; i < 50; i++) {
    const { body } = await call('GET', `/submissions/${id}`)
    if (body.status === 'COMPLETED' || body.status === 'FAILED') return body
    await new Promise(r => setTimeout(r, 10))
  }
  throw new Error('submission never reached a terminal state')
}

async function startAttempt(problemId = 'parking-lot') {
  return (await call('POST', '/attempts', { problemId })).body
}

describe('problems', () => {
  it('lists the four seeded problems without full requirements', async () => {
    const { status, body } = await call('GET', '/problems')
    expect(status).toBe(200)
    expect(body.map((p: any) => p.id).sort()).toEqual(['elevator', 'lru-cache', 'parking-lot', 'vending-machine'])
    expect(body[0].requirements).toBeUndefined()
  })

  it('returns full detail including requirements and a change request', async () => {
    const { body } = await call('GET', '/problems/parking-lot')
    expect(body.requirements.length).toBeGreaterThan(0)
    expect(body.changeRequest).toBeTruthy()
  })

  it('404s for an unknown problem', async () => {
    expect((await call('GET', '/problems/nope')).status).toBe(404)
  })
})

describe('attempts', () => {
  it('numbers attempts per problem and keeps them independent across problems', async () => {
    expect((await startAttempt('parking-lot')).number).toBe(1)
    expect((await startAttempt('parking-lot')).number).toBe(2)
    expect((await startAttempt('elevator')).number).toBe(1)
  })

  it('rejects a missing or invalid problemId', async () => {
    expect((await call('POST', '/attempts', {})).status).toBe(400)
    expect((await call('POST', '/attempts', { problemId: 'nope' })).status).toBe(400)
  })

  it('404s for an unknown attempt', async () => {
    expect((await call('GET', '/attempts/nope')).status).toBe(404)
  })
})

describe('submissions: happy path', () => {
  it('runs the full loop: attempt -> submit -> evaluate -> history shows the score', async () => {
    const attempt = await startAttempt()
    const created = await call('POST', '/submissions', { attemptId: attempt.id, content: goodDesign() })
    expect(created.status).toBe(201)
    expect(created.body.status).toBe('SUBMITTED')

    const done = await waitForTerminal(created.body.submissionId)
    expect(done.status).toBe('COMPLETED')
    expect(done.evaluation.results.length).toBeGreaterThan(0)

    const history = (await call('GET', '/attempts')).body
    expect(history).toHaveLength(1)
    expect(history[0]).toMatchObject({ problemTitle: 'Parking Lot', latestStatus: 'COMPLETED' })
    expect(history[0].overallScore).toBeGreaterThan(0)

    const detail = (await call('GET', `/attempts/${attempt.id}`)).body
    expect(detail.submissions).toHaveLength(1)
  })

  it('keeps a legitimate 0 score in attempt history (not null)', async () => {
    // Evaluator returning nothing valid -> overallScore 0 on a COMPLETED submission.
    evaluatorImpl = async () => []
    const attempt = await startAttempt()
    const { body } = await call('POST', '/submissions', { attemptId: attempt.id, content: goodDesign() })
    await waitForTerminal(body.submissionId)

    const history = (await call('GET', '/attempts')).body
    expect(history[0].latestStatus).toBe('COMPLETED')
    expect(history[0].overallScore).toBe(0)
  })

  it('reports recurring weak criteria in progress', async () => {
    evaluatorImpl = async () => [llmResult('coupling', 1)]
    const attempt = await startAttempt()
    const { body } = await call('POST', '/submissions', { attemptId: attempt.id, content: goodDesign() })
    await waitForTerminal(body.submissionId)

    const progress = (await call('GET', '/progress')).body
    expect(progress.weakCriteria[0]).toMatchObject({ criterionId: 'coupling', averageScore: 1 })
  })
})

describe('submissions: validation and edge cases', () => {
  it('400s when attemptId or content is missing', async () => {
    expect((await call('POST', '/submissions', { content: goodDesign() })).status).toBe(400)
    const attempt = await startAttempt()
    expect((await call('POST', '/submissions', { attemptId: attempt.id })).status).toBe(400)
  })

  it('404s when the attempt does not exist (no orphan submissions)', async () => {
    const res = await call('POST', '/submissions', { attemptId: 'ghost', content: goodDesign() })
    expect(res.status).toBe(404)
  })

  it('400s with every missing section named', async () => {
    const attempt = await startAttempt()
    const res = await call('POST', '/submissions', {
      attemptId: attempt.id,
      content: goodDesign({ assumptions: '', tradeoffs: '  ', classes: [] }),
    })
    expect(res.status).toBe(400)
    expect(res.body.error).toContain('Assumptions')
    expect(res.body.error).toContain('Trade-offs')
    expect(res.body.error).toContain('class')
  })

  it('400s on an incomplete class row', async () => {
    const attempt = await startAttempt()
    const res = await call('POST', '/submissions', {
      attemptId: attempt.id,
      content: goodDesign({ classes: [{ name: 'A', kind: 'class', responsibility: '', keyMethods: [] }] }),
    })
    expect(res.status).toBe(400)
    expect(res.body.error).toContain('Class row 1')
  })

  it('409s on an identical resubmission to the same attempt (idempotency)', async () => {
    const attempt = await startAttempt()
    await call('POST', '/submissions', { attemptId: attempt.id, content: goodDesign() })
    const again = await call('POST', '/submissions', { attemptId: attempt.id, content: goodDesign() })
    expect(again.status).toBe(409)
  })

  it('allows the same design in a different attempt', async () => {
    const a1 = await startAttempt()
    const a2 = await startAttempt()
    expect((await call('POST', '/submissions', { attemptId: a1.id, content: goodDesign() })).status).toBe(201)
    expect((await call('POST', '/submissions', { attemptId: a2.id, content: goodDesign() })).status).toBe(201)
  })

  it('allows a revised design in the same attempt', async () => {
    const attempt = await startAttempt()
    await call('POST', '/submissions', { attemptId: attempt.id, content: goodDesign() })
    const revised = goodDesign({ tradeoffs: 'Revised trade-offs.' })
    expect((await call('POST', '/submissions', { attemptId: attempt.id, content: revised })).status).toBe(201)
  })

  it('404s for an unknown submission', async () => {
    expect((await call('GET', '/submissions/nope')).status).toBe(404)
  })
})

describe('submissions: size limits', () => {
  it('400s when a text field exceeds 5000 characters', async () => {
    const attempt = await startAttempt()
    const res = await call('POST', '/submissions', {
      attemptId: attempt.id,
      content: goodDesign({ assumptions: 'x'.repeat(5001) }),
    })
    expect(res.status).toBe(400)
    expect(res.body.error).toContain('Assumptions must be at most 5000')
  })

  it('400s when there are more than 30 classes', async () => {
    const attempt = await startAttempt()
    const classes = Array.from({ length: 31 }, (_, i) => ({
      name: `C${i}`, kind: 'class' as const, responsibility: 'does things', keyMethods: ['run'],
    }))
    const res = await call('POST', '/submissions', { attemptId: attempt.id, content: goodDesign({ classes }) })
    expect(res.status).toBe(400)
    expect(res.body.error).toContain('At most 30 classes')
  })

  it('400s when a class name or method is too long', async () => {
    const attempt = await startAttempt()
    const res = await call('POST', '/submissions', {
      attemptId: attempt.id,
      content: goodDesign({ classes: [{
        name: 'N'.repeat(121), kind: 'class', responsibility: 'ok', keyMethods: ['m'.repeat(121)],
      }] }),
    })
    expect(res.status).toBe(400)
    expect(res.body.error).toContain('name must be at most 120')
    expect(res.body.error).toContain('method 1 must be at most 120')
  })

  it('accepts content exactly at the limits', async () => {
    const attempt = await startAttempt()
    const classes = Array.from({ length: 30 }, (_, i) => ({
      name: `C${i}`, kind: 'class' as const, responsibility: 'x'.repeat(1000), keyMethods: ['m'.repeat(120)],
    }))
    const res = await call('POST', '/submissions', {
      attemptId: attempt.id,
      content: goodDesign({ assumptions: 'x'.repeat(5000), classes }),
    })
    expect(res.status).toBe(201)
  })
})

describe('submissions: failure and retry', () => {
  it('surfaces FAILED with a reason and no evaluation, and history reflects it', async () => {
    evaluatorImpl = async () => { throw new Error('model unavailable') }
    const attempt = await startAttempt()
    const { body } = await call('POST', '/submissions', { attemptId: attempt.id, content: goodDesign() })
    const failed = await waitForTerminal(body.submissionId)

    expect(failed.status).toBe('FAILED')
    expect(failed.failureReason).toBe('model unavailable')
    expect(failed.evaluation).toBeUndefined()

    const history = (await call('GET', '/attempts')).body
    expect(history[0]).toMatchObject({ latestStatus: 'FAILED', overallScore: null })
  })

  it('retries a FAILED submission, clears the old failure reason, and completes', async () => {
    evaluatorImpl = async () => { throw new Error('flaky') }
    const attempt = await startAttempt()
    const { body } = await call('POST', '/submissions', { attemptId: attempt.id, content: goodDesign() })
    await waitForTerminal(body.submissionId)

    evaluatorImpl = async () => [llmResult('coupling', 3)]
    const retry = await call('POST', `/submissions/${body.submissionId}/retry`)
    expect(retry.status).toBe(200)

    const done = await waitForTerminal(body.submissionId)
    expect(done.status).toBe('COMPLETED')
    expect(done.failureReason).toBeUndefined()
  })

  it('refuses to retry a submission that is not FAILED', async () => {
    const attempt = await startAttempt()
    const { body } = await call('POST', '/submissions', { attemptId: attempt.id, content: goodDesign() })
    await waitForTerminal(body.submissionId)
    expect((await call('POST', `/submissions/${body.submissionId}/retry`)).status).toBe(400)
  })

  it('404s when retrying an unknown submission', async () => {
    expect((await call('POST', '/submissions/nope/retry')).status).toBe(404)
  })
})

describe('health', () => {
  it('reports ok', async () => {
    expect((await call('GET', '/health')).body.status).toBe('ok')
  })
})
