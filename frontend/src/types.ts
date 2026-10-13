export type Difficulty = string

export type SubmissionStatus =
  | 'SUBMITTED'
  | 'EVALUATING'
  | 'COMPLETED'
  | 'FAILED'

export type ClassKind = 'class' | 'interface'

export type Confidence = 'low' | 'medium' | 'high'

export type CriterionSource = 'rule' | 'llm'

export type ProblemSummary = {
  id: string
  title: string
  summary: string
  difficulty: Difficulty
}

export type ProblemDetail = {
  id: string
  title: string
  summary: string
  difficulty: Difficulty
  requirements: string[]
  assumptions: string[]
  changeRequest: string
}

export type Attempt = {
  id: string
  problemId: string
  number: number
  createdAt: string
}

export type AttemptSummary = {
  id: string
  problemId: string
  problemTitle: string
  number: number
  createdAt: string
  latestStatus: SubmissionStatus | null
  overallScore: number | null
}

export type AttemptSubmissionRef = {
  id: string
  status: SubmissionStatus
  createdAt: string
}

export type AttemptDetail = {
  id: string
  problemId: string
  number: number
  submissions: AttemptSubmissionRef[]
}

export type DesignClass = {
  name: string
  kind: ClassKind
  responsibility: string
  keyMethods: string[]
}

export type SubmissionContent = {
  assumptions: string
  classes: DesignClass[]
  relationships: string
  keyFlow: string
  tradeoffs: string
}

export type CreateSubmissionResponse = {
  submissionId: string
  status: SubmissionStatus
}

export type CriterionResult = {
  criterionId: string
  criterion: string
  score: number
  evidence: string
  concern: string
  suggestion: string
  confidence: Confidence
  source: CriterionSource
}

export type Evaluation = {
  overallScore: number
  summary: string
  degraded: boolean
  results: CriterionResult[]
}

export type SubmissionDetail = {
  id: string
  status: SubmissionStatus
  failureReason?: string
  evaluation?: Evaluation
}

export type WeakCriterion = {
  criterionId: string
  criterion: string
  averageScore: number
  attempts: number
}

export type Progress = {
  weakCriteria: WeakCriterion[]
}

export type ApiErrorBody = {
  error?: string
  message?: string
  submissionId?: string
  errors?: Record<string, string> | string[]
}
