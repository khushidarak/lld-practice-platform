import type {
  Attempt,
  AttemptDetail,
  AttemptSummary,
  CreateSubmissionResponse,
  DesignClass,
  Evaluation,
  ProblemDetail,
  ProblemSummary,
  Progress,
  SubmissionContent,
  SubmissionDetail,
  SubmissionStatus,
} from '../types'
import { ApiError } from './errors'

const STORAGE_KEY = 'lld-mock-db'

type StoredSubmission = {
  id: string
  attemptId: string
  content: SubmissionContent
  contentHash: string
  status: SubmissionStatus
  createdAt: string
  evaluatingAt?: string
  completedAt?: string
  failureReason?: string
  evaluation?: Evaluation
  forceFail: boolean
  forceDegraded: boolean
}

type StoredAttempt = {
  id: string
  problemId: string
  number: number
  createdAt: string
}

type MockDb = {
  attempts: StoredAttempt[]
  submissions: StoredSubmission[]
}

const PROBLEMS: ProblemDetail[] = [
  {
    id: 'parking-lot',
    title: 'Parking Lot',
    summary: 'Model spots, tickets, and billing for a multi-floor garage.',
    difficulty: 'Easy',
    requirements: [
      'Support multiple floors and spot sizes (motorcycle, compact, large).',
      'Issue a ticket on park and free the spot on unpark.',
      'Calculate fees from entry time and spot type.',
      'Find an available spot that fits the vehicle.',
    ],
    assumptions: [
      'One vehicle occupies one spot.',
      'Payment happens at exit.',
      'The garage does not overbook spots.',
    ],
    changeRequest:
      'Add electric-vehicle charging spots and a daily-max cap on hourly fees.',
  },
  {
    id: 'elevator',
    title: 'Elevator',
    summary: 'Dispatch cars across floors with hall and cabin requests.',
    difficulty: 'Medium',
    requirements: [
      'Handle hall calls (up/down) and cabin floor selections.',
      'Move cars between floors and open/close doors.',
      'Serve requests without stranding a waiting passenger.',
      'Support more than one elevator in a bank.',
    ],
    assumptions: [
      'Floors are numbered consecutively.',
      'A car serves one direction of travel before reversing.',
      'Door timing is simplified to a single open/close step.',
    ],
    changeRequest:
      'Add peak-hour scheduling and an express car that skips lower floors.',
  },
  {
    id: 'vending-machine',
    title: 'Vending Machine',
    summary: 'Select items, take payment, and dispense with inventory tracking.',
    difficulty: 'Easy',
    requirements: [
      'Display available items and prices.',
      'Accept cash, make change, and reject invalid selections.',
      'Dispense only when stock and payment are sufficient.',
      'Allow an operator to restock and collect cash.',
    ],
    assumptions: [
      'One item is vended per transaction.',
      'Prices are in whole currency units.',
      'The machine is offline (no remote inventory).',
    ],
    changeRequest:
      'Add card payments and a low-stock alert for the operator.',
  },
  {
    id: 'lru-cache',
    title: 'LRU Cache',
    summary: 'Design a fixed-capacity cache with O(1) get and put.',
    difficulty: 'Medium',
    requirements: [
      'Get returns the value and marks the key as most recently used.',
      'Put inserts or updates a key and evicts the least recently used item when full.',
      'Capacity is fixed at construction.',
      'Operations should be constant time.',
    ],
    assumptions: [
      'Keys and values are in-memory.',
      'Capacity is at least 1.',
      'A single-threaded caller in the MVP.',
    ],
    changeRequest:
      'Add TTL-based eviction and safe concurrent access from multiple threads.',
  },
]

const CANNED_EVALUATION: Evaluation = {
  overallScore: 2.8,
  summary:
    'The design names clear types and a main flow, but trade-offs and the change request are only sketched. Tighten module boundaries and say what you would extend first.',
  degraded: false,
  results: [
    {
      criterionId: 'sections-present',
      criterion: 'Required sections present',
      score: 4,
      evidence: 'Assumptions, classes, relationships, key flow, and trade-offs are all filled in.',
      concern: '',
      suggestion: 'Keep this structure on the next attempt so judgement criteria have enough evidence.',
      confidence: 'high',
      source: 'rule',
    },
    {
      criterionId: 'responsibilities',
      criterion: 'Responsibility assignment',
      score: 3,
      evidence: 'Each class states a responsibility, e.g. a dedicated type for the main use case.',
      concern: 'A couple of types still mix coordination with storage.',
      suggestion: 'Split orchestration from the thing it coordinates so each class has one reason to change.',
      confidence: 'medium',
      source: 'llm',
    },
    {
      criterionId: 'coupling',
      criterion: 'Coupling and cohesion',
      score: 2,
      evidence: 'Relationships mention several concrete classes depending on each other by name.',
      concern: 'High-level flow types appear to know about low-level details.',
      suggestion: 'Depend on interfaces for the pieces that will change with the change request.',
      confidence: 'medium',
      source: 'llm',
    },
    {
      criterionId: 'requirement-coverage',
      criterion: 'Requirement coverage',
      score: 3,
      evidence: 'The key flow and class list mention the main verbs from the problem statement.',
      concern: 'One listed requirement is only implied, not named.',
      suggestion: 'Echo each requirement in assumptions or the flow so coverage is obvious.',
      confidence: 'low',
      source: 'rule',
    },
    {
      criterionId: 'tradeoffs',
      criterion: 'Trade-off reasoning',
      score: 2,
      evidence: 'The trade-offs section names at least one alternative.',
      concern: 'The cost of the chosen option is not spelled out.',
      suggestion: 'For each choice, say what you gave up and when you would reverse it.',
      confidence: 'medium',
      source: 'llm',
    },
    {
      criterionId: 'extensibility',
      criterion: 'Extensibility versus the change request',
      score: 2,
      evidence: 'Extension points are mentioned in general terms.',
      concern: 'The write-up does not map the change request onto a specific type or hook.',
      suggestion: 'Name the class you would open first to absorb the change request, and why others stay closed.',
      confidence: 'medium',
      source: 'llm',
    },
  ],
}

function nowIso(): string {
  return new Date().toISOString()
}

function loadDb(): MockDb {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw) as MockDb
  } catch {
    /* ignore */
  }
  return { attempts: [], submissions: [] }
}

function saveDb(db: MockDb): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(db))
}

function hashContent(content: SubmissionContent): string {
  return JSON.stringify(content)
}

function delay(ms = 180): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function validateContent(content: SubmissionContent): void {
  const errors: string[] = []
  if (!content.assumptions?.trim()) errors.push('Assumptions are required.')
  if (!content.relationships?.trim()) errors.push('Relationships are required.')
  if (!content.keyFlow?.trim()) errors.push('Key flow is required.')
  if (!content.tradeoffs?.trim()) errors.push('Trade-offs are required.')
  if (!content.classes?.length) errors.push('At least one class or interface is required.')
  content.classes?.forEach((row: DesignClass, index: number) => {
    if (!row.name?.trim() || !row.responsibility?.trim() || !row.keyMethods?.length) {
      errors.push(`Class row ${index + 1} is incomplete.`)
    }
  })
  if (errors.length) {
    throw new ApiError(400, errors.join(' '), { error: errors.join(' '), errors })
  }
}

function advanceSubmission(sub: StoredSubmission): StoredSubmission {
  const created = new Date(sub.createdAt).getTime()
  const elapsed = Date.now() - created

  if (sub.status === 'COMPLETED' || sub.status === 'FAILED') return sub

  if (sub.forceFail && elapsed > 2500) {
    return {
      ...sub,
      status: 'FAILED',
      failureReason: 'The evaluator timed out while calling the language model.',
    }
  }

  if (elapsed > 4500) {
    const evaluation = sub.forceDegraded
      ? {
          ...CANNED_EVALUATION,
          degraded: true,
          summary:
            'Rule checks finished. Judgement criteria were skipped because the AI evaluator was unavailable.',
          results: CANNED_EVALUATION.results.filter((r) => r.source === 'rule'),
        }
      : CANNED_EVALUATION
    return {
      ...sub,
      status: 'COMPLETED',
      completedAt: sub.completedAt ?? nowIso(),
      evaluation,
    }
  }

  if (elapsed > 2000) {
    return { ...sub, status: 'EVALUATING', evaluatingAt: sub.evaluatingAt ?? nowIso() }
  }

  return sub
}

function latestForAttempt(db: MockDb, attemptId: string): StoredSubmission | undefined {
  return db.submissions
    .filter((s) => s.attemptId === attemptId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]
}

export const mockApi = {
  async listProblems(): Promise<ProblemSummary[]> {
    await delay()
    return PROBLEMS.map(({ id, title, summary, difficulty }) => ({
      id,
      title,
      summary,
      difficulty,
    }))
  },

  async getProblem(id: string): Promise<ProblemDetail> {
    await delay()
    const problem = PROBLEMS.find((p) => p.id === id)
    if (!problem) throw new ApiError(404, 'Problem not found.')
    return problem
  },

  async createAttempt(problemId: string): Promise<Attempt> {
    await delay()
    if (!PROBLEMS.some((p) => p.id === problemId)) {
      throw new ApiError(400, 'Unknown problemId.')
    }
    const db = loadDb()
    const number = db.attempts.filter((a) => a.problemId === problemId).length + 1
    const attempt: StoredAttempt = {
      id: crypto.randomUUID(),
      problemId,
      number,
      createdAt: nowIso(),
    }
    db.attempts.push(attempt)
    saveDb(db)
    return attempt
  },

  async listAttempts(): Promise<AttemptSummary[]> {
    await delay()
    const db = loadDb()
    return [...db.attempts]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((attempt) => {
        const latest = latestForAttempt(db, attempt.id)
        const advanced = latest ? advanceSubmission(latest) : undefined
        const problem = PROBLEMS.find((p) => p.id === attempt.problemId)
        return {
          id: attempt.id,
          problemId: attempt.problemId,
          problemTitle: problem?.title ?? attempt.problemId,
          number: attempt.number,
          createdAt: attempt.createdAt,
          latestStatus: advanced?.status ?? null,
          overallScore:
            advanced?.status === 'COMPLETED'
              ? (advanced.evaluation?.overallScore ?? null)
              : null,
        }
      })
  },

  async getAttempt(id: string): Promise<AttemptDetail> {
    await delay()
    const db = loadDb()
    const attempt = db.attempts.find((a) => a.id === id)
    if (!attempt) throw new ApiError(404, 'Attempt not found.')
    const submissions = db.submissions
      .filter((s) => s.attemptId === id)
      .map((s) => {
        const advanced = advanceSubmission(s)
        return { id: advanced.id, status: advanced.status, createdAt: advanced.createdAt }
      })
    return {
      id: attempt.id,
      problemId: attempt.problemId,
      number: attempt.number,
      submissions,
    }
  },

  async createSubmission(
    attemptId: string,
    content: SubmissionContent,
  ): Promise<CreateSubmissionResponse> {
    await delay()
    validateContent(content)
    const db = loadDb()
    const attempt = db.attempts.find((a) => a.id === attemptId)
    if (!attempt) throw new ApiError(404, 'Attempt not found.')

    const contentHash = hashContent(content)
    const duplicate = db.submissions.find(
      (s) => s.attemptId === attemptId && s.contentHash === contentHash,
    )
    if (duplicate) {
      throw new ApiError(409, 'This design was already submitted.', {
        error: 'This design was already submitted.',
        submissionId: duplicate.id,
      })
    }

    const forceFail = /FORCE_FAIL/i.test(content.assumptions)
    const forceDegraded = /FORCE_DEGRADED/i.test(content.assumptions)
    const sub: StoredSubmission = {
      id: crypto.randomUUID(),
      attemptId,
      content,
      contentHash,
      status: 'SUBMITTED',
      createdAt: nowIso(),
      forceFail,
      forceDegraded,
    }
    db.submissions.push(sub)
    saveDb(db)
    return { submissionId: sub.id, status: sub.status }
  },

  async getSubmission(id: string): Promise<SubmissionDetail> {
    await delay(80)
    const db = loadDb()
    const index = db.submissions.findIndex((s) => s.id === id)
    if (index < 0) throw new ApiError(404, 'Submission not found.')
    const advanced = advanceSubmission(db.submissions[index])
    db.submissions[index] = advanced
    saveDb(db)
    return {
      id: advanced.id,
      status: advanced.status,
      failureReason: advanced.failureReason,
      evaluation: advanced.evaluation,
    }
  },

  async retrySubmission(id: string): Promise<CreateSubmissionResponse> {
    await delay()
    const db = loadDb()
    const index = db.submissions.findIndex((s) => s.id === id)
    if (index < 0) throw new ApiError(404, 'Submission not found.')
    const current = db.submissions[index]
    if (current.status !== 'FAILED') {
      throw new ApiError(400, 'Only a failed submission can be retried.')
    }
    db.submissions[index] = {
      ...current,
      status: 'SUBMITTED',
      createdAt: nowIso(),
      failureReason: undefined,
      evaluatingAt: undefined,
      completedAt: undefined,
      forceFail: false,
    }
    saveDb(db)
    return { submissionId: id, status: 'SUBMITTED' }
  },

  async getProgress(): Promise<Progress> {
    await delay()
    const db = loadDb()
    const totals = new Map<
      string,
      { criterion: string; sum: number; attempts: number }
    >()

    for (const sub of db.submissions) {
      const advanced = advanceSubmission(sub)
      if (advanced.status !== 'COMPLETED' || !advanced.evaluation) continue
      for (const result of advanced.evaluation.results) {
        const prev = totals.get(result.criterionId) ?? {
          criterion: result.criterion,
          sum: 0,
          attempts: 0,
        }
        prev.sum += result.score
        prev.attempts += 1
        totals.set(result.criterionId, prev)
      }
    }

    const weakCriteria = [...totals.entries()]
      .map(([criterionId, value]) => ({
        criterionId,
        criterion: value.criterion,
        averageScore: Math.round((value.sum / value.attempts) * 10) / 10,
        attempts: value.attempts,
      }))
      .sort((a, b) => a.averageScore - b.averageScore)
      .slice(0, 4)

    return { weakCriteria }
  },
}
