import type { SubmissionContent, CriterionResult } from '../src/types.js'

export const REQUIREMENTS = [
  'Support multiple floors and spot sizes.',
  'Issue a ticket on park and free the spot on unpark.',
  'Calculate fees from entry time and spot type.',
]

export function goodDesign(overrides: Partial<SubmissionContent> = {}): SubmissionContent {
  return {
    assumptions: 'Multiple floors with different spot sizes. Ticket issued at entry; fees calculated from entry time.',
    relationships: 'ParkingLot has many Floors; Floor has many Spots; Ticket references a Spot.',
    keyFlow: 'Vehicle arrives, lot finds a spot, issues a ticket, and frees the spot on unpark.',
    tradeoffs: 'FeePolicy is an interface so pricing can change without touching ParkingLot.',
    classes: [
      { name: 'ParkingLot', kind: 'class', responsibility: 'Coordinates floors and spot allocation', keyMethods: ['park', 'unpark'] },
      { name: 'FeePolicy', kind: 'interface', responsibility: 'Calculates the fee from a ticket', keyMethods: ['calculate'] },
    ],
    ...overrides,
  }
}

export function llmResult(id: string, score = 3): CriterionResult {
  return {
    criterionId: id,
    criterion: id,
    score,
    evidence: 'quote',
    concern: '',
    suggestion: 'ok',
    confidence: 'high',
    source: 'llm',
  }
}
