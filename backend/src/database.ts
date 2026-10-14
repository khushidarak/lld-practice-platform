import type { Problem, Attempt, Submission, Evaluation } from './types.js'

// In-memory storage (simple, no native dependencies)
const problems: Map<string, Problem> = new Map()
const attempts: Map<string, Attempt> = new Map()
const submissions: Map<string, Submission> = new Map()
const evaluations: Map<string, Evaluation> = new Map()

export function initDatabase(): void {
  if (problems.size === 0) {
    seedProblems()
  }
}

function seedProblems(): void {
  const problemList: Problem[] = [
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
      changeRequest: 'Add electric-vehicle charging spots and a daily-max cap on hourly fees.',
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
      changeRequest: 'Add peak-hour scheduling and an express car that skips lower floors.',
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
      changeRequest: 'Add card payments and a low-stock alert for the operator.',
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
      changeRequest: 'Add TTL-based eviction and safe concurrent access from multiple threads.',
    },
  ]

  for (const problem of problemList) {
    problems.set(problem.id, problem)
  }
}

/** Clears all data and reseeds problems. Used by tests. */
export function resetDatabase(): void {
  problems.clear()
  attempts.clear()
  submissions.clear()
  evaluations.clear()
  seedProblems()
}

export { problems, attempts, submissions, evaluations }
