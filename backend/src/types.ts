export type ClassKind = 'class' | 'interface'

export interface DesignClass {
  name: string
  kind: ClassKind
  responsibility: string
  keyMethods: string[]
}

export interface SubmissionContent {
  assumptions: string
  relationships: string
  keyFlow: string
  tradeoffs: string
  classes: DesignClass[]
}

export type SubmissionStatus = 'SUBMITTED' | 'EVALUATING' | 'COMPLETED' | 'FAILED'

export interface Problem {
  id: string
  title: string
  summary: string
  difficulty: string
  requirements: string[]
  assumptions: string[]
  changeRequest: string
}

export interface Attempt {
  id: string
  problemId: string
  number: number
  createdAt: string
}

export interface Submission {
  id: string
  attemptId: string
  content: SubmissionContent
  contentHash: string
  status: SubmissionStatus
  createdAt: string
  evaluatingAt?: string
  completedAt?: string
  failureReason?: string
}

export interface CriterionResult {
  criterionId: string
  criterion: string
  score: number
  evidence: string
  concern: string
  suggestion: string
  confidence: 'high' | 'medium' | 'low'
  source: 'rule' | 'llm'
}

export interface Evaluation {
  overallScore: number
  summary: string
  degraded: boolean
  results: CriterionResult[]
}

export interface SubmissionDetail extends Submission {
  evaluation?: Evaluation
}

export interface AttemptDetail extends Attempt {
  submissions: Array<{ id: string; status: SubmissionStatus; createdAt: string }>
}

export interface AttemptSummary extends Attempt {
  problemTitle: string
  latestStatus: SubmissionStatus | null
  overallScore: number | null
}

export interface WeakCriterion {
  criterionId: string
  criterion: string
  averageScore: number
  attempts: number
}

export interface Progress {
  weakCriteria: WeakCriterion[]
}
